"use client";

import Link from "next/link";
import { secondaryButtonClass } from "@/components/ui";
import { useApiAction } from "./useApiAction";

export interface NotificationItem {
  notification_id: number;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  when: string;
}

export function NotificationsPanel({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const { run, loading } = useApiAction();

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Notifications
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
          )}
        </h2>
        {unread > 0 && (
          <button className={secondaryButtonClass} disabled={loading} onClick={() => run("/api/notifications", "POST")}>
            Mark all read
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">Nothing yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {items.map((n) => (
            <li
              key={n.notification_id}
              className={`rounded-lg border p-2.5 text-xs ${
                n.is_read
                  ? "border-zinc-100 text-zinc-500 dark:border-zinc-800"
                  : "border-blue-200 bg-blue-50/60 text-zinc-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{n.title}</span>
                <span className="shrink-0 text-[10px] text-zinc-400">{n.when}</span>
              </div>
              <p className="mt-0.5">{n.message}</p>
              {n.link && (
                <Link href={n.link} className="mt-1 inline-block text-[11px] font-semibold underline underline-offset-2">
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
