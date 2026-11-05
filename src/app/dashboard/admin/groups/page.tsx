import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { GroupListingTable } from "@/components/admin/GroupListingTable";
import { getGroups, getGroupStats } from "@/lib/groups";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const [groupStats, groupsResult] = await Promise.all([
    getGroupStats(),
    getGroups({ limit: 100 }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Capstone Groups
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Capstone Project Groups
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage student project cohorts, enforce maximum 4-member limits, and link approved capstone projects.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/groups/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + Create Capstone Group
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
              Total Groups
            </span>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {groupStats.totalGroups}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Active Groups
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {groupStats.activeGroups}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Forming Groups
            </span>
            <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {groupStats.formingGroups}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Avg. Team Size
            </span>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {groupStats.averageTeamSize} <span className="text-xs font-normal text-zinc-500">/ 4</span>
            </div>
          </div>
        </div>

        {/* Groups Table */}
        <GroupListingTable
          initialGroups={groupsResult.groups}
          total={groupsResult.total}
        />
      </div>
    </div>
  );
}

