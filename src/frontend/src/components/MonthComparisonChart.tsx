import type { MonthComparisonData } from "@/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: MonthComparisonData[];
  currentLabel: string;
  comparisonLabel: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-sm min-w-[140px]">
      <p className="font-display font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm inline-block"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {p.value.toFixed(1)}%
          </span>
        </p>
      ))}
    </div>
  );
}

export function MonthComparisonChart({
  data,
  currentLabel,
  comparisonLabel,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        barGap={4}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="grade"
          tick={{ fontSize: 12, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          domain={[0, 25]}
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
        <Legend
          wrapperStyle={{
            fontSize: "11px",
            color: "oklch(var(--muted-foreground))",
          }}
        />
        <Bar
          dataKey="current"
          name={currentLabel}
          fill="oklch(var(--primary))"
          radius={[3, 3, 0, 0]}
          isAnimationActive
          animationDuration={400}
        />
        <Bar
          dataKey="comparison"
          name={comparisonLabel}
          fill="oklch(var(--primary) / 0.35)"
          radius={[3, 3, 0, 0]}
          isAnimationActive
          animationDuration={400}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
