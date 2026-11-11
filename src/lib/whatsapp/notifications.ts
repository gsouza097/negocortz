import "server-only";
import { and, eq, gt, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, barbers, organizations } from "@/db/schema";
import { SHOP_SLUG } from "@/lib/brand";
import { addDaysISO, fmtTime, localDateISO, zonedToMs } from "@/lib/time";
import { metaConfig, sendWhatsApp } from "./meta";

type MessageKind = "confirmation" | "reminder";

function templateName(kind: MessageKind) {
  return kind === "confirmation" ? process.env.WHATSAPP_CONFIRM_TEMPLATE : process.env.WHATSAPP_REMINDER_TEMPLATE;
}

export function appointmentMessagesEnabled() {
  return !!(metaConfig() && templateName("confirmation") && templateName("reminder") && process.env.CRON_SECRET);
}

export async function deliverAppointmentMessage(id: string, kind: MessageKind) {
  const name = templateName(kind);
  if (!name || !metaConfig()) return false;
  return db.transaction(async (tx) => {
    const [appointment] = await tx.select().from(appointments).where(eq(appointments.id, id)).for("update");
    if (!appointment || appointment.kind !== "booking" || appointment.status !== "confirmed" || !appointment.whatsappPhone ||
      appointment.startsAt.getTime() <= Date.now()) return false;
    const alreadySent = kind === "confirmation" ? appointment.whatsappConfirmedAt : appointment.whatsappRemindedAt;
    if (alreadySent) return false;
    const [[org], [barber]] = await Promise.all([
      tx.select().from(organizations).where(eq(organizations.id, appointment.orgId)).limit(1),
      tx.select().from(barbers).where(eq(barbers.id, appointment.barberId)).limit(1),
    ]);
    if (!org || !barber || org.slug !== SHOP_SLUG) return false;

    const start = appointment.startsAt.getTime();
    if (kind === "reminder" && localDateISO(start, org.timezone) !== addDaysISO(localDateISO(Date.now(), org.timezone), 1)) return false;
    const date = localDateISO(start, org.timezone).split("-").reverse().join("/");
    const values = [appointment.serviceName ?? "Atendimento", barber.displayName, date, fmtTime(start, org.timezone)];
    await sendWhatsApp(appointment.whatsappPhone, {
      type: "template",
      template: {
        name, language: { code: "pt_BR" },
        components: [{ type: "body", parameters: values.map((text) => ({ type: "text", text })) }],
      },
    });
    await tx.update(appointments).set(kind === "confirmation"
      ? { whatsappConfirmedAt: new Date() }
      : { whatsappRemindedAt: new Date() }).where(eq(appointments.id, id));
    return true;
  });
}

export async function sendDueAppointmentMessages() {
  if (!metaConfig() || (!templateName("confirmation") && !templateName("reminder"))) return { sent: 0, failed: 0 };
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, SHOP_SLUG)).limit(1);
  if (!org) return { sent: 0, failed: 0 };

  const now = new Date();
  const tomorrow = addDaysISO(localDateISO(now.getTime(), org.timezone), 1);
  const from = new Date(zonedToMs(tomorrow, 0, org.timezone));
  const until = new Date(zonedToMs(addDaysISO(tomorrow, 1), 0, org.timezone));
  const due = await db.select({ id: appointments.id, startsAt: appointments.startsAt, confirmed: appointments.whatsappConfirmedAt, reminded: appointments.whatsappRemindedAt })
    .from(appointments).where(and(
      eq(appointments.orgId, org.id), eq(appointments.kind, "booking"), eq(appointments.status, "confirmed"),
      isNotNull(appointments.whatsappPhone), gt(appointments.startsAt, now),
      or(
        templateName("confirmation") ? isNull(appointments.whatsappConfirmedAt) : undefined,
        templateName("reminder") ? and(isNull(appointments.whatsappRemindedAt), gte(appointments.startsAt, from), lt(appointments.startsAt, until)) : undefined,
      ),
    )).orderBy(appointments.startsAt).limit(40);
  let sent = 0;
  let failed = 0;
  const tasks = due.flatMap((item) => {
    const kinds: MessageKind[] = [];
    if (!item.confirmed && templateName("confirmation")) kinds.push("confirmation");
    if (!item.reminded && item.startsAt >= from && item.startsAt < until && templateName("reminder")) kinds.push("reminder");
    return kinds.map((kind) => ({ id: item.id, kind }));
  });
  for (let index = 0; index < tasks.length; index += 8) {
    const results = await Promise.allSettled(tasks.slice(index, index + 8).map(({ id, kind }) => deliverAppointmentMessage(id, kind)));
    sent += results.filter((result) => result.status === "fulfilled" && result.value).length;
    failed += results.filter((result) => result.status === "rejected").length;
  }
  return { sent, failed };
}

export async function tryAppointmentConfirmation(id: string) {
  try {
    await deliverAppointmentMessage(id, "confirmation");
  } catch (error) {
    console.error("Confirmação pendente no WhatsApp.", error instanceof Error ? error.name : "erro");
  }
}
