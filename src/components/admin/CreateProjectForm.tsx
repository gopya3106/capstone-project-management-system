"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AvailableGroupForProject, PROJECT_STATUSES } from "@/lib/projects/types";

interface Props {
  availableGroups: AvailableGroupForProject[];
}

export function CreateProjectForm({ availableGroups }: Props) {
  const router = useRouter();

  const [groupId, setGroupId] = useState<number | "">(
    availableGroups.length > 0 ? availableGroups[0].group_id : ""
  );
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDomain, setProjectDomain] = useState("");
  const [projectType, setProjectType] = useState("Development");
  const [problemStatement, setProblemStatement] = useState("");
  const [objectives, setObjectives] = useState("");
  const [scope, setScope] = useState("");
  const [proposedMethodology, setProposedMethodology] = useState("");
  const [technologyStack, setTechnologyStack] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [projectStatus, setProjectStatus] = useState<string>("Proposed");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!groupId) {
      setError("Please select a Capstone Group for this project.");
      return;
    }

    if (!projectTitle.trim() || projectTitle.trim().length < 5) {
      setError("Project title must be at least 5 characters long.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: Number(groupId),
          project_title: projectTitle.trim(),
          project_domain: projectDomain.trim() || null,
          project_type: projectType.trim() || null,
          problem_statement: problemStatement.trim() || null,
          objectives: objectives.trim() || null,
          scope: scope.trim() || null,
          proposed_methodology: proposedMethodology.trim() || null,
          technology_stack: technologyStack.trim() || null,
          start_date: startDate || null,
          expected_end_date: expectedEndDate || null,
          repository_url: repositoryUrl.trim() || null,
          project_status: projectStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create capstone project.");
      }

      router.push(`/dashboard/admin/projects/${data.project.project_id}`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setLoading(false);
    }
  };

  if (availableGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xl font-bold">
          !
        </div>
        <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
          No Available Groups Without Projects
        </h3>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Every active capstone group in the database already has an assigned project. Because the
          system enforces that each group can only be linked to one capstone project, you must first
          create a new capstone group before registering a new project.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard/admin/groups/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Create New Group First
          </Link>
          <Link
            href="/dashboard/admin/projects"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Group Assignment Section */}
      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          Assign to Capstone Group <span className="text-rose-500">*</span>
        </label>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Select an active group without an existing project. Enforces 1-to-1 group-to-project
          integrity.
        </p>
        <select
          value={groupId}
          onChange={(e) => setGroupId(Number(e.target.value))}
          required
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
        >
          {availableGroups.map((g) => (
            <option key={g.group_id} value={g.group_id}>
              {g.group_name} ({g.department} • Batch {g.batch}) — Leader: {g.team_leader_name} (
              {g.team_size} members)
            </option>
          ))}
        </select>
      </div>

      {/* Basic Project Info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Project Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Autonomous Edge AI Pipeline for Capstone Project Tracking"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Domain
          </label>
          <input
            type="text"
            placeholder="e.g., Artificial Intelligence, Cloud Systems, IoT"
            value={projectDomain}
            onChange={(e) => setProjectDomain(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Project Type
          </label>
          <input
            type="text"
            placeholder="e.g., Development, Applied Research, Industry Sponsored"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>
      </div>

      {/* Specifications */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Problem Statement
          </label>
          <textarea
            rows={3}
            placeholder="Describe the core problem or challenge addressed by this capstone project..."
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Project Objectives
            </label>
            <textarea
              rows={3}
              placeholder="Key technical and functional goals..."
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Scope of Work
            </label>
            <textarea
              rows={3}
              placeholder="Boundaries, inclusions, and exclusions..."
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Proposed Methodology
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Agile Scrum, Waterfall, CRISP-DM..."
              value={proposedMethodology}
              onChange={(e) => setProposedMethodology(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Technology Stack
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Next.js, TypeScript, MySQL, MongoDB Atlas, Tailwind CSS..."
              value={technologyStack}
              onChange={(e) => setTechnologyStack(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* Dates, Status and Repository */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Initial Status
          </label>
          <select
            value={projectStatus}
            onChange={(e) => setProjectStatus(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Expected End Date
          </label>
          <input
            type="date"
            value={expectedEndDate}
            onChange={(e) => setExpectedEndDate(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Repository URL
          </label>
          <input
            type="url"
            placeholder="https://github.com/organization/repo"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <Link
          href="/dashboard/admin/projects"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Registering Project..." : "Register Project"}
        </button>
      </div>
    </form>
  );
}

