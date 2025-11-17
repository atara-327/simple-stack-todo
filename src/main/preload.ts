import { contextBridge, ipcRenderer } from "electron";
import type { Todo } from "./main";

contextBridge.exposeInMainWorld("todoApi", {
  loadTodos: () => ipcRenderer.invoke("todos:load") as Promise<Todo[]>,
  saveTodos: (todos: Todo[]) => ipcRenderer.invoke("todos:save", todos) as Promise<Todo[]>
});

export type PreloadTodoApi = {
  loadTodos: () => Promise<Todo[]>;
  saveTodos: (todos: Todo[]) => Promise<Todo[]>;
};
