"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";

// The three choices shown as buttons.
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "auto", label: "Automat" },
  { value: "light", label: "Luminos" },
  { value: "dark", label: "Întunecat" },
];

// Applies the theme on the page: "auto" removes the attribute (CSS then follows the phone setting).
function apply(theme: Theme) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Theme choice: Automat (follows the phone), Luminos or Intunecat. It is kept in the browser, on each device. */
export default function ThemeSetting() {
  const [theme, setTheme] = useState<Theme>("auto");

  // On load, read the saved choice (if any) from the browser storage.
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

  // When a button is pressed: update the state, the page and the saved choice.
  const choose = (t: Theme) => {
    setTheme(t);
    apply(t);
    try {
      if (t === "auto") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {}
  };

  return (
    <div className="theme-form">
      <label id="theme-label">Aspect</label>
      <div className="theme-seg" role="group" aria-labelledby="theme-label">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" aria-pressed={theme === o.value} onClick={() => choose(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="muted small">„Automat” urmează setarea telefonului. Alegerea se salvează doar pe acest dispozitiv.</p>
    </div>
  );
}
