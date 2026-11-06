import { notFound, redirect } from "next/navigation";
import { SHOP_SLUG } from "@/lib/brand";

export default async function ShopPage({ params }: PageProps<"/[slug]">) {
  if ((await params).slug !== SHOP_SLUG) notFound();
  redirect("/");
}
