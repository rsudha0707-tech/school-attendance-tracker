import type {
  AttendanceRecord,
  AttendanceStatus,
  AuditEntry,
  ContactNote,
  LetterRecord,
  Student,
} from "@/types";

// Generate school calendar: Sep 2025 - Apr 2026, weekdays only, excluding holidays
function generateSchoolDays(): string[] {
  const days: string[] = [];
  const holidays = new Set([
    "2025-09-01", // Labor Day
    "2025-11-11", // Veterans Day
    "2025-11-26",
    "2025-11-27",
    "2025-11-28", // Thanksgiving week
    "2025-12-22",
    "2025-12-23",
    "2025-12-24",
    "2025-12-25",
    "2025-12-26",
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02", // Winter break / New Year
    "2026-01-19", // MLK Day
    "2026-02-16", // Presidents Day
    "2026-03-23",
    "2026-03-24",
    "2026-03-25",
    "2026-03-26",
    "2026-03-27", // Spring break
    "2026-04-03", // Spring break extension
  ]);

  const start = new Date("2025-09-02");
  const end = new Date("2026-04-16"); // today

  const cur = new Date(start);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) {
      days.push(iso);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const SCHOOL_DAYS = generateSchoolDays();

// Seeded pseudo-random for deterministic output
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildAttendanceHistory(
  rand: () => number,
  absenceProfile: "good" | "mild" | "moderate" | "poor" | "chronic",
): { history: AttendanceRecord[]; daysPresent: number; daysAbsent: number } {
  let consecutiveMissed = 0;
  const history: AttendanceRecord[] = [];
  let daysPresent = 0;
  let daysAbsent = 0;

  const baseProbability: Record<string, number> = {
    good: 0.02,
    mild: 0.05,
    moderate: 0.07,
    poor: 0.14,
    chronic: 0.25,
  };

  const clusterProbability: Record<string, number> = {
    good: 0.1,
    mild: 0.2,
    moderate: 0.35,
    poor: 0.5,
    chronic: 0.55,
  };

  const clusterDays = new Set<string>();
  if (absenceProfile !== "good") {
    const numClusters =
      absenceProfile === "chronic"
        ? 5
        : absenceProfile === "poor"
          ? 4
          : absenceProfile === "moderate"
            ? 2
            : 1;
    for (let c = 0; c < numClusters; c++) {
      const startIdx = Math.floor(rand() * (SCHOOL_DAYS.length - 10));
      const len = Math.floor(rand() * 3) + 2;
      for (let d = 0; d < len; d++) {
        if (startIdx + d < SCHOOL_DAYS.length)
          clusterDays.add(SCHOOL_DAYS[startIdx + d]);
      }
    }
  }

  for (const date of SCHOOL_DAYS) {
    let status: AttendanceStatus;
    let isAbsent = false;

    if (clusterDays.has(date)) {
      isAbsent = true;
    } else if (
      consecutiveMissed > 0 &&
      rand() < clusterProbability[absenceProfile]
    ) {
      isAbsent = true;
    } else if (rand() < baseProbability[absenceProfile]) {
      isAbsent = true;
    }

    if (isAbsent) {
      status = rand() < 0.3 ? "excused" : "absent";
      daysAbsent++;
      consecutiveMissed++;
    } else {
      status = "present";
      daysPresent++;
      consecutiveMissed = 0;
    }

    history.push({ date, status });
  }

  return { history, daysPresent, daysAbsent };
}

const THIS_WEEK_START = new Date("2026-04-13");

type AbsenceProfile = "good" | "mild" | "moderate" | "poor" | "chronic";

// Teacher assignments — must stay in sync with backend seed() in main.mo
// Grade 6: Teacher Name 001, Teacher Name 002, Teacher Name 003, Teacher Name 004
// Grade 7: Teacher Name 005, Teacher Name 006, Teacher Name 007, Teacher Name 008
// Grade 8: Teacher Name 009, Teacher Name 010, Teacher Name 011, Teacher Name 012
export const TEACHERS_BY_GRADE: Record<6 | 7 | 8, string[]> = {
  6: [
    "Teacher Name 001",
    "Teacher Name 002",
    "Teacher Name 003",
    "Teacher Name 004",
  ],
  7: [
    "Teacher Name 005",
    "Teacher Name 006",
    "Teacher Name 007",
    "Teacher Name 008",
  ],
  8: [
    "Teacher Name 009",
    "Teacher Name 010",
    "Teacher Name 011",
    "Teacher Name 012",
  ],
};

export const ALL_TEACHERS = [
  ...TEACHERS_BY_GRADE[6],
  ...TEACHERS_BY_GRADE[7],
  ...TEACHERS_BY_GRADE[8],
];

// Profile distribution cycle — same pattern repeated for all 619 students
// Distribution: good×14 (35%), mild×13 (32.5%), moderate×7 (17.5%), poor×4 (10%), chronic×2 (5%)
// Only poor+chronic (15% of cycle) exceed the 10% absence threshold → ~93 chronic students total
const PROFILE_CYCLE: AbsenceProfile[] = [
  "good",
  "mild",
  "good",
  "mild",
  "good",
  "mild",
  "good",
  "mild",
  "moderate",
  "good",
  "mild",
  "good",
  "moderate",
  "mild",
  "good",
  "mild",
  "moderate",
  "good",
  "mild",
  "good",
  "moderate",
  "mild",
  "good",
  "moderate",
  "mild",
  "poor",
  "good",
  "mild",
  "moderate",
  "good",
  "mild",
  "poor",
  "good",
  "moderate",
  "mild",
  "poor",
  "chronic",
  "good",
  "poor",
  "chronic",
];

// Newly-flagged pattern: ~2 per 40-cycle → ~31 students newly flagged across 619 students
const NEWLY_FLAGGED_PATTERN = new Set([5, 22]);

// Grade cycle for even distribution across 6, 7, 8
function gradeForIndex(i: number): 6 | 7 | 8 {
  const gradeOrder: Array<6 | 7 | 8> = [6, 7, 8];
  return gradeOrder[i % 3];
}

// Seeded notes content pool
const NOTE_TEXTS = [
  "Called parent — voicemail left. Will follow up next week.",
  "Meeting with parent scheduled for Thursday at 3:30 PM.",
  "Parent confirmed student has been ill. Doctor's note expected.",
  "Spoke with counselor — student dealing with anxiety. Support plan initiated.",
  "Parent meeting held. Transportation issues identified as root cause.",
  "Referral submitted to attendance intervention team.",
  "Follow-up call made — parent aware and working on improvement.",
  "Student reported feeling unsafe in certain classes. Meeting with VP scheduled.",
  "Parent conference completed. Attendance contract signed.",
  "Coordinating with social worker — home visit arranged for next week.",
  "Teacher reports student engaged when present. Motivation strategies discussed.",
  "Parent confirmed family medical situation. Flexible accommodation agreed upon.",
  "Warning letter mailed home. Waiting on response.",
  "Student met with counselor today. Goal-setting session completed.",
  "Second parent conference held. Improvement plan reviewed.",
];

const NOTE_AUTHORS = [
  "Principal",
  "Teacher Name 001",
  "Teacher Name 005",
  "Teacher Name 006",
  "Teacher Name 003",
];

function offsetDate(baseISO: string, daysBack: number): string {
  const d = new Date(baseISO);
  d.setDate(d.getDate() - daysBack);
  return `${d.toISOString().slice(0, 10)}T${String(8 + (daysBack % 8)).padStart(2, "0")}:30:00.000Z`;
}

function buildNotesForStudent(
  studentId: string,
  absenceProfile: AbsenceProfile,
  rand: () => number,
): ContactNote[] {
  if (absenceProfile === "good") return [];
  const count =
    absenceProfile === "chronic"
      ? 4
      : absenceProfile === "poor"
        ? 3
        : absenceProfile === "moderate"
          ? 2
          : 1;

  const notes: ContactNote[] = [];
  const usedDays = new Set<number>();
  for (let i = 0; i < count; i++) {
    let daysBack: number;
    do {
      daysBack = Math.floor(rand() * 55) + 1;
    } while (usedDays.has(daysBack));
    usedDays.add(daysBack);

    const textIdx = Math.floor(rand() * NOTE_TEXTS.length);
    const authorIdx = Math.floor(rand() * NOTE_AUTHORS.length);
    notes.push({
      id: `note-${studentId}-${i}`,
      studentId,
      date: offsetDate("2026-04-16", daysBack),
      text: NOTE_TEXTS[textIdx],
      author: NOTE_AUTHORS[authorIdx],
    });
  }
  // Sort descending
  notes.sort((a, b) => b.date.localeCompare(a.date));
  return notes;
}

function buildLettersForStudent(
  studentId: string,
  absenceProfile: AbsenceProfile,
  rand: () => number,
): LetterRecord[] {
  if (absenceProfile === "good" || absenceProfile === "mild") return [];
  const count =
    absenceProfile === "chronic" ? 2 : absenceProfile === "poor" ? 2 : 1;

  const letters: LetterRecord[] = [];
  const usedDays = new Set<number>();
  for (let i = 0; i < count; i++) {
    let daysBack: number;
    do {
      daysBack = Math.floor(rand() * 50) + 5;
    } while (usedDays.has(daysBack));
    usedDays.add(daysBack);

    const actorIdx = Math.floor(rand() * 3);
    const actors = ["Principal", "Teacher Name 001", "Teacher Name 005"];
    letters.push({
      studentId,
      sentAt: offsetDate("2026-04-16", daysBack),
      sentBy: actors[actorIdx],
    });
  }
  letters.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return letters;
}

// Build all 619 students
function buildStudents(): Student[] {
  const TOTAL = 619;
  const gradeCounters: Record<number, number> = { 6: 0, 7: 0, 8: 0 };

  return Array.from({ length: TOTAL }, (_, i) => {
    const num = i + 1;
    const numStr = String(num).padStart(3, "0");
    const id = `s${numStr}`;
    const name = `Name Surname ${numStr}`;
    const grade = gradeForIndex(i);
    const profileIdx = i % PROFILE_CYCLE.length;
    const profile = PROFILE_CYCLE[profileIdx];
    const isNewlyFlagged = NEWLY_FLAGGED_PATTERN.has(i % 40);

    const rand = seededRand(i * 31337 + 42);
    const { history, daysPresent, daysAbsent } = buildAttendanceHistory(
      rand,
      profile,
    );
    const totalDays = daysPresent + daysAbsent;
    const absenceRate = totalDays > 0 ? daysAbsent / totalDays : 0;

    const gradeTeachers = TEACHERS_BY_GRADE[grade];
    const teacherIdx = gradeCounters[grade] % gradeTeachers.length;
    gradeCounters[grade]++;
    const teacher = gradeTeachers[teacherIdx];

    const rand2 = seededRand(i * 99991 + 7777);
    const notes = buildNotesForStudent(id, profile, rand2);
    const rand3 = seededRand(i * 12347 + 3333);
    const letterHistory = buildLettersForStudent(id, profile, rand3);

    return {
      id,
      name,
      grade,
      teacher,
      daysPresent,
      daysAbsent,
      totalDays,
      absenceRate,
      isNewlyFlagged,
      attendanceHistory: history,
      notes,
      letterHistory,
    };
  });
}

// Pre-seeded audit log entries
const SEEDED_AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: "a01",
    action: "Dismissed alert for Name Surname 001 (Grade 6, 28% absent)",
    studentId: "s001",
    studentName: "Name Surname 001",
    actor: "Principal",
    timestamp: "2026-04-15T14:22:00.000Z",
  },
  {
    id: "a02",
    action: "Sent parent letter for Name Surname 003 (Grade 8, 31% absent)",
    studentId: "s003",
    studentName: "Name Surname 003",
    actor: "Teacher Name 006",
    timestamp: "2026-04-15T10:05:00.000Z",
  },
  {
    id: "a03",
    action: "Added note for Name Surname 004 (Grade 6)",
    studentId: "s004",
    studentName: "Name Surname 004",
    actor: "Teacher Name 001",
    timestamp: "2026-04-14T15:48:00.000Z",
  },
  {
    id: "a04",
    action: "Sent parent letter for Name Surname 011 (Grade 7, 27% absent)",
    studentId: "s011",
    studentName: "Name Surname 011",
    actor: "Principal",
    timestamp: "2026-04-14T09:30:00.000Z",
  },
  {
    id: "a05",
    action: "Dismissed alert for Name Surname 022 (Grade 6, 24% absent)",
    studentId: "s022",
    studentName: "Name Surname 022",
    actor: "Teacher Name 004",
    timestamp: "2026-04-12T16:15:00.000Z",
  },
  {
    id: "a06",
    action: "Added note for Name Surname 002 (Grade 7)",
    studentId: "s002",
    studentName: "Name Surname 002",
    actor: "Teacher Name 003",
    timestamp: "2026-04-11T11:20:00.000Z",
  },
  {
    id: "a07",
    action: "Sent parent letter for Name Surname 015 (Grade 8, 29% absent)",
    studentId: "s015",
    studentName: "Name Surname 015",
    actor: "Principal",
    timestamp: "2026-04-10T14:00:00.000Z",
  },
  {
    id: "a08",
    action: "Added note for Name Surname 016 (Grade 6)",
    studentId: "s016",
    studentName: "Name Surname 016",
    actor: "Teacher Name 001",
    timestamp: "2026-04-09T08:45:00.000Z",
  },
  {
    id: "a09",
    action: "Dismissed alert for Name Surname 029 (Grade 7, 26% absent)",
    studentId: "s029",
    studentName: "Name Surname 029",
    actor: "Teacher Name 005",
    timestamp: "2026-04-08T15:30:00.000Z",
  },
  {
    id: "a10",
    action: "Sent parent letter for Name Surname 034 (Grade 6, 23% absent)",
    studentId: "s034",
    studentName: "Name Surname 034",
    actor: "Principal",
    timestamp: "2026-04-07T10:10:00.000Z",
  },
  {
    id: "a11",
    action: "Added note for Name Surname 039 (Grade 8)",
    studentId: "s039",
    studentName: "Name Surname 039",
    actor: "Teacher Name 007",
    timestamp: "2026-04-04T13:00:00.000Z",
  },
  {
    id: "a12",
    action: "Dismissed alert for Name Surname 005 (Grade 7, 19% absent)",
    studentId: "s005",
    studentName: "Name Surname 005",
    actor: "Teacher Name 003",
    timestamp: "2026-04-02T09:00:00.000Z",
  },
  {
    id: "a13",
    action: "Sent parent letter for Name Surname 009 (Grade 8, 18% absent)",
    studentId: "s009",
    studentName: "Name Surname 009",
    actor: "Teacher Name 006",
    timestamp: "2026-04-01T14:45:00.000Z",
  },
  {
    id: "a14",
    action: "Added note for Name Surname 007 (Grade 6)",
    studentId: "s007",
    studentName: "Name Surname 007",
    actor: "Teacher Name 001",
    timestamp: "2026-03-31T11:30:00.000Z",
  },
  {
    id: "a15",
    action: "Dismissed alert for Name Surname 026 (Grade 7, 17% absent)",
    studentId: "s026",
    studentName: "Name Surname 026",
    actor: "Principal",
    timestamp: "2026-03-28T16:00:00.000Z",
  },
  {
    id: "a16",
    action: "Sent parent letter for Name Surname 032 (Grade 7, 16% absent)",
    studentId: "s032",
    studentName: "Name Surname 032",
    actor: "Teacher Name 005",
    timestamp: "2026-03-27T10:20:00.000Z",
  },
  {
    id: "a17",
    action: "Added note for Name Surname 038 (Grade 7)",
    studentId: "s038",
    studentName: "Name Surname 038",
    actor: "Teacher Name 003",
    timestamp: "2026-03-26T14:15:00.000Z",
  },
  {
    id: "a18",
    action: "Dismissed alert for Name Surname 023 (Grade 7, 12% absent)",
    studentId: "s023",
    studentName: "Name Surname 023",
    actor: "Teacher Name 008",
    timestamp: "2026-03-25T09:45:00.000Z",
  },
  {
    id: "a19",
    action: "Sent parent letter for Name Surname 020 (Grade 7, 18% absent)",
    studentId: "s020",
    studentName: "Name Surname 020",
    actor: "Principal",
    timestamp: "2026-03-22T11:00:00.000Z",
  },
  {
    id: "a20",
    action: "Added note for Name Surname 006 (Grade 8)",
    studentId: "s006",
    studentName: "Name Surname 006",
    actor: "Teacher Name 009",
    timestamp: "2026-03-20T15:30:00.000Z",
  },
  {
    id: "a21",
    action: "Dismissed alert for Name Surname 019 (Grade 6, 11% absent)",
    studentId: "s019",
    studentName: "Name Surname 019",
    actor: "Teacher Name 004",
    timestamp: "2026-03-19T10:00:00.000Z",
  },
  {
    id: "a22",
    action: "Sent parent letter for Name Surname 013 (Grade 6, 13% absent)",
    studentId: "s013",
    studentName: "Name Surname 013",
    actor: "Teacher Name 001",
    timestamp: "2026-03-18T14:30:00.000Z",
  },
  {
    id: "a23",
    action: "Added note for Name Surname 028 (Grade 6)",
    studentId: "s028",
    studentName: "Name Surname 028",
    actor: "Teacher Name 002",
    timestamp: "2026-03-17T09:15:00.000Z",
  },
  {
    id: "a24",
    action: "Dismissed alert for Name Surname 008 (Grade 7, 9% absent)",
    studentId: "s008",
    studentName: "Name Surname 008",
    actor: "Principal",
    timestamp: "2026-03-15T16:45:00.000Z",
  },
  {
    id: "a25",
    action: "Sent parent letter for Name Surname 031 (Grade 6, 12% absent)",
    studentId: "s031",
    studentName: "Name Surname 031",
    actor: "Teacher Name 001",
    timestamp: "2026-03-14T11:00:00.000Z",
  },
  {
    id: "a26",
    action: "Added note for Name Surname 027 (Grade 8)",
    studentId: "s027",
    studentName: "Name Surname 027",
    actor: "Teacher Name 007",
    timestamp: "2026-03-12T13:30:00.000Z",
  },
  {
    id: "a27",
    action: "Dismissed alert for Name Surname 036 (Grade 8, 10% absent)",
    studentId: "s036",
    studentName: "Name Surname 036",
    actor: "Teacher Name 009",
    timestamp: "2026-03-11T10:30:00.000Z",
  },
  {
    id: "a28",
    action: "Sent parent letter for Name Surname 001 (Grade 6, 28% absent)",
    studentId: "s001",
    studentName: "Name Surname 001",
    actor: "Principal",
    timestamp: "2026-03-08T14:00:00.000Z",
  },
];

export const STUDENTS: Student[] = buildStudents();
export const SCHOOL_DAYS_LIST = SCHOOL_DAYS;
export const TODAY = SCHOOL_DAYS[SCHOOL_DAYS.length - 1];
export const WEEK_START_ISO = THIS_WEEK_START.toISOString().slice(0, 10);
export const TOTAL_STUDENTS = 650;
export const SEEDED_AUDIT_LOG: AuditEntry[] = SEEDED_AUDIT_ENTRIES;
