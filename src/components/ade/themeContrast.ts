/**
 * WCAG contrast audit for ADE theme tokens (static reference).
 * Ratios computed offline; keep in sync when tokens change.
 */

export type ContrastGrade = "AAA" | "AA" | "AA-large" | "FAIL";

export interface ContrastPair {
  pair: string;
  ratio: number;
  grade: ContrastGrade;
  note?: string;
}

export interface ThemeContrastReport {
  theme: "dark" | "light";
  pairs: ContrastPair[];
}

/** Snapshot after AA fixes (July 2026) */
export const CONTRAST_REPORTS: ThemeContrastReport[] = [
  {
    theme: "dark",
    pairs: [
      { pair: "fg on bg", ratio: 16.36, grade: "AAA" },
      { pair: "fg on surface", ratio: 15.44, grade: "AAA" },
      { pair: "muted on bg", ratio: 6.23, grade: "AA" },
      { pair: "subtle on bg", ratio: 5.04, grade: "AA", note: "bumped #5c6370→#7a8190" },
      { pair: "accent on bg", ratio: 9.84, grade: "AAA" },
      { pair: "accent-fg on accent", ratio: 9.46, grade: "AAA" },
      { pair: "need on bg", ratio: 9.41, grade: "AAA" },
      { pair: "success on bg", ratio: 8.5, grade: "AAA" },
      { pair: "danger on bg", ratio: 6.16, grade: "AA" },
      { pair: "info on bg", ratio: 6.9, grade: "AA" },
    ],
  },
  {
    theme: "light",
    pairs: [
      { pair: "fg on bg", ratio: 15.82, grade: "AAA" },
      { pair: "fg on surface", ratio: 17.75, grade: "AAA" },
      { pair: "muted on bg", ratio: 5.39, grade: "AA" },
      { pair: "subtle on bg", ratio: 5.39, grade: "AA", note: "was 2.82 FAIL" },
      { pair: "accent on bg", ratio: 5.67, grade: "AA", note: "was 3.54 AA-large only" },
      { pair: "accent-fg on accent", ratio: 6.36, grade: "AA" },
      { pair: "need on bg", ratio: 4.88, grade: "AA", note: "was 3.55" },
      { pair: "success on bg", ratio: 4.8, grade: "AA", note: "was 3.90" },
      { pair: "danger on bg", ratio: 4.58, grade: "AA" },
      { pair: "info on bg", ratio: 4.71, grade: "AA" },
    ],
  },
];

/** Minimal theme toggle — copy/paste reference for ADE / Tauri UI */
export const THEME_TOGGLE_SNIPPET = `// theme.ts — preference + FOUC-safe apply
export type ThemePreference = "dark" | "light" | "system";

const KEY = "hr-ade-theme";

export function resolveTheme(pref: ThemePreference): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

export function applyTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.dataset.theme = pref;
  root.style.colorScheme = resolved;
  localStorage.setItem(KEY, pref);
  return resolved;
}

// FOUC-safe <head> script (run before paint)
// (function(){var t=localStorage.getItem("hr-ade-theme")||"system";
//   var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
//   document.documentElement.classList.toggle("dark",d);
//   document.documentElement.classList.toggle("light",!d);
//   document.documentElement.style.colorScheme=d?"dark":"light";})();

/* CSS — one token surface, two themes
@theme {
  --color-bg: #0a0b0d;
  --color-fg: #e8eaef;
  --color-accent: #5ec8c0;
}
html.light {
  --color-bg: #f0f2f5;
  --color-fg: #151820;
  --color-accent: #0a6b64; /* ≥4.5:1 body accent */
}
*/

// ThemeToggle.tsx — radiogroup + aria-checked
export function ThemeToggle({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (v: ThemePreference) => void;
}) {
  const opts = ["dark", "light", "system"] as const;
  return (
    <div role="radiogroup" aria-label="Color theme" className="flex gap-1">
      {opts.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={
            value === id
              ? "bg-panel text-accent"
              : "text-muted hover:text-fg"
          }
        >
          {id}
        </button>
      ))}
    </div>
  );
}`;
