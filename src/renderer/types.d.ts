import type { PreloadTodoApi } from "../main/preload";

declare global {
  interface Window {
    todoApi: PreloadTodoApi;
  }
}

export {};
