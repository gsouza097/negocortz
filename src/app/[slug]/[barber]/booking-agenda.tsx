"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { bookableStarts, type AgendaDay, type AgendaRules } from "@/lib/slots";
import { addDaysISO, fmtDateLong, fmtDuration, fmtPrice, fmtTime, localMinutes, weekdayOfISO, zonedToMs } from "@/lib/time";
import { buttonClass, cx, FormMessage, SubmitButton, Textarea } from "@/components/ui";
import { bookAppointment } from "./actions";

type Service = { id: string; name: string; durationMin: number; priceCents: number };
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const periods = [{ name: "Manhã", start: 0, end: 720 }, { name: "Tarde", start: 720, end: 1080 }, { name: "Noite", start: 1080, end: 1440 }];

export function BookingAgenda({ slug, barberId, barberName, path, tz, services, days, rules, today, lastDay, initialDay, initialServiceId, initialStart, signedIn, whatsappEnabled }: {
  slug: string;
  barberId: string;
  barberName: string;
  path: string;
  tz: string;
  services: Service[];
  days: AgendaDay[];
  rules: AgendaRules;
  today: string;
  lastDay: string;
  initialDay: string;
  initialServiceId?: string;
  initialStart?: number;
  signedIn: boolean;
  whatsappEnabled: boolean;
}) {
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [day, setDay] = useState(initialDay);
  const [start, setStart] = useState(initialStart);
  const [state, action] = useActionState(bookAppointment, undefined);
  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const freeByDay = new Map(days.map((item) => [item.date, bookableStarts(item, service.durationMin, rules)]));
  const free = freeByDay.get(day) ?? [];
  const selected = start && free.includes(start) ? start : undefined;
  const month = initialDay.slice(0, 7) + "-01";
  const lastOfMonth = addDaysISO(addDaysISO(month, 32).slice(0, 7) + "-01", -1);
  const previous = addDaysISO(month, -1);
  const previousMonth = previous.slice(0, 7) + "-01";
  const next = addDaysISO(lastOfMonth, 1);
  const blanks = (weekdayOfISO(month) + 6) % 7;
  const dates = Array.from({ length: Number(lastOfMonth.slice(-2)) }, (_, index) => addDaysISO(month, index));
  const dateLabel = (date: string) => fmtDateLong(zonedToMs(date, 720, tz), tz);
  const agendaHref = (date: string, time?: number) => `${path}?de=${date}&servico=${service.id}${time ? `&horario=${time}` : ""}#agenda`;

  return (
    <div className="space-y-5">
      <label className="block max-w-md space-y-2 text-sm font-semibold">
        <span>Serviço</span>
        <select value={service.id} onChange={(event) => { setServiceId(event.target.value); setStart(undefined); }}
          className="min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base">
          {services.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {fmtDuration(item.durationMin)} · {fmtPrice(item.priceCents)}</option>
          ))}
        </select>
      </label>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <section aria-label="Escolha o dia" className="rounded-2xl border border-line bg-white p-3 sm:p-5">
          <div className="mb-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
            {previous >= today ? <Link href={agendaHref(previousMonth < today ? today : previousMonth)} scroll={false} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-xl border border-line">←</Link> : <span />}
            <h3 className="text-center font-semibold capitalize">{monthFormat.format(new Date(month + "T12:00:00Z"))}</h3>
            {next <= lastDay ? <Link href={agendaHref(next)} scroll={false} aria-label="Próximo mês" className="grid size-11 place-items-center rounded-xl border border-line">→</Link> : <span />}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((label) => <span key={label} className="py-1 text-center text-xs text-ink-2">{label}</span>)}
            {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
            {dates.map((date) => {
              const available = !!freeByDay.get(date)?.length;
              return (
                <button key={date} type="button" disabled={date < today || date > lastDay}
                  aria-label={`${dateLabel(date)}${available ? ", com horários livres" : ""}`} aria-pressed={date === day}
                  onClick={() => { setDay(date); setStart(undefined); }}
                  className={cx("relative min-h-11 rounded-lg text-sm font-semibold disabled:opacity-25",
                    date === day ? "bg-ink text-white" : available ? "bg-cream text-steel hover:bg-sky" : "text-ink-2 hover:bg-paper-2")}>
                  {Number(date.slice(-2))}
                  {available && <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="Horários livres" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <h3 className="font-semibold first-letter:uppercase">{dateLabel(day)}</h3>
          {!free.length && <p className="mt-3 text-sm text-ink-2">Nenhum horário livre neste dia. Escolha outra data no calendário.</p>}
          {periods.map((period) => {
            const times = free.filter((time) => {
              const minutes = localMinutes(time, tz);
              return minutes >= period.start && minutes < period.end;
            });
            if (!times.length) return null;
            return (
              <div key={period.name} className="mt-4">
                <p className="mb-2 text-xs font-semibold text-ink-2">{period.name}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {times.map((time) => <button key={time} type="button" aria-pressed={time === selected} onClick={() => setStart(time)}
                    className={cx("min-h-11 rounded-xl border px-1 font-mono text-sm",
                      time === selected ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>{fmtTime(time, tz)}</button>)}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {selected !== undefined && (
        <form action={action} className="space-y-3 rounded-2xl border border-ink bg-white p-4 sm:p-5">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="barberId" value={barberId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="start" value={selected} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{service.name} com {barberName}</p>
              <p className="text-sm text-ink-2 first-letter:uppercase">{dateLabel(day)} · {fmtTime(selected, tz)} · {fmtPrice(service.priceCents)}</p>
            </div>
            {signedIn ? <SubmitButton pending="Reservando…">Confirmar reserva</SubmitButton> :
              <Link href={`/entrar?next=${encodeURIComponent(agendaHref(day, selected))}`} className={buttonClass({ size: "lg" })}>Entrar para reservar</Link>}
          </div>
          {signedIn && <details className="text-sm">
            <summary className="cursor-pointer text-ink-2">Deixar um recado para o barbeiro</summary>
            <Textarea name="note" maxLength={280} className="mt-2" placeholder="Ex.: quero manter o comprimento em cima" />
          </details>}
          {signedIn && whatsappEnabled && <label className="flex items-start gap-2 text-sm text-ink-2">
            <input type="checkbox" name="whatsappOptIn" className="mt-0.5 size-4" />
            Quero receber a confirmação e o lembrete desta reserva pelo WhatsApp.
          </label>}
          <FormMessage state={state} />
        </form>
      )}
      {selected === undefined && <FormMessage state={state} />}
    </div>
  );
}
