export type AttendanceStatus =
  | "present"
  | "absent"
  | "excused"
  | "weekend"
  | "holiday";

export interface AttendanceRecord {
  date: string; // ISO date string "YYYY-MM-DD"
  status: AttendanceStatus;
}

export interface ContactNote {
  id: string;
  studentId: string;
  date: string; // ISO string
  text: string;
  author: string; // role name
}

export interface LetterRecord {
  studentId: string;
  sentAt: string; // ISO string
  sentBy: string; // role name
}

export interface AuditEntry {
  id: string;
  action: string;
  studentId?: string;
  studentName?: string;
  actor: string; // role name
  timestamp: string; // ISO string
}

export interface Student {
  id: string;
  name: string;
  grade: 6 | 7 | 8;
  teacher: string;
  daysPresent: number;
  daysAbsent: number;
  totalDays: number;
  absenceRate: number; // 0-1 decimal
  isNewlyFlagged: boolean;
  attendanceHistory: AttendanceRecord[];
  notes: ContactNote[];
  letterHistory: LetterRecord[];
}

export type SortField = "name" | "grade" | "daysAbsent" | "absenceRate";
export type SortDirection = "asc" | "desc";

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export type TrendDirection = "improving" | "worsening" | "stable";

export type RoleOption = "Principal" | string; // string covers teacher names

export interface DayOfWeekData {
  day: string;
  rate: number; // absence rate 0-100
}

export interface HomeroomData {
  teacher: string;
  count: number;
  totalStudents: number;
}

export interface MonthComparisonData {
  grade: string;
  current: number;
  comparison: number;
}
