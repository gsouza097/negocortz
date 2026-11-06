import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { memberships, organizations, users } from "../src/db/schema";
import { SHOP_NAME, SHOP_SLUG } from "../src/lib/brand";
import { scriptDbUrl } from "./db-url";

async function main() {
  const ownerId = z.uuid().parse(process.argv[2]);
  if (!scriptDbUrl) throw new Error("Configure DATABASE_URL para o banco de destino.");
  const client = postgres(scriptDbUrl, { max: 1, prepare: false });
  const db = drizzle(client);
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).limit(1);
      if (!user) throw new Error("A conta indicada não existe no banco de destino.");
      await tx.insert(organizations).values({ slug: SHOP_SLUG, name: SHOP_NAME }).onConflictDoNothing();
      const [org] = await tx.select({ id: organizations.id }).from(organizations)
        .where(eq(organizations.slug, SHOP_SLUG)).for("update");
      const owners = await tx.select({ userId: memberships.userId }).from(memberships)
        .where(and(eq(memberships.orgId, org.id), eq(memberships.role, "owner")));
      if (owners.some((owner) => owner.userId !== ownerId)) {
        throw new Error("A barbearia já tem outro administrador. Nenhuma permissão foi alterada.");
      }
      await tx.insert(memberships).values({ orgId: org.id, userId: ownerId, role: "owner" })
        .onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { role: "owner" } });
    });
    console.log("Administrador da Barbearia Nego Cortez configurado.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
