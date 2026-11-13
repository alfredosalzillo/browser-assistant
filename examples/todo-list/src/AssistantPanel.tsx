import type {
  AssistantSession,
  Step,
  ToolCall,
  ToolResultStatus,
} from "@alfredo.salzillo/browser-assistant";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import StopIcon from "@mui/icons-material/Stop";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createTodoAssistant,
  type TodoAssistantPreset,
} from "./todo-assistant";
import type { TodoStore } from "./todoStore";

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
  store: TodoStore;
  preset: TodoAssistantPreset;
  onGoal?: (goal: string) => void;
  onRunningChange?: (running: boolean) => void;
};

const statusColor: Record<ToolResultStatus, "success" | "error" | "warning"> = {
  success: "success",
  error: "error",
  rejected: "warning",
};

const formatCall = (call: ToolCall) =>
  `${call.name}(${JSON.stringify(call.arguments)})`;

const AssistantMessage = ({ children }: { children: ReactNode }) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
    <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main" }}>
      <AutoAwesomeIcon sx={{ fontSize: 16 }} />
    </Avatar>
    <Box sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>{children}</Box>
  </Stack>
);

const AssistantPanel = ({
  store,
  preset,
  onGoal,
  onRunningChange,
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

  const updateRunning = (value: boolean) => {
    setRunning(value);
    onRunningChange?.(value);
  };

  useEffect(() => {
    let created: AssistantSession | undefined;
    let cancelled = false;
    createTodoAssistant({
      store,
      preset,
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
  }, [store, preset]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !goal.trim() || running) return;
    const text = goal.trim();
    const controller = new AbortController();
    abortRef.current = controller;
    setGoal("");
    updateRunning(true);
    onGoal?.(text);
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
      updateRunning(false);
      decide(false);
    }
  };

  const submitOnEnter = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 2,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tooltip title={preset.toolNames.join(", ")}>
          <Chip
            size="small"
            variant="outlined"
            icon={<BuildOutlinedIcon />}
            label={`${preset.toolNames.length} tools`}
          />
        </Tooltip>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={
            <Switch
              size="small"
              checked={requireApproval}
              onChange={(event) => setRequireApproval(event.target.checked)}
            />
          }
          label={<Typography variant="body2">Ask approval</Typography>}
        />
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column-reverse",
        }}
      >
        <Stack
          component="ol"
          spacing={2}
          sx={{ listStyle: "none", m: 0, p: 2, flexGrow: 1 }}
        >
          {error && (
            <Alert component="li" severity="error">
              {error}
            </Alert>
          )}
          {!session && !error && (
            <Stack
              component="li"
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", color: "text.secondary" }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2">Creating session…</Typography>
            </Stack>
          )}
          {session && messages.length === 0 && (
            <Stack
              component="li"
              spacing={2}
              sx={{
                flexGrow: 1,
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                py: 4,
              }}
            >
              <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
                <AutoAwesomeIcon />
              </Avatar>
              <Box>
                <Typography variant="h6">{preset.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  What should I do with your todos?
                </Typography>
              </Box>
              <Stack
                direction="row"
                sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}
              >
                {preset.suggestions.map((suggestion) => (
                  <Chip
                    key={suggestion}
                    label={suggestion}
                    variant="outlined"
                    onClick={() => setGoal(suggestion)}
                  />
                ))}
              </Stack>
            </Stack>
          )}
          {messages.map((message, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: messages are append only
            <Box component="li" key={index}>
              {message.kind === "goal" && (
                <Box
                  sx={{
                    ml: "auto",
                    width: "fit-content",
                    maxWidth: "85%",
                    px: 2,
                    py: 1,
                    borderRadius: 3,
                    borderBottomRightRadius: 4,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {message.text}
                  </Typography>
                </Box>
              )}
              {message.kind === "final" && (
                <AssistantMessage>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {message.text}
                  </Typography>
                  {message.status !== "completed" && (
                    <Chip
                      size="small"
                      color="warning"
                      label={message.status}
                      sx={{ mt: 1 }}
                    />
                  )}
                </AssistantMessage>
              )}
              {message.kind === "error" && (
                <Alert severity="error">{message.text}</Alert>
              )}
              {message.kind === "step" &&
                message.step.response.type === "calls" && (
                  <AssistantMessage>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: "italic", mb: 1 }}
                    >
                      {message.step.response.reasoning}
                    </Typography>
                    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                      {message.step.results.map((result, callIndex) => (
                        <Stack
                          // biome-ignore lint/suspicious/noArrayIndexKey: results never change
                          key={callIndex}
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "center",
                            px: 1.5,
                            py: 1,
                            "& + &": { borderTop: 1, borderColor: "divider" },
                          }}
                        >
                          <Chip
                            size="small"
                            label={result.status}
                            color={statusColor[result.status]}
                            variant="outlined"
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "monospace",
                              wordBreak: "break-all",
                            }}
                          >
                            {formatCall(result)}
                            {result.error && `: ${result.error}`}
                          </Typography>
                        </Stack>
                      ))}
                    </Paper>
                  </AssistantMessage>
                )}
            </Box>
          ))}
          {running && !pending && (
            <Box component="li">
              <AssistantMessage>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", color: "text.secondary" }}
                >
                  <CircularProgress size={14} />
                  <Typography variant="body2">Thinking…</Typography>
                </Stack>
              </AssistantMessage>
            </Box>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        {pending && (
          <Alert
            severity="warning"
            square
            sx={{ borderBottom: 1, borderColor: "divider" }}
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  color="success"
                  size="small"
                  onClick={() => decide(true)}
                >
                  Approve
                </Button>
                <Button
                  color="error"
                  size="small"
                  onClick={() => decide(false)}
                >
                  Reject
                </Button>
              </Stack>
            }
          >
            Run{" "}
            <Box component="code" sx={{ wordBreak: "break-all" }}>
              {formatCall(pending.call)}
            </Box>
            ?
          </Alert>
        )}
        <Box
          component="form"
          onSubmit={submit}
          sx={{
            display: "flex",
            flexDirection: "column",
            px: 2,
            pt: 1.5,
            pb: 1,
          }}
        >
          <InputBase
            multiline
            fullWidth
            minRows={3}
            maxRows={10}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            onKeyDown={submitOnEnter}
            placeholder={
              session ? "Ask the assistant…" : "The session is not ready"
            }
            disabled={!session}
            inputProps={{ "aria-label": "Prompt" }}
          />
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              mt: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Enter to send, Shift + Enter for a new line
            </Typography>
            {running ? (
              <Tooltip title="Stop">
                <IconButton color="error" onClick={stop} aria-label="Stop">
                  <StopIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Send (Enter)">
                <span>
                  <IconButton
                    type="submit"
                    color="primary"
                    aria-label="Send"
                    disabled={!session || !goal.trim()}
                  >
                    <ArrowUpwardIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default AssistantPanel;
