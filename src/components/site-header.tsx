import Link from "next/link";
import { getUser, isTeamMember } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "./logo";
import { buttonClass } from "./styles";

export async function SiteHeader({ next }: { next?: string }) {
  const user = await getUser();
  const showPanel = user && await isTeamMember(user.id);
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" aria-label="Nego Cortz, início">
          <Logo />
        </Link>
        {user ? (
          <nav className="flex flex-wrap justify-end gap-1 text-sm">
            <Link href="/notificacoes" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Notificações
            </Link>
            <Link href="/minhas-reservas" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Minhas reservas
            </Link>
            {showPanel && (
              <Link href="/painel" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Painel
              </Link>
            )}
            <form action={signOut}>
              <button className={buttonClass({ variant: "outline", size: "sm" })}>Sair</button>
            </form>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link href={`/entrar${qs}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
              Entrar
            </Link>
            <Link href={`/cadastro${qs}`} className={buttonClass({ size: "sm" })}>
              Criar conta
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
