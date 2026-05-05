import type { SortDirection, SortField, SortState, Student } from "@/types";
import { useMemo, useState } from "react";

export function useSortableTable(students: Student[]) {
  const [sort, setSort] = useState<SortState>({
    field: "absenceRate",
    direction: "desc",
  });
  const [search, setSearch] = useState("");

  const handleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || String(s.grade).includes(q),
    );
  }, [students, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "grade":
          cmp = a.grade - b.grade;
          break;
        case "daysAbsent":
          cmp = a.daysAbsent - b.daysAbsent;
          break;
        case "absenceRate":
          cmp = a.absenceRate - b.absenceRate;
          break;
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  return { sorted, sort, handleSort, search, setSearch };
}
