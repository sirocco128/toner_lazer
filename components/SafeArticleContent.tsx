import type { ArticleBlock } from "@/lib/sanitize";

type SafeArticleContentProps = {
  blocks: ArticleBlock[];
};

export function SafeArticleContent({ blocks }: SafeArticleContentProps) {
  if (!blocks.length) {
    return <p className="text-ink/70">ยังไม่มีเนื้อหาบทความ</p>;
  }

  return (
    <div className="prose-custom space-y-4">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "heading2":
            return <h2 key={key}>{block.text}</h2>;
          case "heading3":
            return <h3 key={key}>{block.text}</h3>;
          case "blockquote":
            return <blockquote key={key}>{block.text}</blockquote>;
          case "listItem":
            return (
              <li key={key} className="ml-5 list-disc">
                {block.text}
              </li>
            );
          case "paragraph":
          default:
            return <p key={key}>{block.text}</p>;
        }
      })}
    </div>
  );
}
