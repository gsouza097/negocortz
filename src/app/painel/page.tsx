import { redirect } from "next/navigation";
import { isTeamMember, requireUser } from "@/lib/auth/session";
import { SHOP_SLUG } from "@/lib/brand";

export default async function PanelIndex() {
  const user = await requireUser("/painel");
  const member = await isTeamMember(user.id);
  redirect(member ? `/painel/${SHOP_SLUG}` : "/minhas-reservas");
}
