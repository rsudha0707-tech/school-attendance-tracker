import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LineChartDataPoint {
  date: string; // ISO
  rate: number; // 0–100
}

interface AttendanceLineChartProps {
  data: LineChartDataPoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const rate = payload[0].value;
  let dateStr = label;
  try {
    dateStr = format(parseISO(label), "EEE MMM d, yyyy");
  } catch {
    // leave as-is
  }
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="text-muted-foreground text-xs mb-0.5">{dateStr}</p>
      <p className="font-display font-bold text-foreground">
        {rate.toFixed(1)}% attendance
      </p>
    </div>
  );
}

export function AttendanceLineChart({ data }: AttendanceLineChartProps) {
  const tickCount = Math.min(data.length, 8);
  const tickInterval =
    data.length <= 8 ? 0 : Math.floor(data.length / tickCount);

  const formatTick = (iso: string) => {
    try {
      return format(parseISO(iso), "MMM d");
    } catch {
      return iso;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          interval={tickInterval}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          domain={[60, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={42}
          tickCount={5}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="oklch(var(--primary))"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "oklch(var(--primary))", strokeWidth: 0 }}
          activeDot={{
            r: 5,
            fill: "oklch(var(--primary))",
            stroke: "oklch(var(--card))",
            strokeWidth: 2,
          }}
          isAnimationActive={true}
          animationDuration={400}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
