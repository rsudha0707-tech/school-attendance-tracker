import type { DayOfWeekData } from "@/types";
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
  data: DayOfWeekData[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DayOfWeekData }>;
}) {
  if (!active || !payload?.length) return null;
  const { day, rate } = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-display font-bold text-foreground">{day}</p>
      <p className="text-muted-foreground text-xs mt-0.5">
        Avg absence rate:{" "}
        <span className="text-destructive font-semibold">
          {rate.toFixed(1)}%
        </span>
      </p>
    </div>
  );
}

export function DayOfWeekChart({ data }: Props) {
  const maxRate = Math.max(...data.map((d) => d.rate), 20);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        barSize={44}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 12, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          domain={[0, Math.ceil(maxRate + 5)]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "oklch(var(--muted) / 0.4)" }}
        />
        <Bar
          dataKey="rate"
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
        >
          {data.map((entry) => (
            <Cell
              key={entry.day}
              fill={
                entry.rate === Math.max(...data.map((d) => d.rate))
                  ? "oklch(var(--destructive))"
                  : "oklch(var(--primary) / 0.7)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
