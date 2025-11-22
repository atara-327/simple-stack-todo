import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import fs from "node:fs/promises";

export type Todo = {
  id: string;
  title: string;
  createdAt: string; // ISO 文字列として保存
  completedAt: string | null;
  categoryId: string;
};

export type Category = {
  id: string;
  name: string;
};

export type AppData = {
  categories: Category[];
  todos: Todo[];
  lastCategoryId?: string;
};

const isDev = !app.isPackaged;
const TODOS_FILE = "todos.json";
const iconPath = isDev
  ? path.join(__dirname, "../../build/icon.png")
  : path.join(process.resourcesPath, "icon.png");
const DEFAULT_CATEGORY: Category = { id: "default", name: "default" };

const getTodosPath = () => path.join(app.getPath("userData"), TODOS_FILE);

const normalizeData = (raw: unknown): AppData => {
  // 旧形式（配列のみ）からの移行: 既存タスクは default カテゴリへ
  if (Array.isArray(raw)) {
    const migrated = (raw as any[]).map((t) => ({
      ...t,
      categoryId: (t as any).categoryId ?? DEFAULT_CATEGORY.id
    })) as Todo[];
    return {
      categories: [DEFAULT_CATEGORY],
      todos: migrated,
      lastCategoryId: DEFAULT_CATEGORY.id
    };
  }

  const fallback: AppData = { categories: [DEFAULT_CATEGORY], todos: [], lastCategoryId: DEFAULT_CATEGORY.id };
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Partial<AppData>;
  const categories =
    Array.isArray(obj.categories) && obj.categories.length > 0 ? obj.categories : [DEFAULT_CATEGORY];
  const categoryIds = new Set(categories.map((c) => c.id));
  const todos = Array.isArray(obj.todos)
    ? (obj.todos as Todo[]).map((t) => ({
        ...t,
        categoryId: t.categoryId && categoryIds.has(t.categoryId) ? t.categoryId : categories[0].id
      }))
    : [];
  const lastCategoryId = obj.lastCategoryId && categoryIds.has(obj.lastCategoryId)
    ? obj.lastCategoryId
    : categories[0].id;

  return { categories, todos, lastCategoryId };
};

// JSON をファイルから読み込む（壊れている場合は初期状態で復旧）
const loadTodosFromDisk = async (): Promise<AppData> => {
  try {
    const filePath = getTodosPath();
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeData(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[todos] Failed to parse JSON. Starting with initial data.", error);
    }
    return normalizeData(null);
  }
};

const saveTodosToDisk = async (data: AppData) => {
  // カテゴリが 0 件にならないようにガード
  const categories = data.categories.length > 0 ? data.categories : [DEFAULT_CATEGORY];
  const categoryIds = new Set(categories.map((c) => c.id));
  const todos = data.todos.map((t) => ({
    ...t,
    categoryId: categoryIds.has(t.categoryId) ? t.categoryId : categories[0].id
  }));
  const lastCategoryId =
    data.lastCategoryId && categoryIds.has(data.lastCategoryId)
      ? data.lastCategoryId
      : categories[0].id;

  const filePath = getTodosPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify({ categories, todos, lastCategoryId }, null, 2),
    "utf-8"
  );
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    title: "Simple Stack TODO",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (isDev) {
    const devServerURL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
    await win.loadURL(devServerURL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    await win.loadFile(indexPath);
  }
};

app.whenReady().then(() => {
  // デフォルトメニューを消してシンプルな見た目に
  Menu.setApplicationMenu(null);

  ipcMain.handle("todos:load", async () => loadTodosFromDisk());

  ipcMain.handle("todos:save", async (_event, data: AppData) => {
    await saveTodosToDisk(data);
    return data;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
