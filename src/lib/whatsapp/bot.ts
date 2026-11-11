import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DB } from "@/db";
import { appointments, barbers, organizations, services, whatsappConversations, whatsappMessages } from "@/db/schema";
import { agendaRules, loadAgenda } from "@/lib/agenda";
import { SHOP_SLUG } from "@/lib/brand";
import { pgErrorCode } from "@/lib/forms";
import { bookableStarts } from "@/lib/slots";
import { addDaysISO, fmtDateLong, fmtPrice, fmtTime, isISODate, localDateISO, localMinutes } from "@/lib/time";
import { interpretMessage } from "./interpret";
import { sendWhatsApp } from "./meta";

const draftSchema = z.object({
  serviceId: z.string().optional(),
  barberId: z.string().optional(),
  date: z.string().optional(),
  earliest: z.string().optional(),
  name: z.string().optional(),
});
const choiceSchema = z.object({ barberId: z.string(), serviceId: z.string(), start: z.number() });
const stateSchema = z.object({
  draft: draftSchema.default({}),
  options: z.array(choiceSchema).default([]),
  pending: choiceSchema.optional(),
});
type State = z.infer<typeof stateSchema>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
const empty = (): State => ({ draft: {}, options: [] });
const CONTACT = "https://negocortz.vercel.app";
const IDLE_MS = 30 * 60_000;

function humanContact() {
  const phone = process.env.WHATSAPP_HUMAN_PHONE;
  return phone && /^55\d{11}$/.test(phone)
    ? `Fale com a equipe neste WhatsApp: https://wa.me/${phone}`
    : `Para falar com a equipe, veja os contatos da barbearia em ${CONTACT}.`;
}

async function replyTo(tx: Tx, phone: string, text: string, state: State) {
  const finish = (reply: string, next: State = state) => ({ reply, next });
  const command = text.trim().toLocaleLowerCase("pt-BR").replace(/[.!]+$/, "");
  if (/^(humano|atendente|falar com (um |uma )?(atendente|pessoa))$/.test(command)) return finish(humanContact(), empty());
  if (["parar", "sair", "pare"].includes(command)) {
    await tx.update(appointments).set({ whatsappPhone: null })
      .where(and(eq(appointments.whatsappPhone, phone), eq(appointments.status, "confirmed")));
    return finish("Tudo certo. Você não receberá mais confirmações nem lembretes das reservas atuais.", empty());
  }
  if (["menu", "recomeçar", "não", "nao"].includes(command)) {
    return finish("Sou o assistente da Nego Cortz. Para agendar, diga o serviço e o dia. Se preferir, escreva HUMANO.", empty());
  }
  const [org] = await tx.select().from(organizations).where(eq(organizations.slug, SHOP_SLUG)).limit(1);
  if (!org) return finish(humanContact(), empty());

  const [catalog, team] = await Promise.all([
    tx.select().from(services).where(and(eq(services.orgId, org.id), eq(services.active, true))).orderBy(asc(services.sort), asc(services.name)),
    tx.select().from(barbers).where(and(eq(barbers.orgId, org.id), eq(barbers.active, true))).orderBy(asc(barbers.displayName)),
  ]);
  if (!catalog.length || !team.length) return finish(humanContact(), empty());

  const now = Date.now();
  const today = localDateISO(now, org.timezone);
  const lastDay = addDaysISO(today, org.bookingWindowDays);
  const rules = agendaRules(org, now);
  const label = (choice: z.infer<typeof choiceSchema>) => {
    const professional = team.find((item) => item.id === choice.barberId);
    return `${fmtDateLong(choice.start, org.timezone)} às ${fmtTime(choice.start, org.timezone)} com ${professional?.displayName ?? "o barbeiro"}`;
  };

  if (command === "sim" && state.pending && state.draft.name) {
    const choice = state.pending;
    const service = catalog.find((item) => item.id === choice.serviceId);
    const professional = team.find((item) => item.id === choice.barberId);
    const date = localDateISO(choice.start, org.timezone);
    if (!service || !professional || date < today || date > lastDay) {
      return finish("Esse horário não está mais disponível. Informe outro dia ou horário.", empty());
    }
    const [day] = await loadAgenda(org, professional.id, date, 1, tx);
    if (!bookableStarts(day, service.durationMin, rules).includes(choice.start)) {
      return finish("Esse horário foi ocupado. Informe outro dia ou horário para eu consultar.", { ...state, options: [], pending: undefined });
    }
    try {
      await tx.transaction((savepoint) => savepoint.insert(appointments).values({
        orgId: org.id,
        barberId: professional.id,
        serviceId: service.id,
        serviceName: service.name,
        priceCents: service.priceCents,
        guestName: state.draft.name,
        guestPhone: phone,
        whatsappPhone: phone,
        whatsappConfirmedAt: new Date(),
        startsAt: new Date(choice.start),
        endsAt: new Date(choice.start + service.durationMin * 60_000),
      }));
      return finish(`Reserva confirmada! ${service.name}, ${label(choice)} · ${fmtPrice(service.priceCents)}.`, empty());
    } catch (error) {
      if (["23P01", "23503"].includes(pgErrorCode(error) ?? "")) return finish("A opção ficou indisponível. Informe outro dia ou horário.", empty());
      throw error;
    }
  }

  const option = /^[1-5]$/.test(command) ? state.options[Number(command) - 1] : undefined;
  if (option) {
    const service = catalog.find((item) => item.id === option.serviceId);
    if (!service) return finish("O serviço ficou indisponível. Escolha outro serviço.", empty());
    if (!state.draft.name) {
      return finish("Qual é o nome de quem vai receber o atendimento?", { ...state, pending: option, options: [] });
    }
    return finish(`${service.name}, ${label(option)} · ${fmtPrice(service.priceCents)}. Responda SIM para confirmar e autorizar a confirmação e o lembrete por WhatsApp, ou NÃO para recomeçar.`, { ...state, pending: option, options: [] });
  }

  if (state.pending && !state.draft.name && /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u.test(text.trim())) {
    const service = catalog.find((item) => item.id === state.pending!.serviceId);
    if (!service) return finish("O serviço ficou indisponível. Escolha outro serviço.", empty());
    return finish(`${service.name}, ${label(state.pending)} · ${fmtPrice(service.priceCents)}. Responda SIM para confirmar e autorizar a confirmação e o lembrete por WhatsApp, ou NÃO para recomeçar.`, {
      ...state, draft: { ...state.draft, name: text.trim() },
    });
  }
  if (state.pending && command === "sim") return finish("Informe o nome de quem vai receber o atendimento.");
  if (state.pending && state.draft.name && ["ok", "pode", "confirmo"].includes(command)) return finish("Responda SIM para confirmar ou NÃO para recomeçar.");

  let extracted;
  try {
    extracted = await interpretMessage(text, { today, lastDay, services: catalog.map(({ id, name }) => ({ id, name })),
      barbers: team.map(({ id, displayName }) => ({ id, name: displayName })), previous: state.draft });
  } catch {
    return finish(`Não consegui interpretar a mensagem agora. ${humanContact()}`);
  }

  if (extracted.intent === "humano") return finish(humanContact(), empty());
  if (extracted.intent === "informacoes") {
    const items = catalog.slice(0, 15).map((item) => `• ${item.name}: ${fmtPrice(item.priceCents)}`).join("\n");
    return finish(`Serviços da Nego Cortz\n${items}\nPara agendar, diga o serviço e o dia. Mais informações em ${CONTACT}.`);
  }
  if (extracted.intent === "outro" && !state.draft.serviceId && !state.draft.date) {
    return finish("Sou o assistente da Nego Cortz. Diga o serviço e o dia que prefere, ou escreva HUMANO.");
  }

  const draft = { ...state.draft };
  if (catalog.some((item) => item.id === extracted.serviceId)) draft.serviceId = extracted.serviceId!;
  if (team.some((item) => item.id === extracted.barberId)) draft.barberId = extracted.barberId!;
  if (/\b(qualquer barbeiro|sem prefer[eê]ncia)\b/i.test(text)) delete draft.barberId;
  if (extracted.date && isISODate(extracted.date) && addDaysISO(extracted.date, 0) === extracted.date) {
    if (draft.date !== extracted.date) delete draft.earliest;
    draft.date = extracted.date;
  }
  if (extracted.earliest && /^([01]\d|2[0-3]):[0-5]\d$/.test(extracted.earliest)) draft.earliest = extracted.earliest;
  if (extracted.name && /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u.test(extracted.name.trim())) draft.name = extracted.name.trim();
  const nextState = { draft, options: [] };
  const service = catalog.find((item) => item.id === draft.serviceId);
  if (!service) return finish(`Qual serviço você quer? ${catalog.slice(0, 12).map((item) => item.name).join(", ")}.`, nextState);
  const date = draft.date;
  if (!date || date < today || date > lastDay) return finish("Qual dia você prefere? Informe o dia e o mês dentro do período disponível na agenda.", nextState);
  const candidates = draft.barberId ? team.filter((item) => item.id === draft.barberId) : team;
  const [hours, minutes] = (draft.earliest ?? "00:00").split(":").map(Number);
  const earliest = hours * 60 + minutes;
  const options = (await Promise.all(candidates.map(async (professional) => {
    const [day] = await loadAgenda(org, professional.id, date, 1, tx);
    return bookableStarts(day, service.durationMin, rules).filter((start) => localMinutes(start, org.timezone) >= earliest)
      .slice(0, 5).map((start) => ({ start, barberId: professional.id, serviceId: service.id }));
  }))).flat().sort((a, b) => a.start - b.start).slice(0, 5);
  if (!options.length) return finish("Não encontrei horários livres com essas preferências. Qual outro dia ou período funciona para você?", nextState);
  return finish(`Horários para ${service.name}\n${options.map((item, i) => `${i + 1}. ${label(item)}`).join("\n")}\nResponda com o número da opção.`, { draft, options });
}

export async function handleWhatsAppMessage(message: { id: string; phone: string; text: string }) {
  await db.transaction(async (tx) => {
    const [newMessage] = await tx.insert(whatsappMessages).values({ id: message.id }).onConflictDoNothing().returning();
    if (!newMessage) return;
    await tx.insert(whatsappConversations).values({ sender: message.phone }).onConflictDoNothing();
    const [conversation] = await tx.select().from(whatsappConversations)
      .where(eq(whatsappConversations.sender, message.phone)).for("update");
    const parsed = stateSchema.safeParse(conversation.state);
    const state = parsed.success && Date.now() - conversation.updatedAt.getTime() < IDLE_MS ? parsed.data : empty();
    const { reply, next } = await replyTo(tx, message.phone, message.text, state);
    await tx.update(whatsappConversations).set({ state: next, updatedAt: new Date() }).where(eq(whatsappConversations.sender, message.phone));
    await tx.update(whatsappMessages).set({ reply }).where(eq(whatsappMessages.id, message.id));
  });

  await db.transaction(async (tx) => {
    const [stored] = await tx.select().from(whatsappMessages).where(eq(whatsappMessages.id, message.id)).for("update");
    if (!stored?.reply || stored.sentAt) return;
    await sendWhatsApp(message.phone, { type: "text", text: { body: stored.reply } });
    await tx.update(whatsappMessages).set({ sentAt: new Date() }).where(eq(whatsappMessages.id, message.id));
  });
}
