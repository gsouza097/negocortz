import Link from "next/link";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, barbers, organizations, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { requestTime } from "@/lib/clock";
import { fmtDateLong, fmtTime, localDateISO } from "@/lib/time";
import { SiteHeader } from "@/components/site-header";
import { RefreshNotifications } from "./refresh-notifications";

export const metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const user = await requireUser("/notificacoes");
  const since = new Date(requestTime() - 30 * 86_400_000);
  const rows = await db.select({
    id: appointments.id,
    startsAt: appointments.startsAt,
    createdAt: appointments.createdAt,
    cancelledAt: appointments.cancelledAt,
    service: appointments.serviceName,
    clientId: appointments.clientId,
    clientName: users.name,
    guestName: appointments.guestName,
    barberName: barbers.displayName,
    slug: organizations.slug,
    timezone: organizations.timezone,
  }).from(appointments)
    .innerJoin(barbers, eq(appointments.barberId, barbers.id))
    .innerJoin(organizations, eq(appointments.orgId, organizations.id))
    .leftJoin(users, eq(appointments.clientId, users.id))
    .where(and(
      eq(appointments.kind, "booking"),
      or(eq(appointments.clientId, user.id), eq(barbers.userId, user.id)),
      or(gte(appointments.createdAt, since), gte(appointments.cancelledAt, since)),
    ))
    .orderBy(desc(sql`coalesce(${appointments.cancelledAt}, ${appointments.createdAt})`))
    .limit(50);

  const events = rows.flatMap((row) => {
    const events = [];
    if (row.createdAt >= since) events.push({ ...row, at: row.createdAt, cancelled: false });
    if (row.cancelledAt && row.cancelledAt >= since) events.push({ ...row, at: row.cancelledAt, cancelled: true });
    return events;
  }).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 50);

  return (
    <>
      <SiteHeader />
      <RefreshNotifications />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-5xl">Notificações</h1>
        {events.length === 0 ? (
          <p className="mt-6 text-ink-2">Nenhuma confirmação ou cancelamento nos últimos 30 dias.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {events.map((event) => {
              const client = event.clientId === user.id;
              const start = event.startsAt.getTime();
              const href = client ? "/minhas-reservas" : `/painel/${event.slug}?dia=${localDateISO(start, event.timezone)}`;
              return (
                <li key={`${event.id}-${event.cancelled}`} className="rounded-2xl border border-line p-4">
                  <p className="font-semibold">{event.cancelled ? "Reserva cancelada" : "Reserva confirmada"}</p>
                  <p className="text-sm text-ink-2">{event.service ?? "Agendamento"} · {client ? event.barberName : event.guestName ?? event.clientName ?? "Cliente"}</p>
                  <p className="text-sm">{fmtDateLong(start, event.timezone)} às {fmtTime(start, event.timezone)}</p>
                  <Link href={href} className="mt-2 inline-block text-sm underline underline-offset-4">{client ? "Minhas reservas" : "Ver agenda"}</Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
