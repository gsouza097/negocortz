"use server";

import { after } from "next/server";
import { tryAppointmentConfirmation } from "@/lib/whatsapp/notifications";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, barbers, services } from "@/db/schema";
import { requireMember } from "@/lib/tenant";
import { agendaRules, loadAgenda } from "@/lib/agenda";
import { bookableStarts } from "@/lib/slots";
import { whatsAppSchema } from "@/lib/phone";
import { fmtDateLong, isISODate, localDateISO, localMinutes, zonedToMs } from "@/lib/time";
import { firstError, formObject, pgErrorCode, type FormState } from "@/lib/forms";
import { createWeeklyBooking, endWeeklyBooking } from "@/lib/weekly-bookings";

/** Dono gerencia qualquer barbeiro da barbearia; barbeiro só a própria agenda. */
async function assertCanManage(slug: string, barberId: string) {
  const ctx = await requireMember(slug);
  if (ctx.role !== "owner" && ctx.barber?.id !== barberId) throw new Error("Sem permissão.");
  const [b] = await db
    .select({ id: barbers.id })
    .from(barbers)
    .where(and(eq(barbers.id, barberId), eq(barbers.orgId, ctx.org.id)));
  if (!b) throw new Error("Barbeiro não encontrado.");
  return ctx;
}

export async function cancelAppointment(fd: FormData) {
  const slug = String(fd.get("slug"));
  const id = String(fd.get("id"));
  const ctx = await requireMember(slug);
  const [appt] = await db
    .select({ barberId: appointments.barberId })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.orgId, ctx.org.id)));
  if (!appt) return;
  await assertCanManage(slug, appt.barberId);
  await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.orgId, ctx.org.id)));
  refreshAgenda(slug);
}

function refreshAgenda(slug: string) {
  revalidatePath(`/painel/${slug}`);
  revalidatePath("/");
  revalidatePath("/[slug]/[barber]", "page");
}

const time = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido.");
const blockSchema = z.object({
  slug: z.string(),
  barberId: z.uuid("Escolha o barbeiro."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  start: time,
  end: time,
  note: z.string().trim().max(120).optional(),
});

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export async function addBlock(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = blockSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { slug, barberId, date, start, end, note } = parsed.data;
  if (toMin(end) <= toMin(start)) return { error: "O fim precisa ser depois do início." };
  const ctx = await assertCanManage(slug, barberId);
  const tz = ctx.org.timezone;
  try {
    await db.insert(appointments).values({
      orgId: ctx.org.id,
      barberId,
      kind: "block",
      note: note || "Bloqueado",
      startsAt: new Date(zonedToMs(date, toMin(start), tz)),
      endsAt: new Date(zonedToMs(date, toMin(end), tz)),
    });
  } catch (e) {
    if (pgErrorCode(e) === "23P01") return { error: "Já existe reserva nesse intervalo. Cancele-a antes de bloquear." };
    throw e;
  }
  refreshAgenda(slug);
  return { ok: "Horário bloqueado." };
}

const manualBookingSchema = z.object({
  slug: z.string(),
  barberId: z.uuid("Escolha o barbeiro."),
  serviceId: z.uuid("Escolha o serviço."),
  date: z.string().refine(isISODate, "Data inválida."),
  start: z.coerce.number().int().positive("Escolha um horário disponível."),
  guestName: z.string().trim().min(2, "Informe o nome do cliente.").max(80),
  guestPhone: whatsAppSchema,
  whatsappOptIn: z.literal("on").optional(),
  weekly: z.literal("on").optional(),
});

export async function addManualBooking(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = manualBookingSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { slug, barberId, serviceId, date, start, guestName, guestPhone, whatsappOptIn, weekly } = parsed.data;
  const { org } = await requireMember(slug, ["owner"]);

  const [[barber], [service]] = await Promise.all([
    db.select({ id: barbers.id }).from(barbers)
      .where(and(eq(barbers.orgId, org.id), eq(barbers.id, barberId), eq(barbers.active, true))),
    db.select().from(services)
      .where(and(eq(services.orgId, org.id), eq(services.id, serviceId), eq(services.active, true))),
  ]);
  if (!barber || !service) return { error: "Barbeiro ou serviço indisponível." };

  const rules = agendaRules(org);
  if (start < rules.earliest || start > rules.latest || localDateISO(start, org.timezone) !== date) {
    refreshAgenda(slug);
    return { error: "Escolha um horário disponível no dia selecionado." };
  }
  const [day] = await loadAgenda(org, barberId, date, 1);
  if (!bookableStarts(day, service.durationMin, rules).includes(start)) {
    refreshAgenda(slug);
    return { error: "Esse horário não está mais disponível. Escolha outro." };
  }

  try {
    if (weekly) {
      const result = await createWeeklyBooking(org, {
        barberId, serviceId, serviceName: service.name, durationMin: service.durationMin,
        guestName, guestPhone, firstDate: date, startMinute: localMinutes(start, org.timezone),
      });
      if (result.conflicts.length) {
        const dates = result.conflicts.map((day) => fmtDateLong(zonedToMs(day, 720, org.timezone), org.timezone));
        return { error: `O horário fixo tem conflitos em ${dates.slice(0, 3).join("; ")}${dates.length > 3 ? " e outras datas" : ""}. Escolha outro horário.` };
      }
      if (!result.count) return { error: "Escolha uma data futura para iniciar o horário fixo." };
      refreshAgenda(slug);
      return { ok: `Horário fixo criado. ${result.count} reservas semanais garantidas na agenda.` };
    }
    const [appointment] = await db.insert(appointments).values({
      orgId: org.id,
      barberId,
      serviceId,
      serviceName: service.name,
      priceCents: service.priceCents,
      guestName,
      guestPhone,
      whatsappPhone: whatsappOptIn ? guestPhone : null,
      startsAt: new Date(start),
      endsAt: new Date(start + service.durationMin * 60_000),
    }).returning({ id: appointments.id });
    if (whatsappOptIn) after(() => tryAppointmentConfirmation(appointment.id));
  } catch (error) {
    if (pgErrorCode(error) === "23P01") {
      refreshAgenda(slug);
      return { error: "Esse horário acabou de ser ocupado. Escolha outro." };
    }
    if (pgErrorCode(error) === "23503") {
      refreshAgenda(slug);
      return { error: "Barbeiro ou serviço indisponível." };
    }
    throw error;
  }

  refreshAgenda(slug);
  return { ok: "Agendamento registrado." };
}

export async function cancelWeeklyBooking(fd: FormData) {
  const slug = String(fd.get("slug"));
  const { org } = await requireMember(slug, ["owner"]);
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  await endWeeklyBooking(org.id, id.data);
  refreshAgenda(slug);
}
