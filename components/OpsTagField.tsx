"use client";

import { useMemo, useState } from "react";
import { SUGGESTED_OPS_TAGS, normalizeOpsTags } from "@/lib/ops-tags";

export function OpsTagField({
  name = "tags",
  defaultTags = [],
  suggestions = [],
  label = "แท็ก",
  hint = "ติดกับลูกค้าหรือบิลนี้ เช่น vip, ปีใหม่, ด่วน — พิมพ์แล้วกดเพิ่ม หรือเลือกจากที่ใช้แล้ว",
}: {
  name?: string;
  defaultTags?: string[];
  suggestions?: string[];
  label?: string;
  hint?: string;
}) {
  const [tags, setTags] = useState(() => normalizeOpsTags(defaultTags));
  const [draft, setDraft] = useState("");
  const known = useMemo(() => {
    const set = new Set<string>([...SUGGESTED_OPS_TAGS, ...suggestions, ...tags]);
    return [...set].sort((a, b) => a.localeCompare(b, "th"));
  }, [suggestions, tags]);

  function add(raw: string) {
    const next = normalizeOpsTags([...tags, raw]);
    setTags(next);
    setDraft("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    }
    if (event.key === "Backspace" && !draft && tags.length) {
      setTags(tags.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={tags.join(", ")} />
      <span className="block text-sm font-medium">{label}</span>
      {hint ? <p className="text-xs text-ink/55">{hint}</p> : null}
      <ul className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              onClick={() => setTags(tags.filter((item) => item !== tag))}
              className="rounded-full bg-forest-mist px-2 py-0.5 text-xs text-forest hover:bg-forest/15"
            >
              {tag} ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          list={`${name}-suggestions`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="พิมพ์แท็กแล้วกด Enter"
          className="min-w-[12rem] flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <datalist id={`${name}-suggestions`}>
          {known.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => add(draft)}
          className="rounded border border-forest/30 px-3 py-2 text-sm"
        >
          เพิ่ม
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {SUGGESTED_OPS_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => add(tag)}
            className="rounded-full border border-dashed border-forest/30 px-2 py-0.5 text-xs text-ink/70 hover:border-forest hover:text-forest"
          >
            + {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
