"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

// The current theme lives in the data-theme the pre-paint script wrote, so the
// server has nothing to render here until mount.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  if (theme === null) return null;

  return (
    <button
      className="theme-toggle"
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}.`}
      onClick={() => {
        const next = NEXT[theme];
        // No data-theme at all is what "system" means — the CSS falls back to
        // the OS setting on its own.
        if (next === "system") {
          delete document.documentElement.dataset.theme;
          localStorage.removeItem("theme");
        } else {
          document.documentElement.dataset.theme = next;
          localStorage.theme = next;
        }
        setTheme(next);
      }}
    >
      {theme}
    </button>
  );
}
