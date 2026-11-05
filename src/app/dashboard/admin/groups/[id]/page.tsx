import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { getGroupById } from "@/lib/groups";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: Props) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const groupId = parseInt(id, 10);
  if (isNaN(groupId) || groupId <= 0) {
    notFound();
  }

  const group = await getGroupById(groupId);
  if (!group) {
    notFound();
  }

  const memberCount = group.members.filter((m) => m.membership_status === "Active").length;
  const isFull = memberCount >= 4;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
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
              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Group #{group.group_id}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {group.group_name}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Department of {group.department} • Batch {group.batch} • Academic Year {group.academic_year}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                group.group_status === "Active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : group.group_status === "Forming"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              Status: {group.group_status}
            </span>
            <LogoutButton />
          </div>
        </header>

        {/* Navigation */}
        <AdminNav role={session.role} />

        {/* Group Metadata Overview */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Team Roster
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {memberCount}
              </span>
              <span className="text-xs text-zinc-500">/ 4 max members</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {isFull ? "Maximum Capacity Reached" : `${4 - memberCount} slot(s) remaining`}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Team Leader
            </span>
            <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {group.leader_name}
            </div>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              {group.leader_usn}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Formation Date
            </span>
            <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {group.formation_date ? new Date(group.formation_date).toLocaleDateString() : "—"}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 font-mono">
              Academic: {group.academic_year}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Capstone Project
            </span>
            <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {group.capstone_project?.project_title || "Pending Allocation"}
            </div>
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {group.capstone_project?.project_status || "No project yet"}
            </p>
          </div>
        </div>

        {/* Member Roster Table */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Active Group Members ({memberCount} / 4)
              </h2>
              <p className="text-xs text-zinc-500">
                Official students enrolled in this capstone team. Maximum limit of 4 active members enforced.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">USN</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Sem / Sec</th>
                  <th className="px-4 py-3">Joined Date</th>
                  <th className="px-4 py-3 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {group.members.map((member) => (
                  <tr
                    key={member.group_member_id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {member.member_role === "Leader" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          ★ Team Leader
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Member
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {member.usn}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {member.full_name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-700 dark:text-zinc-300">{member.email}</div>
                      {member.phone_number && (
                        <div className="text-[11px] text-zinc-400">{member.phone_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      Sem {member.current_semester || "—"} {member.section ? `(${member.section})` : ""}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/admin/students/${member.student_id}`}
                        className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View Profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Linked Capstone Project Section */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Official Capstone Project
              </h2>
              <p className="text-xs text-zinc-500">
                Authoritative relational record linked to this group via MySQL Capstone_Projects table.
              </p>
            </div>
            {group.capstone_project && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {group.capstone_project.project_status}
              </span>
            )}
          </div>

          {group.capstone_project ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Project Title
                </span>
                <h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {group.capstone_project.project_title}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.capstone_project.project_domain && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Domain
                    </span>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300 font-medium">
                      {group.capstone_project.project_domain}
                    </p>
                  </div>
                )}
                {group.capstone_project.technology_stack && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Technology Stack
                    </span>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300 font-medium">
                      {group.capstone_project.technology_stack}
                    </p>
                  </div>
                )}
              </div>

              {group.capstone_project.problem_statement && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Problem Statement
                  </span>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {group.capstone_project.problem_statement}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                No Capstone Project Linked Yet
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                This group is formed and ready to submit its capstone project title and synopsis for departmental approval.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

