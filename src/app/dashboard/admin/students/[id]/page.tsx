import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { getStudentById } from "@/lib/students";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: Props) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const studentId = parseInt(id, 10);
  if (isNaN(studentId) || studentId <= 0) {
    notFound();
  }

  const student = await getStudentById(studentId);
  if (!student) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin/students"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              >
                ← Back to Students
              </Link>
              <span className="text-zinc-300">/</span>
              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {student.usn}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {student.full_name}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Department of {student.department} {student.specialization ? `• ${student.specialization}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                student.academic_status === "Active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              Academic Status: {student.academic_status}
            </span>
            <LogoutButton />
          </div>
        </header>

        {/* Navigation */}
        <AdminNav role={session.role} />

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Profile & Academic Information */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                Academic Profile
              </h2>

              <dl className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">USN</dt>
                  <dd className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{student.usn}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Department</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{student.department}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Batch</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{student.batch}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Current Semester</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">Semester {student.current_semester || "—"}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Section</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{student.section || "—"}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">CGPA</dt>
                  <dd className="font-bold text-zinc-900 dark:text-zinc-100">{student.cgpa ? Number(student.cgpa).toFixed(2) : "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                Contact & Account Details
              </h2>

              <dl className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Official Email</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{student.email}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Phone</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">{student.phone_number || "Not provided"}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-zinc-500">Enrolled On</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">
                    {student.created_at ? new Date(student.created_at).toLocaleDateString() : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Right Column: Group Membership & Project Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Group Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Current Capstone Project Group
                </h2>
                {student.active_group && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {student.active_group.group_status}
                  </span>
                )}
              </div>

              {student.active_group ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                          {student.active_group.group_name}
                        </h3>
                        {student.group_role === "Leader" ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            ★ Team Leader
                          </span>
                        ) : (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Team Member
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Academic Year: {student.active_group.academic_year} | Batch: {student.active_group.batch}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/admin/groups/${student.active_group.group_id}`}
                      className="mt-3 sm:mt-0 inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      Manage Group →
                    </Link>
                  </div>

                  {/* Group Members Roster */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                      Group Roster ({student.active_group.members.length} / 4 Members)
                    </h4>
                    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-[11px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">USN</th>
                            <th className="px-3 py-2">Member Name</th>
                            <th className="px-3 py-2">Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {student.active_group.members.map((m) => (
                            <tr
                              key={m.student_id}
                              className={m.student_id === student.student_id ? "bg-blue-50/50 dark:bg-blue-950/20 font-semibold" : ""}
                            >
                              <td className="px-3 py-2">
                                {m.member_role === "Leader" ? (
                                  <span className="text-amber-700 dark:text-amber-400 font-bold">Leader</span>
                                ) : (
                                  <span className="text-zinc-500">Member</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono">{m.usn}</td>
                              <td className="px-3 py-2">{m.full_name}</td>
                              <td className="px-3 py-2 text-zinc-500">{m.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Linked Project Card */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Linked Capstone Project
                    </span>
                    {student.active_group.project_title ? (
                      <div className="mt-1">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {student.active_group.project_title}
                        </h4>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="text-zinc-500">Status:</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {student.active_group.project_status}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-400 italic">
                        No Capstone Project has been officially proposed or linked yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-xs dark:border-zinc-700">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mb-2">
                    !
                  </div>
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Not Assigned to Any Active Capstone Group
                  </h3>
                  <p className="mt-1 text-zinc-500 text-[11px] max-w-sm mx-auto">
                    This student is currently eligible to be allocated to a new or forming capstone project group.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/dashboard/admin/groups/new"
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      + Create Group with {student.full_name}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Past Group Affiliations (Audit trail) */}
            {student.past_groups.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  Past Group Memberships & History
                </h2>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {student.past_groups.map((pg, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {pg.group_name}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Role: {pg.member_role} | Status: {pg.membership_status}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-zinc-400">
                        Left: {pg.left_at ? new Date(pg.left_at).toLocaleDateString() : "Disbanded"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

