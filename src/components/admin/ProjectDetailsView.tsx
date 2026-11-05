"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectDetails, ProjectStatus, PROJECT_STATUSES } from "@/lib/projects/types";
import { AssignMentorModal } from "./AssignMentorModal";

interface Props {
  initialProject: ProjectDetails;
}

export function ProjectDetailsView({ initialProject }: Props) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetails>(initialProject);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [endingAllocId, setEndingAllocId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const reloadProject = async () => {
    try {
      const res = await fetch(`/api/admin/projects/${project.project_id}`);
      const data = await res.json();
      if (data.success && data.project) {
        setProject(data.project);
        router.refresh();
      }
    } catch {
      // Fallback to router.refresh
      router.refresh();
    }
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    setUpdatingStatus(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.project_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update project status.");
      }
      setProject((prev) => ({ ...prev, project_status: newStatus }));
      setFeedback({ type: "success", message: `Status updated to "${newStatus}".` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEndAllocation = async (allocationId: number, mentorName: string) => {
    if (!confirm(`Are you sure you want to end the mentor allocation for ${mentorName}?`)) {
      return;
    }
    setEndingAllocId(allocationId);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/mentors/allocations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation_id: allocationId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to end allocation.");
      }
      setFeedback({ type: "success", message: "Mentor allocation ended successfully." });
      await reloadProject();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to end allocation.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setEndingAllocId(null);
    }
  };

  const activeAllocations = project.mentor_allocations.filter((a) => a.allocation_status === "Active");
  const pastAllocations = project.mentor_allocations.filter((a) => a.allocation_status === "Ended");

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "In Progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Completed":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "On Hold":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Cancelled":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "Approved":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      case "Under Review":
        return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800";
      case "Rejected":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "Proposed":
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-500">
                Project #{project.project_id}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="text-xs text-zinc-500 font-medium">
                {project.department} • Batch {project.batch} ({project.academic_year})
              </span>
              {project.current_phase_name && (
                <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {project.current_phase_name}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {project.project_title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-600 dark:text-zinc-400">
              <div>
                Capstone Group:{" "}
                <Link
                  href={`/dashboard/admin/groups/${project.group_id}`}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {project.group_name}
                </Link>
              </div>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <div>
                Leader:{" "}
                <strong className="text-zinc-900 dark:text-zinc-200">
                  {project.team_leader_name}
                </strong>{" "}
                ({project.team_leader_usn})
              </div>
              {project.project_domain && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {project.project_domain}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick status controller */}
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">Status:</span>
              <select
                value={project.project_status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none ${getStatusBadge(
                  project.project_status
                )}`}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + Assign Faculty Mentor
            </button>
          </div>
        </div>

        {/* Links & Repository banner */}
        {project.repository_url && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Repository:</span>
            <a
              href={project.repository_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-blue-600 hover:underline dark:text-blue-400"
            >
              {project.repository_url}
            </a>
          </div>
        )}
      </div>

      {/* Grid: Specifications & Mentor Allocations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Project Specifications & Team */}
        <div className="space-y-6 lg:col-span-2">
          {/* Specifications Card */}
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Project Specifications
            </h2>

            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Problem Statement
              </h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                {project.problem_statement || (
                  <span className="italic text-zinc-400">No problem statement provided yet.</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Objectives</h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {project.objectives || (
                    <span className="italic text-zinc-400">No objectives recorded.</span>
                  )}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Scope of Work</h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {project.scope || (
                    <span className="italic text-zinc-400">No scope specified.</span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Proposed Methodology
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {project.proposed_methodology || (
                    <span className="italic text-zinc-400">Methodology not documented.</span>
                  )}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Technology Stack
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {project.technology_stack || (
                    <span className="italic text-zinc-400">No technology stack listed.</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Student Team Roster Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                  Student Team Roster
                </h2>
                <p className="text-xs text-zinc-400">
                  {project.team_members.length} active students enrolled in {project.group_name}
                </p>
              </div>
              <Link
                href={`/dashboard/admin/groups/${project.group_id}`}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Manage Group →
              </Link>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Student Name</th>
                    <th className="px-4 py-2.5 font-semibold">USN</th>
                    <th className="px-4 py-2.5 font-semibold">Role</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {project.team_members.map((member) => (
                    <tr key={member.student_id}>
                      <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                        <Link
                          href={`/dashboard/admin/students/${member.student_id}`}
                          className="hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {member.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                        {member.usn}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            member.member_role === "Leader"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {member.member_role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{member.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Mentor Allocations */}
        <div className="space-y-6">
          {/* Active Faculty Mentors */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                Assigned Mentors
              </h2>
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                + Assign
              </button>
            </div>

            {activeAllocations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
                <p className="text-xs text-zinc-500">No active mentors currently assigned.</p>
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="mt-3 inline-flex items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Assign Primary Mentor
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAllocations.map((alloc) => (
                  <div
                    key={alloc.allocation_id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              alloc.mentor_role === "Primary"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            }`}
                          >
                            {alloc.mentor_role} Mentor
                          </span>
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Active
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/admin/mentors/${alloc.mentor_id}`}
                          className="mt-1 block text-sm font-bold text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {alloc.mentor_name}
                        </Link>
                        <p className="text-[11px] text-zinc-500">
                          {alloc.designation || "Faculty"} • {alloc.specialization || "General"}
                        </p>
                        <p className="text-[10px] text-zinc-400">{alloc.mentor_email}</p>
                      </div>

                      <button
                        onClick={() => handleEndAllocation(alloc.allocation_id, alloc.mentor_name)}
                        disabled={endingAllocId === alloc.allocation_id}
                        className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      >
                        {endingAllocId === alloc.allocation_id ? "Ending..." : "End"}
                      </button>
                    </div>

                    {alloc.remarks && (
                      <div className="mt-2 text-[11px] italic text-zinc-500 border-t border-zinc-200/50 pt-1.5 dark:border-zinc-700/50">
                        &ldquo;{alloc.remarks}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Allocation History Log */}
          {pastAllocations.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                Allocation History
              </h2>

              <div className="space-y-2">
                {pastAllocations.map((alloc) => (
                  <div
                    key={alloc.allocation_id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/30 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {alloc.mentor_name} ({alloc.mentor_role})
                      </span>
                      <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Ended
                      </span>
                    </div>
                    {alloc.end_date && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Ended on: {new Date(alloc.end_date).toLocaleDateString()}
                      </p>
                    )}
                    {alloc.remarks && (
                      <p className="text-[10px] italic text-zinc-500 mt-1">{alloc.remarks}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Mentor Modal */}
      <AssignMentorModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        projectId={project.project_id}
        projectTitle={project.project_title}
        currentPrimaryMentorName={project.primary_mentor_name}
        onAssigned={reloadProject}
      />
    </div>
  );
}
