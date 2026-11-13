import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  type AnyTool,
  type AssistantSession,
  createAssistantSession,
  type LanguageModelStatic,
  type Step,
  type ToolCall,
  type ToolResultStatus,
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

const statusColor: Record<ToolResultStatus, "success" | "error" | "warning"> = {
  success: "success",
  error: "error",
  rejected: "warning",
};

const formatCall = (call: ToolCall) =>
  `${call.name}(${JSON.stringify(call.arguments)})`;

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
    <Card variant="outlined" sx={{ display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={title}
        subheader={`${preset.label} · tools: ${preset.toolNames.join(", ")}`}
        action={
          <IconButton aria-label="Close session" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        }
      />
      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={requireApproval}
              onChange={(event) => setRequireApproval(event.target.checked)}
            />
          }
          label="Ask approval before each call"
        />

        <Stack
          component="ol"
          spacing={1}
          sx={{ listStyle: "none", p: 0, m: 0, mt: 1 }}
        >
          {error && (
            <Alert component="li" severity="error">
              {error}
            </Alert>
          )}
          {!session && !error && (
            <Typography component="li" color="text.secondary">
              Creating session…
            </Typography>
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
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  }}
                >
                  <Typography variant="body2">{message.text}</Typography>
                </Box>
              )}
              {message.kind === "final" && (
                <Alert
                  severity={message.status === "completed" ? "info" : "warning"}
                  icon={false}
                >
                  {message.text}
                  {message.status !== "completed" && ` (${message.status})`}
                </Alert>
              )}
              {message.kind === "error" && (
                <Alert severity="error">{message.text}</Alert>
              )}
              {message.kind === "step" &&
                message.step.response.type === "calls" && (
                  <Stack spacing={0.5}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: "italic" }}
                    >
                      {message.step.response.reasoning}
                    </Typography>
                    {message.step.results.map((result, callIndex) => (
                      <Stack
                        // biome-ignore lint/suspicious/noArrayIndexKey: results never change
                        key={callIndex}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <Chip
                          size="small"
                          label={result.status}
                          color={statusColor[result.status]}
                        />
                        <Typography
                          variant="body2"
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
                  </Stack>
                )}
            </Box>
          ))}
        </Stack>
        {running && !pending && <LinearProgress sx={{ mt: 2 }} />}

        {pending && (
          <Alert
            severity="warning"
            sx={{ mt: 2 }}
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
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Stack
          component="form"
          direction="row"
          spacing={1}
          onSubmit={submit}
          sx={{ width: "100%" }}
        >
          <TextField
            fullWidth
            size="small"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="e.g. add milk and bread"
            disabled={!session}
          />
          {running ? (
            <Button
              variant="outlined"
              color="error"
              startIcon={<StopIcon />}
              onClick={stop}
            >
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              variant="contained"
              endIcon={<SendIcon />}
              disabled={!session || !goal.trim()}
            >
              Send
            </Button>
          )}
        </Stack>
      </CardActions>
    </Card>
  );
};

export default AssistantPanel;
