import { STATUS_LABEL } from "@/lib/format";
import { STATUS_TONE } from "@/lib/opTheme";
import type { Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
