import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  AppBar,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
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

const availabilityColor = {
  available: "success",
  downloadable: "info",
  downloading: "info",
  unavailable: "warning",
} as const;

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
    <>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            browser-assistant
          </Typography>
          <Chip
            label={`Built-in LanguageModel: ${status ?? "checking…"}`}
            color={status ? availabilityColor[status] : "default"}
            variant="filled"
          />
          <FormControlLabel
            control={
              <Switch
                color="default"
                checked={useDemoModel}
                onChange={(event) => setUseDemoModel(event.target.checked)}
              />
            }
            label="Use the rule based demo model"
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" component="h2">
              Todos
            </Typography>
            {todos.length === 0 && (
              <Typography color="text.secondary">No todos.</Typography>
            )}
            <List dense>
              {todos.map((todo) => (
                <ListItem
                  key={todo.id}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="Remove todo"
                      onClick={() => store.remove(todo.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => store.toggle(todo.id)}>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={todo.done}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={todo.title}
                      secondary={`#${todo.id}`}
                      sx={{
                        textDecoration: todo.done ? "line-through" : undefined,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>

          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <TextField
              select
              size="small"
              label="Preset"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
              sx={{ minWidth: 220 }}
            >
              {presets.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addPanel}
            >
              New assistant session
            </Button>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            }}
          >
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
          </Box>
        </Stack>
      </Container>
    </>
  );
};

export default App;
