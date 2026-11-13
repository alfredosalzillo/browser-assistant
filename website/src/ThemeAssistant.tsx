import type { Step } from "@alfredo.salzillo/browser-assistant";
import { Assistant } from "@alfredo.salzillo/browser-assistant";
import { availability } from "@alfredo.salzillo/browser-assistant/availability";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useSiteTheme } from "./siteTheme";
import { createThemeTools } from "./themeTools";

type Support = "checking" | "supported" | "unsupported";

type LogEvent =
  | { kind: "goal"; text: string }
  | { kind: "step"; step: Step }
  | { kind: "final"; text: string }
  | { kind: "error"; text: string };

type LogEntry = LogEvent & { id: number };

const suggestions = [
  "Make it green",
  "Switch to dark mode",
  "Use a sunset palette",
  "Reset the theme",
];

const instructions = [
  "You are the theme assistant of the browser-assistant website.",
  "You change the look of the website only through the provided tools.",
  "Colors must be CSS colors, prefer hex codes like #2e7d32.",
  "When the user asks for a palette, pick a primary and a secondary color that match it.",
  "Call getTheme when you need the current theme.",
  "When done, answer with a short final message describing the change.",
].join("\n");

const ThemeAssistant = () => {
  const theme = useSiteTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const [support, setSupport] = useState<Support>("checking");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const assistantRef = useRef<Promise<Assistant> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    availability()
      .then((status) => {
        if (!active) return;
        setSupport(
          status === "available" ||
            status === "downloadable" ||
            status === "downloading"
            ? "supported"
            : "unsupported",
        );
      })
      .catch(() => {
        if (active) setSupport("unsupported");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      const assistant = assistantRef.current;
      assistantRef.current = null;
      assistant?.then((created) => created.destroy()).catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (log.length === 0) return;
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [log]);

  const append = (event: LogEvent) => {
    const id = nextId.current++;
    setLog((current) => [...current, { ...event, id }]);
  };

  const getAssistant = () => {
    if (!assistantRef.current) {
      const created = Assistant.createSession({
        instructions,
        tools: createThemeTools(() => themeRef.current),
        maxSteps: 6,
        onStep: (step) => {
          if (step.response.type === "calls") append({ kind: "step", step });
        },
        monitor: (monitor) => {
          monitor.addEventListener("downloadprogress", (event) =>
            setDownload(event.loaded < 1 ? event.loaded : null),
          );
        },
      });
      created.catch(() => {
        if (assistantRef.current === created) assistantRef.current = null;
      });
      assistantRef.current = created;
    }
    return assistantRef.current;
  };

  const send = async (goal: string) => {
    const text = goal.trim();
    if (!text || busy) return;
    setPrompt("");
    setBusy(true);
    append({ kind: "goal", text });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const assistant = await getAssistant();
      const result = await assistant.run(text, { signal: controller.signal });
      append({
        kind: "final",
        text:
          result.status === "completed"
            ? result.message
            : `Stopped after ${result.steps.length} steps: ${result.message}`,
      });
    } catch (error) {
      append({
        kind: "error",
        text: controller.signal.aborted
          ? "Stopped."
          : error instanceof Error
            ? error.message
            : String(error),
      });
    } finally {
      abortRef.current = null;
      setDownload(null);
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(prompt);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(prompt);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <CardContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              color: "primary.contrastText",
              background: (t) =>
                `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
            }}
          >
            <AutoAwesomeIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Theme assistant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask it to restyle this page.
            </Typography>
          </Box>
        </Stack>

        {support === "checking" && <LinearProgress />}

        {support === "unsupported" && (
          <Alert severity="info">
            LanguageModel not supported — use a browser supporting the{" "}
            <Link
              href="https://developer.chrome.com/docs/ai/prompt-api"
              target="_blank"
              rel="noreferrer"
            >
              Prompt API
            </Link>
            .
          </Alert>
        )}

        {support === "supported" && (
          <>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={suggestion}
                  variant="outlined"
                  color="primary"
                  disabled={busy}
                  onClick={() => void send(suggestion)}
                />
              ))}
            </Stack>

            <Box
              aria-live="polite"
              sx={{
                flex: 1,
                minHeight: 160,
                maxHeight: 320,
                overflowY: "auto",
                borderRadius: 2,
                p: 1.5,
                bgcolor: "action.hover",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {log.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  The steps of the assistant will appear here.
                </Typography>
              )}
              {log.map((entry) => (
                <LogItem key={entry.id} entry={entry} />
              ))}
              {download !== null && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Downloading the model… {Math.round(download * 100)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={download * 100}
                  />
                </Box>
              )}
              {busy && download === null && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Thinking…
                  </Typography>
                </Stack>
              )}
              <div ref={logEndRef} />
            </Box>

            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{ display: "flex", gap: 1, alignItems: "center" }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. make the page ocean blue"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={onKeyDown}
                disabled={busy}
                slotProps={{ htmlInput: { "aria-label": "Theme request" } }}
              />
              {busy ? (
                <Tooltip title="Stop">
                  <IconButton
                    color="secondary"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <StopIcon />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Send">
                  <span>
                    <IconButton
                      type="submit"
                      color="primary"
                      disabled={!prompt.trim()}
                    >
                      <SendIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const LogItem = ({ entry }: { entry: LogEntry }) => {
  switch (entry.kind) {
    case "goal":
      return (
        <Box
          sx={{
            alignSelf: "flex-end",
            maxWidth: "85%",
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            bgcolor: "primary.main",
            color: "primary.contrastText",
          }}
        >
          <Typography variant="body2">{entry.text}</Typography>
        </Box>
      );
    case "step": {
      const { response, results } = entry.step;
      return (
        <Box>
          {response.type === "calls" && response.reasoning && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", fontStyle: "italic" }}
            >
              {response.reasoning}
            </Typography>
          )}
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {results.map((result, index) => (
              <Tooltip
                // biome-ignore lint/suspicious/noArrayIndexKey: results are never reordered
                key={index}
                title={result.error ?? JSON.stringify(result.arguments)}
              >
                <Chip
                  size="small"
                  icon={
                    result.status === "success" ? (
                      <CheckCircleIcon />
                    ) : (
                      <ErrorIcon />
                    )
                  }
                  color={result.status === "success" ? "success" : "error"}
                  variant="outlined"
                  label={`${result.name}(${formatArguments(result.arguments)})`}
                  sx={{ fontFamily: "monospace" }}
                />
              </Tooltip>
            ))}
          </Stack>
        </Box>
      );
    }
    case "final":
      return (
        <Box
          sx={{
            alignSelf: "flex-start",
            maxWidth: "85%",
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="body2">{entry.text}</Typography>
        </Box>
      );
    case "error":
      return (
        <Alert severity="warning" sx={{ py: 0 }}>
          {entry.text}
        </Alert>
      );
  }
};

const formatArguments = (args: Record<string, unknown>) =>
  Object.values(args)
    .map((value) => JSON.stringify(value))
    .join(", ");

export default ThemeAssistant;
