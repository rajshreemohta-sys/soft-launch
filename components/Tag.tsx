import { SIGNAL_LABELS, type SignalType } from "@/lib/taxonomy";
import { DEAL_STAGE_LABELS } from "@/lib/format";

export function SignalTag({ type }: { type: string | null }) {
  if (!type) return <span className="muted">{"—"}</span>;
  return <span className={`tag tag-${type}`}>{SIGNAL_LABELS[type as SignalType] ?? type}</span>;
}

export function StageTag({ stage }: { stage: string | null }) {
  if (!stage) return <span className="muted">{"—"}</span>;
  return <span className="stage">{DEAL_STAGE_LABELS[stage] ?? stage}</span>;
}
