import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { CoordinatorOverview } from "@/components/workflow/CoordinatorOverview";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { StudentDirectoryTable } from "@/components/admin/StudentDirectoryTable";
import { GroupListingTable } from "@/components/admin/GroupListingTable";
import { ProjectListingTable } from "@/components/admin/ProjectListingTable";
import { getStudents, getStudentStats } from "@/lib/students";
import { getGroups, getGroupStats } from "@/lib/groups";
import { getProjects, getProjectStats } from "@/lib/projects";
import { getMentorStats } from "@/lib/mentors";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const isAdmin = session.role === "Admin";

  // Coordinators do not manage student / group records, so only Admin loads them
  const [
    studentStats,
    groupStats,
    projectStats,
    mentorStats,
    studentsResult,
    groupsResult,
    projectsResult,
  ] = await Promise.all([
    isAdmin ? getStudentStats() : null,
    isAdmin ? getGroupStats() : null,
    getProjectStats(),
    getMentorStats(),
    isAdmin ? getStudents({ limit: 50 }) : null,
    isAdmin ? getGroups({ limit: 20 }) : null,
    getProjects({ limit: 20 }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                {isAdmin ? "Administrator" : "Coordinator Console"}
              </span>
              <span className="text-xs text-zinc-400">|</span>
              <span className="text-xs text-zinc-500 font-mono">User ID: #{session.userId}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {isAdmin ? "Admin & Coordinator Portal" : "Coordinator Dashboard"}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Logged in as{" "}
              <strong className="text-zinc-700 dark:text-zinc-300">{session.email}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/admin/projects/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + Register Project
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard/admin/groups/new"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                + Create Group
              </Link>
            )}
            <LogoutButton />
          </div>
        </header>

        {/* Admin Navigation Tabs */}
        <AdminNav role={session.role} />

        {/* Coordinator dashboard (views: v_dashboard_summary, v_project_progress) */}
        <CoordinatorOverview />

        {/* Aggregate Metrics Grid */}
        {isAdmin && studentStats && groupStats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Capstone Projects
              </span>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {projectStats.totalProjects}
              </div>
              <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                {projectStats.inProgressCount} in progress • {projectStats.completedCount} completed
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Faculty Mentors
              </span>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {mentorStats.totalMentors}
              </div>
              <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {mentorStats.activeAllocationsCount} active project allocations
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Capstone Groups
              </span>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {groupStats.totalGroups}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {groupStats.activeGroups} active groups ({groupStats.averageTeamSize} avg size)
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Enrolled Students
              </span>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {studentStats.totalStudents}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {studentStats.assignedStudents} assigned ({studentStats.unassignedStudents}{" "}
                unassigned)
              </p>
            </div>
          </div>
        )}

        {/* Capstone Projects Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Capstone Projects
              </h2>
              <p className="text-xs text-zinc-500">
                Registered projects, domains, assigned groups, and primary mentors.
              </p>
            </div>
            <Link
              href="/dashboard/admin/projects"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              View All Projects ({projectsResult.total}) →
            </Link>
          </div>

          <ProjectListingTable
            initialProjects={projectsResult.projects}
            total={projectsResult.total}
          />
        </section>

        {/* Capstone Groups Section */}
        {isAdmin && groupsResult && studentsResult && (
          <>
            <section className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Capstone Project Groups
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Managed project teams, team leaders, and active member limits.
                  </p>
                </div>
                <Link
                  href="/dashboard/admin/groups"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  View All Groups ({groupsResult.total}) →
                </Link>
              </div>

              <GroupListingTable initialGroups={groupsResult.groups} total={groupsResult.total} />
            </section>

            {/* Student Directory Section */}
            <section className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Student Enrollment Directory
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Searchable directory with USN, academic status, and group allocations.
                  </p>
                </div>
                <Link
                  href="/dashboard/admin/students"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  Full Directory ({studentsResult.total}) →
                </Link>
              </div>

              <StudentDirectoryTable
                initialStudents={studentsResult.students}
                total={studentsResult.total}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
