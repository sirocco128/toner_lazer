export type ArticleBlockType =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "blockquote"
  | "listItem";

export type ArticleBlock = {
  type: ArticleBlockType;
  text: string;
};

/** Alias used by SafeArticleContent and consumers. */
export type SafeArticleBlock = ArticleBlock;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Remove control characters, normalize whitespace, and trim.
 */
export function cleanText(input: string): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decode common named and numeric HTML entities.
 */
export function decodeEntities(input: string): string {
  return input.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (full, entity: string) => {
      if (entity[0] === "#") {
        const isHex = entity[1]?.toLowerCase() === "x";
        const codePoint = Number.parseInt(
          isHex ? entity.slice(2) : entity.slice(1),
          isHex ? 16 : 10,
        );
        if (!Number.isFinite(codePoint) || codePoint < 0) return full;
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return full;
        }
      }
      return NAMED_ENTITIES[entity] ?? full;
    },
  );
}

function stripDangerousBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*\/?>/gi, "");
}

function stripTagsToText(fragment: string): string {
  const withoutTags = fragment.replace(/<\/?[^>]+>/g, " ");
  return cleanText(decodeEntities(withoutTags));
}

function blockTypeFromTag(tag: string): ArticleBlockType | null {
  switch (tag.toLowerCase()) {
    case "h2":
      return "heading2";
    case "h3":
      return "heading3";
    case "p":
      return "paragraph";
    case "blockquote":
      return "blockquote";
    case "li":
      return "listItem";
    default:
      return null;
  }
}

/**
 * Parse a constrained HTML subset into safe article blocks.
 * Keeps only h2/h3/p/blockquote/li text; strips executable markup.
 */
export function parseSafeArticleBlocks(html: string): ArticleBlock[] {
  if (!html || typeof html !== "string") return [];

  const prepared = stripDangerousBlocks(html);
  const blocks: ArticleBlock[] = [];
  const tagPattern =
    /<(h2|h3|p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const leftovers: string[] = [];

  while ((match = tagPattern.exec(prepared)) !== null) {
    const preceding = prepared.slice(lastIndex, match.index);
    if (preceding.trim()) {
      leftovers.push(preceding);
    }
    lastIndex = tagPattern.lastIndex;

    const tag = match[1] ?? "";
    const inner = match[2] ?? "";
    const type = blockTypeFromTag(tag);
    const text = stripTagsToText(inner);
    if (type && text) {
      blocks.push({ type, text });
    }
  }

  const trailing = prepared.slice(lastIndex);
  if (trailing.trim()) {
    leftovers.push(trailing);
  }

  for (const chunk of leftovers) {
    const text = stripTagsToText(chunk);
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
  }

  return blocks;
}

/**
 * Convert arbitrary HTML/rich text into plain text for SEO/card summaries.
 */
export function htmlToPlainText(html: string): string {
  const withoutDanger = stripDangerousBlocks(html);
  return stripTagsToText(withoutDanger);
}
