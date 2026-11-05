import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { CreateProjectForm } from "@/components/admin/CreateProjectForm";
import { getAvailableGroupsForProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const availableGroups = await getAvailableGroupsForProject();

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Project Registration
              </span>
              <span className="text-xs text-zinc-400">|</span>
              <span className="text-xs text-zinc-500 font-mono">User ID: #{session.userId}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Register Capstone Project
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Create a project specification and link it to an active capstone group.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/projects"
              className="rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Back to Projects
            </Link>
            <LogoutButton />
          </div>
        </header>

        {/* Admin Navigation */}
        <AdminNav role={session.role} />

        {/* Form */}
        <CreateProjectForm availableGroups={availableGroups} />
      </div>
    </div>
  );
}

