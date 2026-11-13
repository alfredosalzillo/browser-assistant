import {
  availability,
  type LanguageModelAvailability,
} from "@alfredo.salzillo/browser-assistant";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import {
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
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import AssistantChat from "./AssistantChat";
import {
  todoAssistantPresets as presets,
  type TodoAssistantPreset,
} from "./todo-assistant";
import type { TodoStore } from "./todoStore";

const availabilityColor = {
  available: "success.main",
  downloadable: "info.main",
  downloading: "info.main",
  unavailable: "warning.main",
} as const;

type Session = {
  key: number;
  preset: TodoAssistantPreset;
  title?: string;
  running: boolean;
};

type AssistantPanelProps = {
  store: TodoStore;
};

/**
 * AssistantPanel is the assistant column: it checks the LanguageModel availability, owns the
 * presets and the sessions, and renders the header (new session, history, model settings) and the
 * chat of the active session.
 */
const AssistantPanel = ({ store }: AssistantPanelProps) => {
  const [status, setStatus] = useState<LanguageModelAvailability>();
  const [sessions, setSessions] = useState<Session[]>([
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

  const active = sessions.find((session) => session.key === activeKey);

  const updateSession = (key: number, patch: Partial<Session>) =>
    setSessions((current) =>
      current.map((session) =>
        session.key === key ? { ...session, ...patch } : session,
      ),
    );

  const addSession = (preset: TodoAssistantPreset) => {
    const key = Math.max(0, ...sessions.map((session) => session.key)) + 1;
    setSessions((current) => [...current, { key, preset, running: false }]);
    setActiveKey(key);
    setNewAnchor(undefined);
  };

  const closeSession = (key: number) => {
    const rest = sessions.filter((session) => session.key !== key);
    if (rest.length === 0) {
      const next = key + 1;
      setSessions([{ key: next, preset: presets[0], running: false }]);
      setActiveKey(next);
      return;
    }
    setSessions(rest);
    if (key === activeKey) setActiveKey(rest[rest.length - 1].key);
  };

  const sessionTitle = (session: Session) =>
    session.title ?? `New ${session.preset.label.toLowerCase()} chat`;

  return (
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
                ? sessionTitle(active)
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
          <MenuItem key={preset.id} onClick={() => addSession(preset)}>
            <ListItemText
              primary={preset.label}
              secondary={preset.toolNames.join(", ")}
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
        {[...sessions].reverse().map((session) => (
          <MenuItem
            key={session.key}
            selected={session.key === activeKey}
            onClick={() => {
              setActiveKey(session.key);
              setHistoryAnchor(undefined);
            }}
          >
            <ListItemIcon>
              {session.running ? (
                <CircularProgress size={18} />
              ) : session.key === activeKey ? (
                <CheckIcon fontSize="small" />
              ) : null}
            </ListItemIcon>
            <ListItemText
              primary={sessionTitle(session)}
              secondary={session.preset.label}
              slotProps={{ primary: { noWrap: true } }}
            />
            <IconButton
              size="small"
              edge="end"
              aria-label="Close session"
              onClick={(event) => {
                event.stopPropagation();
                closeSession(session.key);
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
                bgcolor: status ? availabilityColor[status] : "text.disabled",
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
            The built-in LanguageModel is not available in this browser. Use a
            browser that supports the Prompt API to chat with the todo
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
        sessions.map((session) => (
          <Box
            key={session.key}
            sx={{
              display: session.key === activeKey ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <AssistantChat
              store={store}
              preset={session.preset}
              onGoal={(goal) => {
                if (!session.title) updateSession(session.key, { title: goal });
              }}
              onRunningChange={(running) =>
                updateSession(session.key, { running })
              }
            />
          </Box>
        ))
      )}
    </Box>
  );
};

export default AssistantPanel;
