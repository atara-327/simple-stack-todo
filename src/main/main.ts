import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import fs from "node:fs/promises";

export type Todo = {
  id: string;
  title: string;
  createdAt: string; // ISO 文字列として保存
  completedAt: string | null;
};

const isDev = !app.isPackaged;
const TODOS_FILE = "todos.json";

const getTodosPath = () => path.join(app.getPath("userData"), TODOS_FILE);

// JSON をファイルから読み込む（壊れている場合は空配列で復旧）
const loadTodosFromDisk = async (): Promise<Todo[]> => {
  try {
    const filePath = getTodosPath();
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("[todos] JSON is not array. Starting fresh.");
      return [];
    }
    return parsed as Todo[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[todos] Failed to parse JSON. Starting with empty list.", error);
    }
    return [];
  }
};

const saveTodosToDisk = async (todos: Todo[]) => {
  const filePath = getTodosPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(todos, null, 2), "utf-8");
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    title: "My Stack TODO",
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

  ipcMain.handle("todos:save", async (_event, todos: Todo[]) => {
    await saveTodosToDisk(todos);
    return todos;
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
