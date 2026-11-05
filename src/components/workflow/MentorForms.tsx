"use client";

import { useEffect, useState, FormEvent } from "react";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useApiAction } from "./useApiAction";
import { Feedback } from "./Feedback";

export function SubmissionReviewForm({
  submissionId,
  currentStatus,
  currentFeedback,
}: {
  submissionId: number;
  currentStatus: string;
  currentFeedback: string | null;
}) {
  const { run, loading, error, message } = useApiAction();
  const [feedback, setFeedback] = useState(currentFeedback || "");

  const send = (submission_status: "Under Review" | "Accepted" | "Revision Requested") =>
    run(`/api/mentor/submissions/${submissionId}`, "PATCH", {
      submission_status,
      feedback: feedback.trim() || null,
    });

  return (
    <div className="space-y-2">
      <textarea
        className={inputClass}
        rows={2}
        placeholder="Feedback for the group (required when requesting a revision)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <Feedback error={error} message={message} />
      <div className="flex flex-wrap gap-2">
        <button className={primaryButtonClass} disabled={loading} onClick={() => send("Accepted")}>
          Accept
        </button>
        <button className={secondaryButtonClass} disabled={loading} onClick={() => send("Revision Requested")}>
          Request revision
        </button>
        {currentStatus === "Submitted" && (
          <button className={secondaryButtonClass} disabled={loading} onClick={() => send("Under Review")}>
            Mark under review
          </button>
        )}
      </div>
    </div>
  );
}

interface SheetStudent {
  student_id: number;
  usn: string;
  full_name: string;
  member_role: string;
  marks_awarded: number | string | null;
  remarks: string | null;
}

interface Sheet {
  milestone_title: string;
  max_marks: number;
  weightage: number;
  evaluation_id: number | null;
  comments: string | null;
  students: SheetStudent[];
}

export function EvaluationForm({
  projectId,
  milestones,
}: {
  projectId: number;
  milestones: Array<{ milestone_id: number; label: string; evaluated: boolean }>;
}) {
  const [milestoneId, setMilestoneId] = useState<number>(
    milestones.find((m) => !m.evaluated)?.milestone_id || milestones[0]?.milestone_id || 0
  );
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [marks, setMarks] = useState<Record<number, { marks: string; remarks: string }>>({});
  const [comments, setComments] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { run, loading, error, message } = useApiAction();

  useEffect(() => {
    if (!milestoneId) return;
    let ignore = false;
    fetch(`/api/mentor/evaluations?project_id=${projectId}&milestone_id=${milestoneId}`)
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        if (!data.success) {
          setLoadError(data.message || "Could not load the marks sheet.");
          setSheet(null);
          return;
        }
        const s: Sheet = data.sheet;
        setLoadError(null);
        setSheet(s);
        setComments(s.comments || "");
        setMarks(
          Object.fromEntries(
            s.students.map((st) => [
              st.student_id,
              { marks: st.marks_awarded === null ? "" : String(Number(st.marks_awarded)), remarks: st.remarks || "" },
            ])
          )
        );
      })
      .catch(() => !ignore && setLoadError("Could not load the marks sheet."));
    return () => {
      ignore = true;
    };
  }, [projectId, milestoneId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sheet) return;
    const rows = sheet.students
      .filter((s) => marks[s.student_id]?.marks !== "")
      .map((s) => ({
        student_id: s.student_id,
        marks_awarded: Number(marks[s.student_id].marks),
        remarks: marks[s.student_id].remarks || null,
      }));
    await run("/api/mentor/evaluations", "PUT", {
      project_id: projectId,
      milestone_id: milestoneId,
      comments: comments.trim() || null,
      marks: rows,
    });
  }

  if (milestones.length === 0) {
    return <p className="text-xs text-zinc-500">No milestones have been defined for this academic year yet.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="max-w-sm">
        <label className={labelClass}>Milestone</label>
        <select className={inputClass} value={milestoneId} onChange={(e) => setMilestoneId(Number(e.target.value))}>
          {milestones.map((m) => (
            <option key={m.milestone_id} value={m.milestone_id}>
              {m.label}
              {m.evaluated ? " (evaluated)" : ""}
            </option>
          ))}
        </select>
      </div>

      {loadError && <Feedback error={loadError} message={null} />}

      {sheet && (
        <>
          <p className="text-[11px] text-zinc-500">
            Marks out of <strong>{sheet.max_marks}</strong> · counts for <strong>{sheet.weightage}%</strong> of the final mark
            {sheet.evaluation_id ? " · editing your saved evaluation" : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Marks</th>
                  <th className="px-2 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sheet.students.map((s) => (
                  <tr key={s.student_id}>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200">{s.full_name}</div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {s.usn} · {s.member_role}
                      </div>
                    </td>
                    <td className="w-28 px-2 py-2">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        max={sheet.max_marks}
                        step="0.5"
                        value={marks[s.student_id]?.marks ?? ""}
                        onChange={(e) =>
                          setMarks((m) => ({ ...m, [s.student_id]: { ...m[s.student_id], marks: e.target.value } }))
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={inputClass}
                        value={marks[s.student_id]?.remarks ?? ""}
                        onChange={(e) =>
                          setMarks((m) => ({ ...m, [s.student_id]: { ...m[s.student_id], remarks: e.target.value } }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label className={labelClass}>Overall comments</label>
            <textarea className={inputClass} rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>
          <Feedback error={error} message={message} />
          <button type="submit" className={primaryButtonClass} disabled={loading}>
            {loading ? "Saving..." : "Save marks"}
          </button>
        </>
      )}
    </form>
  );
}
