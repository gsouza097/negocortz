export const SITE_ORIGIN = (__DEV__ && process.env.EXPO_PUBLIC_SITE_ORIGIN) || "https://negocortz.vercel.app";

const PATHS = {
  agenda: "/#equipe",
  reservas: "/minhas-reservas",
  painel: "/painel",
} as const;

export function continuationPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return;
  const url = new URL(SITE_ORIGIN + value);
  if (url.origin === SITE_ORIGIN && url.searchParams.get("login") !== "1") {
    return url.pathname + url.search + url.hash;
  }
}

export function loginLanding(value: string) {
  if (classifyUrl(value) !== "internal") return null;
  const url = new URL(value);
  if (url.pathname !== "/" || url.searchParams.get("login") !== "1") return null;
  return { continuation: continuationPath(url.searchParams.get("continuar")) };
}

export function portalUrl(destination: unknown, continuation?: string) {
  if (destination === "continuar") return SITE_ORIGIN + (continuationPath(continuation) ?? PATHS.agenda);
  const path = destination === "reservas" || destination === "painel" ? PATHS[destination] : PATHS.agenda;
  return SITE_ORIGIN + path;
}

export function classifyUrl(value: string): "internal" | "external" | "blocked" {
  try {
    const url = new URL(value);
    if (url.username || url.password) return "blocked";
    if (url.origin === SITE_ORIGIN) return "internal";
    if (["https:", "mailto:", "tel:", "whatsapp:"].includes(url.protocol)) return "external";
  } catch {
    return "blocked";
  }
  return "blocked";
}
