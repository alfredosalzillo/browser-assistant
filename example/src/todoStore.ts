export type Todo = {
  id: number;
  title: string;
  done: boolean;
};

type Listener = () => void;

export type TodoStore = ReturnType<typeof createTodoStore>;

/**
 * createTodoStore creates a tiny external store, shared by the React UI and the assistant tools.
 */
export const createTodoStore = (initialTitles: string[] = []) => {
  let nextId = 1;
  let todos: Todo[] = initialTitles.map((title) => ({
    id: nextId++,
    title,
    done: false,
  }));
  const listeners = new Set<Listener>();

  const set = (next: Todo[]) => {
    todos = next;
    for (const listener of listeners) listener();
  };

  const find = (id: number) => {
    const todo = todos.find((item) => item.id === id);
    if (!todo) throw new Error(`Todo ${id} not found`);
    return todo;
  };

  return {
    getSnapshot: () => todos,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add: (title: string) => {
      const todo = { id: nextId++, title, done: false };
      set([...todos, todo]);
      return todo;
    },
    toggle: (id: number, done?: boolean) => {
      const todo = { ...find(id) };
      todo.done = done ?? !todo.done;
      set(todos.map((item) => (item.id === id ? todo : item)));
      return todo;
    },
    remove: (id: number) => {
      const todo = find(id);
      set(todos.filter((item) => item.id !== id));
      return todo;
    },
    clearCompleted: () => {
      const removed = todos.filter((item) => item.done);
      set(todos.filter((item) => !item.done));
      return { removed: removed.length };
    },
  };
};
