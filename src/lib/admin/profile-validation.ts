import { z } from "zod";

const optionalPhone = z.string().trim().max(60, "El teléfono es demasiado largo.").refine((value) => {
  if (!value) return true;
  if (!/^[+()\d\s.-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}, "Ingrese un número de teléfono válido.");

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Ingrese su nombre completo.").max(160, "El nombre es demasiado largo."),
  preferredName: z.string().trim().max(100, "El nombre preferido es demasiado largo."),
  jobTitle: z.string().trim().max(140, "El cargo es demasiado largo."),
  phone: optionalPhone,
  locale: z.enum(["es-HN", "en-US"], { error: "Seleccione un idioma válido." }),
}).strict();

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileField = keyof ProfileInput;

export function profileFieldErrors(error: z.ZodError<ProfileInput>) {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).flatMap(([field, messages]) => messages?.[0] ? [[field, messages[0]]] : []),
  ) as Partial<Record<ProfileField, string>>;
}
