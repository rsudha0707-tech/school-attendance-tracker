import type {
  AttendanceRecord as BackendAttendanceRecord,
  AttendanceStatus as BackendAttendanceStatus,
  AuditEntry as BackendAuditEntry,
  ContactNote as BackendContactNote,
  LetterRecord as BackendLetterRecord,
  Student as BackendStudent,
} from "@/backend";
import {
  SCHOOL_DAYS_LIST,
  SEEDED_AUDIT_LOG,
  STUDENTS,
  TEACHERS_BY_GRADE,
  TODAY,
} from "@/data/students";
import type {
  AttendanceRecord,
  AuditEntry,
  ContactNote,
  LetterRecord,
  Student,
} from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBackend } from "./useBackend";

// ─── Type converters ──────────────────────────────────────────────────────────

function nanosToISO(ns: bigint): string {
  return new Date(Number(ns / 1_000_000n)).toISOString();
}

function mapNote(n: BackendContactNote): ContactNote {
  return {
    id: n.id,
    studentId: n.studentId,
    date: nanosToISO(n.createdAt),
    text: n.text,
    author: n.author,
  };
}

function mapLetter(l: BackendLetterRecord): LetterRecord {
  return {
    studentId: l.studentId,
    sentAt: nanosToISO(l.sentAt),
    sentBy: l.sentBy,
  };
}

function mapAuditEntry(e: BackendAuditEntry): AuditEntry {
  return {
    id: e.id,
    action: e.action,
    studentId: e.studentId,
    studentName: e.studentName,
    actor: e.actorName,
    timestamp: nanosToISO(e.timestamp),
  };
}

/** Explicit mapping from backend AttendanceStatus enum to frontend string union */
function mapStatus(s: BackendAttendanceStatus): AttendanceRecord["status"] {
  switch (s) {
    case "present":
      return "present";
    case "absent":
      return "absent";
    case "excused":
      return "excused";
    case "weekend":
      return "weekend";
    case "holiday":
      return "holiday";
    default:
      return "present";
  }
}

function mapAttendanceRecord(r: BackendAttendanceRecord): AttendanceRecord {
  return { date: r.date, status: mapStatus(r.status) };
}

/** Build computed fields for a student, given their attendance records */
function buildStudentStats(
  base: BackendStudent,
  attendanceRecords: BackendAttendanceRecord[],
  notesForStudent: BackendContactNote[],
  lettersForStudent: BackendLetterRecord[],
  dismissedSet: Set<string>,
): Student {
  const history = attendanceRecords.map(mapAttendanceRecord);
  const schoolDaysSet = new Set(SCHOOL_DAYS_LIST);

  let daysPresent = 0;
  let daysAbsent = 0;

  for (const r of history) {
    if (!schoolDaysSet.has(r.date)) continue;
    if (r.status === "present") daysPresent++;
    else if (r.status === "absent" || r.status === "excused") daysAbsent++;
  }

  const totalDays = daysPresent + daysAbsent;
  const absenceRate = totalDays > 0 ? daysAbsent / totalDays : 0;

  const WEEK_START = "2026-04-13";
  const recentAbsent = history.filter(
    (r) =>
      r.date >= WEEK_START &&
      r.date <= TODAY &&
      (r.status === "absent" || r.status === "excused"),
  ).length;
  const isNewlyFlagged =
    absenceRate >= 0.1 && recentAbsent > 0 && !dismissedSet.has(base.id);

  const grade = Number(base.grade) as 6 | 7 | 8;

  const teachers = TEACHERS_BY_GRADE[grade] ?? TEACHERS_BY_GRADE[6];
  const teacherFromBackend = base.teacher;
  const teacher = teachers.includes(teacherFromBackend)
    ? teacherFromBackend
    : teachers[0];

  return {
    id: base.id,
    name: base.name,
    grade,
    teacher,
    daysPresent,
    daysAbsent,
    totalDays,
    absenceRate,
    isNewlyFlagged,
    attendanceHistory: history,
    notes: notesForStudent.map(mapNote),
    letterHistory: lettersForStudent.map(mapLetter),
  };
}

// ─── Hook state ───────────────────────────────────────────────────────────────

export interface AppData {
  students: Student[];
  allNotes: ContactNote[];
  allLetters: LetterRecord[];
  dismissedAlerts: Set<string>;
  auditLog: AuditEntry[];
  isLoading: boolean;
  error: string | null;
  handleDismissAlert: (
    studentId: string,
    studentName: string,
    role: string,
  ) => Promise<void>;
  handleSendLetter: (
    studentId: string,
    studentName: string,
    sentBy: string,
  ) => Promise<void>;
  handleAddNote: (
    studentId: string,
    studentName: string,
    text: string,
    author: string,
  ) => Promise<void>;
  refetchStudent: (studentId: string) => Promise<void>;
}

// ─── Local-seed fallback ───────────────────────────────────────────────────────

/** Returns a fully hydrated AppData driven entirely by local seed data.
 *  Mutations update in-memory state so changes persist for the session. */
function useLocalFallback(): AppData {
  const [students, setStudents] = useState<Student[]>(() => STUDENTS);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(
    () => SEEDED_AUDIT_LOG,
  );
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const allNotes: ContactNote[] = students.flatMap((s) => s.notes);
  const allLetters: LetterRecord[] = students.flatMap((s) => s.letterHistory);

  const handleDismissAlert = useCallback(
    async (studentId: string, studentName: string, role: string) => {
      setDismissedAlerts((prev) => new Set([...prev, studentId]));
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, isNewlyFlagged: false } : s,
        ),
      );
      const newEntry: AuditEntry = {
        id: `a-local-${Date.now()}`,
        action: `Dismissed alert for ${studentName}`,
        studentId,
        studentName,
        actor: role,
        timestamp: new Date().toISOString(),
      };
      setAuditLog((prev) => [newEntry, ...prev]);
    },
    [],
  );

  const handleSendLetter = useCallback(
    async (studentId: string, studentName: string, sentBy: string) => {
      const newLetter: LetterRecord = {
        studentId,
        sentAt: new Date().toISOString(),
        sentBy,
      };
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, letterHistory: [newLetter, ...s.letterHistory] }
            : s,
        ),
      );
      const newEntry: AuditEntry = {
        id: `a-local-${Date.now()}`,
        action: `Sent parent letter for ${studentName}`,
        studentId,
        studentName,
        actor: sentBy,
        timestamp: new Date().toISOString(),
      };
      setAuditLog((prev) => [newEntry, ...prev]);
    },
    [],
  );

  const handleAddNote = useCallback(
    async (
      studentId: string,
      studentName: string,
      text: string,
      author: string,
    ) => {
      const newNote: ContactNote = {
        id: `note-local-${Date.now()}`,
        studentId,
        date: new Date().toISOString(),
        text,
        author,
      };
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, notes: [newNote, ...s.notes] } : s,
        ),
      );
      const newEntry: AuditEntry = {
        id: `a-local-${Date.now() + 1}`,
        action: `Added note for ${studentName}`,
        studentId,
        studentName,
        actor: author,
        timestamp: new Date().toISOString(),
      };
      setAuditLog((prev) => [newEntry, ...prev]);
    },
    [],
  );

  // No-op: local data is already in state
  const refetchStudent = useCallback(async (_studentId: string) => {}, []);

  return {
    students,
    allNotes,
    allLetters,
    dismissedAlerts,
    auditLog,
    isLoading: false,
    error: null,
    handleDismissAlert,
    handleSendLetter,
    handleAddNote,
    refetchStudent,
  };
}

// ─── Backend-connected path ────────────────────────────────────────────────────

function useBackendData(
  backend: NonNullable<ReturnType<typeof useBackend>>,
  active: boolean,
): AppData {
  const [isLoading, setIsLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);

  const [rawStudents, setRawStudents] = useState<BackendStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<
    Map<string, BackendAttendanceRecord[]>
  >(new Map());
  const [notesMap, setNotesMap] = useState<Map<string, BackendContactNote[]>>(
    new Map(),
  );
  const [lettersMap, setLettersMap] = useState<
    Map<string, BackendLetterRecord[]>
  >(new Map());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set(),
  );
  const [rawAuditLog, setRawAuditLog] = useState<BackendAuditEntry[]>([]);

  const loadedRef = useRef(false);

  const loadAllData = useCallback(async () => {
    if (!active) return;
    setIsLoading(true);
    setError(null);
    try {
      const [
        students,
        allAttendance,
        allNotesList,
        allLettersList,
        dismissed,
        auditEntries,
      ] = await Promise.all([
        backend.getStudents(),
        backend.getAttendanceForDateRange("2025-09-01", "2026-12-31"),
        backend.getAllNotes(),
        backend.getAllLetterHistory(),
        backend.getDismissedAlerts(),
        backend.getAuditLog(),
      ]);

      const newAttendanceMap = new Map<string, BackendAttendanceRecord[]>();
      for (const record of allAttendance) {
        const list = newAttendanceMap.get(record.studentId) ?? [];
        list.push(record);
        newAttendanceMap.set(record.studentId, list);
      }

      const newNotesMap = new Map<string, BackendContactNote[]>();
      for (const note of allNotesList) {
        const list = newNotesMap.get(note.studentId) ?? [];
        list.push(note);
        newNotesMap.set(note.studentId, list);
      }

      const newLettersMap = new Map<string, BackendLetterRecord[]>();
      for (const letter of allLettersList) {
        const list = newLettersMap.get(letter.studentId) ?? [];
        list.push(letter);
        newLettersMap.set(letter.studentId, list);
      }

      setRawStudents(students);
      setAttendanceMap(newAttendanceMap);
      setNotesMap(newNotesMap);
      setLettersMap(newLettersMap);
      setDismissedAlerts(new Set(dismissed));
      setRawAuditLog(auditEntries);
      loadedRef.current = true;
    } catch (err) {
      console.error("Failed to load backend data:", err);
      setError("Unable to connect to backend. Please try refreshing.");
    } finally {
      setIsLoading(false);
    }
  }, [backend, active]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const students: Student[] = rawStudents.map((base) => {
    const attendance = attendanceMap.get(base.id) ?? [];
    const notes = notesMap.get(base.id) ?? [];
    const letters = lettersMap.get(base.id) ?? [];
    return buildStudentStats(base, attendance, notes, letters, dismissedAlerts);
  });

  const allNotes: ContactNote[] = Array.from(notesMap.values())
    .flat()
    .map(mapNote);

  const allLetters: LetterRecord[] = Array.from(lettersMap.values())
    .flat()
    .map(mapLetter);

  const auditLog: AuditEntry[] = rawAuditLog.map(mapAuditEntry);

  const handleDismissAlert = useCallback(
    async (studentId: string, studentName: string, role: string) => {
      try {
        await backend.dismissAlert(studentId, studentName, role);
        setDismissedAlerts((prev) => new Set([...prev, studentId]));
        const entries = await backend.getAuditLog();
        setRawAuditLog(entries);
      } catch (err) {
        console.error("dismissAlert failed:", err);
      }
    },
    [backend],
  );

  const handleSendLetter = useCallback(
    async (studentId: string, studentName: string, sentBy: string) => {
      try {
        await backend.sendLetter(studentId, studentName, sentBy);
        const [letters, entries] = await Promise.all([
          backend.getLetterHistoryForStudent(studentId),
          backend.getAuditLog(),
        ]);
        setLettersMap((prev) => {
          const next = new Map(prev);
          next.set(studentId, letters);
          return next;
        });
        setRawAuditLog(entries);
      } catch (err) {
        console.error("sendLetter failed:", err);
      }
    },
    [backend],
  );

  const handleAddNote = useCallback(
    async (
      studentId: string,
      studentName: string,
      text: string,
      author: string,
    ) => {
      try {
        await backend.addNote(studentId, studentName, text, author);
        const [notes, entries] = await Promise.all([
          backend.getNotesForStudent(studentId),
          backend.getAuditLog(),
        ]);
        setNotesMap((prev) => {
          const next = new Map(prev);
          next.set(studentId, notes);
          return next;
        });
        setRawAuditLog(entries);
      } catch (err) {
        console.error("addNote failed:", err);
      }
    },
    [backend],
  );

  const refetchStudent = useCallback(
    async (studentId: string) => {
      try {
        const [attendance, notes, letters] = await Promise.all([
          backend.getAttendanceForStudent(studentId),
          backend.getNotesForStudent(studentId),
          backend.getLetterHistoryForStudent(studentId),
        ]);
        setAttendanceMap((prev) => {
          const m = new Map(prev);
          m.set(studentId, attendance);
          return m;
        });
        setNotesMap((prev) => {
          const m = new Map(prev);
          m.set(studentId, notes);
          return m;
        });
        setLettersMap((prev) => {
          const m = new Map(prev);
          m.set(studentId, letters);
          return m;
        });
      } catch (err) {
        console.error("refetchStudent failed:", err);
      }
    },
    [backend],
  );

  return {
    students,
    allNotes,
    allLetters,
    dismissedAlerts,
    auditLog,
    isLoading,
    error,
    handleDismissAlert,
    handleSendLetter,
    handleAddNote,
    refetchStudent,
  };
}

// ─── Selector hook ─────────────────────────────────────────────────────────────

/**
 * Thin wrapper that picks either the backend path or the local-seed fallback
 * depending on whether a live backend actor is available.
 *
 * Rules of Hooks require that BOTH inner hooks always run. We solve this by
 * calling both unconditionally and returning the appropriate result based on
 * whether `backend` is null.
 */
export function useAppData(): AppData {
  const backend = useBackend();

  // Always call both hooks — hooks must be called unconditionally
  const localData = useLocalFallback();
  // For backend path, we pass a stable sentinel when backend is null so the
  // hook can still be called but will not attempt any network calls
  const backendData = useBackendDataOrSkip(backend);

  return backend ? backendData : localData;
}

/** Calls useBackendData when a backend is available, otherwise returns a
 *  stable no-op result without making any network calls. */
function useBackendDataOrSkip(backend: ReturnType<typeof useBackend>): AppData {
  // We cannot conditionally call hooks, so we always call useBackendData.
  // When backend is null we pass a fake actor and set active=false so
  // loadAllData never fires.
  const safeBackend = backend ?? NULL_BACKEND;
  return useBackendData(safeBackend, backend !== null);
}

// Typed stub that satisfies the backend interface but always throws
const NULL_BACKEND = new Proxy(
  {} as NonNullable<ReturnType<typeof useBackend>>,
  {
    get(_target, prop) {
      if (prop === "then") return undefined; // not a promise
      return () => {
        throw new Error(`Backend not available (called ${String(prop)})`);
      };
    },
  },
);
