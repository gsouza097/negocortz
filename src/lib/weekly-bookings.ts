import "server-only";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db, type DB } from "@/db";
import { appointments, barbers, organizations, weeklyBookings, type Organization } from "@/db/schema";
import { loadAgenda } from "./agenda";
import { pgErrorCode } from "./forms";
import { overlaps } from "./slots";
import { addDaysISO, diffDaysISO, localDateISO, zonedToMs } from "./time";

type Series = typeof weeklyBookings.$inferSelect;
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];
const BUFFER_DAYS = 28;

function appointmentFor(series: Series, start: number) {
  return {
    orgId: series.orgId,
    barberId: series.barberId,
    serviceId: series.serviceId,
    serviceName: series.serviceName,
    guestName: series.guestName,
    guestPhone: series.guestPhone,
    weeklyBookingId: series.id,
    startsAt: new Date(start),
    endsAt: new Date(start + series.durationMin * 60_000),
  };
}

function datesThrough(firstDate: string, today: string, last: string) {
  const dates: string[] = [];
  const skippedWeeks = Math.max(0, Math.ceil(diffDaysISO(today, firstDate) / 7));
  for (let date = addDaysISO(firstDate, skippedWeeks * 7); date <= last; date = addDaysISO(date, 7)) dates.push(date);
  return dates;
}

async function findOccurrences(tx: Transaction, org: Organization, series: Series, now: number, initial: boolean) {
  const today = localDateISO(now, series.timezone);
  const last = addDaysISO(today, org.bookingWindowDays + BUFFER_DAYS);
  const dates = datesThrough(series.firstDate, today, last);
  if (!dates.length) return [];

  const from = dates[0];
  const [days, existing] = await Promise.all([
    loadAgenda({ ...org, timezone: series.timezone }, series.barberId, from, diffDaysISO(dates.at(-1)!, from) + 1, tx),
    initial ? [] : tx.select({ start: appointments.startsAt }).from(appointments).where(and(
      eq(appointments.weeklyBookingId, series.id),
      gte(appointments.startsAt, new Date(zonedToMs(from, 0, series.timezone))),
      lte(appointments.startsAt, new Date(zonedToMs(last, 1439, series.timezone))),
    )),
  ]);
  // Uma ocorrência cancelada fica registrada para que a renovação não a recrie.
  const recorded = new Set(existing.map((row) => row.start.getTime()));
  return dates.flatMap((date) => {
    const start = zonedToMs(date, series.startMinute, series.timezone);
    if (start <= now || recorded.has(start)) return [];
    const interval = { start, end: start + series.durationMin * 60_000 };
    const day = days[diffDaysISO(date, from)];
    const available = day.open.some((part) => interval.start >= part.start && interval.end <= part.end)
      && !day.busy.some((part) => overlaps(part, interval));
    return [{ date, start, available }];
  });
}

export async function createWeeklyBooking(org: Organization, details: Omit<typeof weeklyBookings.$inferInsert, "orgId" | "timezone">) {
  return db.transaction(async (tx) => {
    const [series] = await tx.insert(weeklyBookings).values({ ...details, orgId: org.id, timezone: org.timezone }).returning();
    const occurrences = await findOccurrences(tx, org, series, Date.now(), true);
    const conflicts = occurrences.filter((item) => !item.available).map((item) => item.date);
    if (!occurrences.length || conflicts.length) {
      await tx.delete(weeklyBookings).where(eq(weeklyBookings.id, series.id));
      return { conflicts, count: 0 };
    }
    await tx.insert(appointments).values(occurrences.map(({ start }) => appointmentFor(series, start)));
    return { conflicts: [], count: occurrences.length };
  });
}

export async function extendWeeklyBookings() {
  const active = await db.select({ id: weeklyBookings.id }).from(weeklyBookings).where(isNull(weeklyBookings.endedAt));
  let created = 0;
  let conflicts = 0;
  for (const { id } of active) {
    const result = await db.transaction(async (tx) => {
      const [series] = await tx.select().from(weeklyBookings).where(eq(weeklyBookings.id, id)).for("update");
      if (!series || series.endedAt) return null;
      const [[org], [barber]] = await Promise.all([
        tx.select().from(organizations).where(eq(organizations.id, series.orgId)),
        tx.select({ active: barbers.active }).from(barbers).where(eq(barbers.id, series.barberId)),
      ]);
      if (!org || !barber?.active) return null;
      let count = 0;
      let conflictDate: string | null = null;
      for (const occurrence of await findOccurrences(tx, org, series, Date.now(), false)) {
        if (!occurrence.available) {
          conflictDate ??= occurrence.date;
          continue;
        }
        try {
          await tx.transaction((savepoint) => savepoint.insert(appointments).values(appointmentFor(series, occurrence.start)));
          count += 1;
        } catch (error) {
          if (pgErrorCode(error) !== "23P01") throw error;
          conflictDate ??= occurrence.date;
        }
      }
      if (conflictDate !== series.conflictDate) await tx.update(weeklyBookings).set({ conflictDate }).where(eq(weeklyBookings.id, id));
      return { count, conflictDate };
    });
    created += result?.count ?? 0;
    if (result?.conflictDate) conflicts += 1;
  }
  return { created, conflicts };
}

export async function endWeeklyBooking(orgId: string, id: string) {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [ended] = await tx.update(weeklyBookings).set({ endedAt: now })
      .where(and(eq(weeklyBookings.id, id), eq(weeklyBookings.orgId, orgId), isNull(weeklyBookings.endedAt)))
      .returning({ id: weeklyBookings.id });
    if (!ended) return;
    await tx.update(appointments).set({ status: "cancelled", cancelledAt: now }).where(and(
      eq(appointments.weeklyBookingId, ended.id),
      eq(appointments.status, "confirmed"),
      gte(appointments.startsAt, now),
    ));
  });
}
