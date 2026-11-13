import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ThemeMode = "light" | "dark";

export type SiteThemeSettings = {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
};

export type SiteThemeContextValue = SiteThemeSettings & {
  /** returns the latest settings, also the ones not yet rendered */
  getSettings: () => SiteThemeSettings;
  setMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  resetTheme: () => void;
};

const storageKey = "browser-assistant-site-theme";

export const defaultSettings: SiteThemeSettings = {
  mode: "light",
  primaryColor: "#645cff",
  secondaryColor: "#ee7a5a",
};

export const SiteThemeContext = createContext<SiteThemeContextValue | null>(
  null,
);

export const useSiteTheme = (): SiteThemeContextValue => {
  const value = useContext(SiteThemeContext);
  if (!value) {
    throw new Error("useSiteTheme must be used inside a SiteThemeProvider");
  }
  return value;
};

const readSettings = (): SiteThemeSettings => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaultSettings;
    const parsed: unknown = JSON.parse(saved);
    if (
      parsed &&
      typeof parsed === "object" &&
      "mode" in parsed &&
      (parsed.mode === "light" || parsed.mode === "dark") &&
      "primaryColor" in parsed &&
      typeof parsed.primaryColor === "string" &&
      "secondaryColor" in parsed &&
      typeof parsed.secondaryColor === "string"
    ) {
      return {
        mode: parsed.mode,
        primaryColor: parsed.primaryColor,
        secondaryColor: parsed.secondaryColor,
      };
    }
  } catch {
    return defaultSettings;
  }
  return defaultSettings;
};

const buildTheme = (settings: SiteThemeSettings) => {
  try {
    return createTheme({
      palette: {
        mode: settings.mode,
        primary: { main: settings.primaryColor },
        secondary: { main: settings.secondaryColor },
        background: {
          default: settings.mode === "light" ? "#f6f7fb" : "#10121a",
          paper: settings.mode === "light" ? "#ffffff" : "#191c27",
        },
      },
      shape: { borderRadius: 16 },
      typography: {
        fontFamily:
          '"Inter", "Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif',
        button: { textTransform: "none", fontWeight: 700 },
        h1: { fontWeight: 800, letterSpacing: "-0.03em" },
        h2: { fontWeight: 800, letterSpacing: "-0.02em" },
        h3: { fontWeight: 700 },
      },
    });
  } catch {
    // a broken saved colour must never break the website
    return buildTheme(defaultSettings);
  }
};

export const SiteThemeProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState(readSettings);
  const settingsRef = useRef(settings);

  const update = useCallback((patch: Partial<SiteThemeSettings>) => {
    settingsRef.current = { ...settingsRef.current, ...patch };
    setSettings(settingsRef.current);
  }, []);
  const getSettings = useCallback(() => settingsRef.current, []);
  const setMode = useCallback((mode: ThemeMode) => update({ mode }), [update]);
  const setPrimaryColor = useCallback(
    (primaryColor: string) => update({ primaryColor }),
    [update],
  );
  const setSecondaryColor = useCallback(
    (secondaryColor: string) => update({ secondaryColor }),
    [update],
  );
  const resetTheme = useCallback(() => update(defaultSettings), [update]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // storage can be unavailable (private mode, quota): the theme still works
    }
  }, [settings]);

  const theme = useMemo(() => buildTheme(settings), [settings]);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.palette.background.default);
  }, [theme]);

  const value = useMemo(
    () => ({
      ...settings,
      getSettings,
      setMode,
      setPrimaryColor,
      setSecondaryColor,
      resetTheme,
    }),
    [
      settings,
      getSettings,
      setMode,
      setPrimaryColor,
      setSecondaryColor,
      resetTheme,
    ],
  );

  return (
    <SiteThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SiteThemeContext.Provider>
  );
};
