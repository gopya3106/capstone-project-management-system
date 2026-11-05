import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProjectDetailsView } from "@/components/admin/ProjectDetailsView";
import { getProjectById } from "@/lib/projects";
import { ProjectWorkflowPanel } from "@/components/workflow/ProjectWorkflowPanel";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProjectDetailPage({ params }: Props) {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  const project = await getProjectById(projectId);
  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-zinc-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Navigation Breadcrumb Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link
              href="/dashboard/admin/projects"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Projects
            </Link>
            <span>/</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
              #{project.project_id}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/projects"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Back to Projects
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Admin Navigation */}
        <AdminNav role={session.role} />

        {/* Interactive Project Details View */}
        <ProjectDetailsView initialProject={project} />

        {/* Proposal, milestone submission and marks history */}
        <ProjectWorkflowPanel projectId={project.project_id} groupId={project.group_id} />
      </div>
    </div>
  );
}
