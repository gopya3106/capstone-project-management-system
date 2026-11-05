import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { CreateGroupForm } from "@/components/admin/CreateGroupForm";
import { getAvailableStudents } from "@/lib/students";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  // Load available active students with no active group membership
  const availableStudents = await getAvailableStudents();

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin/groups"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              >
                ← Back to Groups
              </Link>
              <span className="text-zinc-300">/</span>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                New Formation
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Create Capstone Project Group
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Form a new student group, designate the team leader, and optionally initialize the project link.
            </p>
          </div>
          <LogoutButton />
        </header>

        {/* Navigation */}
        <AdminNav role={session.role} />

        {/* Group Creation Form */}
        <CreateGroupForm availableStudents={availableStudents} />
      </div>
    </div>
  );
}

