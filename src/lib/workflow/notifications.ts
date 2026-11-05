import { query } from "@/lib/mysql";

export interface NotificationRecord {
  notification_id: number;
  title: string;
  message: string;
  link: string | null;
  is_read: number;
  created_at: string | Date;
}

export async function listNotifications(userId: number, limit = 15): Promise<NotificationRecord[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  return query<NotificationRecord[]>(
    `SELECT notification_id, title, message, link, is_read, created_at
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, notification_id DESC
      LIMIT ${safeLimit}`,
    [userId]
  );
}

export async function countUnread(userId: number): Promise<number> {
  const [row] = await query<Array<{ n: number }>>(
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = FALSE",
    [userId]
  );
  return Number(row?.n || 0);
}

export async function markAllRead(userId: number): Promise<void> {
  await query("UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE", [userId]);
}
