import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppData, Category, Todo } from "../main/main";

type UndoAction =
  | { type: "create"; id: string; categoryId: string }
  | { type: "complete"; todo: Todo; index: number; categoryId: string };

const MAX_UNDO = 20;

const DEFAULT_CATEGORY_ID = "default";

const partitionTodos = (list: Todo[]) => {
  const active: Todo[] = [];
  const completed: Todo[] = [];
  list.forEach((todo) => {
    if (todo.completedAt) completed.push(todo);
    else active.push(todo);
  });
  return { active, completed };
};

const makeTodo = (title: string, categoryId: string): Todo => ({
  id: crypto.randomUUID(),
  title: title.trim(),
  createdAt: new Date().toISOString(),
  completedAt: null,
  categoryId
});

const isBlank = (value: string) => value.trim().length === 0;

const splitByCategory = (list: Todo[], categoryId: string) => {
  const current = list.filter((t) => t.categoryId === categoryId);
  const others = list.filter((t) => t.categoryId !== categoryId);
  const { active, completed } = partitionTodos(current);
  return { active, completed, others };
};

export const App = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<Category[]>([{ id: DEFAULT_CATEGORY_ID, name: "default" }]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(DEFAULT_CATEGORY_ID);
  const [input, setInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const loaded = await window.todoApi.loadTodos();
      const data: AppData = Array.isArray((loaded as any)?.todos)
        ? (loaded as AppData)
        : {
            categories: [{ id: DEFAULT_CATEGORY_ID, name: "default" }],
            todos: [],
            lastCategoryId: DEFAULT_CATEGORY_ID
          };
      const sanitizedCategories =
        data.categories.length > 0 ? data.categories : [{ id: DEFAULT_CATEGORY_ID, name: "default" }];
      const selected =
        data.lastCategoryId && sanitizedCategories.some((c) => c.id === data.lastCategoryId)
          ? data.lastCategoryId
          : sanitizedCategories[0].id;
      setCategories(sanitizedCategories);
      setSelectedCategoryId(selected);
      setTodos(Array.isArray(data.todos) ? data.todos : []);
      setLoading(false);
    };
    bootstrap();
  }, []);

  const persist = useCallback(
    (nextTodos: Todo[], nextCategories?: Category[], nextSelectedId?: string) => {
      const categoriesForSave = nextCategories ?? categories;
      const selected = nextSelectedId ?? selectedCategoryId ?? categoriesForSave[0]?.id ?? DEFAULT_CATEGORY_ID;
      window.todoApi
        .saveTodos({ categories: categoriesForSave, todos: nextTodos, lastCategoryId: selected })
        .catch((err) => console.warn("[todos] save failed", err));
    },
    [categories, selectedCategoryId]
  );

  const currentCategoryId = useMemo(() => {
    if (selectedCategoryId && categories.some((c) => c.id === selectedCategoryId)) return selectedCategoryId;
    return categories[0]?.id ?? DEFAULT_CATEGORY_ID;
  }, [categories, selectedCategoryId]);

  const { active: activeTodos } = useMemo(
    () => partitionTodos(todos.filter((t) => t.categoryId === currentCategoryId)),
    [todos, currentCategoryId]
  );

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), action]);
  }, []);

  const addTodo = useCallback(
    (title: string) => {
      if (isBlank(title)) return;
      const nextTodo = makeTodo(title, currentCategoryId);
      setTodos((prev) => {
        const { active, completed, others } = splitByCategory(prev, currentCategoryId);
        const updatedSelected = [nextTodo, ...active, ...completed];
        const next = [...updatedSelected, ...others];
        persist(next);
        return next;
      });
      pushUndo({ type: "create", id: nextTodo.id, categoryId: currentCategoryId });
      setInput("");
    },
    [persist, pushUndo, currentCategoryId]
  );

  const completeTodo = useCallback(
    (id: string) => {
      setCompletingId(id);
      setTimeout(() => {
        setTodos((prev) => {
          const { active, completed, others } = splitByCategory(prev, currentCategoryId);
          const index = active.findIndex((t) => t.id === id);
          if (index === -1) return prev;
          const target = active[index];
          const finished: Todo = { ...target, completedAt: new Date().toISOString(), categoryId: currentCategoryId };
          const nextActive = [...active];
          nextActive.splice(index, 1);
          const nextSelected = [...nextActive, ...completed, finished];
          const next = [...nextSelected, ...others];
          persist(next);
          pushUndo({ type: "complete", todo: target, index, categoryId: currentCategoryId });
          return next;
        });
        setCompletingId(null);
      }, 120); // 軽いフェードアウト用の猶予
    },
    [persist, pushUndo, currentCategoryId]
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
        const { active, completed, others } = splitByCategory(prev, currentCategoryId);
        const from = active.findIndex((t) => t.id === sourceId);
        const to = active.findIndex((t) => t.id === targetId);
        if (from < 0 || to < 0) return prev;
        const reordered = [...active];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        const nextSelected = [...reordered, ...completed];
        const next = [...nextSelected, ...others];
        persist(next);
        return next;
      });
    },
    [persist, currentCategoryId]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      const last = prev.at(-1);
      if (!last || last.categoryId !== currentCategoryId) return prev;
      setTodos((current) => {
        let next = current;
        if (last.type === "create") {
          next = current.filter((t) => t.id !== last.id);
        } else {
          const { active, completed, others } = splitByCategory(
            current.filter((t) => t.id !== last.todo.id),
            currentCategoryId
          );
          const restored: Todo = { ...last.todo, completedAt: null };
          const nextActive = [
            ...active.slice(0, last.index),
            restored,
            ...active.slice(last.index)
          ];
          next = [...nextActive, ...completed, ...others];
        }
        persist(next);
        return next;
      });
      return prev.slice(0, -1);
    });
  }, [persist, currentCategoryId]);

  const handleCategoryChange = useCallback(
    (id: string) => {
      setSelectedCategoryId(id);
      setUndoStack([]);
      persist(todos, categories, id);
    },
    [categories, persist, todos]
  );

  const addCategory = useCallback(() => {
    const name = categoryInput.trim();
    if (!name) return;
    const newCategory: Category = { id: crypto.randomUUID(), name };
    const nextCategories = [...categories, newCategory];
    setCategories(nextCategories);
    setSelectedCategoryId(newCategory.id);
    setUndoStack([]);
    persist(todos, nextCategories, newCategory.id);
    setCategoryInput("");
    setIsAddModalOpen(false);
    setIsCategoryMenuOpen(false);
  }, [categoryInput, categories, persist, todos]);

  const deleteCategory = useCallback(
    (targetId: string) => {
    if (categories.length <= 1) return;
      const exists = categories.some((c) => c.id === targetId);
      if (!exists) return;
      const nextCategories = categories.filter((c) => c.id !== targetId);
      const nextTodos = todos.filter((t) => t.categoryId !== targetId);
      const nextSelected =
        nextCategories.some((c) => c.id === selectedCategoryId)
          ? selectedCategoryId
          : nextCategories[0]?.id ?? DEFAULT_CATEGORY_ID;
    setCategories(nextCategories);
    setTodos(nextTodos);
    setSelectedCategoryId(nextSelected);
    setUndoStack([]);
    persist(nextTodos, nextCategories, nextSelected);
    },
    [categories, persist, selectedCategoryId, todos]
  );

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
    <>
      <div className="min-h-screen bg-gray-50 px-5 py-6">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <header className="flex items-center justify-between text-aqua-500">
            <h1 className="text-2xl font-bold">Simple Stack TODO</h1>
          </header>

        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="タスクを入力して Enter"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-lg shadow-sm outline-none transition focus:border-aqua-400 focus:ring-2 focus:ring-aqua-100"
          />
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition hover:bg-gray-50"
            aria-label="カテゴリを選択"
          >
            ☰
          </button>
          <button
            type="submit"
            className="hidden"
            aria-hidden="true"
            aria-label="add todo"
          />

          {isCategoryMenuOpen && (
            <div className="absolute right-0 top-14 z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="max-h-64 overflow-y-auto py-1">
                {categories.map((c) => {
                  const canDelete = categories.length > 1 && c.id !== DEFAULT_CATEGORY_ID;
                  return (
                    <div
                      key={c.id}
                      className={`group flex items-center justify-between px-3 py-2 text-sm transition hover:bg-gray-50 ${
                        c.id === currentCategoryId ? "bg-aqua-50 text-aqua-700" : "text-gray-800"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => {
                          handleCategoryChange(c.id);
                          setIsCategoryMenuOpen(false);
                        }}
                      >
                        {c.name}
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteCategory(c.id)}
                          className="ml-2 opacity-0 transition group-hover:opacity-100"
                          aria-label="カテゴリ削除"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(true);
                  setIsCategoryMenuOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 border-t border-gray-100 px-3 py-2 text-sm font-semibold text-aqua-600 transition hover:bg-aqua-50"
              >
                ＋ カテゴリを追加
              </button>
            </div>
          )}
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

      {isAddModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">カテゴリを追加</h2>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="カテゴリ名"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setCategoryInput("");
                  }}
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={addCategory}
                  className="rounded-md bg-aqua-400 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aqua-500"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
