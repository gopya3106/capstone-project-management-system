import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { StudentDirectoryTable } from "@/components/admin/StudentDirectoryTable";
import { getStudents, getStudentStats } from "@/lib/students";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const [studentStats, studentsResult] = await Promise.all([
    getStudentStats(),
    getStudents({ limit: 100 }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Student Administration
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Student Directory & Enrollment
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Search by USN or name, filter by department, and audit capstone group assignments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/groups/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + Create Group
            </Link>
            <LogoutButton />
          </div>
        </header>

        {/* Navigation */}
        <AdminNav role={session.role} />

        {/* Stats Strip */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Total Enrolled
            </span>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {studentStats.totalStudents}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Active Status
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {studentStats.activeStudents}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Group Assigned
            </span>
            <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {studentStats.assignedStudents}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Unassigned Students
            </span>
            <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {studentStats.unassignedStudents}
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <StudentDirectoryTable
          initialStudents={studentsResult.students}
          total={studentsResult.total}
        />
      </div>
    </div>
  );
}

