import { equalSecret } from "@/lib/whatsapp/meta";
import { sendDueAppointmentMessages } from "@/lib/whatsapp/notifications";
import { extendWeeklyBookings } from "@/lib/weekly-bookings";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 204 });
  if (!equalSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response(null, { status: 401 });
  }
  const weekly = await extendWeeklyBookings();
  return Response.json({ ...await sendDueAppointmentMessages(), weekly });
}
