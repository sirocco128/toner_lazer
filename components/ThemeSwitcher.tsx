"use client";

import { useEffect, useId, useState } from "react";
import {
  applyThemeToDocument,
  parseThemeId,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/theme-presets";

export function ThemeSwitcher({
  compact = false,
  tone = "paper",
}: {
  compact?: boolean;
  /** `onDark` for forest/navy chrome such as the ops header. */
  tone?: "paper" | "onDark";
}) {
  const labelId = useId();
  const [theme, setTheme] = useState<ThemeId>("forest");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const next = parseThemeId(localStorage.getItem(THEME_STORAGE_KEY));
      setTheme(next);
      applyThemeToDocument(next);
    } catch {
      setTheme("forest");
    }
    setMounted(true);
  }, []);

  function select(next: ThemeId) {
    setTheme(next);
    applyThemeToDocument(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="relative">
      <p id={labelId} className="sr-only">
        เลือกธีมสีของเว็บ
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={
          tone === "onDark"
            ? "flex items-center gap-1 rounded-full border border-paper/25 bg-forest-light/70 p-1"
            : "flex items-center gap-1 rounded-full border border-forest/15 bg-paper/80 p-1 backdrop-blur-md"
        }
      >
        {THEME_PRESETS.map((preset) => {
          const active = mounted && theme === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${preset.label}: ${preset.hint}`}
              title={preset.label}
              onClick={() => select(preset.id)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-1.5 transition ${
                tone === "onDark"
                  ? active
                    ? "bg-paper/18 text-brass-soft"
                    : "text-paper/70 hover:bg-paper/10"
                  : active
                    ? "bg-forest text-paper"
                    : "text-ink/70 hover:bg-forest-mist"
              } ${compact ? "" : "sm:px-2.5"}`}
            >
              <span
                className="inline-flex h-4 w-4 overflow-hidden rounded-full border border-white/70 shadow-sm"
                aria-hidden
              >
                <span className="h-full w-1/2" style={{ background: preset.swatchPrimary }} />
                <span className="h-full w-1/2" style={{ background: preset.swatchAccent }} />
              </span>
              {compact ? null : (
                <span className="hidden text-[11px] font-medium lg:inline">
                  {preset.option === "default" ? "เดิม" : preset.option}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
