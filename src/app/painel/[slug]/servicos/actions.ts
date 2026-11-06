"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireMember } from "@/lib/tenant";
import { firstError, formObject, type FormState } from "@/lib/forms";

const schema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nome do serviço muito curto.").max(60),
  description: z.string().trim().max(200).optional(),
  durationMin: z.coerce.number().int().min(5, "Duração mínima de 5 min.").max(480, "Duração máxima de 8h."),
  price: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um preço válido, como 45,00.")
    .transform((v) => Math.round(Number(v.replace(",", ".")) * 100))
    .refine((c) => Number.isInteger(c) && c >= 0 && c <= 2_147_483_647, "Preço inválido."),
  active: z.string().optional(),
});

export async function saveService(_: FormState, fd: FormData): Promise<FormState> {
  const slug = String(fd.get("slug"));
  const { org } = await requireMember(slug, ["owner"]);
  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, name, description, durationMin, price, active } = parsed.data;
  const values = { name, description: description || null, durationMin, priceCents: price, active: active !== "0" };

  if (id) {
    await db.update(services).set(values).where(and(eq(services.id, id), eq(services.orgId, org.id)));
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${services.sort}), 0)::int + 1` })
      .from(services)
      .where(eq(services.orgId, org.id));
    await db.insert(services).values({ ...values, orgId: org.id, sort: next });
  }
  revalidatePath("/");
  revalidatePath(`/painel/${slug}/servicos`);
  revalidatePath(`/${slug}`, "layout");
  return { ok: id ? "Serviço atualizado." : "Serviço criado." };
}

export async function deleteService(fd: FormData) {
  const slug = String(fd.get("slug"));
  const { org } = await requireMember(slug, ["owner"]);
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  await db.delete(services).where(and(eq(services.id, id.data), eq(services.orgId, org.id)));
  revalidatePath("/");
  revalidatePath(`/painel/${slug}/servicos`);
  revalidatePath(`/${slug}`, "layout");
}
