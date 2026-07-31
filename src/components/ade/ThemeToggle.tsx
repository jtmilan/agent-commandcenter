import { useEffect, useId, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getStoredTheme,
  storeTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

const OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: typeof Moon;
  description: string;
}[] = [
  { id: "dark", label: "Dark", icon: Moon, description: "Terminal dark chrome" },
  { id: "light", label: "Light", icon: Sun, description: "Paper light chrome" },
  { id: "system", label: "System", icon: Monitor, description: "Match operating system" },
];

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setPreference(stored);
    setResolved(applyTheme(stored));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const r = applyTheme(preference);
    setResolved(r);
    storeTheme(preference);
  }, [preference, mounted]);

  useEffect(() => {
    if (!mounted || preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, mounted]);

  return { preference, setPreference, resolved, mounted };
}

/**
 * Accessible theme control:
 * - role="radiogroup" + role="radio" + aria-checked
 * - arrow-key navigation within the group
 * - visible focus ring (global :focus-visible uses accent)
 */
export function ThemeToggle({
  preference,
  onChange,
  compact,
}: {
  preference: ThemePreference;
  onChange: (p: ThemePreference) => void;
  compact?: boolean;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusIndex = (i: number) => {
    const el = refs.current[i];
    el?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="flex items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5"
    >
      <span id={labelId} className="sr-only">
        Color theme
      </span>
      {OPTIONS.map(({ id, label, icon: Icon, description }, index) => {
        const on = preference === id;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label}: ${description}`}
            title={`${label} — ${description}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              let next = index;
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                next = (index + 1) % OPTIONS.length;
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                next = (index - 1 + OPTIONS.length) % OPTIONS.length;
              } else if (e.key === "Home") {
                e.preventDefault();
                next = 0;
              } else if (e.key === "End") {
                e.preventDefault();
                next = OPTIONS.length - 1;
              } else {
                return;
              }
              onChange(OPTIONS[next]!.id);
              focusIndex(next);
            }}
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-1 font-mono text-[10px] transition-colors ${
              on ? "bg-panel text-accent shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            {!compact && <span className="hidden sm:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
