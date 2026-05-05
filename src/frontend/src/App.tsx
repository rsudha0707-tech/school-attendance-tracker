import { AbsenteeismBarChart } from "@/components/AbsenteeismBarChart";
import { AttendanceLineChart } from "@/components/AttendanceLineChart";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { DayOfWeekChart } from "@/components/DayOfWeekChart";
import { HomeroomBreakdownChart } from "@/components/HomeroomBreakdownChart";
import { MonthComparisonChart } from "@/components/MonthComparisonChart";
import { MonthlyReportPanel } from "@/components/MonthlyReportPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ALL_TEACHERS,
  SCHOOL_DAYS_LIST,
  TEACHERS_BY_GRADE,
  TODAY,
  TOTAL_STUDENTS,
} from "@/data/students";
import { useAppData } from "@/hooks/useAppData";
import { useSortableTable } from "@/hooks/useSortableTable";
import type {
  AttendanceStatus,
  AuditEntry,
  ContactNote,
  LetterRecord,
  SortField,
  Student,
  TrendDirection,
} from "@/types";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { format, isWithinInterval, parseISO } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  Download,
  FileText,
  LogIn,
  LogOut,
  Minus,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Pagination ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-border bg-muted/20"
      data-ocid="all_students.pagination"
    >
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        {totalItems === 0
          ? "No students to show"
          : `Showing students ${rangeStart}–${rangeEnd} of ${totalItems}`}
      </p>

      <nav
        className="flex items-center gap-1.5 order-1 sm:order-2"
        aria-label="Pagination"
      >
        {/* First page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth text-xs font-semibold"
          aria-label="First page"
          data-ocid="all_students.pagination_first"
        >
          «
        </button>

        {/* Previous */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center justify-center gap-1 px-3 h-8 rounded-md border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth min-w-[80px]"
          aria-label="Previous page"
          data-ocid="all_students.pagination_prev"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        {/* Page indicator */}
        <span
          className="px-3 h-8 flex items-center justify-center rounded-md border border-primary bg-primary/10 text-primary text-xs font-bold min-w-[80px] text-center"
          aria-current="page"
          data-ocid="all_students.pagination_indicator"
        >
          Page {currentPage} of {totalPages}
        </span>

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center justify-center gap-1 px-3 h-8 rounded-md border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth min-w-[80px]"
          aria-label="Next page"
          data-ocid="all_students.pagination_next"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth text-xs font-semibold"
          aria-label="Last page"
          data-ocid="all_students.pagination_last"
        >
          »
        </button>
      </nav>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getAbsenceLabel(rate: number): "critical" | "warning" | "none" {
  if (rate >= 0.2) return "critical";
  if (rate >= 0.1) return "warning";
  return "none";
}

function fmtPercent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000,
  );
}

function getLastContactDate(student: Student): string | null {
  const dates: string[] = [];
  if (student.notes.length > 0) dates.push(student.notes[0].date.slice(0, 10));
  if (student.letterHistory.length > 0)
    dates.push(student.letterHistory[0].sentAt.slice(0, 10));
  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

function computeTrend(student: Student, schoolDays: string[]): TrendDirection {
  const recent = schoolDays.slice(-14);
  const older = schoolDays.slice(-28, -14);
  if (older.length === 0) return "stable";

  const absentRateIn = (days: string[]) => {
    const records = student.attendanceHistory.filter((r) =>
      days.includes(r.date),
    );
    if (records.length === 0) return 0;
    return (
      records.filter((r) => r.status === "absent" || r.status === "excused")
        .length / records.length
    );
  };

  const recentRate = absentRateIn(recent);
  const olderRate = absentRateIn(older);
  const diff = (recentRate - olderRate) * 100;

  if (diff > 2) return "worsening";
  if (diff < -2) return "improving";
  return "stable";
}

function getMilestone(daysAbsent: number): {
  label: string;
  color: string;
} | null {
  if (daysAbsent >= 20)
    return {
      label: `${daysAbsent}d`,
      color: "text-destructive bg-destructive/10",
    };
  if (daysAbsent >= 15)
    return {
      label: `${daysAbsent}d`,
      color:
        "text-[oklch(var(--warning-foreground))] bg-[oklch(var(--warning)/0.15)]",
    };
  if (daysAbsent >= 10)
    return { label: `${daysAbsent}d`, color: "text-foreground bg-muted" };
  if (daysAbsent >= 5)
    return { label: `${daysAbsent}d`, color: "text-muted-foreground bg-muted" };
  return null;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ rate }: { rate: number }) {
  const level = getAbsenceLabel(rate);
  if (level === "critical")
    return (
      <span className="badge-critical" data-ocid="status.badge.critical">
        Critical
      </span>
    );
  if (level === "warning")
    return (
      <span className="badge-warning" data-ocid="status.badge.warning">
        Warning
      </span>
    );
  return (
    <span className="badge-on-track" data-ocid="status.badge.on_track">
      On Track
    </span>
  );
}

function AtRiskBadge({ rate }: { rate: number }) {
  if (rate >= 0.08 && rate < 0.1) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[oklch(var(--warning)/0.2)] text-[oklch(var(--warning-foreground))] border border-[oklch(var(--warning)/0.3)]"
        title="Projected to cross 10% threshold by year-end"
        data-ocid="status.at_risk_badge"
      >
        <AlertTriangle className="w-2.5 h-2.5" />
        At Risk
      </span>
    );
  }
  return null;
}

// ─── Trend Arrow ─────────────────────────────────────────────────────────────

function TrendArrow({ trend }: { trend: TrendDirection }) {
  if (trend === "improving")
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[oklch(var(--success))] text-xs font-semibold"
        title="Improving: absence rate decreased over past 2 weeks"
        data-ocid="trend.improving"
      >
        <TrendingUp className="w-3.5 h-3.5" />
      </span>
    );
  if (trend === "worsening")
    return (
      <span
        className="inline-flex items-center gap-0.5 text-destructive text-xs font-semibold"
        title="Worsening: absence rate increased over past 2 weeks"
        data-ocid="trend.worsening"
      >
        <TrendingDown className="w-3.5 h-3.5" />
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-0.5 text-muted-foreground text-xs"
      title="Stable"
      data-ocid="trend.stable"
    >
      <Minus className="w-3.5 h-3.5" />
    </span>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({
  field,
  sort,
}: {
  field: SortField;
  sort: { field: SortField; direction: "asc" | "desc" };
}) {
  if (sort.field !== field)
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
  return sort.direction === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5" />
  );
}

// ─── Attendance Calendar ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-[oklch(var(--success))]",
  absent: "bg-destructive",
  excused: "bg-[oklch(var(--warning))]",
  weekend: "bg-muted",
  holiday: "bg-muted",
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function AttendanceCalendar({
  history,
}: { history: Student["attendanceHistory"] }) {
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const r of history) months.add(r.date.slice(0, 7));
    return Array.from(months).sort();
  }, [history]);

  const [monthIdx, setMonthIdx] = useState(availableMonths.length - 1);
  const currentMonth = availableMonths[monthIdx] ?? "";

  const byDate = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const r of history) map[r.date] = r.status;
    return map;
  }, [history]);

  const calDays = useMemo(() => {
    if (!currentMonth) return [];
    const [y, m] = currentMonth.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: Array<{
      date: string | null;
      status: AttendanceStatus | null;
    }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, status: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(y, m - 1, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      cells.push({
        date,
        status: isWeekend ? "weekend" : (byDate[date] ?? null),
      });
    }
    return cells;
  }, [currentMonth, byDate]);

  const [y, m] = currentMonth ? currentMonth.split("-").map(Number) : [0, 0];

  const monthStats = useMemo(() => {
    const monthRecords = history.filter((r) => r.date.startsWith(currentMonth));
    const present = monthRecords.filter((r) => r.status === "present").length;
    const absent = monthRecords.filter(
      (r) => r.status === "absent" || r.status === "excused",
    ).length;
    return { present, absent };
  }, [history, currentMonth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
          disabled={monthIdx === 0}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 transition-smooth"
          aria-label="Previous month"
          data-ocid="calendar.prev_button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-display font-semibold text-sm text-foreground">
          {MONTH_NAMES[m - 1]} {y}
        </span>
        <button
          type="button"
          onClick={() =>
            setMonthIdx((i) => Math.min(availableMonths.length - 1, i + 1))
          }
          disabled={monthIdx === availableMonths.length - 1}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 transition-smooth"
          aria-label="Next month"
          data-ocid="calendar.next_button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-[10px] font-semibold text-muted-foreground uppercase"
          >
            {d}
          </div>
        ))}
        {calDays.map((cell, i) => (
          <div
            key={cell.date ?? `empty-${i}`}
            className="aspect-square flex items-center justify-center"
          >
            {cell.date ? (
              <div className="relative group w-7 h-7 flex items-center justify-center rounded-full">
                <div
                  className={`w-5 h-5 rounded-full ${cell.status ? STATUS_COLORS[cell.status] : "bg-muted"} ${cell.status === "weekend" ? "opacity-20" : "opacity-90"}`}
                  title={cell.date}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white pointer-events-none mix-blend-overlay">
                  {cell.status !== "weekend"
                    ? new Date(`${cell.date}T12:00:00`).getDate()
                    : ""}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {[
          { color: "bg-[oklch(var(--success))]", label: "Present" },
          { color: "bg-destructive", label: "Absent" },
          { color: "bg-[oklch(var(--warning))]", label: "Excused" },
          { color: "bg-muted border border-border", label: "Weekend" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${color} inline-block`} />
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="text-center">
          <div className="text-lg font-display font-bold text-[oklch(var(--success))]">
            {monthStats.present}
          </div>
          <div className="text-xs text-muted-foreground">Days Present</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-display font-bold text-destructive">
            {monthStats.absent}
          </div>
          <div className="text-xs text-muted-foreground">Days Absent</div>
        </div>
      </div>
    </div>
  );
}

// ─── Student Notes Section ───────────────────────────────────────────────────

function StudentNotesSection({
  student,
  notes,
  onAddNote,
  currentRole,
}: {
  student: Student;
  notes: ContactNote[];
  onAddNote: (studentId: string, text: string, author: string) => void;
  currentRole: string;
}) {
  const [newNote, setNewNote] = useState("");
  const studentNotes = notes.filter((n) => n.studentId === student.id);

  const handleAdd = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    onAddNote(student.id, trimmed, currentRole);
    setNewNote("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note (call, meeting, outreach)…"
          rows={3}
          className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
          data-ocid="student.note_textarea"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newNote.trim()}
          className="self-end"
          data-ocid="student.add_note_button"
        >
          Add Note
        </Button>
      </div>

      {studentNotes.length === 0 ? (
        <p
          className="text-xs text-muted-foreground py-2"
          data-ocid="student.notes.empty_state"
        >
          No notes yet. Add the first note above.
        </p>
      ) : (
        <div className="space-y-2">
          {studentNotes.map((note) => (
            <div
              key={note.id}
              className="bg-muted/30 rounded-md p-3 border border-border"
            >
              <p className="text-sm text-foreground leading-relaxed">
                {note.text}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span className="font-semibold">{note.author}</span>
                <span className="opacity-40">·</span>
                <span>{note.date.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Student Letter History ──────────────────────────────────────────────────

function LetterHistorySection({ letters }: { letters: LetterRecord[] }) {
  if (letters.length === 0) {
    return (
      <p
        className="text-xs text-muted-foreground py-2"
        data-ocid="student.letters.empty_state"
      >
        No letters sent yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {letters.map((l) => (
        <div
          key={`${l.studentId}-${l.sentAt}`}
          className="flex items-center gap-3 bg-muted/20 rounded-md p-2.5 border border-border text-sm"
        >
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-foreground font-medium">
              Parent notification letter
            </span>
            <div className="text-xs text-muted-foreground mt-0.5">
              Sent by {l.sentBy} · {l.sentAt.slice(0, 10)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Student Detail Panel ─────────────────────────────────────────────────────

function StudentPanel({
  student,
  notes,
  letterHistory,
  onClose,
  onAddNote,
  currentRole,
}: {
  student: Student | null;
  notes: ContactNote[];
  letterHistory: LetterRecord[];
  onClose: () => void;
  onAddNote: (studentId: string, text: string, author: string) => void;
  currentRole: string;
}) {
  const [activeTab, setActiveTab] = useState<"calendar" | "notes" | "letters">(
    "calendar",
  );
  if (!student) return null;
  const level = getAbsenceLabel(student.absenceRate);
  const lastContact = getLastContactDate(student);
  const daysSince = lastContact ? daysBetween(lastContact, TODAY) : null;
  const trend = computeTrend(student, SCHOOL_DAYS_LIST);
  const milestone = getMilestone(student.daysAbsent);
  const studentLetters = letterHistory.filter(
    (l) => l.studentId === student.id,
  );

  return (
    <Sheet
      open={!!student}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        data-ocid="student.panel"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display text-xl">
            {student.name}
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold">
              Grade {student.grade}
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {student.teacher}
            </Badge>
            {level !== "none" && <StatusBadge rate={student.absenceRate} />}
            {student.isNewlyFlagged && (
              <span
                className="badge-neutral text-xs"
                data-ocid="student.newly_flagged_badge"
              >
                New Flag
              </span>
            )}
            <TrendArrow trend={trend} />
            {milestone && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded ${milestone.color}`}
                title={`Milestone: ${student.daysAbsent} days absent`}
              >
                {milestone.label}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            {
              label: "Days Present",
              value: student.daysPresent,
              colorClass: "text-[oklch(var(--success))]",
            },
            {
              label: "Days Absent",
              value: student.daysAbsent,
              colorClass: "text-destructive",
            },
            {
              label: "Absence Rate",
              value: fmtPercent(student.absenceRate),
              colorClass:
                level === "critical"
                  ? "text-destructive"
                  : level === "warning"
                    ? "text-[oklch(var(--warning-foreground))]"
                    : "text-foreground",
            },
          ].map(({ label, value, colorClass }) => (
            <div key={label} className="card-elevated p-3 text-center">
              <div className={`text-xl font-display font-bold ${colorClass}`}>
                {value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Last contact indicator */}
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border text-sm">
          <UserCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {daysSince === null ? (
            <span className="text-muted-foreground">No contact on record</span>
          ) : (
            <span className="text-foreground">
              Last contact:{" "}
              <span
                className={`font-semibold ${daysSince > 14 ? "text-destructive" : "text-foreground"}`}
              >
                {daysSince === 0
                  ? "today"
                  : `${daysSince} day${daysSince === 1 ? "" : "s"} ago`}
              </span>
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-4">
          {(["calendar", "notes", "letters"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-xs font-semibold py-2.5 transition-smooth border-b-2 capitalize ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-ocid={`student.tab.${tab}`}
            >
              {tab === "notes"
                ? `Notes (${notes.filter((n) => n.studentId === student.id).length})`
                : tab === "letters"
                  ? `Letters (${studentLetters.length})`
                  : "Calendar"}
            </button>
          ))}
        </div>

        {activeTab === "calendar" && (
          <div className="card-elevated p-4">
            <h3 className="font-display font-semibold text-sm mb-4 text-foreground">
              Attendance History
            </h3>
            <AttendanceCalendar history={student.attendanceHistory} />
          </div>
        )}

        {activeTab === "notes" && (
          <div className="card-elevated p-4 space-y-4">
            <h3 className="font-display font-semibold text-sm text-foreground">
              Contact Notes
            </h3>
            <StudentNotesSection
              student={student}
              notes={notes}
              onAddNote={onAddNote}
              currentRole={currentRole}
            />
          </div>
        )}

        {activeTab === "letters" && (
          <div className="card-elevated p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm text-foreground">
              Letter History
            </h3>
            <LetterHistorySection letters={studentLetters} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Parent Letter Modal ──────────────────────────────────────────────────────

function ParentLetterModal({
  student,
  onClose,
  onSent,
  currentRole,
}: {
  student: Student | null;
  onClose: () => void;
  onSent: (student: Student, sentBy: string) => void;
  currentRole: string;
}) {
  if (!student) return null;

  const today = format(new Date(), "MMMM d, yyyy");
  const letterText = `${today}

Dear Parent or Guardian of ${student.name},

We are writing to bring to your attention a concern regarding ${student.name}'s attendance record at Jefferson Middle School.

As of today, ${student.name} (Grade ${student.grade}) has an absence rate of ${fmtPercent(student.absenceRate)}, which has crossed the chronic absenteeism threshold established by our school. Regular attendance is essential to academic success, and we are committed to supporting every student in reaching their full potential.

We would like to invite you to schedule a meeting with ${student.name}'s counselor and grade-level team to discuss attendance patterns and explore how we can work together to improve attendance going forward. Early intervention is key, and your partnership makes a meaningful difference.

Please contact the main office at Jefferson Middle School to schedule a meeting at your earliest convenience. We are available Monday through Friday, 8:00 AM – 4:00 PM.

We appreciate your attention to this matter and look forward to working with you.

Sincerely,

Attendance Office
Jefferson Middle School
Grades 6–8 | SY 2025–2026`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(letterText);
  };
  const handleSent = () => {
    onSent(student, currentRole);
    onClose();
  };

  return (
    <Dialog
      open={!!student}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg max-h-[85vh] flex flex-col"
        data-ocid="letter.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Parent Notification Letter
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {student.name} · Grade {student.grade} ·{" "}
            {fmtPercent(student.absenceRate)} absence rate
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-2">
          <pre className="whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed bg-muted/30 rounded-md p-4 border border-border">
            {letterText}
          </pre>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCopy}
            data-ocid="letter.copy_button"
          >
            Copy to Clipboard
          </Button>
          <Button
            className="flex-1"
            onClick={handleSent}
            data-ocid="letter.confirm_button"
          >
            Mark as Sent
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notification Bell + Alerts Dropdown ─────────────────────────────────────

type AlertItem = { id: string; student: Student };

function useAlerts(
  dismissed: Set<string>,
  visibleStudents: Student[],
): AlertItem[] {
  return useMemo(() => {
    return visibleStudents
      .filter(
        (s) => s.absenceRate >= 0.1 && s.isNewlyFlagged && !dismissed.has(s.id),
      )
      .map((s) => ({ id: s.id, student: s }));
  }, [dismissed, visibleStudents]);
}

function AlertsDropdown({
  alerts,
  onDismiss,
  onSendLetter,
  onClose,
}: {
  alerts: AlertItem[];
  onDismiss: (id: string) => void;
  onSendLetter: (student: Student) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-[340px] sm:w-[400px] card-elevated shadow-lg z-50 overflow-hidden"
      data-ocid="alerts.dropdown"
      aria-label="Alerts panel"
    >
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-sm text-foreground">
            Recent Alerts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Students crossing chronic threshold this week
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-smooth text-muted-foreground hover:text-foreground"
          aria-label="Close alerts"
          data-ocid="alerts.close_button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div
            className="px-4 py-8 text-center text-sm text-muted-foreground"
            data-ocid="alerts.empty_state"
          >
            No new alerts this week.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert, idx) => (
              <li
                key={alert.id}
                className="px-4 py-3 hover:bg-muted/20 transition-smooth"
                data-ocid={`alerts.item.${idx + 1}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">
                      {alert.student.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>Grade {alert.student.grade}</span>
                      <span className="opacity-40">·</span>
                      <span className="font-semibold text-destructive">
                        {fmtPercent(alert.student.absenceRate)} absent
                      </span>
                    </div>
                  </div>
                  <StatusBadge rate={alert.student.absenceRate} />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => onSendLetter(alert.student)}
                    className="flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-smooth flex items-center justify-center gap-1.5 min-h-[36px]"
                    data-ocid={`alerts.send_letter_button.${idx + 1}`}
                  >
                    <Send className="w-3 h-3" />
                    Send Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(alert.id)}
                    className="flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-smooth min-h-[36px]"
                    data-ocid={`alerts.dismiss_button.${idx + 1}`}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────

function NotificationBell({
  count,
  onClick,
  isOpen,
}: { count: number; onClick: () => void; isOpen: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-2 rounded-md transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] min-w-[40px] flex items-center justify-center ${isOpen ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
      aria-label={`Notifications${count > 0 ? `, ${count} new alerts` : ""}`}
      aria-expanded={isOpen}
      data-ocid="alerts.bell_button"
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground"
          aria-hidden="true"
          data-ocid="alerts.badge"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ─── Role Switcher ─────────────────────────────────────────────────────────

function RoleSwitcher({
  currentRole,
  onChange,
}: { currentRole: string; onChange: (r: string) => void }) {
  const roles = ["Principal", ...ALL_TEACHERS];
  return (
    <div className="flex items-center gap-2">
      <UserCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
      <select
        value={currentRole}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs sm:text-sm h-8 px-2 py-1 rounded-md border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-smooth cursor-pointer max-w-[140px] sm:max-w-[180px]"
        aria-label="Switch role"
        data-ocid="role_switcher.select"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Login Button ─────────────────────────────────────────────────────────────

function LoginButton() {
  const {
    login,
    clear,
    isAuthenticated,
    isLoggingIn,
    isInitializing,
    identity,
  } = useInternetIdentity();

  if (isInitializing) {
    return (
      <div
        className="h-8 w-24 bg-muted/60 animate-pulse rounded-md"
        data-ocid="auth.loading_state"
      />
    );
  }

  if (isAuthenticated && identity) {
    const principal = identity.getPrincipal().toText();
    const shortPrincipal = `${principal.slice(0, 5)}…${principal.slice(-3)}`;
    return (
      <div className="flex items-center gap-2" data-ocid="auth.logged_in">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
            Logged in
          </span>
          <span
            className="text-xs font-mono text-foreground/80 leading-tight mt-0.5"
            title={principal}
          >
            {shortPrincipal}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clear}
          className="h-8 gap-1.5 text-xs font-semibold border-border hover:border-destructive/50 hover:text-destructive hover:bg-destructive/5 transition-smooth"
          data-ocid="auth.logout_button"
          aria-label="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={login}
      disabled={isLoggingIn}
      className="h-8 gap-1.5 text-xs font-semibold transition-smooth"
      data-ocid="auth.login_button"
      aria-label="Log in with Internet Identity"
    >
      <LogIn className="w-3.5 h-3.5" />
      {isLoggingIn ? (
        <span className="hidden sm:inline">Connecting…</span>
      ) : (
        <span className="hidden sm:inline">Login</span>
      )}
    </Button>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportToCSV(students: Student[], filename = "attendance-report.csv") {
  const header = [
    "Name",
    "Grade",
    "Teacher",
    "Days Missed",
    "Total Days",
    "Absence Rate",
    "Status",
    "Days Since Last Contact",
  ];
  const rows = students.map((s) => {
    const level = getAbsenceLabel(s.absenceRate);
    const status =
      level === "critical"
        ? "Critical"
        : level === "warning"
          ? "Warning"
          : "On Track";
    const lastContact = getLastContactDate(s);
    const daysSince = lastContact ? daysBetween(lastContact, TODAY) : "—";
    return [
      `"${s.name}"`,
      s.grade,
      `"${s.teacher}"`,
      s.daysAbsent,
      s.totalDays,
      fmtPercent(s.absenceRate),
      status,
      daysSince,
    ];
  });
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Summary Cards ─────────────────────────────────────────────────────────

function SummaryCards({
  todayRate,
  chronicCount,
  newlyFlaggedCount,
  totalStudents,
  onScrollTo,
}: {
  todayRate: number;
  chronicCount: number;
  newlyFlaggedCount: number;
  totalStudents: number;
  onScrollTo: (id: string) => void;
}) {
  const presentCount = Math.round(todayRate * totalStudents);
  const cards = [
    {
      id: "today-rate",
      label: "Today's Attendance Rate",
      value: fmtPercent(todayRate),
      sub: `${presentCount} / ${totalStudents} students present`,
      colorClass:
        todayRate >= 0.9
          ? "text-[oklch(var(--success))]"
          : "text-[oklch(var(--warning-foreground))]",
      ocid: "summary.today_rate.card",
      scrollTo: "today-attendance-section",
    },
    {
      id: "chronic-count",
      label: "Chronically Absent",
      value: `${chronicCount}`,
      sub: `${chronicCount} students / ${Math.round((chronicCount / totalStudents) * 100)}% of total (≥10% absent)`,
      colorClass:
        chronicCount > 50
          ? "text-destructive"
          : "text-[oklch(var(--warning-foreground))]",
      ocid: "summary.chronic_count.card",
      scrollTo: "chronic-absent-section",
    },
    {
      id: "newly-flagged",
      label: "Newly Flagged This Week",
      value: `${newlyFlaggedCount}`,
      sub: `${newlyFlaggedCount} students flagged this week / ${Math.round((newlyFlaggedCount / totalStudents) * 100)}% of total`,
      colorClass: "text-primary",
      ocid: "summary.newly_flagged.card",
      scrollTo: "newly-flagged-section",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {cards.map((card) => (
        <button
          type="button"
          key={card.id}
          className="summary-card text-left hover:shadow-md hover:-translate-y-0.5 transition-smooth cursor-pointer group focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-lg"
          onClick={() => onScrollTo(card.scrollTo)}
          data-ocid={card.ocid}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {card.label}
          </p>
          <p
            className={`text-2xl sm:text-3xl font-display font-bold ${card.colorClass} mt-1`}
          >
            {card.value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Grade Filter Bar ─────────────────────────────────────────────────────────

type GradeFilter = "all" | 6 | 7 | 8;

function GradeFilterBar({
  active,
  onChange,
}: { active: GradeFilter; onChange: (g: GradeFilter) => void }) {
  const filters: Array<{ value: GradeFilter; label: string }> = [
    { value: "all", label: "All Grades" },
    { value: 6, label: "Grade 6" },
    { value: 7, label: "Grade 7" },
    { value: 8, label: "Grade 8" },
  ];
  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      data-ocid="grade_filter.group"
    >
      {filters.map((f) => (
        <button
          key={String(f.value)}
          type="button"
          onClick={() => onChange(f.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === f.value ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"}`}
          data-ocid={`grade_filter.${f.value === "all" ? "all" : `grade_${f.value}`}.button`}
          aria-pressed={active === f.value}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

const SCHOOL_YEAR_START = "2025-09-02";
const SCHOOL_YEAR_END = TODAY;

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (d: string) => void;
  onEndChange: (d: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      data-ocid="date_range.section"
    >
      <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground font-medium">Range:</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="date"
          value={startDate}
          min={SCHOOL_YEAR_START}
          max={endDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="h-8 px-2 py-1 rounded-md border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-smooth cursor-pointer"
          aria-label="Start date"
          data-ocid="date_range.start_input"
        />
        <span className="text-muted-foreground text-sm">→</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={SCHOOL_YEAR_END}
          onChange={(e) => onEndChange(e.target.value)}
          className="h-8 px-2 py-1 rounded-md border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-smooth cursor-pointer"
          aria-label="End date"
          data-ocid="date_range.end_input"
        />
      </div>
    </div>
  );
}

// ─── Day Of Week Chart Data ───────────────────────────────────────────────────

function computeDayOfWeekData(
  students: Student[],
  startDate: string,
  endDate: string,
) {
  const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const totals: Record<number, { absent: number; total: number }> = {
    1: { absent: 0, total: 0 },
    2: { absent: 0, total: 0 },
    3: { absent: 0, total: 0 },
    4: { absent: 0, total: 0 },
    5: { absent: 0, total: 0 },
  };

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  for (const s of students) {
    for (const r of s.attendanceHistory) {
      const dt = parseISO(r.date);
      if (!isWithinInterval(dt, { start, end })) continue;
      if (r.status === "weekend" || r.status === "holiday") continue;
      const dow = dt.getDay(); // 1-5
      if (!totals[dow]) continue;
      totals[dow].total++;
      if (r.status === "absent" || r.status === "excused") totals[dow].absent++;
    }
  }

  return DOW_LABELS.map((day, i) => {
    const dowNum = i + 1;
    const { absent, total } = totals[dowNum];
    return { day, rate: total > 0 ? (absent / total) * 100 : 0 };
  });
}

// ─── Charts Section ───────────────────────────────────────────────────────────

function ChartsSection({
  gradeFilter,
  onGradeChange,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  roleStudents,
}: {
  gradeFilter: GradeFilter;
  onGradeChange: (g: GradeFilter) => void;
  startDate: string;
  endDate: string;
  onStartChange: (d: string) => void;
  onEndChange: (d: string) => void;
  roleStudents: Student[];
}) {
  const filteredStudents = useMemo(
    () =>
      gradeFilter === "all"
        ? roleStudents
        : roleStudents.filter((s) => s.grade === gradeFilter),
    [roleStudents, gradeFilter],
  );

  const lineData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const windowDays = SCHOOL_DAYS_LIST.filter((d) =>
      isWithinInterval(parseISO(d), { start, end }),
    );

    return windowDays.map((day) => {
      const total = filteredStudents.length;
      if (total === 0) return { date: day, rate: 0 };
      const present = filteredStudents.filter((s) =>
        s.attendanceHistory.some(
          (r) =>
            r.date === day &&
            (r.status === "present" || r.status === "excused"),
        ),
      ).length;
      return { date: day, rate: total > 0 ? (present / total) * 100 : 0 };
    });
  }, [filteredStudents, startDate, endDate]);

  const barData = useMemo(() => {
    return ([6, 7, 8] as const).map((g) => ({
      grade: `Grade ${g}`,
      gradeNum: g,
      count: roleStudents.filter((s) => s.grade === g && s.absenceRate >= 0.1)
        .length,
    }));
  }, [roleStudents]);

  const dowData = useMemo(
    () => computeDayOfWeekData(filteredStudents, startDate, endDate),
    [filteredStudents, startDate, endDate],
  );

  const handleBarClick = (grade: 6 | 7 | 8) => {
    onGradeChange(gradeFilter === grade ? "all" : grade);
  };

  const dateLabel = useMemo(() => {
    try {
      return `${format(parseISO(startDate), "MMM d")} – ${format(parseISO(endDate), "MMM d, yyyy")}`;
    } catch {
      return "";
    }
  }, [startDate, endDate]);

  return (
    <section
      aria-label="Charts and filters"
      className="space-y-4"
      data-ocid="charts.section"
    >
      <div className="card-elevated px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 flex-wrap">
          <GradeFilterBar active={gradeFilter} onChange={onGradeChange} />
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={onStartChange}
            onEndChange={onEndChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="card-elevated px-4 sm:px-6 py-4"
          data-ocid="line_chart.card"
        >
          <div className="mb-3">
            <h2 className="font-display font-bold text-base text-foreground">
              Daily Attendance Rate
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gradeFilter === "all" ? "All grades" : `Grade ${gradeFilter}`} ·{" "}
              {dateLabel}
            </p>
          </div>
          {lineData.length === 0 ? (
            <div
              className="flex items-center justify-center h-[220px] text-sm text-muted-foreground"
              data-ocid="line_chart.empty_state"
            >
              No school days in selected range.
            </div>
          ) : (
            <AttendanceLineChart data={lineData} />
          )}
        </div>

        <div
          className="card-elevated px-4 sm:px-6 py-4"
          data-ocid="bar_chart.card"
        >
          <div className="mb-3">
            <h2 className="font-display font-bold text-base text-foreground">
              Chronic Absenteeism by Grade
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Students with ≥10% absence rate · click a bar to filter
            </p>
          </div>
          <AbsenteeismBarChart
            data={barData}
            activeGrade={gradeFilter === "all" ? null : gradeFilter}
            onBarClick={handleBarClick}
          />
        </div>
      </div>

      {/* Day of Week Chart */}
      <div
        className="card-elevated px-4 sm:px-6 py-4"
        data-ocid="dow_chart.card"
      >
        <div className="mb-3">
          <h2 className="font-display font-bold text-base text-foreground">
            Absence Pattern by Day of Week
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Average absence rate per weekday ·{" "}
            {gradeFilter === "all" ? "all grades" : `Grade ${gradeFilter}`} ·{" "}
            {dateLabel}
          </p>
        </div>
        <DayOfWeekChart data={dowData} />
      </div>
    </section>
  );
}

// ─── Table cell renderers ─────────────────────────────────────────────────────

type ColKey =
  | "name"
  | "grade"
  | "daysPresent"
  | "daysAbsent"
  | "totalDays"
  | "absenceRate";

type TableColumn = {
  key: ColKey;
  label: string;
  align: "left" | "center";
  sortField?: SortField;
};

function renderCell(student: Student, key: ColKey): React.ReactNode {
  const level = getAbsenceLabel(student.absenceRate);
  switch (key) {
    case "name":
      return (
        <span className="font-medium text-foreground">{student.name}</span>
      );
    case "grade":
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-primary/10 text-primary">
          {student.grade}
        </span>
      );
    case "daysPresent":
      return (
        <span className="font-mono text-sm text-[oklch(var(--success))]">
          {student.daysPresent}
        </span>
      );
    case "daysAbsent":
      return (
        <span className="font-mono text-sm text-foreground">
          {student.daysAbsent}
        </span>
      );
    case "totalDays":
      return (
        <span className="font-mono text-sm text-muted-foreground">
          {student.totalDays}
        </span>
      );
    case "absenceRate":
      return (
        <span
          className={`font-mono text-sm ${level === "critical" ? "text-destructive font-semibold" : level === "warning" ? "text-[oklch(var(--warning-foreground))] font-semibold" : "text-foreground"}`}
        >
          {fmtPercent(student.absenceRate)}
        </span>
      );
  }
}

// ─── Student Mobile Card ──────────────────────────────────────────────────────

function StudentMobileCard({
  student,
  ocid,
  onClick,
}: { student: Student; ocid: string; onClick: () => void }) {
  const level = getAbsenceLabel(student.absenceRate);
  const trend = computeTrend(student, SCHOOL_DAYS_LIST);
  const milestone = getMilestone(student.daysAbsent);
  const lastContact = getLastContactDate(student);
  const daysSince = lastContact ? daysBetween(lastContact, TODAY) : null;

  return (
    <button
      type="button"
      className="w-full text-left px-4 py-3 border-b border-border hover:bg-muted/30 transition-smooth min-h-[60px] flex items-center gap-3 focus-visible:outline-none focus-visible:bg-muted/40"
      onClick={onClick}
      data-ocid={ocid}
    >
      <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-bold bg-primary/10 text-primary">
        {student.grade}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-foreground text-sm truncate">
            {student.name}
          </span>
          <TrendArrow trend={trend} />
          {milestone && (
            <span
              className={`inline-flex px-1 py-0.5 text-[9px] font-bold rounded ${milestone.color}`}
            >
              {milestone.label}
            </span>
          )}
          <AtRiskBadge rate={student.absenceRate} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span>{student.daysAbsent} missed</span>
          <span className="opacity-40">·</span>
          <span
            className={
              level === "critical"
                ? "text-destructive font-semibold"
                : level === "warning"
                  ? "text-[oklch(var(--warning-foreground))] font-semibold"
                  : "text-foreground"
            }
          >
            {fmtPercent(student.absenceRate)}
          </span>
          {daysSince !== null && (
            <>
              <span className="opacity-40">·</span>
              <span className={daysSince > 14 ? "text-destructive" : ""}>
                {daysSince}d since contact
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        <StatusBadge rate={student.absenceRate} />
      </div>
    </button>
  );
}

// ─── Column configs ───────────────────────────────────────────────────────────

const ALL_STUDENT_COLS: TableColumn[] = [
  { key: "name", label: "Student Name", align: "left" },
  { key: "grade", label: "Grade", align: "center", sortField: "grade" },
  { key: "daysPresent", label: "Days Present", align: "center" },
  {
    key: "daysAbsent",
    label: "Days Missed",
    align: "center",
    sortField: "daysAbsent",
  },
  { key: "totalDays", label: "Total Days", align: "center" },
  {
    key: "absenceRate",
    label: "Absence Rate",
    align: "center",
    sortField: "absenceRate",
  },
];

const CHRONIC_COLS: TableColumn[] = [
  { key: "name", label: "Student Name", align: "left", sortField: "name" },
  { key: "grade", label: "Grade", align: "center", sortField: "grade" },
  {
    key: "daysAbsent",
    label: "Days Missed",
    align: "center",
    sortField: "daysAbsent",
  },
  { key: "totalDays", label: "Total Days", align: "center" },
  {
    key: "absenceRate",
    label: "Absence Rate",
    align: "center",
    sortField: "absenceRate",
  },
];

const FLAGGED_COLS: TableColumn[] = [
  { key: "name", label: "Student Name", align: "left" },
  { key: "grade", label: "Grade", align: "center" },
  { key: "daysAbsent", label: "Days Missed", align: "center" },
  { key: "totalDays", label: "Total Days", align: "center" },
  { key: "absenceRate", label: "Absence Rate", align: "center" },
];

// ─── Student Desktop Table ────────────────────────────────────────────────────

function StudentDesktopTable({
  students,
  columns,
  sort,
  handleSort,
  onSelect,
  tableOcid,
  emptyMsg,
  showStatus,
  showNewFlag,
  showExtra,
}: {
  students: Student[];
  columns: TableColumn[];
  sort: { field: SortField; direction: "asc" | "desc" };
  handleSort: (f: SortField) => void;
  onSelect: (s: Student) => void;
  tableOcid: string;
  emptyMsg: string;
  showStatus: boolean;
  showNewFlag?: boolean;
  showExtra?: boolean;
}) {
  const extraColCount = (showStatus ? 1 : 0) + (showExtra ? 3 : 0);
  const totalCols = columns.length + extraColCount;
  return (
    <table className="data-table" data-ocid={tableOcid}>
      <thead>
        <tr className="data-table-header">
          {columns.map(({ key, label, align, sortField }) => (
            <th
              key={key}
              scope="col"
              className={`px-4 py-3 ${align === "center" ? "text-center" : "text-left"} select-none`}
              aria-sort={
                sortField && sort.field === sortField
                  ? sort.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              data-ocid={sortField ? `table.sort.${sortField}` : undefined}
            >
              {sortField ? (
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:underline ${align === "center" ? "justify-center w-full" : ""}`}
                  onClick={() => handleSort(sortField)}
                >
                  {label}
                  <SortIcon field={sortField} sort={sort} />
                </button>
              ) : (
                label
              )}
            </th>
          ))}
          {showStatus && (
            <th scope="col" className="px-4 py-3 text-left">
              Status
            </th>
          )}
          {showExtra && (
            <>
              <th scope="col" className="px-4 py-3 text-center">
                Trend
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Milestone
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Last Contact
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {students.length === 0 ? (
          <tr>
            <td
              colSpan={totalCols}
              className="px-4 py-12 text-center text-muted-foreground text-sm"
              data-ocid={`${tableOcid.replace(".table", "")}.empty_state`}
            >
              {emptyMsg}
            </td>
          </tr>
        ) : (
          students.map((student, idx) => {
            const trend = computeTrend(student, SCHOOL_DAYS_LIST);
            const milestone = getMilestone(student.daysAbsent);
            const lastContact = getLastContactDate(student);
            const daysSince = lastContact
              ? daysBetween(lastContact, TODAY)
              : null;
            return (
              <tr
                key={student.id}
                className="data-table-row cursor-pointer"
                onClick={() => onSelect(student)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(student);
                }}
                data-ocid={`${tableOcid.replace(".table", "")}.item.${idx + 1}`}
                aria-label={`Open details for ${student.name}`}
              >
                {columns.map(({ key, align }) => (
                  <td
                    key={key}
                    className={`px-4 py-3 ${align === "center" ? "text-center" : "text-left"}`}
                  >
                    {renderCell(student, key)}
                  </td>
                ))}
                {showStatus && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge rate={student.absenceRate} />
                      <AtRiskBadge rate={student.absenceRate} />
                      {showNewFlag && student.isNewlyFlagged && (
                        <span
                          className="badge-neutral"
                          data-ocid={`students.new_flag_badge.${idx + 1}`}
                        >
                          New
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {showExtra && (
                  <>
                    <td className="px-4 py-3 text-center">
                      <TrendArrow trend={trend} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {milestone ? (
                        <span
                          className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded ${milestone.color}`}
                        >
                          {milestone.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                      {daysSince === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            daysSince > 14
                              ? "text-destructive font-semibold"
                              : ""
                          }
                        >
                          {daysSince}d
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

// ─── Table Toolbar ─────────────────────────────────────────────────────────

function TableToolbar({
  search,
  onSearchChange,
  onExport,
  resultCount,
  totalCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onExport: () => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
      <div className="relative flex-1" data-ocid="students.search_input">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search students by name…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-8 text-sm h-10"
          aria-label="Search students"
        />
        {search && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            data-ocid="students.search_clear_button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        className="flex items-center gap-2 h-10 whitespace-nowrap"
        data-ocid="students.export_csv_button"
        aria-label="Export filtered student data as CSV"
      >
        <Download className="w-4 h-4" />
        Export CSV
        {search && (
          <span className="text-xs text-muted-foreground ml-1">
            ({resultCount}/{totalCount})
          </span>
        )}
      </Button>
    </div>
  );
}

// ─── Reports Section ──────────────────────────────────────────────────────────

type ReportTab = "monthly" | "comparison" | "homeroom" | "audit";

const COMPARISON_OPTIONS = [
  { value: "last-month", label: "vs Last Month" },
  { value: "same-last-year", label: "vs Same Month Last Year" },
];

function ReportsSection({
  students,
  auditEntries,
}: { students: Student[]; auditEntries: AuditEntry[] }) {
  const [activeTab, setActiveTab] = useState<ReportTab>("monthly");
  const [comparisonPeriod, setComparisonPeriod] = useState("last-month");

  const currentMonth = TODAY.slice(0, 7); // "2026-04"

  const comparisonData = useMemo(() => {
    const curr = currentMonth;
    let comp: string;
    if (comparisonPeriod === "last-month") {
      const [y, m] = curr.split("-").map(Number);
      const prevMonth =
        m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      comp = prevMonth;
    } else {
      const [y, m] = curr.split("-").map(Number);
      comp = `${y - 1}-${String(m).padStart(2, "0")}`;
    }

    const rateForPeriod = (grade: 6 | 7 | 8, period: string) => {
      const gs = students.filter((s) => s.grade === grade);
      if (gs.length === 0) return 0;
      const records = gs.flatMap((s) =>
        s.attendanceHistory.filter(
          (r) =>
            r.date.startsWith(period) &&
            r.status !== "weekend" &&
            r.status !== "holiday",
        ),
      );
      if (records.length === 0) {
        // Fall back to yearly rate * some variation for demo
        const avgRate =
          gs.reduce((acc, s) => acc + s.absenceRate, 0) / gs.length;
        return avgRate * 100 * (period < curr ? 0.85 : 1);
      }
      const absent = records.filter(
        (r) => r.status === "absent" || r.status === "excused",
      ).length;
      return (absent / records.length) * 100;
    };

    return ([6, 7, 8] as const).map((g) => ({
      grade: `Grade ${g}`,
      current: rateForPeriod(g, curr),
      comparison: rateForPeriod(g, comp),
    }));
  }, [students, currentMonth, comparisonPeriod]);

  const homeroomData = useMemo(() => {
    return Object.values(TEACHERS_BY_GRADE)
      .flat()
      .map((teacher) => {
        const homeroomStudents = students.filter((s) => s.teacher === teacher);
        const chronicCount = homeroomStudents.filter(
          (s) => s.absenceRate >= 0.1,
        ).length;
        return {
          teacher,
          count: chronicCount,
          totalStudents: homeroomStudents.length,
        };
      });
  }, [students]);

  const tabs: Array<{ id: ReportTab; label: string; icon: React.ReactNode }> = [
    {
      id: "monthly",
      label: "Monthly Report",
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      id: "comparison",
      label: "Comparison",
      icon: <ChevronDown className="w-3.5 h-3.5" />,
    },
    {
      id: "homeroom",
      label: "Homeroom",
      icon: <UserCheck className="w-3.5 h-3.5" />,
    },
    {
      id: "audit",
      label: "Audit Log",
      icon: <ClipboardList className="w-3.5 h-3.5" />,
    },
  ];

  const compLabel =
    COMPARISON_OPTIONS.find((o) => o.value === comparisonPeriod)?.label ?? "";
  const currMonthLabel = format(parseISO(`${currentMonth}-01`), "MMMM yyyy");

  return (
    <section
      className="card-elevated overflow-hidden"
      data-ocid="reports.section"
      id="reports-section"
    >
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-muted/30">
        <h2 className="font-display font-bold text-base sm:text-lg text-foreground">
          Reports & Analytics
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Monthly reports, comparisons, homeroom breakdown, and audit log
        </p>
      </div>

      {/* Report tabs */}
      <div
        className="flex border-b border-border overflow-x-auto"
        data-ocid="reports.tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-smooth ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-ocid={`reports.tab.${tab.id}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === "monthly" && (
          <MonthlyReportPanel students={students} currentMonth={currentMonth} />
        )}

        {activeTab === "comparison" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {currMonthLabel}
              </span>
              <select
                value={comparisonPeriod}
                onChange={(e) => setComparisonPeriod(e.target.value)}
                className="h-8 px-2 py-1 rounded-md border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-smooth cursor-pointer"
                data-ocid="reports.comparison.select"
              >
                {COMPARISON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="card-elevated px-4 py-4">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3">
                Absence Rate by Grade · {currMonthLabel} {compLabel}
              </h3>
              <MonthComparisonChart
                data={comparisonData}
                currentLabel={currMonthLabel}
                comparisonLabel={compLabel}
              />
            </div>
          </div>
        )}

        {activeTab === "homeroom" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chronic absenteeism count by homeroom teacher (≥10% absence rate).
            </p>
            <div className="card-elevated px-4 py-4">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3">
                Chronic Absenteeism by Homeroom
              </h3>
              <HomeroomBreakdownChart data={homeroomData} />
            </div>
            <div className="data-table-scroll-container max-h-[400px]">
              <table className="data-table">
                <thead>
                  <tr className="data-table-header">
                    <th className="px-4 py-3 text-left">Teacher</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    <th className="px-4 py-3 text-center">Total Students</th>
                    <th className="px-4 py-3 text-center">Chronic Absent</th>
                    <th className="px-4 py-3 text-center">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {homeroomData.map((row) => {
                    const gradeEntry = (
                      Object.entries(TEACHERS_BY_GRADE) as Array<
                        [string, string[]]
                      >
                    ).find(([, teachers]) => teachers.includes(row.teacher));
                    const grade = gradeEntry ? Number(gradeEntry[0]) : "—";
                    const total = row.totalStudents;
                    return (
                      <tr key={row.teacher} className="data-table-row">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {row.teacher}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {grade}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-sm text-muted-foreground">
                          {total}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-mono text-sm font-semibold ${row.count >= 4 ? "text-destructive" : row.count >= 2 ? "text-[oklch(var(--warning-foreground))]" : "text-foreground"}`}
                          >
                            {row.count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                          {total > 0
                            ? `${Math.round((row.count / total) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "audit" && <AuditLogPanel entries={auditEntries} />}
      </div>
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-ocid="app.loading_state"
    >
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Jefferson Middle School
            </p>
            <h1 className="font-display text-lg sm:text-2xl font-bold text-primary leading-tight">
              Attendance Dashboard
            </h1>
          </div>
          <div className="h-8 w-40 bg-muted animate-pulse rounded-md" />
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-card border border-border rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />
        <div className="h-96 bg-card border border-border rounded-lg animate-pulse" />
      </main>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 flex items-start gap-3 text-sm"
      data-ocid="app.error_state"
    >
      <span className="text-destructive font-semibold shrink-0">⚠</span>
      <span className="text-foreground">{message}</span>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

function Dashboard() {
  const todayAttendanceRef = useRef<HTMLElement>(null);
  const chronicAbsentRef = useRef<HTMLElement>(null);
  const newlyFlaggedRef = useRef<HTMLElement>(null);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [letterStudent, setLetterStudent] = useState<Student | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("Principal");

  // Backend data
  const {
    students,
    allNotes,
    allLetters,
    dismissedAlerts,
    auditLog,
    isLoading,
    error,
    handleDismissAlert,
    handleSendLetter: backendSendLetter,
    handleAddNote: backendAddNote,
  } = useAppData();

  const defaultEnd = TODAY;
  const defaultStart = useMemo(() => {
    const idx = SCHOOL_DAYS_LIST.indexOf(TODAY);
    return SCHOOL_DAYS_LIST[Math.max(0, idx - 29)];
  }, []);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const { sorted, sort, handleSort, search, setSearch } =
    useSortableTable(students);

  // Role-filtered students (teacher role sees only their homeroom)
  const roleStudents = useMemo(() => {
    if (currentRole === "Principal") return sorted;
    return sorted.filter((s) => s.teacher === currentRole);
  }, [sorted, currentRole]);

  const { todayRate, chronicCount, newlyFlaggedCount } = useMemo(() => {
    const presentToday = students.filter((s) =>
      s.attendanceHistory.some(
        (r) => r.date === TODAY && r.status === "present",
      ),
    ).length;
    const otherPresent = Math.round((TOTAL_STUDENTS - students.length) * 0.968);
    const rate =
      students.length > 0 ? (presentToday + otherPresent) / TOTAL_STUDENTS : 0;
    return {
      todayRate: rate,
      chronicCount: roleStudents.filter((s) => s.absenceRate >= 0.1).length,
      newlyFlaggedCount: roleStudents.filter((s) => s.isNewlyFlagged).length,
    };
  }, [students, roleStudents]);

  const scrollTo = (id: string) => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
      "today-attendance-section": todayAttendanceRef,
      "chronic-absent-section": chronicAbsentRef,
      "newly-flagged-section": newlyFlaggedRef,
    };
    refMap[id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const gradeSorted = useMemo(
    () =>
      gradeFilter === "all"
        ? roleStudents
        : roleStudents.filter((s) => s.grade === gradeFilter),
    [roleStudents, gradeFilter],
  );

  const chronicStudents = useMemo(
    () => gradeSorted.filter((s) => s.absenceRate >= 0.1),
    [gradeSorted],
  );
  const newlyFlaggedStudents = useMemo(
    () => gradeSorted.filter((s) => s.isNewlyFlagged),
    [gradeSorted],
  );
  const alerts = useAlerts(dismissedAlerts, roleStudents);

  const handleDismiss = useCallback(
    (id: string) => {
      const student = students.find((s) => s.id === id);
      void handleDismissAlert(id, student?.name ?? id, currentRole);
    },
    [students, currentRole, handleDismissAlert],
  );

  const handleSendLetter = useCallback((student: Student) => {
    setLetterStudent(student);
    setAlertsOpen(false);
  }, []);

  const handleLetterSent = useCallback(
    (student: Student, sentBy: string) => {
      void backendSendLetter(student.id, student.name, sentBy);
    },
    [backendSendLetter],
  );

  const handleAddNote = useCallback(
    (studentId: string, text: string, author: string) => {
      const student = students.find((s) => s.id === studentId);
      void backendAddNote(studentId, student?.name ?? studentId, text, author);
    },
    [students, backendAddNote],
  );

  const handleExportCSV = useCallback(() => {
    exportToCSV(gradeSorted, `attendance-report-${TODAY}.csv`);
  }, [gradeSorted]);

  // ─── All Students pagination ────────────────────────────────────────────────
  const [allStudentsPage, setAllStudentsPage] = useState(1);

  // Handlers that also reset pagination
  const handleSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      setAllStudentsPage(1);
    },
    [setSearch],
  );

  const handleGradeChange = useCallback((g: GradeFilter) => {
    setGradeFilter(g);
    setAllStudentsPage(1);
  }, []);

  const pagedStudents = useMemo(() => {
    const start = (allStudentsPage - 1) * PAGE_SIZE;
    return gradeSorted.slice(start, start + PAGE_SIZE);
  }, [gradeSorted, allStudentsPage]);

  // Find selected student with up-to-date data (refreshed from backend state)
  const selectedStudentFull = useMemo(() => {
    if (!selectedStudent) return null;
    return students.find((s) => s.id === selectedStudent.id) ?? null;
  }, [selectedStudent, students]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header
        className="bg-card border-b border-border shadow-sm sticky top-0 z-20"
        data-ocid="header"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Jefferson Middle School
            </p>
            <h1 className="font-display text-lg sm:text-2xl font-bold text-primary leading-tight">
              Attendance Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LoginButton />
            <div className="h-5 w-px bg-border hidden sm:block" />
            <RoleSwitcher currentRole={currentRole} onChange={setCurrentRole} />
            <div className="relative" data-ocid="alerts.section">
              <NotificationBell
                count={alerts.length}
                onClick={() => setAlertsOpen((o) => !o)}
                isOpen={alertsOpen}
              />
              {alertsOpen && (
                <AlertsDropdown
                  alerts={alerts}
                  onDismiss={handleDismiss}
                  onSendLetter={handleSendLetter}
                  onClose={() => setAlertsOpen(false)}
                />
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-foreground">
                2025 – 2026
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                650 Students · Grades 6–8
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Backend error banner */}
        {error && <ErrorBanner message={error} />}

        {/* Role banner for teacher view */}
        {currentRole !== "Principal" && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/8 border border-primary/20 text-sm"
            data-ocid="role.banner"
          >
            <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-foreground">
              Viewing{" "}
              <span className="font-semibold text-primary">
                {currentRole}'s
              </span>{" "}
              homeroom only ·{" "}
              <span className="text-muted-foreground">
                {roleStudents.length} students
              </span>
            </span>
          </div>
        )}

        {/* Summary cards */}
        <section aria-label="Summary metrics" data-ocid="summary.section">
          <SummaryCards
            todayRate={todayRate}
            chronicCount={chronicCount}
            newlyFlaggedCount={newlyFlaggedCount}
            totalStudents={roleStudents.length}
            onScrollTo={scrollTo}
          />
        </section>

        {/* Charts + Filters Section */}
        <ChartsSection
          gradeFilter={gradeFilter}
          onGradeChange={handleGradeChange}
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          roleStudents={roleStudents}
        />

        {/* Reports Section */}
        <ReportsSection students={roleStudents} auditEntries={auditLog} />

        {/* Today's Attendance Section */}
        <section
          id="today-attendance-section"
          ref={todayAttendanceRef}
          aria-label="Today's attendance"
          className="card-elevated overflow-hidden"
          data-ocid="today_attendance.section"
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-base sm:text-lg text-foreground">
                  All Students
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {Math.round(todayRate * TOTAL_STUDENTS)} of {TOTAL_STUDENTS}{" "}
                  students present today · {fmtPercent(todayRate)} rate
                </p>
              </div>
            </div>
            <TableToolbar
              search={search}
              onSearchChange={handleSearchChange}
              onExport={handleExportCSV}
              resultCount={gradeSorted.length}
              totalCount={roleStudents.length}
            />
          </div>

          {/* Mobile list */}
          <div className="sm:hidden" data-ocid="all_students.mobile_list">
            {gradeSorted.length === 0 ? (
              <p
                className="px-4 py-10 text-center text-sm text-muted-foreground"
                data-ocid="all_students.empty_state"
              >
                No students match your search.
              </p>
            ) : (
              pagedStudents.map((student, idx) => (
                <StudentMobileCard
                  key={student.id}
                  student={student}
                  ocid={`all_students.item.${(allStudentsPage - 1) * PAGE_SIZE + idx + 1}`}
                  onClick={() => setSelectedStudent(student)}
                />
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block data-table-scroll-container">
            <StudentDesktopTable
              students={pagedStudents}
              columns={ALL_STUDENT_COLS}
              sort={sort}
              handleSort={handleSort}
              onSelect={setSelectedStudent}
              tableOcid="all_students.table"
              emptyMsg="No students match your search."
              showStatus
              showExtra
            />
          </div>

          {/* Pagination */}
          {gradeSorted.length > 0 && (
            <TablePagination
              currentPage={allStudentsPage}
              totalItems={gradeSorted.length}
              pageSize={PAGE_SIZE}
              onPageChange={setAllStudentsPage}
            />
          )}
        </section>

        {/* Chronic Absent Section */}
        <section
          id="chronic-absent-section"
          ref={chronicAbsentRef}
          aria-label="Chronic absenteeism tracker"
          className="card-elevated overflow-hidden"
          data-ocid="chronic_absent.section"
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30">
            <h2 className="font-display font-bold text-base sm:text-lg text-foreground">
              Chronically Absent Students
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {chronicStudents.length} students with ≥10% absence rate
            </p>
          </div>

          <div className="sm:hidden" data-ocid="chronic_absent.mobile_list">
            {chronicStudents.length === 0 ? (
              <p
                className="px-4 py-10 text-center text-sm text-muted-foreground"
                data-ocid="chronic_absent.empty_state"
              >
                No students match your search.
              </p>
            ) : (
              chronicStudents.map((student, idx) => (
                <StudentMobileCard
                  key={student.id}
                  student={student}
                  ocid={`students.item.${idx + 1}`}
                  onClick={() => setSelectedStudent(student)}
                />
              ))
            )}
          </div>

          <div className="hidden sm:block data-table-scroll-container">
            <StudentDesktopTable
              students={chronicStudents}
              columns={CHRONIC_COLS}
              sort={sort}
              handleSort={handleSort}
              onSelect={setSelectedStudent}
              tableOcid="students.table"
              emptyMsg="No students match your search."
              showStatus
              showNewFlag
              showExtra
            />
          </div>
        </section>

        {/* Newly Flagged Section */}
        <section
          id="newly-flagged-section"
          ref={newlyFlaggedRef}
          aria-label="Newly flagged students"
          className="card-elevated overflow-hidden"
          data-ocid="newly_flagged.section"
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30">
            <h2 className="font-display font-bold text-base sm:text-lg text-foreground">
              Newly Flagged This Week
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {newlyFlaggedStudents.length} students first flagged in the
              current week
            </p>
          </div>

          <div className="sm:hidden" data-ocid="newly_flagged.mobile_list">
            {newlyFlaggedStudents.length === 0 ? (
              <p
                className="px-4 py-10 text-center text-sm text-muted-foreground"
                data-ocid="newly_flagged.empty_state"
              >
                No newly flagged students this week.
              </p>
            ) : (
              newlyFlaggedStudents.map((student, idx) => (
                <StudentMobileCard
                  key={student.id}
                  student={student}
                  ocid={`newly_flagged.item.${idx + 1}`}
                  onClick={() => setSelectedStudent(student)}
                />
              ))
            )}
          </div>

          <div className="hidden sm:block data-table-scroll-container">
            <StudentDesktopTable
              students={newlyFlaggedStudents}
              columns={FLAGGED_COLS}
              sort={sort}
              handleSort={handleSort}
              onSelect={setSelectedStudent}
              tableOcid="newly_flagged.table"
              emptyMsg="No newly flagged students this week."
              showStatus
              showExtra
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="bg-muted/40 border-t border-border py-4 mt-4 sm:mt-8"
        data-ocid="footer"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground text-center sm:text-left">
          <span>
            Built on Caffeine AI — owned and operated by Jefferson Middle
            School.
          </span>
          <span>
            © {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-smooth"
            >
              caffeine.ai
            </a>
          </span>
        </div>
      </footer>

      {/* Student detail panel */}
      <StudentPanel
        student={selectedStudentFull}
        notes={allNotes}
        letterHistory={allLetters}
        onClose={() => setSelectedStudent(null)}
        onAddNote={handleAddNote}
        currentRole={currentRole}
      />

      {/* Parent letter modal */}
      <ParentLetterModal
        student={letterStudent}
        onClose={() => setLetterStudent(null)}
        onSent={handleLetterSent}
        currentRole={currentRole}
      />
    </div>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────

export default function App() {
  return <Dashboard />;
}
