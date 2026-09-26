"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SuggestItem = {
  label: string;
  value: string;
  [key: string]: string | undefined;
};

type SuggestInputProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  fetchUrl: (query: string) => string;
  onChange: (value: string, item?: SuggestItem) => void;
};

export function SuggestInput({
  id,
  name,
  label,
  value,
  error,
  placeholder,
  disabled,
  autoComplete = "off",
  fetchUrl,
  onChange,
}: SuggestInputProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function load(query: string) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        const response = await fetch(fetchUrl(query), { cache: "no-store" });
        const json = (await response.json()) as { items?: SuggestItem[] };
        setItems(json.items || []);
        setActive(0);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 180);
  }

  function pick(item: SuggestItem) {
    onChange(item.value, item);
    setOpen(false);
  }

  const errorId = `${id}-error`;

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        onChange={(event) => {
          onChange(event.target.value);
          load(event.target.value);
        }}
        onFocus={() => load(value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === "Enter" && open && items[active]) {
            event.preventDefault();
            pick(items[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-forest/15 bg-paper py-1 shadow-lg"
        >
          {items.map((item, index) => (
            <li key={`${item.value}-${index}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  index === active ? "bg-forest-mist text-forest" : "text-ink"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
