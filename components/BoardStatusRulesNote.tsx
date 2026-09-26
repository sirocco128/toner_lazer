import { BOARD_TEAM_RULES } from "@/lib/board-status-rules";

type Props = {
  /** แสดงรายการย่อหรือเต็ม */
  compact?: boolean;
};

/** Note กติกาบอร์ดงาน — วางบนหน้าทำงานให้ทีมเห็นตลอด */
export function BoardStatusRulesNote({ compact = false }: Props) {
  const rules = compact ? BOARD_TEAM_RULES.slice(0, 4) : BOARD_TEAM_RULES;

  return (
    <aside
      className="rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-ink/85"
      aria-labelledby="board-status-rules-heading"
    >
      <h2
        id="board-status-rules-heading"
        className="font-semibold text-forest"
      >
        กติกาสั้น ๆ ที่ทีมควรจำ
      </h2>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      {compact ? (
        <p className="mt-2 text-xs text-ink/60">
          ดูกติกาครบที่หน้าบอร์ดงาน
        </p>
      ) : null}
    </aside>
  );
}
