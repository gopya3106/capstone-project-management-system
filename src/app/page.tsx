import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRoleDashboardPath } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

const WORKFLOW = [
  "Group formation",
  "Proposal submission",
  "Coordinator review",
  "Guide allocation",
  "Milestones",
  "Document submission",
  "Faculty review",
  "Evaluation",
  "Final marks",
];

const ROLES = [
  {
    name: "Coordinator",
    text: "Reviews proposals, assigns guides, sets milestones and follows progress through reports.",
  },
  {
    name: "Faculty Guide",
    text: "Reviews submissions from assigned projects, gives feedback and enters evaluation marks.",
  },
  {
    name: "Student",
    text: "Submits the group proposal and milestone documents, and tracks feedback and marks.",
  },
  {
    name: "Admin",
    text: "Manages student, faculty, group and project records.",
  },
];

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(getRoleDashboardPath(session.role));
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <section className="space-y-4">
          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            CPMS
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
            Capstone Project Management System
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            One place for capstone groups, proposals, guide allocation, milestones, submissions and
            evaluations, built on a normalised MySQL database.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Workflow</h2>
          <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {WORKFLOW.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {step}
                </span>
                {i < WORKFLOW.length - 1 && <span className="text-zinc-400">→</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((role) => (
            <div
              key={role.name}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{role.name}</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{role.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
