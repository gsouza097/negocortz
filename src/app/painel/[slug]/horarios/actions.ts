"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { workingHours } from "@/db/schema";
import { requireManagedBarber } from "@/lib/managed-barber";
import { WEEKDAYS } from "@/lib/time";
import type { FormState } from "@/lib/forms";

function toMinutes(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export async function saveHours(_: FormState, fd: FormData): Promise<FormState> {
  const slug = String(fd.get("slug"));
  const { barber } = await requireManagedBarber(slug, String(fd.get("barberId") ?? "") || undefined);
  const rows: (typeof workingHours.$inferInsert)[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (!fd.get(`d${weekday}_on`)) continue;
    const start = toMinutes(fd.get(`d${weekday}_start`));
    const end = toMinutes(fd.get(`d${weekday}_end`));
    const day = WEEKDAYS[weekday];
    if (start === null || end === null || start >= end) return { error: `${day}: informe o início e o fim do expediente.` };

    const lunchStartValue = fd.get(`d${weekday}_lunchStart`);
    const lunchEndValue = fd.get(`d${weekday}_lunchEnd`);
    if (!lunchStartValue && !lunchEndValue) {
      rows.push({ barberId: barber.id, weekday, startMin: start, endMin: end });
      continue;
    }

    const lunchStart = toMinutes(lunchStartValue);
    const lunchEnd = toMinutes(lunchEndValue);
    if (lunchStart === null || lunchEnd === null || start >= lunchStart || lunchStart >= lunchEnd || lunchEnd >= end) {
      return { error: `${day}: informe os dois horários da pausa, em ordem e dentro do expediente.` };
    }
    rows.push(
      { barberId: barber.id, weekday, startMin: start, endMin: lunchStart },
      { barberId: barber.id, weekday, startMin: lunchEnd, endMin: end },
    );
  }

  await db.transaction(async (tx) => {
    // Serializa edições do mesmo barbeiro, inclusive quando a agenda está vazia.
    await tx.execute(sql`select id from barbers where id = ${barber.id} for update`);
    await tx.delete(workingHours).where(eq(workingHours.barberId, barber.id));
    if (rows.length) await tx.insert(workingHours).values(rows);
  });
  revalidatePath(`/painel/${slug}/horarios`);
  revalidatePath("/");
  revalidatePath(`/${slug}`, "layout");
  return { ok: "Horários salvos. A agenda pública já foi atualizada." };
}
