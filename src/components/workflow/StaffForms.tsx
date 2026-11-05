"use client";

import { useState, FormEvent } from "react";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useApiAction } from "./useApiAction";
import { Feedback } from "./Feedback";

export function ProposalReviewForm({ proposalId, status }: { proposalId: number; status: string }) {
  const { run, loading, error, message } = useApiAction();
  const [comments, setComments] = useState("");

  const decide = (decision: "Under Review" | "Approved" | "Rejected") =>
    run(`/api/admin/proposals/${proposalId}`, "PATCH", { decision, comments: comments.trim() || null });

  return (
    <div className="space-y-2">
      <textarea
        className={inputClass}
        rows={2}
        placeholder="Review comments (required to reject)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />
      <Feedback error={error} message={message} />
      <div className="flex flex-wrap gap-2">
        <button className={primaryButtonClass} disabled={loading} onClick={() => decide("Approved")}>
          Approve
        </button>
        <button
          className={`${secondaryButtonClass} !text-rose-700 dark:!text-rose-400`}
          disabled={loading}
          onClick={() => decide("Rejected")}
        >
          Reject
        </button>
        {status === "Submitted" && (
          <button className={secondaryButtonClass} disabled={loading} onClick={() => decide("Under Review")}>
            Mark under review
          </button>
        )}
      </div>
    </div>
  );
}

export interface MilestoneRow {
  milestone_id: number;
  academic_year: string;
  milestone_order: number;
  title: string;
  description: string | null;
  due_date: string; // "YYYY-MM-DDTHH:mm"
  due_label: string;
  max_marks: number;
  weightage: number;
  submission_count: number;
  is_past_due: boolean;
}

const emptyMilestone = (year: string, order: number) => ({
  academic_year: year,
  milestone_order: String(order),
  title: "",
  description: "",
  due_date: "",
  max_marks: "",
  weightage: "",
});

export function MilestoneEditor({
  initial,
  defaultYear,
  nextOrder,
  onDone,
}: {
  initial?: MilestoneRow;
  defaultYear: string;
  nextOrder: number;
  onDone?: () => void;
}) {
  const { run, loading, error, message } = useApiAction();
  const [form, setForm] = useState(
    initial
      ? {
          academic_year: initial.academic_year,
          milestone_order: String(initial.milestone_order),
          title: initial.title,
          description: initial.description || "",
          due_date: initial.due_date,
          max_marks: String(initial.max_marks),
          weightage: String(initial.weightage),
        }
      : emptyMilestone(defaultYear, nextOrder)
  );
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = initial
      ? await run(`/api/admin/milestones/${initial.milestone_id}`, "PATCH", form)
      : await run("/api/admin/milestones", "POST", form);
    if (ok) {
      if (!initial) setForm(emptyMilestone(form.academic_year, Number(form.milestone_order) + 1));
      onDone?.();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className={labelClass}>Academic year</label>
          <input className={inputClass} value={form.academic_year} onChange={set("academic_year")} placeholder="2026-2027" required />
        </div>
        <div>
          <label className={labelClass}>Order</label>
          <input className={inputClass} type="number" min={1} max={20} value={form.milestone_order} onChange={set("milestone_order")} required />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={form.title} onChange={set("title")} required minLength={3} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Due</label>
          <input className={inputClass} type="datetime-local" value={form.due_date} onChange={set("due_date")} required />
        </div>
        <div>
          <label className={labelClass}>Max marks</label>
          <input className={inputClass} type="number" min={1} max={500} step="0.5" value={form.max_marks} onChange={set("max_marks")} required />
        </div>
        <div>
          <label className={labelClass}>Weight %</label>
          <input className={inputClass} type="number" min={0.5} max={100} step="0.5" value={form.weightage} onChange={set("weightage")} required />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Description</label>
          <input className={inputClass} value={form.description} onChange={set("description")} />
        </div>
      </div>
      <Feedback error={error} message={message} />
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass} disabled={loading}>
          {loading ? "Saving..." : initial ? "Save changes" : "Add milestone"}
        </button>
        {onDone && initial && (
          <button type="button" className={secondaryButtonClass} onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function MilestoneRowActions({ row, defaultYear }: { row: MilestoneRow; defaultYear: string }) {
  const [editing, setEditing] = useState(false);
  const { run, loading, error } = useApiAction();

  if (editing) {
    return (
      <div className="min-w-[36rem] rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
        <MilestoneEditor initial={row} defaultYear={defaultYear} nextOrder={row.milestone_order} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button className={secondaryButtonClass} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className={`${secondaryButtonClass} !text-rose-700 dark:!text-rose-400`}
          disabled={loading || row.submission_count > 0}
          title={row.submission_count > 0 ? "Has submissions; cannot delete" : "Delete milestone"}
          onClick={() => {
            if (window.confirm(`Delete milestone "${row.title}"?`)) {
              run(`/api/admin/milestones/${row.milestone_id}`, "DELETE");
            }
          }}
        >
          Delete
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

export function RecalculateButton({ projectId }: { projectId: number }) {
  const { run, loading, error, message } = useApiAction();
  return (
    <div className="space-y-1">
      <button className={secondaryButtonClass} disabled={loading} onClick={() => run(`/api/admin/projects/${projectId}/final-marks`, "POST")}>
        {loading ? "Calculating..." : "Recalculate"}
      </button>
      {(error || message) && <p className={`text-[11px] ${error ? "text-rose-600" : "text-emerald-600"}`}>{error || message}</p>}
    </div>
  );
}
