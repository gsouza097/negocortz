"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui";
import { bookableStarts, type AgendaDay, type AgendaRules } from "@/lib/slots";
import { addDaysISO, fmtDayMonth, fmtDuration, fmtPrice, fmtTime, localDateISO } from "@/lib/time";
import { addManualBooking } from "./actions";

type Barber = { id: string; name: string; agenda: AgendaDay };
type Service = { id: string; name: string; durationMin: number; priceCents: number };

export function ManualBookingForm({ slug, date, timezone, barbers, services, rules, whatsappEnabled }: {
  slug: string;
  date: string;
  timezone: string;
  barbers: Barber[];
  services: Service[];
  rules: AgendaRules;
  whatsappEnabled: boolean;
}) {
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [weekly, setWeekly] = useState(false);
  const [state, action] = useActionState(async (previous: Awaited<ReturnType<typeof addManualBooking>>, data: FormData) => {
    const result = await addManualBooking(previous, data);
    if (result?.ok) {
      setName("");
      setPhone("");
      setStart("");
      setWeekly(false);
    }
    return result;
  }, undefined);

  const barber = barbers.find((item) => item.id === barberId) ?? barbers[0];
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const starts = barber && service ? bookableStarts(barber.agenda, service.durationMin, rules) : [];
  const selectedStart = starts.some((time) => String(time) === start) ? start : "";
  const initialDates: string[] = [];
  if (weekly && selectedStart) {
    const last = addDaysISO(localDateISO(rules.latest - 1, timezone), 28);
    for (let occurrence = date; occurrence <= last; occurrence = addDaysISO(occurrence, 7)) initialDates.push(occurrence);
  }

  return (
    <form action={action} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="date" value={date} />
      <Field label="Barbeiro">
        <Select name="barberId" required value={barber?.id ?? ""} onChange={(event) => {
          setBarberId(event.target.value);
          setStart("");
        }}>
          {barbers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <Field label="Serviço">
        <Select name="serviceId" required value={service?.id ?? ""} onChange={(event) => {
          setServiceId(event.target.value);
          setStart("");
        }}>
          {services.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {fmtDuration(item.durationMin)} · {fmtPrice(item.priceCents)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Horário disponível">
        <Select name="start" required value={selectedStart} onChange={(event) => setStart(event.target.value)} disabled={!starts.length}>
          <option value="">{starts.length ? "Escolha o horário" : "Sem horários disponíveis neste dia"}</option>
          {starts.map((time) => <option key={time} value={time}>{fmtTime(time, timezone)}</option>)}
        </Select>
      </Field>
      <Field label="Nome do cliente">
        <Input name="guestName" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="WhatsApp do cliente">
        <Input name="guestPhone" type="tel" placeholder="(11) 91234-5678" required maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="weekly" checked={weekly} onChange={(event) => setWeekly(event.target.checked)} className="mt-0.5 size-4" />
        <span><strong>Horário fixo semanal</strong><br />Repete no mesmo dia e horário enquanto o plano estiver ativo. Você controla o pagamento fora do sistema.</span>
      </label>
      {initialDates.length > 0 && (
        <p className="rounded-xl bg-paper px-3 py-2 text-sm text-ink-2 sm:col-span-2">
          Datas iniciais às {fmtTime(Number(selectedStart), timezone)}: {initialDates.map(fmtDayMonth).join(", ")}.
        </p>
      )}
      {whatsappEnabled && !weekly && <label className="flex items-start gap-2 text-sm text-ink-2 sm:col-span-2">
        <input type="checkbox" name="whatsappOptIn" className="mt-0.5 size-4" />
        O cliente autorizou receber a confirmação e o lembrete pelo WhatsApp.
      </label>}
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <SubmitButton disabled={!selectedStart}>{weekly ? "Criar horário fixo" : "Confirmar agendamento"}</SubmitButton>
      </div>
    </form>
  );
}
