import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Todo } from "../main/main";

type UndoAction =
  | { type: "create"; id: string }
  | { type: "complete"; todo: Todo; index: number };

const MAX_UNDO = 20;

const partitionTodos = (list: Todo[]) => {
  const active: Todo[] = [];
  const completed: Todo[] = [];
  list.forEach((todo) => {
    if (todo.completedAt) completed.push(todo);
    else active.push(todo);
  });
  return { active, completed };
};

const makeTodo = (title: string): Todo => ({
  id: crypto.randomUUID(),
  title: title.trim(),
  createdAt: new Date().toISOString(),
  completedAt: null
});

const isBlank = (value: string) => value.trim().length === 0;

export const App = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const loaded = await window.todoApi.loadTodos();
      setTodos(Array.isArray(loaded) ? loaded : []);
      setLoading(false);
    };
    bootstrap();
  }, []);

  const persist = useCallback((next: Todo[]) => {
    window.todoApi.saveTodos(next).catch((err) => console.warn("[todos] save failed", err));
  }, []);

  const activeTodos = useMemo(() => partitionTodos(todos).active, [todos]);

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), action]);
  }, []);

  const addTodo = useCallback(
    (title: string) => {
      if (isBlank(title)) return;
      const nextTodo = makeTodo(title);
      setTodos((prev) => {
        const { active, completed } = partitionTodos(prev);
        const next = [nextTodo, ...active, ...completed];
        persist(next);
        return next;
      });
      pushUndo({ type: "create", id: nextTodo.id });
      setInput("");
    },
    [persist, pushUndo]
  );

  const completeTodo = useCallback(
    (id: string) => {
      setCompletingId(id);
      setTimeout(() => {
        setTodos((prev) => {
          const { active, completed } = partitionTodos(prev);
          const index = active.findIndex((t) => t.id === id);
          if (index === -1) return prev;
          const target = active[index];
          const finished: Todo = { ...target, completedAt: new Date().toISOString() };
          const nextActive = [...active];
          nextActive.splice(index, 1);
          const next = [...nextActive, ...completed, finished];
          persist(next);
          pushUndo({ type: "complete", todo: target, index });
          return next;
        });
        setCompletingId(null);
      }, 120); // 軽いフェードアウト用の猶予
    },
    [persist, pushUndo]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      addTodo(input);
    },
    [addTodo, input]
  );

  const reorder = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setTodos((prev) => {
        const { active, completed } = partitionTodos(prev);
        const from = active.findIndex((t) => t.id === sourceId);
        const to = active.findIndex((t) => t.id === targetId);
        if (from < 0 || to < 0) return prev;
        const reordered = [...active];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        const next = [...reordered, ...completed];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      const last = prev.at(-1);
      if (!last) return prev;
      setTodos((current) => {
        let next = current;
        if (last.type === "create") {
          next = current.filter((t) => t.id !== last.id);
        } else {
          const { active, completed } = partitionTodos(
            current.filter((t) => t.id !== last.todo.id)
          );
          const restored: Todo = { ...last.todo, completedAt: null };
          const nextActive = [
            ...active.slice(0, last.index),
            restored,
            ...active.slice(last.index)
          ];
          next = [...nextActive, ...completed];
        }
        persist(next);
        return next;
      });
      return prev.slice(0, -1);
    });
  }, [persist]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); // 入力欄の Undo と競合しないようにアプリ側で捕捉
        handleUndo();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleUndo]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="text-3xl font-bold text-aqua-500">Simple Stack TODO</h1>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="タスクを入力して Enter"
            className="w-full rounded-lg border border-aqua-200 bg-white px-4 py-3 text-lg shadow-sm outline-none transition focus:border-aqua-400 focus:ring-2 focus:ring-aqua-100"
          />
          <button
            type="submit"
            className="hidden"
            aria-hidden="true"
            aria-label="add todo"
          />
        </form>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100" aria-label="todo list">
            {activeTodos.length === 0 ? (
              <li className="px-4 py-6 text-center text-gray-400">未完了タスクはありません</li>
            ) : (
              activeTodos.map((todo) => {
                const isDragging = draggingId === todo.id;
                const isDropTarget = dragOverId === todo.id && !isDragging;
                const isCompleting = completingId === todo.id;
                return (
                  <li
                    key={todo.id}
                    role="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(todo.id);
                    }}
                    onDragEnter={() => setDragOverId(todo.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(todo.id);
                    }}
                    onDragLeave={() => setDragOverId((prev) => (prev === todo.id ? null : prev))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingId) reorder(draggingId, todo.id);
                      setDragOverId(null);
                      setDraggingId(null);
                    }}
                    onDragEnd={() => {
                      setDragOverId(null);
                      setDraggingId(null);
                    }}
                    onClick={() => completeTodo(todo.id)}
                    className={`group relative cursor-pointer px-4 py-4 transition duration-150 ease-out ${
                      isCompleting
                        ? "bg-aqua-50/90 border-l-4 border-aqua-300 text-gray-600 scale-[0.98] opacity-70"
                        : ""
                    } ${
                      isDragging
                        ? "bg-white shadow-lg ring-2 ring-aqua-200/80 ring-offset-0"
                        : ""
                    } ${
                      isDropTarget
                        ? "bg-aqua-100/80 outline outline-2 outline-aqua-300"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-gray-300 transition group-hover:text-aqua-400"
                        aria-hidden="true"
                      >
                        ☰
                      </span>
                      <span className="flex-1 text-lg text-gray-800">{todo.title}</span>
                      <span
                        className={`text-aqua-400 transition ${
                          isCompleting ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-50"
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default App;
