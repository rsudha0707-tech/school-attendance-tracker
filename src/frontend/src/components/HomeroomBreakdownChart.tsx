import type { HomeroomData } from "@/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: HomeroomData[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HomeroomData }>;
}) {
  if (!active || !payload?.length) return null;
  const { teacher, count, totalStudents } = payload[0].payload;
  const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-display font-bold text-foreground">{teacher}</p>
      <p className="text-muted-foreground text-xs mt-0.5">
        <span className="text-destructive font-semibold">{count}</span> of{" "}
        {totalStudents} chronically absent
        {totalStudents > 0 && (
          <span className="text-muted-foreground"> ({pct}%)</span>
        )}
      </p>
    </div>
  );
}

export function HomeroomBreakdownChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 40 }}
        barSize={32}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="teacher"
          tick={{ fontSize: 10, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          dy={8}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "oklch(var(--muted) / 0.4)" }}
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
        >
          {data.map((entry) => (
            <Cell
              key={entry.teacher}
              fill={
                entry.count >= 4
                  ? "oklch(var(--destructive))"
                  : entry.count >= 2
                    ? "oklch(var(--warning) / 0.9)"
                    : "oklch(var(--primary) / 0.7)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
