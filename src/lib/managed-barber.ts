import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { barbers } from "@/db/schema";
import { requireMember } from "./tenant";

export async function requireManagedBarber(slug: string, barberId?: string) {
  const { org, role, barber: ownBarber } = await requireMember(slug);
  if (ownBarber && (!barberId || ownBarber.id === barberId)) return { org, barber: ownBarber };
  if (role !== "owner" || !z.uuid().safeParse(barberId).success) notFound();

  const [barber] = await db.select().from(barbers)
    .where(and(eq(barbers.orgId, org.id), eq(barbers.id, barberId!))).limit(1);
  if (!barber) notFound();
  return { org, barber };
}
