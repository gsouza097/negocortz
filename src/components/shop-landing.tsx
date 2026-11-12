import { requestTime } from "@/lib/clock";
import Image from "next/image";
import { SHOP_DETAILS, SHOP_LOGO, SHOP_NAME, SHOP_SLUG } from "@/lib/brand";
import { buttonClass } from "@/components/styles";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { barbers, services } from "@/db/schema";
import { agendaRules, loadAgenda } from "@/lib/agenda";
import { bookableStarts } from "@/lib/slots";
import { getOrgBySlug } from "@/lib/tenant";
import { fmtDuration, fmtPrice, fmtTime, localDateISO, addDaysISO } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { ArrowIcon, InstagramIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";

export async function ShopLanding({ resumeHref }: { resumeHref?: string }) {
  const slug = SHOP_SLUG;
  const org = await getOrgBySlug(slug);
  const address = org?.address || SHOP_DETAILS.address;
  const city = org?.city || SHOP_DETAILS.city;
  const phone = org?.phone || SHOP_DETAILS.phone;
  const instagram = org?.instagram || SHOP_DETAILS.instagram;
  const digits = phone.replace(/\D/g, "");
  const phoneUri = digits.length === 10 || digits.length === 11 ? `+55${digits}` : `+${digits}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${city}`)}`;

  const [team, svcList] = org ? await Promise.all([
    db
      .select()
      .from(barbers)
      .where(and(eq(barbers.orgId, org.id), eq(barbers.active, true)))
      .orderBy(asc(barbers.createdAt)),
    db
      .select()
      .from(services)
      .where(and(eq(services.orgId, org.id), eq(services.active, true)))
      .orderBy(asc(services.sort), asc(services.name)),
  ]) : [[], []];

  // próximo horário livre de cada barbeiro (serviço mais curto, 7 dias)
  const now = requestTime();
  const timezone = org?.timezone ?? "America/Sao_Paulo";
  const today = localDateISO(now, timezone);
  const shortest = Math.min(...svcList.map((s) => s.durationMin));
  const nextFree = await Promise.all(
    team.map(async (b) => {
      if (!org || !svcList.length) return null;
      const rules = agendaRules(org, now);
      const days = await loadAgenda(org, b.id, today, 7);
      for (const d of days) {
        const first = bookableStarts(d, shortest, rules)[0];
        if (first) return { date: d.date, ms: first };
      }
      return null;
    }),
  );
  const dayLabel = (date: string) =>
    date === today ? "hoje" : date === addDaysISO(today, 1) ? "amanhã" : new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  return (
    <>
      <SiteHeader next={`/${slug}`} />
      <main>
        {resumeHref && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold">Você pode continuar de onde parou.</p>
            <Link href={resumeHref} className={buttonClass({ variant: "outline", size: "sm" })}>Continuar</Link>
          </div>
        )}
        <section className="border-b border-line bg-night text-white">
          <div className="pole-stripes h-1.5" />
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr] md:py-16">
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-sky">Corte · Barba · Estilo</p>
              <h1 className="font-display text-[clamp(46px,8vw,96px)] leading-[0.9]">Barbearia<br />Nego Cortz</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/75">Seu estilo começa na cadeira. Escolha seu barbeiro e marque um horário para um atendimento no seu ritmo, com atenção ao corte e ao acabamento.</p>
              <a href="#equipe" className={`${buttonClass({ variant: "accent", size: "lg" })} mt-7`}>Agendar meu horário</a>
            </div>
            <Image src={SHOP_LOGO} alt={SHOP_NAME} width={460} height={460} preload className="mx-auto aspect-square w-full max-w-[380px] self-center rounded-3xl bg-white object-cover md:max-w-[460px]" />
          </div>
        </section>

        <section id="informacoes" aria-labelledby="informacoes-titulo" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-10 sm:px-6">
          <div className="mb-5">
            <h2 id="informacoes-titulo" className="font-display text-4xl leading-none sm:text-5xl">Sobre a barbearia</h2>
            <p className="mt-3 max-w-2xl text-ink-2">{org?.description || SHOP_DETAILS.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-label="Endereço e contato" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-bold">Endereço e contato</h3>
              <ul className="space-y-3 text-[15px]">
                <li className="flex gap-3">
                  <PinIcon className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p>{address}</p>
                    <p className="text-ink-2">{city}</p>
                    <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-steel underline underline-offset-4">Como chegar</a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <PhoneIcon className="size-5 shrink-0" />
                  <a href={`tel:${phoneUri}`} className="underline underline-offset-4">{phone}</a>
                </li>
                <li className="flex gap-3">
                  <InstagramIcon className="size-5 shrink-0" />
                  <a href={`https://instagram.com/${encodeURIComponent(instagram)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">@{instagram}</a>
                </li>
              </ul>
            </section>
            <section aria-label="Horário de funcionamento" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <h3 className="mb-2 text-lg font-bold">Horário de funcionamento</h3>
              <dl className="divide-y divide-line text-sm">
                {SHOP_DETAILS.hours.map(([day, time]) => (
                  <div key={day} className="flex justify-between gap-3 py-2.5">
                    <dt className="font-semibold">{day}</dt>
                    <dd className="shrink-0 tabular-nums text-ink-2">{time}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </section>

        <section id="equipe" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-5xl leading-none">Escolha seu barbeiro</h2>
            <p className="hidden text-sm text-ink-2 sm:block">Toque para ver o perfil e a agenda completa.</p>
          </div>
          {team.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-10 text-center text-ink-2">Nenhum barbeiro atendendo por aqui ainda.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((b, i) => (
                <li key={b.id}>
                  <Link
                    href={`/${slug}/${b.handle}`}
                    className="group flex h-full flex-col rounded-3xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_10px_30px_-15px_rgba(21,19,15,.4)]"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar name={b.displayName} src={b.avatarUrl} size={64} />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">{b.displayName}</p>
                        {b.instagram && <p className="truncate font-mono text-xs text-ink-2">@{b.instagram}</p>}
                      </div>
                    </div>
                    {b.specialties.length > 0 && (
                      <p className="mt-4 line-clamp-1 text-sm text-ink-2">{b.specialties.join(" · ")}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-5">
                      <span className="rounded-full bg-paper-2 px-3 py-1.5 font-mono text-xs">
                        {nextFree[i]
                          ? `Livre ${dayLabel(nextFree[i]!.date)} ${fmtTime(nextFree[i]!.ms, timezone)}`
                          : "Sem horários esta semana"}
                      </span>
                      <ArrowIcon className="h-5 w-5 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {svcList.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
            <h2 className="mb-6 font-display text-5xl leading-none">Serviços</h2>
            <ul className="divide-y divide-line border-y border-line">
              {svcList.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-6 py-4">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    {s.description && <p className="text-sm text-ink-2">{s.description}</p>}
                  </div>
                  <p className="shrink-0 text-right font-mono text-sm">
                    <span className="text-ink-2">{fmtDuration(s.durationMin)}</span>
                    <span className="ml-4 font-semibold">{fmtPrice(s.priceCents)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="border-t border-line bg-night px-4 py-7 text-center text-sm text-paper">{SHOP_NAME}</footer>
    </>
  );
}
