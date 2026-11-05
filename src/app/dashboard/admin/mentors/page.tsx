import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { MentorListingTable } from "@/components/admin/MentorListingTable";
import { getMentors, getMentorStats } from "@/lib/mentors";

export const dynamic = "force-dynamic";

export default async function AdminMentorsPage() {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const [stats, result] = await Promise.all([
    getMentorStats(),
    getMentors(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Phase 3 Faculty Administration
              </span>
              <span className="text-xs text-zinc-400">|</span>
              <span className="text-xs text-zinc-500 font-mono">User ID: #{session.userId}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Faculty Mentor Directory & Capacity
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Track faculty mentorship workload, project allocations, and capacity limits.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LogoutButton />
          </div>
        </header>

        {/* Navigation */}
        <AdminNav role={session.role} />

        {/* Mentor Metrics Summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Total Mentors
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.totalMentors}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {stats.availableMentors} active & available
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Active Allocations
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.activeAllocationsCount}
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {stats.primaryAllocationsCount} primary • {stats.coMentorAllocationsCount} co-mentors
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Average Workload
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.avgWorkload}{" "}
              <span className="text-xs font-normal text-zinc-500">projects / mentor</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              4.0 max standard department cap
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Unavailable
            </span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.unavailableMentors}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">On leave or sabbatical</p>
          </div>
        </div>

        {/* Mentor Directory Table */}
        <section className="space-y-3">
          <MentorListingTable
            initialMentors={result.mentors}
            total={result.total}
          />
        </section>
      </div>
    </div>
  );
}

