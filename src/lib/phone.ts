import { z } from "zod";

export function normalizeWhatsApp(input: string | null | undefined) {
  const value = input?.trim() ?? "";
  if (value.length > 30 || !/^\+?[\d().\s-]+$/.test(value)) return null;

  const digits = value.replace(/\D/g, "");
  const local = digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (value.startsWith("+") && local === digits) return null;
  return /^[1-9]\d9\d{8}$/.test(local) ? `+55${local}` : null;
}

export const whatsAppSchema = z.string().nullish().transform((input, ctx) => {
  const phone = normalizeWhatsApp(input);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Informe um celular com DDD, como (11) 91234-5678." });
    return z.NEVER;
  }
  return phone;
});
