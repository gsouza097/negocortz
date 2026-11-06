import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { SHOP_SLUG } from "@/lib/brand";

export default async function PanelIndex() {
  const user = await requireUser("/painel");
  const [member] = await db.select({ id: memberships.userId }).from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, user.id), eq(organizations.slug, SHOP_SLUG))).limit(1);
  redirect(member ? `/painel/${SHOP_SLUG}` : "/minhas-reservas");
}
