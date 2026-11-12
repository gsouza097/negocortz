import { connection } from "next/server";
import { ShopLanding } from "@/components/shop-landing";
import { safeNext } from "@/lib/forms";
import { LoginBridge } from "./login-bridge";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  await connection();
  const { login, continuar } = await searchParams;
  const next = login === "1" && typeof continuar === "string" ? safeNext(continuar) : "/";
  return <>
    {login === "1" && <LoginBridge />}
    <ShopLanding resumeHref={next !== "/" ? next : undefined} />
  </>;
}
