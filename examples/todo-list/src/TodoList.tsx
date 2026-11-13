import AddIcon from "@mui/icons-material/Add";
import ChecklistIcon from "@mui/icons-material/Checklist";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type FormEvent, useState, useSyncExternalStore } from "react";
import type { TodoStore } from "./todoStore";

type TodoListProps = {
  store: TodoStore;
};

const TodoList = ({ store }: TodoListProps) => {
  const todos = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [title, setTitle] = useState("");
  const done = todos.filter((todo) => todo.done).length;

  const addTodo = (event: FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    store.add(value);
    setTitle("");
  };

  return (
    <Box
      component="main"
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: { xs: "none", md: 1 },
        minWidth: 0,
        minHeight: { xs: "60vh", md: 0 },
      }}
    >
      <Box sx={{ px: { xs: 2, md: 4 }, pt: 3, pb: 2 }}>
        <Stack
          direction="row"
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 600 }}>
              Todos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {done} of {todos.length} completed
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<ClearAllIcon />}
            disabled={done === 0}
            onClick={() => store.clearCompleted()}
          >
            Clear completed
          </Button>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={todos.length ? (done / todos.length) * 100 : 0}
          sx={{ mt: 2, height: 6, borderRadius: 3 }}
        />
        <Box component="form" onSubmit={addTodo} sx={{ mt: 3 }}>
          <TextField
            fullWidth
            placeholder="Add a todo and press Enter"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AddIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {todos.length === 0 ? (
          <Stack
            spacing={1}
            sx={{
              height: "100%",
              minHeight: 200,
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
            }}
          >
            <ChecklistIcon sx={{ fontSize: 48 }} />
            <Typography>
              Nothing to do. Add a todo or ask an assistant.
            </Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {todos.map((todo) => (
              <ListItem
                key={todo.id}
                divider
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Remove todo"
                    onClick={() => store.remove(todo.id)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => store.toggle(todo.id)}
                  sx={{ px: { xs: 2, md: 4 }, py: 1 }}
                >
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
                      opacity: todo.done ? 0.6 : 1,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default TodoList;
