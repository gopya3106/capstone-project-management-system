"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ProjectListItem, ProjectStatus } from "@/lib/projects/types";

interface Props {
  initialProjects: ProjectListItem[];
  total: number;
}

export function ProjectListingTable({ initialProjects, total }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");

  // Derive unique filter options
  const departments = useMemo(() => {
    return Array.from(new Set(initialProjects.map((p) => p.department).filter(Boolean))).sort();
  }, [initialProjects]);

  const domains = useMemo(() => {
    return Array.from(
      new Set(initialProjects.map((p) => p.project_domain).filter(Boolean) as string[])
    ).sort();
  }, [initialProjects]);

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((project) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesTitle = project.project_title.toLowerCase().includes(q);
        const matchesGroup = project.group_name.toLowerCase().includes(q);
        const matchesLeader = project.team_leader_name.toLowerCase().includes(q);
        const matchesUsn = project.team_leader_usn.toLowerCase().includes(q);
        const matchesMentor = (project.primary_mentor_name || "").toLowerCase().includes(q);
        const matchesDomain = (project.project_domain || "").toLowerCase().includes(q);

        if (
          !matchesTitle &&
          !matchesGroup &&
          !matchesLeader &&
          !matchesUsn &&
          !matchesMentor &&
          !matchesDomain
        ) {
          return false;
        }
      }

      if (statusFilter !== "ALL" && project.project_status !== statusFilter) {
        return false;
      }

      if (departmentFilter !== "ALL" && project.department !== departmentFilter) {
        return false;
      }

      if (domainFilter !== "ALL" && project.project_domain !== domainFilter) {
        return false;
      }

      return true;
    });
  }, [initialProjects, search, statusFilter, departmentFilter, domainFilter]);

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
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by title, group, leader, mentor, or domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="Proposed">Proposed</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="In Progress">In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Domain Filter */}
          {domains.length > 0 && (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <option value="ALL">All Domains</option>
              {domains.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Projects Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Project Title & Domain</th>
                <th className="px-4 py-3">Capstone Group</th>
                <th className="px-4 py-3">Team Leader</th>
                <th className="px-4 py-3">Primary Mentor</th>
                <th className="px-4 py-3">Current Phase</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No capstone projects match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr
                    key={project.project_id}
                    className="hover:bg-zinc-50/80 transition-colors dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {project.project_title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {project.project_domain ? (
                          <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {project.project_domain}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">Domain unassigned</span>
                        )}
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: #{project.project_id}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/admin/groups/${project.group_id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {project.group_name}
                      </Link>
                      <div className="text-[11px] text-zinc-500">
                        {project.department} • {project.batch}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {project.team_leader_name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {project.team_leader_usn}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {project.primary_mentor_name ? (
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {project.primary_mentor_name}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {project.primary_mentor_email}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Needs Mentor
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {project.current_phase_name ? (
                        <div className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {project.current_phase_name}
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Phase 1 (Default)</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(
                          project.project_status
                        )}`}
                      >
                        {project.project_status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/admin/projects/${project.project_id}`}
                        className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        View Project →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="border-t border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Showing {filteredProjects.length} of {total} registered capstone projects
        </div>
      </div>
    </div>
  );
}

