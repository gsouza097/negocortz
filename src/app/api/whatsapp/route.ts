import { z } from "zod";
import { handleWhatsAppMessage } from "@/lib/whatsapp/bot";
import { equalSecret, metaConfig, verifySignature } from "@/lib/whatsapp/meta";
import { normalizeWhatsApp } from "@/lib/phone";

export const runtime = "nodejs";
export const maxDuration = 60;

const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({ changes: z.array(z.object({
    field: z.string(),
    value: z.object({
      metadata: z.object({ phone_number_id: z.string() }).optional(),
      messages: z.array(z.object({
        id: z.string().min(1).max(256),
        from: z.string(),
        type: z.string(),
        text: z.object({ body: z.string() }).optional(),
      })).optional(),
    }),
  })) })),
});

export function GET(request: Request) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return new Response(null, { status: 503 });
  const query = new URL(request.url).searchParams;
  const challenge = query.get("hub.challenge");
  if (query.get("hub.mode") !== "subscribe" || !challenge || !equalSecret(query.get("hub.verify_token") ?? "", token)) {
    return new Response(null, { status: 403 });
  }
  return new Response(challenge);
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const config = metaConfig();
  if (!secret || !config) return new Response(null, { status: 503 });

  const body = await request.text();
  if (!verifySignature(body, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response(null, { status: 401 });
  }
  let payload;
  try {
    payload = payloadSchema.safeParse(JSON.parse(body));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!payload.success) return new Response(null, { status: 400 });

  try {
    for (const entry of payload.data.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages" || change.value.metadata?.phone_number_id !== config.id) continue;
        for (const item of change.value.messages ?? []) {
          const phone = normalizeWhatsApp(item.from);
          if (!phone) continue;
          const text = item.type === "text" ? item.text?.body.trim().slice(0, 1500) : "humano";
          if (text) await handleWhatsAppMessage({ id: item.id, phone, text });
        }
      }
    }
  } catch (error) {
    console.error("Falha ao processar mensagem do WhatsApp.", error instanceof Error ? error.name : "erro");
    return new Response(null, { status: 503 });
  }

  return new Response(null, { status: 200 });
}
