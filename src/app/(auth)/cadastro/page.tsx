import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { loginHome, safeNext } from "@/lib/forms";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNext(next) : undefined;
  if (await getUser()) redirect(loginHome(nextPath));
  return (
    <>
      <h1 className="font-display text-5xl">Criar conta</h1>
      <p className="mt-2 mb-8 text-ink-2">Crie sua conta para reservar na Barbearia Nego Cortz.</p>
      <AuthForm mode="cadastro" next={nextPath} />
    </>
  );
}
