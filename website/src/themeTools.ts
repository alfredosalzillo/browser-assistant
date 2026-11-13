import { defineTool } from "@alfredo.salzillo/browser-assistant/tools";
import type { AnyTool } from "@alfredo.salzillo/browser-assistant/types";
import type { SiteThemeContextValue, ThemeMode } from "./siteTheme";

const cssWideKeywords = new Set([
  "currentcolor",
  "inherit",
  "initial",
  "revert",
  "revert-layer",
  "unset",
]);

let canvasContext: CanvasRenderingContext2D | null | undefined;

const getCanvasContext = () => {
  if (canvasContext === undefined) {
    canvasContext = document.createElement("canvas").getContext("2d");
  }
  return canvasContext;
};

/**
 * normalizeColor validates a CSS colour and returns it as hex (or `rgba()` when it is translucent),
 * MUI only accepts these formats. It throws when the colour is not valid.
 */
export const normalizeColor = (color: unknown): string => {
  if (typeof color !== "string" || color.trim() === "") {
    throw new Error("The color must be a non empty CSS color string");
  }
  const value = color.trim();
  if (
    cssWideKeywords.has(value.toLowerCase()) ||
    !CSS.supports("color", value)
  ) {
    throw new Error(
      `"${value}" is not a valid CSS color, use a color name, a hex code or rgb()/hsl()`,
    );
  }
  const context = getCanvasContext();
  if (!context) return value;
  // fillStyle keeps the previous value for unsupported colours: detect it with two different seeds
  context.fillStyle = "#000000";
  context.fillStyle = value;
  const first = context.fillStyle;
  context.fillStyle = "#ffffff";
  context.fillStyle = value;
  if (first !== context.fillStyle) {
    throw new Error(`"${value}" cannot be used as a theme color`);
  }
  return first;
};

/**
 * createThemeTools returns the tools the assistant uses to read and change the website theme.
 */
export const createThemeTools = (
  getTheme: () => SiteThemeContextValue,
): AnyTool[] => {
  const snapshot = () => {
    const { mode, primaryColor, secondaryColor } = getTheme().getSettings();
    return { mode, primaryColor, secondaryColor };
  };

  return [
    defineTool({
      name: "getTheme",
      description:
        "Returns the current website theme: mode (light or dark), primaryColor and secondaryColor as hex.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: () => snapshot(),
    }),
    defineTool<{ color: string }>({
      name: "setPrimaryColor",
      description:
        "Sets the primary color of the website (app bar, buttons, links, headings accents).",
      parameters: {
        type: "object",
        properties: {
          color: {
            type: "string",
            description:
              'A CSS color: a name like "teal", a hex like "#1e88e5" or rgb()/hsl()',
          },
        },
        required: ["color"],
        additionalProperties: false,
      },
      execute: ({ color }) => {
        getTheme().setPrimaryColor(normalizeColor(color));
        return snapshot();
      },
    }),
    defineTool<{ color: string }>({
      name: "setSecondaryColor",
      description:
        "Sets the secondary color of the website (highlights, chips, gradients).",
      parameters: {
        type: "object",
        properties: {
          color: {
            type: "string",
            description:
              'A CSS color: a name like "orange", a hex like "#ff7043" or rgb()/hsl()',
          },
        },
        required: ["color"],
        additionalProperties: false,
      },
      execute: ({ color }) => {
        getTheme().setSecondaryColor(normalizeColor(color));
        return snapshot();
      },
    }),
    defineTool<{ mode: ThemeMode }>({
      name: "setMode",
      description: "Switches the website between light and dark mode.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["light", "dark"] },
        },
        required: ["mode"],
        additionalProperties: false,
      },
      execute: ({ mode }) => {
        if (mode !== "light" && mode !== "dark") {
          throw new Error('The mode must be "light" or "dark"');
        }
        getTheme().setMode(mode);
        return snapshot();
      },
    }),
    defineTool({
      name: "resetTheme",
      description: "Restores the default website theme (colors and mode).",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: () => {
        getTheme().resetTheme();
        return snapshot();
      },
    }),
  ];
};
