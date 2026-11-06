import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/forms";
import { normalizeWhatsApp } from "@/lib/phone";
import { PhoneForm } from "./phone-form";

export const metadata: Metadata = { title: "Cadastrar WhatsApp" };

export default async function CompleteProfilePage({ searchParams }: PageProps<"/completar-cadastro">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNext(next, "/inicio") : "/inicio";
  const destination = nextPath.startsWith("/completar-cadastro") ? "/inicio" : nextPath;
  const user = await getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(destination)}`);
  if (normalizeWhatsApp(user.phone)) redirect(destination);

  return (
    <>
      <h1 className="font-display text-5xl">Cadastre seu WhatsApp</h1>
      <p className="mt-2 mb-8 text-ink-2">Precisamos de um número para contato sobre suas reservas. Você só precisa preencher uma vez.</p>
      <PhoneForm next={destination} />
    </>
  );
}
