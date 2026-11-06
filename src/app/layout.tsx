import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { SHOP_LOGO, SHOP_NAME } from "@/lib/brand";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: `${SHOP_NAME} · Agendamento`, template: `%s · ${SHOP_NAME}` },
  description: "Conheça a equipe da Nego Cortz, escolha seu barbeiro e agende seu horário online.",
  icons: SHOP_LOGO,
};

export const viewport: Viewport = { themeColor: "#101116" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
