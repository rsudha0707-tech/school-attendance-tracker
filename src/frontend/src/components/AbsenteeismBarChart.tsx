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

export interface BarChartDataPoint {
  grade: string;
  count: number;
  gradeNum: 6 | 7 | 8;
}

interface AbsenteeismBarChartProps {
  data: BarChartDataPoint[];
  activeGrade: 6 | 7 | 8 | null;
  onBarClick: (grade: 6 | 7 | 8) => void;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarChartDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const { grade, count } = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-display font-bold text-foreground">
        {grade}:{" "}
        <span className="text-primary">
          {count} student{count !== 1 ? "s" : ""}
        </span>
      </p>
      <p className="text-muted-foreground text-xs mt-0.5">
        chronic absenteeism
      </p>
    </div>
  );
}

export function AbsenteeismBarChart({
  data,
  activeGrade,
  onBarClick,
}: AbsenteeismBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        barSize={52}
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
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "oklch(var(--muted) / 0.4)" }}
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          onClick={(entry: BarChartDataPoint) => onBarClick(entry.gradeNum)}
          cursor="pointer"
          isAnimationActive={true}
          animationDuration={400}
        >
          {data.map((entry) => {
            const isActive =
              activeGrade === null || activeGrade === entry.gradeNum;
            return (
              <Cell
                key={entry.grade}
                fill={
                  isActive
                    ? "oklch(var(--primary))"
                    : "oklch(var(--primary) / 0.3)"
                }
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
