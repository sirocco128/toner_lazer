/**
 * Markdown → safe HTML for Ops work manuals (tables, lists, headings, inline).
 * Broader than storefront toArticleHtml; still escapes untrusted text.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g,
    (_m, label: string, href: string) =>
      `<a href="${escapeHtml(href)}" class="text-forest underline underline-offset-2 hover:text-brass">${label}</a>`,
  );
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return out;
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function slugifyManualHeading(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase("th")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function manualMarkdownToHtml(input: string): string {
  const raw = String(input || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return "";

  const lines = raw.split("\n");
  const chunks: string[] = [];
  let i = 0;
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    paragraph = [];
    if (text) chunks.push(`<p>${inlineFormat(text)}</p>`);
  };

  const flushList = () => {
    if (!listType || !listItems.length) {
      listType = null;
      listItems = [];
      return;
    }
    const tag = listType;
    chunks.push(
      `<${tag}>${listItems.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</${tag}>`,
    );
    listType = null;
    listItems = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      const lang = trimmed.slice(3).trim().toLowerCase();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      i += 1;
      const source = body.join("\n");
      if (lang === "mermaid") {
        chunks.push(
          [
            `<figure class="ops-mermaid-figure not-prose my-6 overflow-hidden rounded-2xl border border-forest/15 bg-[linear-gradient(165deg,#f7f4ef_0%,#eef5f1_48%,#f4f1ea_100%)] shadow-[0_12px_40px_-24px_rgba(20,53,42,0.45)]">`,
            `<figcaption class="flex flex-wrap items-center justify-between gap-2 border-b border-forest/10 bg-forest/[0.04] px-4 py-2.5">`,
            `<span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">Diagram</span>`,
            `<div class="flex flex-wrap items-center gap-2">`,
            `<span class="text-xs text-ink/50">ลากเลื่อน · ลูกกลิ้งซูม</span>`,
            `<div class="ops-mermaid-toolbar inline-flex items-center gap-0.5 rounded-full border border-forest/15 bg-paper/80 p-0.5 shadow-sm">`,
            `<button type="button" class="ops-mermaid-zoom-out inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-forest hover:bg-forest-mist" aria-label="ซูมออก">−</button>`,
            `<button type="button" class="ops-mermaid-zoom-reset inline-flex h-7 min-w-12 items-center justify-center rounded-full px-2 text-[11px] font-semibold text-forest hover:bg-forest-mist" aria-label="รีเซ็ตซูม"><span class="ops-mermaid-zoom-label">100%</span></button>`,
            `<button type="button" class="ops-mermaid-zoom-in inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-forest hover:bg-forest-mist" aria-label="ซูมเข้า">+</button>`,
            `</div>`,
            `</div>`,
            `</figcaption>`,
            `<div class="ops-mermaid" data-rendered="false">`,
            `<div class="ops-mermaid-viewport relative h-[min(70vh,34rem)] touch-none overflow-hidden overscroll-contain bg-transparent">`,
            `<div class="ops-mermaid-canvas ops-mermaid-stage absolute left-0 top-0 origin-top-left px-3 py-5 sm:px-5 [&_svg]:max-w-none" role="img" aria-label="แผนภาพ Mermaid"></div>`,
            `</div>`,
            `<pre class="ops-mermaid-source hidden" hidden>${escapeHtml(source)}</pre>`,
            `<p class="ops-mermaid-fallback hidden px-4 py-3 text-sm text-red-800" hidden></p>`,
            `</div>`,
            `</figure>`,
          ].join(""),
        );
      } else {
        chunks.push(
          `<pre class="overflow-x-auto rounded-lg bg-forest/95 p-3 text-xs text-paper"><code${
            lang ? ` data-lang="${escapeHtml(lang)}"` : ""
          }>${escapeHtml(source)}</code></pre>`,
        );
      }
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? "")) {
      flushParagraph();
      flushList();
      const header = parseTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        rows.push(parseTableRow((lines[i] ?? "").trim()));
        i += 1;
      }
      const thead = `<thead><tr>${header
        .map((c) => `<th>${inlineFormat(c)}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${inlineFormat(c)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>`;
      chunks.push(
        `<div class="ops-manual-table-wrap overflow-x-auto"><table class="ops-manual-table">${thead}${tbody}</table></div>`,
      );
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      flushParagraph();
      flushList();
      const title = h1[1] || "";
      const id = slugifyManualHeading(title);
      chunks.push(`<h1 id="${id}">${inlineFormat(title)}</h1>`);
      i += 1;
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushParagraph();
      flushList();
      const title = h2[1] || "";
      const id = slugifyManualHeading(title);
      chunks.push(`<h2 id="${id}">${inlineFormat(title)}</h2>`);
      i += 1;
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flushParagraph();
      flushList();
      const title = h3[1] || "";
      const id = slugifyManualHeading(title);
      chunks.push(`<h3 id="${id}">${inlineFormat(title)}</h3>`);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      chunks.push("<hr />");
      i += 1;
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      chunks.push(`<blockquote>${inlineFormat(quote[1] || "")}</blockquote>`);
      i += 1;
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ul[1] || "");
      i += 1;
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(ol[1] || "");
      i += 1;
      continue;
    }

    flushList();
    paragraph.push(trimmed);
    i += 1;
  }

  flushParagraph();
  flushList();
  return chunks.join("\n");
}
