import Image from "next/image";
import { SHOP_LOGO } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image src={SHOP_LOGO} alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg object-cover" />
      <span className="font-display text-lg leading-none sm:text-[22px]">Nego Cortz</span>
    </span>
  );
}
