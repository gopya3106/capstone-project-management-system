import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { countUnread, listNotifications, markAllRead } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const ALL_ROLES = ["Student", "Mentor", "Coordinator", "Admin"] as const;

/** GET /api/notifications : latest notifications for the signed-in user */
export async function GET() {
  const auth = await authorize([...ALL_ROLES]);
  if (auth.response) return auth.response;
  try {
    const [notifications, unread] = await Promise.all([
      listNotifications(auth.session.userId, 30),
      countUnread(auth.session.userId),
    ]);
    return NextResponse.json({ success: true, notifications, unread });
  } catch (error) {
    return errorResponse(error, "GET /api/notifications");
  }
}

/** POST /api/notifications : mark all as read */
export async function POST() {
  const auth = await authorize([...ALL_ROLES]);
  if (auth.response) return auth.response;
  try {
    await markAllRead(auth.session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "POST /api/notifications");
  }
}
