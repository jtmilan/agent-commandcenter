/**
 * In-app docs: CSS custom properties, contrast audit, theme toggle snippet.
 */
import { useState } from "react";
import { Check, ClipboardCopy, Contrast, Palette } from "lucide-react";
import { CONTRAST_REPORTS, THEME_TOGGLE_SNIPPET } from "./themeContrast";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemePreference } from "./theme";

const gradeClass: Record<string, string> = {
  AAA: "text-success",
  AA: "text-success",
  "AA-large": "text-need",
  FAIL: "text-danger",
};

export function ThemeDocsPanel({
  preference,
  resolved,
  onTheme,
}: {
  preference: ThemePreference;
  resolved: "dark" | "light";
  onTheme: (p: ThemePreference) => void;
}) {
  const [copied, setCopied] = useState(false);
  const report =
    CONTRAST_REPORTS.find((r) => r.theme === resolved) ?? CONTRAST_REPORTS[0]!;

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-surface p-4">
        <h3 className="flex items-center gap-2 font-mono text-sm font-semibold text-fg">
          <Palette className="size-4 text-accent" />
          CSS custom properties
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Tailwind v4 <code className="text-accent">@theme</code> registers{" "}
          <code className="text-fg">--color-*</code> tokens as utilities (
          <code className="text-fg">bg-bg</code>, <code className="text-fg">text-fg</code>
          , <code className="text-fg">border-border</code>). Themes override the{" "}
          <em>same</em> variables on <code className="text-fg">html.dark</code> /{" "}
          <code className="text-fg">html.light</code> — components stay semantic; no
          theme branches in JSX.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[10px] leading-relaxed text-muted">
{`@theme {
  --color-bg: #0a0b0d;
  --color-fg: #e8eaef;
  --color-accent: #5ec8c0;
  /* … surface, muted, need, success, danger … */
}

html.light {
  --color-bg: #f0f2f5;
  --color-fg: #151820;
  --color-accent: #0a6b64; /* AA link/text on paper */
}

/* Use tokens, not hex, in components: */
/* <div className="bg-surface text-fg border-border" /> */`}
        </pre>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted">
          <li>
            <span className="text-fg">Layering</span> — bg → surface → elevated → panel
          </li>
          <li>
            <span className="text-fg">Text</span> — fg (body) · muted (secondary) · subtle
            (meta, still ≥4.5:1)
          </li>
          <li>
            <span className="text-fg">Lanes</span> — need / success / danger / info + -dim
          </li>
          <li>
            <span className="text-fg">color-scheme</span> — set on html for native scrollbars
            / form controls
          </li>
        </ul>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h3 className="flex items-center gap-2 font-mono text-sm font-semibold text-fg">
          <Contrast className="size-4 text-accent" />
          Contrast audit (WCAG 2.1)
        </h3>
        <p className="mt-1 text-[11px] text-muted">
          Target: body text ≥4.5:1 (AA), preferred ≥7:1 (AAA). Showing{" "}
          <span className="text-accent">{report.theme}</span> tokens (resolved UI).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-subtle">
                <th className="py-1.5 pr-2">Pair</th>
                <th className="py-1.5 pr-2">Ratio</th>
                <th className="py-1.5 pr-2">Grade</th>
                <th className="py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {report.pairs.map((row) => (
                <tr key={row.pair} className="border-b border-border/50">
                  <td className="py-1.5 pr-2 text-fg">{row.pair}</td>
                  <td className="py-1.5 pr-2 text-muted">{row.ratio.toFixed(2)}:1</td>
                  <td className={`py-1.5 pr-2 font-semibold ${gradeClass[row.grade]}`}>
                    {row.grade}
                  </td>
                  <td className="py-1.5 text-subtle">{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[10px] text-subtle">
          Light theme accent/subtle/need/success were raised after audit (were AA-large or
          FAIL for small text).
        </p>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h3 className="font-mono text-sm font-semibold text-fg">Live toggle</h3>
        <p className="mt-1 text-[11px] text-muted">
          Radiogroup · arrow keys · aria-checked · preference{" "}
          <code className="text-accent">{preference}</code>
        </p>
        <div className="mt-3">
          <ThemeToggle preference={preference} onChange={onTheme} />
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-semibold text-fg">Theme toggle snippet</h3>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(THEME_TOGGLE_SNIPPET);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
            className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-muted hover:text-fg"
          >
            {copied ? (
              <>
                <Check className="size-3 text-success" /> Copied
              </>
            ) : (
              <>
                <ClipboardCopy className="size-3" /> Copy snippet
              </>
            )}
          </button>
        </div>
        <pre className="mt-3 max-h-[40dvh] overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-[10px] leading-relaxed text-muted">
          {THEME_TOGGLE_SNIPPET}
        </pre>
      </section>
    </div>
  );
}
