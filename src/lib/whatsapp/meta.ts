import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function equalSecret(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifySignature(body: string, signature: string | null, secret: string) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return equalSecret(signature ?? "", `sha256=${digest}`);
}

export function metaConfig() {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: id, WHATSAPP_GRAPH_VERSION: version } = process.env;
  if (!token || !id || !version || !/^\d+$/.test(id) || !/^v\d+\.\d+$/.test(version)) return null;
  return { token, id, version };
}

export async function sendWhatsApp(to: string, message: { type: "text"; text: { body: string } } | {
  type: "template";
  template: { name: string; language: { code: string }; components: { type: "body"; parameters: { type: "text"; text: string }[] }[] };
}) {
  const config = metaConfig();
  if (!config) throw new Error("WhatsApp não configurado.");
  const response = await fetch(`https://graph.facebook.com/${config.version}/${config.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), ...message }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`WhatsApp recusou a mensagem (HTTP ${response.status}).`);
}
