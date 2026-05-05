import List "mo:core/List";
import Set "mo:core/Set";
import Int "mo:core/Int";
import Time "mo:core/Time";

actor {

  // ─────────────────────────────────────────
  // Types
  // ─────────────────────────────────────────

  type Student = {
    id : Text;
    name : Text;
    grade : Nat;
    teacher : Text;
  };

  type AttendanceStatus = { #present; #absent; #excused; #weekend; #holiday };

  type AttendanceRecord = {
    studentId : Text;
    date : Text; // YYYY-MM-DD
    status : AttendanceStatus;
  };

  type ContactNote = {
    id : Text;
    studentId : Text;
    text : Text;
    author : Text;
    createdAt : Int;
  };

  type LetterRecord = {
    id : Text;
    studentId : Text;
    sentAt : Int;
    sentBy : Text;
  };

  type AuditEntry = {
    id : Text;
    action : Text;
    studentId : Text;
    studentName : Text;
    actorName : Text;
    timestamp : Int;
  };

  // ─────────────────────────────────────────
  // State
  // ─────────────────────────────────────────

  let students     = List.empty<Student>();
  let attendance   = List.empty<AttendanceRecord>();
  let notes        = List.empty<ContactNote>();
  let letters      = List.empty<LetterRecord>();
  let auditLog     = List.empty<AuditEntry>();
  let dismissedAlerts = Set.empty<Text>();

  var nextId : Nat = 0;
  var seeded : Bool = false;

  // ─────────────────────────────────────────
  // ID generation
  // ─────────────────────────────────────────

  func genId(prefix : Text) : Text {
    nextId += 1;
    prefix # "-" # nextId.toText();
  };

  // ─────────────────────────────────────────
  // Seed data helpers
  // ─────────────────────────────────────────

  // School days: Sep 2 2025 through Apr 17 2026 (weekdays, minus holidays)
  // We encode as YYYY-MM-DD strings. Days are pre-computed as a flat array.

  func buildSchoolDays() : [Text] {
    // Major US holidays to skip (observed):
    // Sep 1 2025 (Labor Day), Nov 11 2025 (Veterans Day), Nov 27 2025 (Thanksgiving),
    // Nov 28 2025 (day after Thanksgiving), Dec 24 2025, Dec 25 2025, Dec 26 2025,
    // Dec 31 2025, Jan 1 2026, Jan 19 2026 (MLK Day), Feb 16 2026 (Presidents Day),
    // Apr 3 2026 (spring break), Apr 6 2026 - Apr 10 2026 (spring break)

    let holidays = Set.fromArray([
      "2025-09-01",
      "2025-11-11", "2025-11-27", "2025-11-28",
      "2025-12-24", "2025-12-25", "2025-12-26", "2025-12-31",
      "2026-01-01", "2026-01-19",
      "2026-02-16",
      "2026-04-03", "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10"
    ]);

    // Enumerate days Sep 2 2025 through Apr 17 2026
    // Use a simple day-of-week calculation: Sep 2 2025 is a Tuesday (dow=2)
    // We'll iterate by computing offsets from a known epoch.
    // Sep 2 2025 = day 0 in our loop. We'll go for 229 calendar days.
    // Weekday of Sep 2 2025: Tuesday (1=Mon,2=Tue,...,0=Sun)

    // Month lengths for 2025/2026
    let monthData : [(Nat, Nat, Nat)] = [
      // (year, month, days)
      (2025, 9, 30), (2025, 10, 31), (2025, 11, 30), (2025, 12, 31),
      (2026, 1, 31), (2026, 2, 28), (2026, 3, 31), (2026, 4, 17)
    ];

    let result = List.empty<Text>();

    // Sep 2 2025 is a Tuesday. We start from day 2 of Sep 2025.
    // Compute day-of-week incrementally.
    // Sep 1 2025 is Monday → dow=1. Sep 2 is Tuesday → dow=2.
    var dow : Nat = 2; // 1=Mon .. 5=Fri, 6=Sat, 0=Sun

    for ((year, month, maxDay) in monthData.vals()) {
      let startDay : Nat = if (year == 2025 and month == 9) { 2 } else { 1 };
      var d = startDay;
      while (d <= maxDay) {
        // dow: 1=Mon..5=Fri, 6=Sat, 0=Sun
        if (dow != 6 and dow != 0) {
          // weekday
          let mm = if (month < 10) { "0" # month.toText() } else { month.toText() };
          let dd = if (d < 10) { "0" # d.toText() } else { d.toText() };
          let dateStr = year.toText() # "-" # mm # "-" # dd;
          if (not holidays.contains(dateStr)) {
            result.add(dateStr);
          };
        };
        d += 1;
        dow := (dow + 1) % 7;
      };
    };

    result.toArray();
  };

  // Deterministic pseudo-random absent check
  // Returns true if student should be absent on this day
  func isAbsent(studentIndex : Nat, dayIndex : Nat, absentRate : Nat) : Bool {
    // absentRate in percent (e.g., 3 = 3%)
    // Deterministic hash: (studentIndex * 7919 + dayIndex * 6271) % 100
    let hash = (studentIndex * 7919 + dayIndex * 6271) % 100;
    hash < absentRate;
  };

  // Deterministic excused check (about 30% of absences are excused)
  func isExcused(studentIndex : Nat, dayIndex : Nat) : Bool {
    let hash = (studentIndex * 5003 + dayIndex * 3307 + 17) % 100;
    hash < 30;
  };

  // Profile index → absence rate %
  func profileRate(profileIdx : Nat) : Nat {
    // 0=good(2%), 1=mild(5%), 2=moderate(8%), 3=poor(12%), 4=chronic(20%)
    switch (profileIdx) {
      case 0 { 2 };
      case 1 { 5 };
      case 2 { 8 };
      case 3 { 12 };
      case 4 { 20 };
      case _ { 5 };
    };
  };

  func padTimestamp(base : Int, offsetMs : Int) : Int {
    base + offsetMs * 1_000_000;
  };

  // ─────────────────────────────────────────
  // Seed function
  // ─────────────────────────────────────────

  func seed() {
    if (seeded) return;
    seeded := true;

    let baseTime : Int = 1_720_000_000_000_000_000; // ~Jul 2024 in nanoseconds

    // 12 teachers
    let teachersByGrade : [[Text]] = [
      // Grade 6
      ["Teacher Name 001", "Teacher Name 002", "Teacher Name 003", "Teacher Name 004"],
      // Grade 7
      ["Teacher Name 005", "Teacher Name 006", "Teacher Name 007", "Teacher Name 008"],
      // Grade 8
      ["Teacher Name 009", "Teacher Name 010", "Teacher Name 011", "Teacher Name 012"]
    ];

    // Student names (40 students, 8 per profile × 5 profiles)
    let studentNames : [Text] = [
      // good (low absence) — indices 0-7
      "Student Name 001", "Student Name 002", "Student Name 003", "Student Name 004",
      "Student Name 005", "Student Name 006", "Student Name 007", "Student Name 008",
      // mild — indices 8-15
      "Student Name 009", "Student Name 010", "Student Name 011", "Student Name 012",
      "Student Name 013", "Student Name 014", "Student Name 015", "Student Name 016",
      // moderate — indices 16-23
      "Student Name 017", "Student Name 018", "Student Name 019", "Student Name 020",
      "Student Name 021", "Student Name 022", "Student Name 023", "Student Name 024",
      // poor — indices 24-31
      "Student Name 025", "Student Name 026", "Student Name 027", "Student Name 028",
      "Student Name 029", "Student Name 030", "Student Name 031", "Student Name 032",
      // chronic — indices 32-39
      "Student Name 033", "Student Name 034", "Student Name 035", "Student Name 036",
      "Student Name 037", "Student Name 038", "Student Name 039", "Student Name 040"
    ];

    // Assign grade and teacher deterministically
    // Students 0-12 = grade 6, 13-25 = grade 7, 26-39 = grade 8
    // Profile index: 0-7=good, 8-15=mild, 16-23=moderate, 24-31=poor, 32-39=chronic

    let schoolDays = buildSchoolDays();
    let dayCount = schoolDays.size();

    var si = 0;
    while (si < 40) {
      let name = studentNames[si];
      let gradeIdx = si / 14; // 0=grade6 (0-13), 1=grade7 (14-27), 2=grade8 (28-41) - rough split
      let safeGradeIdx = if (gradeIdx > 2) { 2 } else { gradeIdx };
      let grade : Nat = safeGradeIdx + 6;
      let teacherList = teachersByGrade[safeGradeIdx];
      let teacher = teacherList[si % 4];
      let studentId = "s" # si.toText();

      students.add({ id = studentId; name; grade; teacher });

      // profile: 0-7=good, 8-15=mild, 16-23=moderate, 24-31=poor, 32-39=chronic
      let profileIdx = si / 8;
      let rate = profileRate(profileIdx);

      // Generate attendance
      var di = 0;
      while (di < dayCount) {
        let dateStr = schoolDays[di];
        let absent = isAbsent(si, di, rate);
        let status : AttendanceStatus = if (absent) {
          if (isExcused(si, di)) { #excused } else { #absent }
        } else {
          #present
        };
        attendance.add({ studentId; date = dateStr; status });
        di += 1;
      };

      si += 1;
    };

    // Seed contact notes
    let noteTexts : [Text] = [
      "Called parent — no answer, left voicemail.",
      "Parent called back — discussed attendance concerns.",
      "Meeting scheduled for next week.",
      "Home visit conducted — family is aware of issue.",
      "Email sent to guardian regarding absences.",
      "Student met with counselor.",
      "Parent letter mailed home.",
      "Spoke with parent — illness cited as reason.",
      "Referred to attendance intervention team.",
      "Follow-up call made — parent committed to improvement.",
      "Parent confirmed receipt of letter.",
      "Student reported feeling better and plans to return.",
      "Nurse note provided for recent absences.",
      "Discussed transportation issues with family.",
      "Community resource referral made."
    ];

    let noteAuthors : [Text] = [
      "Staff Name 001", "Teacher Name 001", "Teacher Name 002", "Teacher Name 005",
      "Teacher Name 009", "Teacher Name 006", "Staff Name 002"
    ];

    // Generate 3-8 notes per student — focus on moderate/poor/chronic (students 20-49)
    var nsi = 0;
    while (nsi < 40) {
      let studentId = "s" # nsi.toText();
      let profileIdx = nsi / 8;
      let noteQty : Nat = switch (profileIdx) {
        case 0 { 2 };  // good: 2 notes
        case 1 { 3 };  // mild: 3 notes
        case 2 { 5 };  // moderate: 5 notes
        case 3 { 7 };  // poor: 7 notes
        case 4 { 8 };  // chronic: 8 notes
        case _ { 3 };
      };

      var ni = 0;
      while (ni < noteQty) {
        let noteText = noteTexts[(nsi * 3 + ni) % noteTexts.size()];
        let author = noteAuthors[(nsi + ni) % noteAuthors.size()];
        let ts = padTimestamp(baseTime, (nsi * 100_000 + ni * 10_000).toInt());
        let noteId = genId("note");
        notes.add({
          id = noteId;
          studentId;
          text = noteText;
          author;
          createdAt = ts;
        });
        ni += 1;
      };
      nsi += 1;
    };

    // Seed letter records — for students with moderate/poor/chronic profile (index 20-49)
    let letterSenders : [Text] = [
      "Staff Name 001", "Teacher Name 001", "Teacher Name 005", "Teacher Name 009"
    ];

    var lsi = 16; // start from moderate profile students (index 16 = profile 2)
    while (lsi < 40) {
      let studentId = "s" # lsi.toText();
      let profileIdx = lsi / 8;
      let letterQty : Nat = switch (profileIdx) {
        case 2 { 1 };
        case 3 { 2 };
        case 4 { 3 };
        case _ { 1 };
      };

      var li = 0;
      while (li < letterQty) {
        let sender = letterSenders[(lsi + li) % letterSenders.size()];
        let ts = padTimestamp(baseTime, (lsi * 200_000 + li * 20_000 + 5_000).toInt());
        let letterId = genId("letter");
        letters.add({
          id = letterId;
          studentId;
          sentAt = ts;
          sentBy = sender;
        });
        li += 1;
      };
      lsi += 1;
    };

    // Seed audit log (50-80 entries)
    let auditActions : [Text] = [
      "Note added", "Letter sent", "Alert dismissed", "Note added", "Letter sent"
    ];
    let auditActors : [Text] = [
      "Staff Name 001", "Teacher Name 001", "Teacher Name 002", "Teacher Name 005",
      "Teacher Name 009", "Teacher Name 006"
    ];

    var ai = 0;
    while (ai < 65) {
      let si2 = (ai * 7 + 3) % 40;
      let studentId = "s" # si2.toText();
      let studentName = studentNames[si2];
      let action = auditActions[ai % auditActions.size()];
      let actor2 = auditActors[ai % auditActors.size()];
      let ts = padTimestamp(baseTime, (ai * 50_000 + 1_000).toInt());
      let entryId = genId("audit");
      auditLog.add({
        id = entryId;
        action;
        studentId;
        studentName;
        actorName = actor2;
        timestamp = ts;
      });
      ai += 1;
    };

    // Pre-dismiss alerts for about half the students who have poor/chronic profiles (indices 24-39)
    // Dismiss every other one
    var dsi = 24;
    while (dsi < 40) {
      if (dsi % 2 == 0) {
        dismissedAlerts.add("s" # dsi.toText());
      };
      dsi += 1;
    };
  };

  // Run seed once on actor initialization
  seed();

  // ─────────────────────────────────────────
  // Query functions
  // ─────────────────────────────────────────

  public query func getStudents() : async [Student] {
    students.toArray();
  };

  public query func getStudentsByGrade(grade : Nat) : async [Student] {
    students.filter(func(s) { s.grade == grade }).toArray();
  };

  public query func getStudentsByTeacher(teacher : Text) : async [Student] {
    students.filter(func(s) { s.teacher == teacher }).toArray();
  };

  public query func getAttendanceForStudent(studentId : Text) : async [AttendanceRecord] {
    attendance.filter(func(r) { r.studentId == studentId }).toArray();
  };

  public query func getAttendanceForDateRange(startDate : Text, endDate : Text) : async [AttendanceRecord] {
    attendance.filter(func(r) {
      r.date >= startDate and r.date <= endDate
    }).toArray();
  };

  public query func getNotesForStudent(studentId : Text) : async [ContactNote] {
    let filtered = notes.filter(func(n) { n.studentId == studentId });
    // Sort by createdAt desc
    filtered.sort(func(a, b) { Int.compare(b.createdAt, a.createdAt) }).toArray();
  };

  public query func getLetterHistoryForStudent(studentId : Text) : async [LetterRecord] {
    letters.filter(func(l) { l.studentId == studentId }).toArray();
  };

  public query func getAuditLog() : async [AuditEntry] {
    // Sort by timestamp desc
    auditLog.sort(func(a, b) { Int.compare(b.timestamp, a.timestamp) }).toArray();
  };

  public query func getDismissedAlerts() : async [Text] {
    dismissedAlerts.toArray();
  };

  public query func getAllLetterHistory() : async [LetterRecord] {
    letters.toArray();
  };

  public query func getAllNotes() : async [ContactNote] {
    notes.toArray();
  };

  // ─────────────────────────────────────────
  // Update functions
  // ─────────────────────────────────────────

  public func addNote(studentId : Text, studentName : Text, text : Text, author : Text) : async Text {
    let noteId = genId("note");
    let ts = Time.now();
    notes.add({ id = noteId; studentId; text; author; createdAt = ts });

    let auditId = genId("audit");
    auditLog.add({
      id = auditId;
      action = "Note added";
      studentId;
      studentName;
      actorName = author;
      timestamp = ts;
    });

    noteId;
  };

  public func sendLetter(studentId : Text, studentName : Text, sentBy : Text) : async Text {
    let letterId = genId("letter");
    let ts = Time.now();
    letters.add({ id = letterId; studentId; sentAt = ts; sentBy });

    let auditId = genId("audit");
    auditLog.add({
      id = auditId;
      action = "Letter sent";
      studentId;
      studentName;
      actorName = sentBy;
      timestamp = ts;
    });

    letterId;
  };

  public func dismissAlert(studentId : Text, studentName : Text, dismissedBy : Text) : async () {
    dismissedAlerts.add(studentId);

    let auditId = genId("audit");
    auditLog.add({
      id = auditId;
      action = "Alert dismissed";
      studentId;
      studentName;
      actorName = dismissedBy;
      timestamp = Time.now();
    });
  };

  public func reinstateAlert(studentId : Text) : async () {
    dismissedAlerts.remove(studentId);
  };

  public func clearAllData() : async () {
    students.clear();
    attendance.clear();
    notes.clear();
    letters.clear();
    auditLog.clear();
    dismissedAlerts.clear();
    seeded := false;
    nextId := 0;
  };
};
