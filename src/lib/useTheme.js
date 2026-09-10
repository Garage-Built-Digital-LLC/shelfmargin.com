import { useCallback, useEffect, useState } from "react";

// ShelfMargin light/dark theme. Scoped to the app shell: the resolved
// theme ("light" | "dark") is applied as data-sm-theme on the app root,
// which flips the --sm-* CSS custom properties defined in index.css.
//
// Resolution: an explicit user choice (localStorage "sm-theme") wins;
// otherwise we follow the device's prefers-color-scheme and keep tracking
// it live. Default is dark (the app's native look) when nothing is known.

const KEY = "sm-theme";

function readStored() {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* private mode / blocked storage — fall through */
  }
  return null;
}

function systemTheme() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    /* no matchMedia — fall through */
  }
  return "dark";
}

export function useTheme() {
  const [stored, setStored] = useState(readStored); // "light" | "dark" | null
  const [system, setSystem] = useState(systemTheme);

  // Track the device setting while the user hasn't made an explicit choice.
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: light)");
    } catch {
      return undefined;
    }
    const onChange = () => setSystem(mq.matches ? "light" : "dark");
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  const theme = stored || system;

  const setTheme = useCallback((next) => {
    if (next !== "light" && next !== "dark") return;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    setStored(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
