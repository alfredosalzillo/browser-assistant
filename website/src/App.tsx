import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DataObjectIcon from "@mui/icons-material/DataObject";
import GitHubIcon from "@mui/icons-material/GitHub";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LaunchIcon from "@mui/icons-material/Launch";
import LightModeIcon from "@mui/icons-material/LightMode";
import LoopIcon from "@mui/icons-material/Loop";
import RuleIcon from "@mui/icons-material/Rule";
import TimelineIcon from "@mui/icons-material/Timeline";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useState } from "react";
import { useSiteTheme } from "./siteTheme";
import ThemeAssistant from "./ThemeAssistant";

const githubUrl = "https://github.com/alfredosalzillo/browser-assistant";
const npmUrl =
  "https://www.npmjs.com/package/@alfredo.salzillo/browser-assistant";
const promptApiUrl = "https://developer.chrome.com/docs/ai/prompt-api";
const installCommand = "npm install @alfredo.salzillo/browser-assistant";

type ExamplePackage = { name: string; description?: string };

const examples = Object.entries(
  import.meta.glob<ExamplePackage>("../../examples/*/package.json", {
    eager: true,
    import: "default",
  }),
)
  .map(([path, pkg]) => ({
    dir: path.split("/").at(-2) ?? pkg.name,
    description: pkg.description,
  }))
  .sort((a, b) => a.dir.localeCompare(b.dir));

const sections = [
  { id: "what", label: "What it is" },
  { id: "how", label: "How it works" },
  { id: "usage", label: "Usage" },
  { id: "try", label: "Try it" },
  { id: "examples", label: "Examples" },
];

const features = [
  {
    icon: <AccountTreeIcon />,
    title: "Multiple assistants",
    text: "Create independent assistants with Assistant.createSession, each with its own tools, instructions and history, and list the live ones with Assistant.listSessions.",
  },
  {
    icon: <DataObjectIcon />,
    title: "JSON Schema tools",
    text: "Tools are plain JavaScript functions with a name, a description and a JSON Schema of their arguments.",
  },
  {
    icon: <RuleIcon />,
    title: "Constrained JSON output",
    text: "Answers are constrained with responseConstraint and validated by the library, with automatic retry on malformed JSON.",
  },
  {
    icon: <LoopIcon />,
    title: "Agentic loop",
    text: "Call, execute, feed the results back and repeat until the goal is reached, bounded by maxSteps.",
  },
  {
    icon: <HowToRegIcon />,
    title: "Human approval",
    text: "The onBeforeCall hook lets a person approve or reject every call before it runs.",
  },
  {
    icon: <TimelineIcon />,
    title: "Progress callbacks",
    text: "Follow every run with onStep, onToolCall and onToolResult, and get the full step log in the result.",
  },
  {
    icon: <ViewModuleIcon />,
    title: "Modular ES modules",
    text: "Tree-shakeable modules: import everything from the root or only the subpath you need.",
  },
  {
    icon: <Inventory2Icon />,
    title: "Zero dependencies",
    text: "Browser only and dependency free: it runs on the on-device model, no server and no API key.",
  },
];

const loopSteps = [
  {
    title: "Describe your tools",
    text: "Give the assistant JavaScript functions with a description and a JSON Schema of their arguments.",
  },
  {
    title: "Ask for a goal",
    text: "run(goal) sends the goal to the built-in LanguageModel, forced to answer only with JSON.",
  },
  {
    title: "The model picks the calls",
    text: 'It answers with { "type": "calls", "reasoning", "calls" } listing the functions to call and their arguments.',
  },
  {
    title: "The library runs them",
    text: "Arguments are validated, onBeforeCall can approve each call, and errors are captured instead of thrown.",
  },
  {
    title: "Results go back to the model",
    text: "Every result, error or rejection is sent back so the model can continue or recover.",
  },
  {
    title: "Repeat until done",
    text: 'The loop ends with { "type": "final", "message" } or when maxSteps is reached.',
  },
];

const defineToolCode = `import { defineTool } from "@alfredo.salzillo/browser-assistant";

const todos: string[] = [];

const addTodo = defineTool<{ title: string }>({
  name: "addTodo",
  description: "Add a new todo item to the list.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The title of the todo." },
    },
    required: ["title"],
    additionalProperties: false,
  },
  execute: ({ title }) => {
    todos.push(title);
    return { id: todos.length - 1, title };
  },
});

const listTodos = defineTool({
  name: "listTodos",
  description: "Return all the todo items.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  execute: () => todos,
});`;

const runCode = `import { Assistant } from "@alfredo.salzillo/browser-assistant";

const assistant = await Assistant.createSession({
  tools: [addTodo, listTodos],
  instructions: "You manage the user's todo list.",
  maxSteps: 10,
  onBeforeCall: (call) => confirm(\`Run \${call.name}?\`),
  onStep: (step) => console.log(step),
});

const result = await assistant.run("Add milk and bread to my list");

result.status; // "completed" | "max-steps"
result.message; // final message of the assistant
result.steps; // every model response with the executed calls

assistant.destroy();`;

const multipleCode = `const todoAssistant = await Assistant.createSession({ tools: todoTools });
const pageAssistant = await Assistant.createSession({ tools: pageTools });

for await (const assistant of Assistant.listSessions()) {
  console.log(assistant.id); // todoAssistant, then pageAssistant
}

todoAssistant.destroy(); // no longer listed`;

const availabilityCode = `import {
  availability,
  isSupported,
} from "@alfredo.salzillo/browser-assistant/availability";

if (!isSupported()) {
  // the browser has no built-in LanguageModel
}

const status = await availability();
// "unavailable" | "downloadable" | "downloading" | "available"`;

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Tooltip title={copied ? "Copied" : "Copy"}>
      <IconButton
        size="small"
        onClick={() => void copy()}
        aria-label="Copy"
        sx={{ color: "inherit" }}
      >
        {copied ? (
          <CheckIcon fontSize="small" />
        ) : (
          <ContentCopyIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
};

const CodeBlock = ({ code, title }: { code: string; title?: string }) => (
  <Box
    sx={{
      borderRadius: "8px",
      overflow: "hidden",
      bgcolor: "#0d1017",
      color: "#e6e8ef",
      border: 1,
      borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
    }}
  >
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        py: 0.5,
        bgcolor: "rgba(255, 255, 255, 0.04)",
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontFamily: "monospace", opacity: 0.7 }}
      >
        {title ?? "ts"}
      </Typography>
      <CopyButton text={code} />
    </Stack>
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        overflowX: "auto",
        fontSize: 13.5,
        lineHeight: 1.6,
        fontFamily:
          '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <code>{code}</code>
    </Box>
  </Box>
);

const Section = ({
  id,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) => (
  <Box
    component="section"
    id={id}
    sx={{ py: { xs: 7, md: 10 }, scrollMarginTop: 64 }}
  >
    <Container maxWidth="lg">
      <Typography
        variant="overline"
        color="primary"
        sx={{ fontWeight: 800, letterSpacing: "0.12em" }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h2" sx={{ fontSize: { xs: 30, md: 40 }, mb: 1.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 720, mb: 5, fontSize: 18 }}
        >
          {subtitle}
        </Typography>
      )}
      {children}
    </Container>
  </Box>
);

const Header = () => {
  const { mode, setMode } = useSiteTheme();
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        backdropFilter: "blur(12px)",
        bgcolor: (theme) => alpha(theme.palette.background.default, 0.8),
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 1 }}>
          <Link
            href="#top"
            underline="none"
            color="inherit"
            sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                color: "primary.contrastText",
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              <BoltIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              browser-assistant
            </Typography>
          </Link>
          <Stack
            direction="row"
            component="nav"
            sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, flex: 1 }}
          >
            {sections.map((section) => (
              <Button
                key={section.id}
                href={`#${section.id}`}
                color="inherit"
                size="small"
              >
                {section.label}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flex: { xs: 1, md: 0 } }} />
          <Tooltip title="npm">
            <IconButton
              href={npmUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="npm"
            >
              <Inventory2Icon />
            </IconButton>
          </Tooltip>
          <Tooltip title="GitHub">
            <IconButton
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === "light" ? "Dark mode" : "Light mode"}>
            <IconButton
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              aria-label="Toggle light and dark mode"
            >
              {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

const Hero = () => (
  <Box
    id="top"
    component="section"
    sx={{
      position: "relative",
      overflow: "hidden",
      pt: { xs: 8, md: 14 },
      pb: { xs: 8, md: 12 },
      background: (theme) =>
        `radial-gradient(circle at 15% 20%, ${alpha(theme.palette.primary.main, 0.22)}, transparent 45%), radial-gradient(circle at 85% 10%, ${alpha(theme.palette.secondary.main, 0.2)}, transparent 40%)`,
    }}
  >
    <Container maxWidth="md" sx={{ textAlign: "center" }}>
      <Chip
        label="Runs on the browser built-in Prompt API"
        color="primary"
        variant="outlined"
        component="a"
        href={promptApiUrl}
        target="_blank"
        rel="noreferrer"
        clickable
        sx={{ mb: 3, fontWeight: 600 }}
      />
      <Typography
        variant="h1"
        sx={{ fontSize: { xs: 40, sm: 56, md: 68 }, mb: 2 }}
      >
        Agentic assistants,{" "}
        <Box
          component="span"
          sx={{
            background: (theme) =>
              `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          right in the browser
        </Box>
      </Typography>
      <Typography
        variant="h5"
        component="p"
        color="text.secondary"
        sx={{ mb: 5, fontWeight: 400, fontSize: { xs: 18, md: 22 } }}
      >
        Give the on-device <code>LanguageModel</code> your JavaScript functions:
        it plans the calls, the library runs them and loops until the goal is
        reached.
      </Typography>
      <Box sx={{ maxWidth: 560, mx: "auto", mb: 4, textAlign: "left" }}>
        <CodeBlock code={installCommand} title="bash" />
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "center" }}
      >
        <Button variant="contained" size="large" href="#usage">
          Get started
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<GitHubIcon />}
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </Button>
        <Button
          variant="outlined"
          size="large"
          color="secondary"
          startIcon={<Inventory2Icon />}
          href={npmUrl}
          target="_blank"
          rel="noreferrer"
        >
          npm
        </Button>
      </Stack>
    </Container>
  </Box>
);

const What = () => (
  <Section
    id="what"
    eyebrow="What it is"
    title="A tiny agent runtime for the on-device model"
    subtitle={
      <>
        <code>@alfredo.salzillo/browser-assistant</code> is a modular TypeScript
        library that builds agentic assistants on top of the built-in{" "}
        <code>LanguageModel</code>. You bring the tools, it handles the prompt,
        the JSON protocol, validation and the loop.
      </>
    }
  >
    <Box
      sx={{
        display: "grid",
        gap: 2.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(4, 1fr)",
        },
      }}
    >
      {features.map((feature) => (
        <Card key={feature.title} variant="outlined" sx={{ height: "100%" }}>
          <CardContent>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                mb: 2,
                color: "primary.main",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              }}
            >
              {feature.icon}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              {feature.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {feature.text}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  </Section>
);

const How = () => (
  <Box sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
    <Section
      id="how"
      eyebrow="How it works"
      title="Call, execute, feed back, repeat"
      subtitle="Every run is a loop between the model and your functions."
    >
      <Box
        component="ol"
        sx={{
          listStyle: "none",
          p: 0,
          m: 0,
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
        }}
      >
        {loopSteps.map((step, index) => (
          <Box component="li" key={step.title}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent sx={{ display: "flex", gap: 2 }}>
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    color: "primary.contrastText",
                    background: (theme) =>
                      `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.text}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Section>
  </Box>
);

const UsageStep = ({
  title,
  text,
  code,
}: {
  title: string;
  text: ReactNode;
  code: string;
}) => (
  <Box
    sx={{
      display: "grid",
      gap: { xs: 2, md: 4 },
      gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" },
      alignItems: "start",
    }}
  >
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {text}
      </Typography>
    </Box>
    <CodeBlock code={code} title={code === installCommand ? "bash" : "ts"} />
  </Box>
);

const Usage = () => (
  <Section
    id="usage"
    eyebrow="Usage"
    title="From zero to an assistant in a few lines"
    subtitle={
      <>
        Requires a browser exposing the built-in <code>LanguageModel</code>, for
        example Chrome with the{" "}
        <Link href={promptApiUrl} target="_blank" rel="noreferrer">
          Prompt API
        </Link>{" "}
        enabled.
      </>
    }
  >
    <Stack spacing={6} divider={<Divider flexItem />}>
      <UsageStep
        title="1. Install"
        text="The package is dependency free and ships ES modules only."
        code={installCommand}
      />
      <UsageStep
        title="2. Define the tools"
        text={
          <>
            <code>defineTool</code> validates the tool and types the arguments
            of <code>execute</code>. Thrown errors are sent back to the model.
          </>
        }
        code={defineToolCode}
      />
      <UsageStep
        title="3. Create an assistant and run it"
        text={
          <>
            <code>Assistant.createSession</code> resolves to an assistant backed
            by its own <code>LanguageModel</code> session; <code>run</code>{" "}
            loops until the goal is reached or <code>maxSteps</code> (default
            10) is hit.
          </>
        }
        code={runCode}
      />
      <UsageStep
        title="4. Multiple assistants"
        text={
          <>
            Each assistant has its own tools and history.{" "}
            <code>Assistant.listSessions()</code> is an async iterator over the
            live ones, in creation order.
          </>
        }
        code={multipleCode}
      />
      <UsageStep
        title="5. Check availability"
        text={
          <>
            Detect the browser support before showing your assistant. Download
            progress can be followed with the <code>monitor</code> option.
          </>
        }
        code={availabilityCode}
      />
    </Stack>
  </Section>
);

const TryIt = () => (
  <Box sx={{ bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.05) }}>
    <Section
      id="try"
      eyebrow="Try it"
      title="Restyle this page with an assistant"
      subtitle="This assistant has five tools: getTheme, setPrimaryColor, setSecondaryColor, setMode and resetTheme. Ask for a colour, a palette or dark mode and watch every step."
    >
      <Box
        sx={{
          display: "grid",
          gap: 4,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          alignItems: "stretch",
        }}
      >
        <ThemeAssistant />
        <CodeBlock
          title="themeTools.ts"
          code={`const setPrimaryColor = defineTool<{ color: string }>({
  name: "setPrimaryColor",
  description: "Sets the primary color of the website.",
  parameters: {
    type: "object",
    properties: { color: { type: "string" } },
    required: ["color"],
    additionalProperties: false,
  },
  execute: ({ color }) => {
    // throws on invalid colours, the error goes back to the model
    theme.setPrimaryColor(normalizeColor(color));
    return theme.getSettings();
  },
});

const assistant = await Assistant.createSession({
  tools: [getTheme, setPrimaryColor, setSecondaryColor, setMode, resetTheme],
  instructions: "You change the look of the website only through the tools.",
  maxSteps: 6,
});

await assistant.run("Use a sunset palette");`}
        />
      </Box>
    </Section>
  </Box>
);

const Examples = () => (
  <Section
    id="examples"
    eyebrow="Examples"
    title="See it in a real app"
    subtitle="Every example is built and published together with this website."
  >
    <Box
      sx={{
        display: "grid",
        gap: 2.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
      }}
    >
      {examples.map((example) => (
        <Card key={example.dir} variant="outlined">
          <CardActionArea href={`./${example.dir}/`} sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {example.dir}
                </Typography>
                <LaunchIcon fontSize="small" color="primary" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {example.description ?? "Open the live demo."}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  </Section>
);

const Footer = () => (
  <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 4 }}>
    <Container
      maxWidth="lg"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        gap: 1,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Released under the MIT License.
      </Typography>
      <Link
        href={githubUrl}
        target="_blank"
        rel="noreferrer"
        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
      >
        <GitHubIcon fontSize="small" /> alfredosalzillo/browser-assistant
      </Link>
    </Container>
  </Box>
);

const App = () => (
  <>
    <Header />
    <main>
      <Hero />
      <What />
      <How />
      <Usage />
      <TryIt />
      <Examples />
    </main>
    <Footer />
  </>
);

export default App;
