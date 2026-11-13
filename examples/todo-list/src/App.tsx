import ChecklistIcon from "@mui/icons-material/Checklist";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useColorScheme,
} from "@mui/material";
import AssistantPanel from "./AssistantPanel";
import TodoList from "./TodoList";
import { createTodoStore } from "./todoStore";

const store = createTodoStore(["Try the browser-assistant example"]);

const App = () => {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = (mode === "system" ? systemMode : mode) ?? "light";

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
        <AssistantPanel store={store} />
      </Box>
    </Box>
  );
};

export default App;
