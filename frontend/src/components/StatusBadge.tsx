import { STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLE[status].badge}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
