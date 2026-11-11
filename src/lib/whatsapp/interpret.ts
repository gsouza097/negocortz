import "server-only";
import { z } from "zod";

const requestSchema = z.object({
  intent: z.enum(["agendar", "informacoes", "humano", "outro"]),
  serviceId: z.string().nullable(),
  barberId: z.string().nullable(),
  date: z.string().nullable(),
  earliest: z.string().nullable(),
  name: z.string().nullable(),
});

export async function interpretMessage(text: string, context: {
  today: string;
  lastDay: string;
  services: { id: string; name: string }[];
  barbers: { id: string; name: string }[];
  previous: { serviceId?: string; barberId?: string; date?: string; earliest?: string; name?: string };
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.WHATSAPP_OPENAI_MODEL;
  if (!apiKey || !model) throw new Error("IA do WhatsApp não configurada.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1200,
      instructions: "Extraia dados de uma mensagem em português para agendamento de barbearia. Use apenas IDs do catálogo. Resolva datas relativas com base em today. Use YYYY-MM-DD e HH:mm. Uma mensagem que completa os dados anteriores é agendar. Não invente dados. Use null quando não informado. Se o cliente pedir qualquer barbeiro ou qualquer horário, devolva null para a preferência e deixe o sistema oferecer opções. Nunca registre nem confirme uma reserva.",
      input: JSON.stringify({ context, message: text }),
      text: { format: { type: "json_schema", name: "pedido_agendamento", strict: true, schema: z.toJSONSchema(requestSchema) } },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`IA indisponível (HTTP ${response.status}).`);
  const payload = await response.json() as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
  const value = payload.output?.find((item) => item.type === "message")?.content?.find((item) => item.type === "output_text")?.text;
  if (!value) throw new Error("A IA não retornou os dados do pedido.");
  return requestSchema.parse(JSON.parse(value));
}
