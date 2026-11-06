"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { fmtMinutes, WEEKDAYS } from "@/lib/time";
import { saveHours } from "./actions";

type Range = { startMin: number; endMin: number };
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursForm({ slug, barberId, initial }: { slug: string; barberId: string; initial: Record<number, Range[]> }) {
  const [state, action] = useActionState(saveHours, undefined);
  const [on, setOn] = useState(() => Object.fromEntries(ORDER.map((wd) => [wd, !!initial[wd]?.length])));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="barberId" value={barberId} />
      <ul className="divide-y divide-line rounded-3xl border border-line bg-white">
        {ORDER.map((wd) => {
          const [first, second] = initial[wd] ?? [];
          const hasLunch = first && second && first.endMin < second.startMin;
          return (
            <li key={wd} className="space-y-3 p-4">
              <label className="flex items-center gap-3 font-semibold">
                <input type="checkbox" name={`d${wd}_on`} checked={on[wd]} onChange={(event) => setOn({ ...on, [wd]: event.target.checked })} className="size-5 accent-ink" />
                {WEEKDAYS[wd]}
                {!on[wd] && <span className="text-sm font-normal text-ink-2">Folga</span>}
              </label>
              <fieldset disabled={!on[wd]} className="grid grid-cols-2 gap-3 disabled:opacity-40 sm:grid-cols-4">
                <Field label="Início do expediente">
                  <Input type="time" name={`d${wd}_start`} required defaultValue={first ? fmtMinutes(first.startMin) : ""} />
                </Field>
                <Field label="Fim do expediente">
                  <Input type="time" name={`d${wd}_end`} required defaultValue={first ? fmtMinutes((second ?? first).endMin) : ""} />
                </Field>
                <Field label="Início do almoço">
                  <Input type="time" name={`d${wd}_lunchStart`} defaultValue={hasLunch ? fmtMinutes(first.endMin) : ""} />
                </Field>
                <Field label="Fim do almoço">
                  <Input type="time" name={`d${wd}_lunchEnd`} defaultValue={hasLunch ? fmtMinutes(second.startMin) : ""} />
                </Field>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-2">A pausa fica indisponível para novas reservas. Deixe os dois campos de almoço vazios se o dia não tiver pausa.</p>
      <FormMessage state={state} />
      <SubmitButton>Salvar horários</SubmitButton>
    </form>
  );
}
