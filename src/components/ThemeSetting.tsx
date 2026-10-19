"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "auto", label: "Automat" },
  { value: "light", label: "Luminos" },
  { value: "dark", label: "Întunecat" },
];

function apply(theme: Theme) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Alegerea temei: Automat (dupa telefon), Luminos sau Intunecat. Se pastreaza in browser, pe fiecare dispozitiv. */
export default function ThemeSetting() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

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
