import type { Student } from "@/types";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { useMemo } from "react";

interface Props {
  students: Student[];
  currentMonth: string; // "YYYY-MM"
}

function fmtPct(r: number) {
  return `${Math.round(r * 100)}%`;
}

export function MonthlyReportPanel({ students, currentMonth }: Props) {
  const [year, month] = currentMonth.split("-").map(Number);
  const monthName = format(new Date(year, month - 1, 1), "MMMM yyyy");
  const reportDate = format(new Date(), "MMMM d, yyyy");

  const gradeStats = useMemo(() => {
    return ([6, 7, 8] as const).map((g) => {
      const gs = students.filter((s) => s.grade === g);
      if (gs.length === 0)
        return { grade: g, total: 0, chronic: 0, avgRate: 0, present: 0 };
      const monthRecords = gs.flatMap((s) =>
        s.attendanceHistory.filter((r) => r.date.startsWith(currentMonth)),
      );
      const presentDays = monthRecords.filter(
        (r) => r.status === "present",
      ).length;
      const totalDays = monthRecords.filter(
        (r) => r.status !== "weekend" && r.status !== "holiday",
      ).length;
      const avgRate = totalDays > 0 ? (1 - presentDays / totalDays) * 100 : 0;
      const chronic = gs.filter((s) => s.absenceRate >= 0.1).length;
      return {
        grade: g,
        total: gs.length,
        chronic,
        avgRate,
        present: presentDays,
      };
    });
  }, [students, currentMonth]);

  const top10 = useMemo(
    () =>
      [...students].sort((a, b) => b.daysAbsent - a.daysAbsent).slice(0, 10),
    [students],
  );

  const chronicCount = students.filter((s) => s.absenceRate >= 0.1).length;
  const newlyFlagged = students.filter((s) => s.isNewlyFlagged).length;

  return (
    <div className="space-y-4">
      {/* Print button — hidden in print */}
      <div className="no-print flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-smooth"
          data-ocid="report.print_button"
        >
          <Printer className="w-4 h-4" />
          Print Report
        </button>
      </div>

      {/* Report content */}
      <div
        id="monthly-report-content"
        className="print-report card-elevated p-6 sm:p-8 space-y-6 max-w-2xl mx-auto"
      >
        {/* Header */}
        <div className="border-b border-border pb-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Jefferson Middle School
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground mt-1">
            Monthly Attendance Report
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {monthName} · Generated {reportDate}
          </p>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Students", value: String(students.length) },
            { label: "Chronically Absent", value: String(chronicCount) },
            { label: "Newly Flagged", value: String(newlyFlagged) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="text-center p-3 rounded-lg bg-muted/30 border border-border"
            >
              <div className="text-2xl font-display font-bold text-foreground">
                {value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Grade breakdown table */}
        <div>
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">
            Grade-by-Grade Attendance Summary
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-foreground">
                <th className="px-3 py-2 text-left">Grade</th>
                <th className="px-3 py-2 text-center">Students</th>
                <th className="px-3 py-2 text-center">Chronic Absent</th>
                <th className="px-3 py-2 text-center">Avg Absence Rate</th>
              </tr>
            </thead>
            <tbody>
              {gradeStats.map((row) => (
                <tr key={row.grade} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">
                    Grade {row.grade}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {row.total}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`font-semibold ${row.chronic > 3 ? "text-destructive" : "text-foreground"}`}
                    >
                      {row.chronic}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`font-mono text-xs ${row.avgRate > 15 ? "text-destructive" : row.avgRate > 8 ? "text-[oklch(var(--warning-foreground))]" : "text-foreground"}`}
                    >
                      {row.avgRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top 10 most absent */}
        <div>
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">
            Top 10 Most Absent Students
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-foreground">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-center">Grade</th>
                <th className="px-3 py-2 text-center">Days Absent</th>
                <th className="px-3 py-2 text-center">Rate</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((s, i) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {s.name}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {s.grade}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-sm text-foreground">
                    {s.daysAbsent}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`font-mono text-xs font-semibold ${s.absenceRate >= 0.2 ? "text-destructive" : s.absenceRate >= 0.1 ? "text-[oklch(var(--warning-foreground))]" : "text-foreground"}`}
                    >
                      {fmtPct(s.absenceRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
          Jefferson Middle School · Attendance Dashboard · SY 2025–2026
        </div>
      </div>
    </div>
  );
}
