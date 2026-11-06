"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { barberPhotos, barbers } from "@/db/schema";
import { slugify } from "@/lib/tenant";
import { requireManagedBarber } from "@/lib/managed-barber";
import { deleteImage, saveImage, validateImage } from "@/lib/upload";
import { firstError, formObject, instagramHandle, pgErrorCode, type FormState } from "@/lib/forms";

const MAX_PHOTOS = 30;
const captionSchema = z.string().trim().min(1).max(120);

const year = new Date().getFullYear();
const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome.").max(60),
  handle: z.string().trim().min(2, "O endereço do perfil é curto demais.").max(40),
  bio: z.string().trim().max(500, "Bio com no máximo 500 caracteres.").optional(),
  instagram: z.string().trim().max(100).optional(),
  specialties: z.string().max(400).optional(),
  since: z.union([z.literal(""), z.coerce.number().int().min(1950).max(year)]).optional(),
});

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const slug = String(fd.get("slug"));
  const { org, barber } = await requireManagedBarber(slug, String(fd.get("barberId") ?? "") || undefined);
  const parsed = profileSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const ig = d.instagram ? instagramHandle(d.instagram) : null;
  if (d.instagram && !ig) return { error: "Instagram inválido. Use @seuperfil ou o link do perfil." };
  const handle = slugify(d.handle);
  if (handle.length < 2) return { error: "Endereço do perfil inválido." };

  let avatarUrl = barber.avatarUrl;
  const avatar = fd.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const err = validateImage(avatar);
    if (err) return { error: err };
    if (process.env.NODE_ENV === "production" && !process.env.BLOB_READ_WRITE_TOKEN) return { error: "O armazenamento de fotos ainda não está configurado." };
    avatarUrl = await saveImage(avatar, `${org.id}/avatars`);
  }

  try {
    await db
      .update(barbers)
      .set({
        displayName: d.displayName,
        handle,
        bio: d.bio || null,
        instagram: ig,
        specialties: (d.specialties ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8)
          .map((s) => s.slice(0, 30)),
        since: typeof d.since === "number" ? d.since : null,
        avatarUrl,
      })
      .where(and(eq(barbers.id, barber.id), eq(barbers.orgId, org.id)));
  } catch (e) {
    if (avatarUrl !== barber.avatarUrl) await deleteImage(avatarUrl);
    if (pgErrorCode(e) === "23505") return { error: "Esse endereço de perfil já é de outro barbeiro da casa." };
    throw e;
  }
  if (avatarUrl !== barber.avatarUrl) await deleteImage(barber.avatarUrl);

  revalidatePath("/");
  revalidatePath(`/${slug}`, "layout");
  revalidatePath(`/painel/${slug}`, "layout");
  return { ok: "Perfil salvo." };
}

export async function addPhoto(_: FormState, fd: FormData): Promise<FormState> {
  const slug = String(fd.get("slug"));
  const { org, barber } = await requireManagedBarber(slug, String(fd.get("barberId") ?? "") || undefined);
  const caption = captionSchema.safeParse(fd.get("caption"));
  if (!caption.success) return { error: "Informe o nome do corte (até 120 caracteres)." };
  const file = fd.get("photo");
  const err = validateImage(file);
  if (err) return { error: err };
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(barberPhotos)
    .where(eq(barberPhotos.barberId, barber.id));
  if (n >= MAX_PHOTOS) return { error: `Limite de ${MAX_PHOTOS} fotos. Apague alguma antes.` };
  if (process.env.NODE_ENV === "production" && !process.env.BLOB_READ_WRITE_TOKEN) return { error: "O armazenamento de fotos ainda não está configurado." };
  const url = await saveImage(file as File, `${org.id}/portfolio`);
  await db.insert(barberPhotos).values({ barberId: barber.id, url, caption: caption.data });
  revalidatePath(`/painel/${slug}/perfil`);
  revalidatePath(`/${slug}/${barber.handle}`);
  return { ok: "Foto publicada." };
}

export async function renamePhoto(_: FormState, fd: FormData): Promise<FormState> {
  const slug = String(fd.get("slug"));
  const { barber } = await requireManagedBarber(slug, String(fd.get("barberId") ?? "") || undefined);
  const caption = captionSchema.safeParse(fd.get("caption"));
  const id = z.uuid().safeParse(fd.get("id"));
  if (!caption.success || !id.success) return { error: "Informe o nome do corte (até 120 caracteres)." };
  const [photo] = await db.update(barberPhotos).set({ caption: caption.data })
    .where(and(eq(barberPhotos.id, id.data), eq(barberPhotos.barberId, barber.id))).returning({ id: barberPhotos.id });
  if (!photo) return { error: "Foto não encontrada." };
  revalidatePath(`/painel/${slug}/perfil`);
  revalidatePath(`/${slug}/${barber.handle}`);
  return { ok: "Nome do corte atualizado." };
}

export async function deletePhoto(fd: FormData) {
  const slug = String(fd.get("slug"));
  const { barber } = await requireManagedBarber(slug, String(fd.get("barberId") ?? "") || undefined);
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  const [photo] = await db
    .delete(barberPhotos)
    .where(and(eq(barberPhotos.id, id.data), eq(barberPhotos.barberId, barber.id)))
    .returning();
  if (photo) await deleteImage(photo.url);
  revalidatePath(`/painel/${slug}/perfil`);
  revalidatePath(`/${slug}/${barber.handle}`);
}
