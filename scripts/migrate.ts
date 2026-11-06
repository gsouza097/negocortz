// Aplica as migrações de ./drizzle.
// Com DATABASE_URL: Postgres (Neon/Supabase). Sem: PGlite local em .pglite/, já populado com a barbearia demo.
import path from "node:path";
import { SHOP_NAME, SHOP_SLUG } from "../src/lib/brand";
import { scriptDbUrl as url } from "./db-url";

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function main() {
  if (!url && process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL não configurada. Conecte um Postgres (Storage → Neon) ao projeto na Vercel e faça o redeploy. Veja DEPLOY.md.",
    );
  }

  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1, prepare: false });
    await migrate(drizzle(client), { migrationsFolder });
    await client.end();
    console.log("Migrações aplicadas.");
    return;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { and, eq, sql } = await import("drizzle-orm");
  const schema = await import("../src/db/schema");
  const { seed, DEMO_PASSWORD } = await import("../src/db/seed");

  const client = new PGlite(path.join(process.cwd(), ".pglite"), { extensions: { btree_gist } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.organizations);
  if (count === 0) {
    await seed(db as never);
    console.log(`Banco local criado com a demo: / · contas *@example.com · senha ${DEMO_PASSWORD}`);
  } else {
    // Mantém a demo de instalações locais anteriores sem recriar contas ou reservas.
    await db.update(schema.organizations)
      .set({ slug: SHOP_SLUG, name: SHOP_NAME, description: null, address: null, city: null, phone: null, instagram: null })
      .where(and(eq(schema.organizations.slug, "casa-brava"), sql`exists (
        select 1 from memberships m join users u on u.id = m.user_id
        where m.org_id = ${schema.organizations.id} and m.role = 'owner' and u.email = 'rafa@example.com'
      ) and not exists (select 1 from organizations where slug = ${SHOP_SLUG})`));
    console.log("Banco local migrado.");
  }
  await client.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
