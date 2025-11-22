import { contextBridge, ipcRenderer } from "electron";
import type { AppData } from "./main";

contextBridge.exposeInMainWorld("todoApi", {
  loadTodos: () => ipcRenderer.invoke("todos:load") as Promise<AppData>,
  saveTodos: (data: AppData) => ipcRenderer.invoke("todos:save", data) as Promise<AppData>
});

export type PreloadTodoApi = {
  loadTodos: () => Promise<AppData>;
  saveTodos: (data: AppData) => Promise<AppData>;
};
