import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProjectListingTable } from "@/components/admin/ProjectListingTable";
import { getProjects, getProjectStats } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const [stats, result] = await Promise.all([
    getProjectStats(),
    getProjects({ limit: 50 }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Phase 3 Capstone Administration
              </span>
              <span className="text-xs text-zinc-400">|</span>
              <span className="text-xs text-zinc-500 font-mono">User ID: #{session.userId}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Capstone Project Directory
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage capstone projects, domains, phases, and group allocations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/projects/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + Register New Project
            </Link>
            <LogoutButton />
          </div>
        </header>

        {/* Admin Navigation */}
        <AdminNav role={session.role} />

        {/* Project Metrics Summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Total Projects
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.totalProjects}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {stats.inProgressCount} in progress
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              With Primary Mentor
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.withPrimaryMentorCount}
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {stats.totalProjects - stats.withPrimaryMentorCount} need primary mentor
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Completed Projects
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.completedCount}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {stats.notStartedCount} not yet started
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              On Hold
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.onHoldCount}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Requires coordinator review</p>
          </div>
        </div>

        {/* Projects Listing Table */}
        <section className="space-y-3">
          <ProjectListingTable
            initialProjects={result.projects}
            total={result.total}
          />
        </section>
      </div>
    </div>
  );
}

