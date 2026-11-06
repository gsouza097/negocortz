import { connection } from "next/server";
import { ShopLanding } from "@/components/shop-landing";

export default async function HomePage() {
  await connection();
  return <ShopLanding />;
}
