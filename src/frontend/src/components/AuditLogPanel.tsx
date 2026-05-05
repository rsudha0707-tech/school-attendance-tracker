import type { AuditEntry } from "@/types";
import { format, parseISO } from "date-fns";
import { ClipboardList } from "lucide-react";

interface Props {
  entries: AuditEntry[];
}

const ACTION_COLORS: Record<string, string> = {
  Dismissed: "text-[oklch(var(--warning-foreground))]",
  Sent: "text-primary",
  Added: "text-[oklch(var(--success))]",
};

function getActionColor(action: string): string {
  const verb = action.split(" ")[0];
  return ACTION_COLORS[verb] ?? "text-foreground";
}

function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return iso;
  }
}

export function AuditLogPanel({ entries }: Props) {
  const sorted = [...entries].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider px-1">
        <ClipboardList className="w-4 h-4" />
        <span>{entries.length} entries</span>
      </div>

      {sorted.length === 0 ? (
        <div
          className="py-12 text-center text-sm text-muted-foreground"
          data-ocid="audit_log.empty_state"
        >
          No audit log entries yet.
        </div>
      ) : (
        <div
          className="max-h-[400px] overflow-y-auto space-y-0 divide-y divide-border rounded-lg border border-border overflow-hidden"
          data-ocid="audit_log.list"
        >
          {sorted.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-smooth"
              data-ocid={`audit_log.item.${idx + 1}`}
            >
              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary/50 mt-2" />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${getActionColor(entry.action)}`}
                >
                  {entry.action}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground font-semibold">
                    {entry.actor}
                  </span>
                  <span className="text-muted-foreground opacity-40 text-xs">
                    ·
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
