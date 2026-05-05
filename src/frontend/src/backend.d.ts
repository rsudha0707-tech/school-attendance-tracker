import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ContactNote {
    id: string;
    studentId: string;
    createdAt: bigint;
    text: string;
    author: string;
}
export interface AuditEntry {
    id: string;
    action: string;
    studentId: string;
    actorName: string;
    studentName: string;
    timestamp: bigint;
}
export interface AttendanceRecord {
    status: AttendanceStatus;
    studentId: string;
    date: string;
}
export interface LetterRecord {
    id: string;
    studentId: string;
    sentAt: bigint;
    sentBy: string;
}
export interface Student {
    id: string;
    name: string;
    teacher: string;
    grade: bigint;
}
export enum AttendanceStatus {
    weekend = "weekend",
    present = "present",
    absent = "absent",
    excused = "excused",
    holiday = "holiday"
}
export interface backendInterface {
    addNote(studentId: string, studentName: string, text: string, author: string): Promise<string>;
    clearAllData(): Promise<void>;
    dismissAlert(studentId: string, studentName: string, dismissedBy: string): Promise<void>;
    getAllLetterHistory(): Promise<Array<LetterRecord>>;
    getAllNotes(): Promise<Array<ContactNote>>;
    getAttendanceForDateRange(startDate: string, endDate: string): Promise<Array<AttendanceRecord>>;
    getAttendanceForStudent(studentId: string): Promise<Array<AttendanceRecord>>;
    getAuditLog(): Promise<Array<AuditEntry>>;
    getDismissedAlerts(): Promise<Array<string>>;
    getLetterHistoryForStudent(studentId: string): Promise<Array<LetterRecord>>;
    getNotesForStudent(studentId: string): Promise<Array<ContactNote>>;
    getStudents(): Promise<Array<Student>>;
    getStudentsByGrade(grade: bigint): Promise<Array<Student>>;
    getStudentsByTeacher(teacher: string): Promise<Array<Student>>;
    reinstateAlert(studentId: string): Promise<void>;
    sendLetter(studentId: string, studentName: string, sentBy: string): Promise<string>;
}
