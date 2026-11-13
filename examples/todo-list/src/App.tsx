import {
  availability,
  type LanguageModelAvailability,
} from "@alfredo.salzillo/browser-assistant";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import HistoryIcon from "@mui/icons-material/History";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import {
  AppBar,
  Box,
  CircularProgress,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useColorScheme,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import AssistantPanel, { type AssistantPreset } from "./AssistantPanel";
import TodoList from "./TodoList";
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
    suggestions: ["add milk and bread", "complete 1", "clear"],
  },
  {
    id: "reviewer",
    label: "Read-only reviewer",
    instructions:
      "You can only read the todo list. Summarize it and suggest priorities, never pretend to change it.",
    toolNames: ["listTodos"],
    suggestions: ["list"],
  },
];

const availabilityColor = {
  available: "success.main",
  downloadable: "info.main",
  downloading: "info.main",
  unavailable: "warning.main",
} as const;

type Panel = {
  key: number;
  preset: AssistantPreset;
  title?: string;
  running: boolean;
};

const store = createTodoStore(["Try the browser-assistant example"]);

const App = () => {
  const tools = useMemo(() => createTodoTools(store), []);
  const { mode, systemMode, setMode } = useColorScheme();
  const [status, setStatus] = useState<LanguageModelAvailability>();
  const [panels, setPanels] = useState<Panel[]>([
    { key: 1, preset: presets[0], running: false },
  ]);
  const [activeKey, setActiveKey] = useState(1);
  const [newAnchor, setNewAnchor] = useState<HTMLElement>();
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement>();
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement>();

  useEffect(() => {
    availability()
      .catch((): LanguageModelAvailability => "unavailable")
      .then(setStatus);
  }, []);

  const checking = status === undefined;
  const supported = status !== "unavailable";
  const ready = supported && !checking;

  const resolvedMode = (mode === "system" ? systemMode : mode) ?? "light";
  const active = panels.find((panel) => panel.key === activeKey);

  const updatePanel = (key: number, patch: Partial<Panel>) =>
    setPanels((current) =>
      current.map((panel) =>
        panel.key === key ? { ...panel, ...patch } : panel,
      ),
    );

  const addPanel = (preset: AssistantPreset) => {
    const key = Math.max(0, ...panels.map((panel) => panel.key)) + 1;
    setPanels((current) => [...current, { key, preset, running: false }]);
    setActiveKey(key);
    setNewAnchor(undefined);
  };

  const closePanel = (key: number) => {
    const rest = panels.filter((panel) => panel.key !== key);
    if (rest.length === 0) {
      const next = key + 1;
      setPanels([{ key: next, preset: presets[0], running: false }]);
      setActiveKey(next);
      return;
    }
    setPanels(rest);
    if (key === activeKey) setActiveKey(rest[rest.length - 1].key);
  };

  const panelTitle = (panel: Panel) =>
    panel.title ?? `New ${panel.preset.label.toLowerCase()} chat`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <ChecklistIcon color="primary" />
          <Typography
            variant="h6"
            component="h1"
            sx={{ flexGrow: 1, fontWeight: 600 }}
          >
            Todo List Assistant
          </Typography>
          <Tooltip
            title={
              resolvedMode === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            <IconButton
              aria-label="Toggle light/dark theme"
              onClick={() =>
                setMode(resolvedMode === "dark" ? "light" : "dark")
              }
            >
              {resolvedMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          flex: 1,
          minHeight: 0,
          overflowY: { xs: "auto", md: "hidden" },
        }}
      >
        <TodoList store={store} />

        <Box
          component="aside"
          sx={{
            display: "flex",
            flexDirection: "column",
            width: { xs: "100%", md: 440 },
            height: { xs: "85vh", md: "auto" },
            flexShrink: 0,
            borderStyle: "solid",
            borderWidth: 0,
            borderLeftWidth: { xs: 0, md: 1 },
            borderTopWidth: { xs: 1, md: 0 },
            borderColor: "grey.800",
            bgcolor: "background.paper",
          }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: "center",
              pl: 2,
              pr: 1,
              minHeight: 56,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <AutoAwesomeIcon color="primary" fontSize="small" />
            <Box sx={{ flex: 1, minWidth: 0, pl: 0.5 }}>
              <Typography variant="subtitle2" noWrap>
                {!supported
                  ? "Assistant unavailable"
                  : ready && active
                    ? panelTitle(active)
                    : "Assistant"}
              </Typography>
              {ready && active && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {active.preset.label}
                </Typography>
              )}
            </Box>
            <Tooltip title="New session">
              <IconButton
                aria-label="New session"
                disabled={!ready}
                onClick={(event) => setNewAnchor(event.currentTarget)}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sessions history">
              <IconButton
                aria-label="Sessions history"
                disabled={!ready}
                onClick={(event) => setHistoryAnchor(event.currentTarget)}
              >
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Model settings">
              <IconButton
                aria-label="Model settings"
                onClick={(event) => setSettingsAnchor(event.currentTarget)}
              >
                <TuneIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Menu
            anchorEl={newAnchor}
            open={Boolean(newAnchor)}
            onClose={() => setNewAnchor(undefined)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <ListSubheader>New session</ListSubheader>
            {presets.map((preset) => (
              <MenuItem key={preset.id} onClick={() => addPanel(preset)}>
                <ListItemText
                  primary={preset.label}
                  secondary={`${preset.toolNames.length} tools`}
                />
              </MenuItem>
            ))}
          </Menu>

          <Menu
            anchorEl={historyAnchor}
            open={Boolean(historyAnchor)}
            onClose={() => setHistoryAnchor(undefined)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { width: 320, maxHeight: 420 } } }}
          >
            <ListSubheader>Sessions</ListSubheader>
            {panels.length === 0 && <MenuItem disabled>No sessions</MenuItem>}
            {[...panels].reverse().map((panel) => (
              <MenuItem
                key={panel.key}
                selected={panel.key === activeKey}
                onClick={() => {
                  setActiveKey(panel.key);
                  setHistoryAnchor(undefined);
                }}
              >
                <ListItemIcon>
                  {panel.running ? (
                    <CircularProgress size={18} />
                  ) : panel.key === activeKey ? (
                    <CheckIcon fontSize="small" />
                  ) : null}
                </ListItemIcon>
                <ListItemText
                  primary={panelTitle(panel)}
                  secondary={panel.preset.label}
                  slotProps={{ primary: { noWrap: true } }}
                />
                <IconButton
                  size="small"
                  edge="end"
                  aria-label="Close session"
                  onClick={(event) => {
                    event.stopPropagation();
                    closePanel(panel.key);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </MenuItem>
            ))}
          </Menu>

          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={() => setSettingsAnchor(undefined)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <ListSubheader>Language model</ListSubheader>
            <MenuItem disabled sx={{ "&.Mui-disabled": { opacity: 1 } }}>
              <ListItemIcon>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: status
                      ? availabilityColor[status]
                      : "text.disabled",
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary="Built-in LanguageModel"
                secondary={status ?? "checking…"}
              />
            </MenuItem>
          </Menu>

          {!supported ? (
            <Stack
              component="section"
              role="status"
              spacing={1.5}
              sx={{
                flex: 1,
                minHeight: 0,
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                textAlign: "center",
              }}
            >
              <InfoOutlinedIcon color="warning" sx={{ fontSize: 40 }} />
              <Typography variant="h6">LanguageModel not supported</Typography>
              <Typography variant="body2" color="text.secondary">
                The built-in LanguageModel is not available in this browser. Use
                a browser that supports the Prompt API to chat with the todo
                assistant.
              </Typography>
              <Link
                href="https://developer.chrome.com/docs/ai/prompt-api"
                target="_blank"
                rel="noreferrer"
              >
                Learn about the Prompt API
              </Link>
            </Stack>
          ) : checking ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2">Checking LanguageModel…</Typography>
            </Stack>
          ) : (
            panels.map((panel) => (
              <Box
                key={panel.key}
                sx={{
                  display: panel.key === activeKey ? "flex" : "none",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <AssistantPanel
                  preset={panel.preset}
                  tools={tools}
                  onGoal={(goal) => {
                    if (!panel.title) updatePanel(panel.key, { title: goal });
                  }}
                  onRunningChange={(running) =>
                    updatePanel(panel.key, { running })
                  }
                />
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default App;
