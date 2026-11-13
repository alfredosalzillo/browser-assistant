import {
  type AnyTool,
  type AssistantSession,
  createAssistantSession,
  type LanguageModelStatic,
  type Step,
  type ToolCall,
} from "browser-assistant";
import { type FormEvent, useEffect, useRef, useState } from "react";

export type AssistantPreset = {
  id: string;
  label: string;
  instructions: string;
  toolNames: string[];
};

type Message =
  | { kind: "goal"; text: string }
  | { kind: "step"; step: Step }
  | { kind: "final"; text: string; status: string }
  | { kind: "error"; text: string };

type PendingCall = {
  call: ToolCall;
  resolve: (approved: boolean) => void;
};

type AssistantPanelProps = {
  title: string;
  preset: AssistantPreset;
  tools: AnyTool[];
  languageModel?: LanguageModelStatic;
  onClose: () => void;
};

const AssistantPanel = ({
  title,
  preset,
  tools,
  languageModel,
  onClose,
}: AssistantPanelProps) => {
  const [session, setSession] = useState<AssistantSession>();
  const [error, setError] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [pending, setPending] = useState<PendingCall>();
  const requireApprovalRef = useRef(requireApproval);
  const pendingRef = useRef<PendingCall>(undefined);
  const abortRef = useRef<AbortController>(undefined);
  requireApprovalRef.current = requireApproval;

  const decide = (approved: boolean) => {
    pendingRef.current?.resolve(approved);
    pendingRef.current = undefined;
    setPending(undefined);
  };

  const stop = () => {
    abortRef.current?.abort();
    decide(false);
  };

  useEffect(() => {
    let created: AssistantSession | undefined;
    let cancelled = false;
    createAssistantSession({
      tools: tools.filter((tool) => preset.toolNames.includes(tool.name)),
      instructions: preset.instructions,
      languageModel,
      onBeforeCall: (call) =>
        requireApprovalRef.current
          ? new Promise<boolean>((resolve) => {
              pendingRef.current = { call, resolve };
              setPending(pendingRef.current);
            })
          : true,
      onStep: (step) =>
        setMessages((current) => [...current, { kind: "step", step }]),
    })
      .then((value) => {
        created = value;
        if (cancelled) value.destroy();
        else setSession(value);
      })
      .catch((reason: unknown) => setError(String(reason)));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      pendingRef.current?.resolve(false);
      created?.destroy();
    };
  }, [preset, tools, languageModel]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !goal.trim() || running) return;
    const text = goal.trim();
    const controller = new AbortController();
    abortRef.current = controller;
    setGoal("");
    setRunning(true);
    setMessages((current) => [...current, { kind: "goal", text }]);
    try {
      const result = await session.run(text, { signal: controller.signal });
      setMessages((current) => [
        ...current,
        { kind: "final", text: result.message, status: result.status },
      ]);
    } catch (reason) {
      setMessages((current) => [
        ...current,
        { kind: "error", text: String(reason) },
      ]);
    } finally {
      setRunning(false);
      decide(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <small>
            {preset.label} · tools: {preset.toolNames.join(", ")}
          </small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close session">
          ✕
        </button>
      </header>

      <label className="approval">
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(event) => setRequireApproval(event.target.checked)}
        />
        Ask approval before each call
      </label>

      <ol className="messages">
        {error && <li className="message error">{error}</li>}
        {!session && !error && <li className="message">Creating session…</li>}
        {messages.map((message, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: messages are append only
          <li key={index} className={`message ${message.kind}`}>
            {message.kind === "goal" && <strong>🧑 {message.text}</strong>}
            {message.kind === "final" && (
              <span>
                🤖 {message.text}
                {message.status !== "completed" && ` (${message.status})`}
              </span>
            )}
            {message.kind === "error" && <span>⚠️ {message.text}</span>}
            {message.kind === "step" &&
              message.step.response.type === "calls" && (
                <div>
                  <em>{message.step.response.reasoning}</em>
                  <ul className="calls">
                    {message.step.results.map((result, callIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: results never change
                      <li key={callIndex} className={result.status}>
                        <code>
                          {result.name}({JSON.stringify(result.arguments)})
                        </code>{" "}
                        → {result.status}
                        {result.error && `: ${result.error}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </li>
        ))}
        {running && !pending && <li className="message">Thinking…</li>}
      </ol>

      {pending && (
        <div className="pending">
          <span>
            Run <code>{pending.call.name}</code>
            <code>{JSON.stringify(pending.call.arguments)}</code>?
          </span>
          <button type="button" onClick={() => decide(true)}>
            Approve
          </button>
          <button type="button" onClick={() => decide(false)}>
            Reject
          </button>
        </div>
      )}

      <form className="goal-form" onSubmit={submit}>
        <input
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="e.g. add milk and bread"
          disabled={!session}
        />
        {running ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!session || !goal.trim()}>
            Send
          </button>
        )}
      </form>
    </section>
  );
};

export default AssistantPanel;
