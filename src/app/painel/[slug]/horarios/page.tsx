import { requireManagedBarber } from "@/lib/managed-barber";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workingHours } from "@/db/schema";
import { HoursForm } from "./hours-form";

export default async function HoursPage({ params, searchParams }: PageProps<"/painel/[slug]/horarios">) {
  const { slug } = await params;
  const target = (await searchParams).barbeiro;
  const { barber } = await requireManagedBarber(slug, typeof target === "string" ? target : undefined);
  const rows = await db.select().from(workingHours).where(eq(workingHours.barberId, barber.id)).orderBy(asc(workingHours.startMin));
  const byDay: Record<number, { startMin: number; endMin: number }[]> = {};
  for (const r of rows) (byDay[r.weekday] ??= []).push({ startMin: r.startMin, endMin: r.endMin });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-2">{barber.displayName}</p>
      <h1 className="font-display text-5xl leading-none sm:text-6xl">Expediente</h1>
      <p className="mt-2 mb-8 text-ink-2">Só aparecem horários livres dentro do seu expediente. Para folgas pontuais, use “Bloquear horário” na Agenda.</p>
      <HoursForm key={barber.id} slug={slug} barberId={barber.id} initial={byDay} />
    </div>
  );
}
