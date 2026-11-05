import { formatDate } from "@/components/ui";
import type { NotificationRecord } from "@/lib/workflow";
import type { NotificationItem } from "./NotificationsPanel";

/** Server-side helpers that turn DB rows into plain props for client components. */

export function toNotificationItems(rows: NotificationRecord[]): NotificationItem[] {
  return rows.map((n) => ({
    notification_id: n.notification_id,
    title: n.title,
    message: n.message,
    link: n.link,
    is_read: Boolean(n.is_read),
    when: formatDate(n.created_at, true),
  }));
}

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local"> */
export function toDateTimeLocal(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
