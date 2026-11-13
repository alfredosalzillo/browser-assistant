import {
  availability,
  isSupported,
  type LanguageModelAvailability,
} from "browser-assistant";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AssistantPanel, { type AssistantPreset } from "./AssistantPanel";
import { demoLanguageModel } from "./demoLanguageModel";
import { createTodoStore } from "./todoStore";
import { createTodoTools } from "./todoTools";

const presets: AssistantPreset[] = [
  {
    id: "manager",
    label: "Todo manager",
    instructions:
      "You manage the todo list of the user. Read the list with listTodos before changing todos by id.",
    toolNames: [
      "listTodos",
      "addTodo",
      "toggleTodo",
      "removeTodo",
      "clearCompleted",
    ],
  },
  {
    id: "reviewer",
    label: "Read-only reviewer",
    instructions:
      "You can only read the todo list. Summarize it and suggest priorities, never pretend to change it.",
    toolNames: ["listTodos"],
  },
];

type Panel = { key: number; preset: AssistantPreset };

const store = createTodoStore(["Try the browser-assistant example"]);

const App = () => {
  const todos = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const tools = useMemo(() => createTodoTools(store), []);
  const [status, setStatus] = useState<LanguageModelAvailability>();
  const [useDemoModel, setUseDemoModel] = useState(!isSupported());
  const [presetId, setPresetId] = useState(presets[0].id);
  const [panels, setPanels] = useState<Panel[]>([
    { key: 1, preset: presets[0] },
  ]);

  useEffect(() => {
    availability().then(setStatus);
  }, []);

  const addPanel = () => {
    const preset = presets.find((item) => item.id === presetId) ?? presets[0];
    setPanels((current) => [
      ...current,
      { key: (current.at(-1)?.key ?? 0) + 1, preset },
    ]);
  };

  return (
    <main>
      <header className="app-header">
        <h1>browser-assistant</h1>
        <p>
          Built-in LanguageModel: <strong>{status ?? "checking…"}</strong>
        </p>
        <label>
          <input
            type="checkbox"
            checked={useDemoModel}
            onChange={(event) => setUseDemoModel(event.target.checked)}
          />
          Use the rule based demo model instead of the built-in one
        </label>
      </header>

      <section className="todos">
        <h2>Todos</h2>
        {todos.length === 0 && <p>No todos.</p>}
        <ul>
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? "done" : undefined}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => store.toggle(todo.id)}
                />
                <span className="todo-id">#{todo.id}</span> {todo.title}
              </label>
              <button type="button" onClick={() => store.remove(todo.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="sessions-toolbar">
        <select
          value={presetId}
          onChange={(event) => setPresetId(event.target.value)}
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={addPanel}>
          New assistant session
        </button>
      </section>

      <div className="panels">
        {panels.map((panel) => (
          <AssistantPanel
            key={`${panel.key}-${useDemoModel}`}
            title={`Session ${panel.key}`}
            preset={panel.preset}
            tools={tools}
            languageModel={useDemoModel ? demoLanguageModel : undefined}
            onClose={() =>
              setPanels((current) =>
                current.filter((item) => item.key !== panel.key),
              )
            }
          />
        ))}
      </div>
    </main>
  );
};

export default App;
