"use client";

import { useState, FormEvent } from "react";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useApiAction } from "./useApiAction";
import { Feedback } from "./Feedback";

export function ProposalForm({ defaultTitle = "" }: { defaultTitle?: string }) {
  const { run, loading, error, message } = useApiAction();
  const [form, setForm] = useState({
    title: defaultTitle,
    abstract: "",
    objectives: "",
    methodology: "",
    technology_stack: "",
    project_domain: "",
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run("/api/student/proposals", "POST", form);
    if (ok) setForm({ title: "", abstract: "", objectives: "", methodology: "", technology_stack: "", project_domain: "" });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelClass}>Project title *</label>
        <input className={inputClass} value={form.title} onChange={set("title")} required minLength={5} maxLength={200} />
      </div>
      <div>
        <label className={labelClass}>Abstract / problem statement *</label>
        <textarea className={inputClass} rows={4} value={form.abstract} onChange={set("abstract")} required minLength={30} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Objectives</label>
          <textarea className={inputClass} rows={3} value={form.objectives} onChange={set("objectives")} />
        </div>
        <div>
          <label className={labelClass}>Methodology</label>
          <textarea className={inputClass} rows={3} value={form.methodology} onChange={set("methodology")} />
        </div>
        <div>
          <label className={labelClass}>Technology stack</label>
          <input className={inputClass} value={form.technology_stack} onChange={set("technology_stack")} placeholder="e.g. Python, MySQL, React" />
        </div>
        <div>
          <label className={labelClass}>Domain</label>
          <input className={inputClass} value={form.project_domain} onChange={set("project_domain")} placeholder="e.g. AI & ML" />
        </div>
      </div>
      <Feedback error={error} message={message} />
      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Submitting..." : "Submit proposal"}
      </button>
    </form>
  );
}

export function SubmissionForm({
  milestoneId,
  milestoneTitle,
  isResubmission,
  isPastDue,
}: {
  milestoneId: number;
  milestoneTitle: string;
  isResubmission: boolean;
  isPastDue: boolean;
}) {
  const { run, loading, error, message } = useApiAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ document_title: "", document_url: "", notes: "" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run("/api/student/submissions", "POST", { milestone_id: milestoneId, ...form });
    if (ok) {
      setForm({ document_title: "", document_url: "", notes: "" });
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {message && <Feedback error={null} message={message} />}
        <button type="button" onClick={() => setOpen(true)} className={isResubmission ? secondaryButtonClass : primaryButtonClass}>
          {isResubmission ? "Submit new version" : "Submit"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
        {milestoneTitle}
        {isPastDue && <span className="ml-1 text-rose-600 dark:text-rose-400">(past due: this will be marked late)</span>}
      </p>
      <input
        className={inputClass}
        placeholder="Document title"
        value={form.document_title}
        onChange={(e) => setForm((f) => ({ ...f, document_title: e.target.value }))}
        required
        minLength={3}
      />
      <input
        className={inputClass}
        type="url"
        placeholder="https://drive.google.com/... (shared link to the document)"
        value={form.document_url}
        onChange={(e) => setForm((f) => ({ ...f, document_url: e.target.value }))}
        required
      />
      <textarea
        className={inputClass}
        rows={2}
        placeholder="Notes for your guide (optional)"
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
      />
      <Feedback error={error} message={null} />
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Submitting..." : "Submit document"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
