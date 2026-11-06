"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { savePhone, signOut } from "../actions";

export function PhoneForm({ next }: { next: string }) {
  const [state, action] = useActionState(savePhone, undefined);
  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="WhatsApp com DDD">
          <Input name="phone" type="tel" autoComplete="tel" placeholder="(11) 91234-5678" maxLength={30} required />
        </Field>
        <FormMessage state={state} />
        <SubmitButton className="w-full">Salvar e continuar</SubmitButton>
      </form>
      <form action={signOut} className="mt-4 text-center">
        <button className="text-sm underline underline-offset-4">Sair</button>
      </form>
    </>
  );
}
