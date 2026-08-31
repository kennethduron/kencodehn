type AuthErrorLike = { code?: unknown; status?: unknown; name?: unknown };

export function loginErrorMessage(error: unknown) {
  const candidate = error && typeof error === "object" ? error as AuthErrorLike : {};
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const status = typeof candidate.status === "number" ? candidate.status : 0;
  if (code === "email_not_confirmed") {
    return "No pudimos iniciar sesión. Verifique sus datos o utilice la recuperación de contraseña.";
  }
  if (code === "over_request_rate_limit" || status === 429) {
    return "Se realizaron demasiados intentos. Espere unos minutos antes de volver a intentarlo.";
  }
  if (code === "weak_password") {
    return "Por seguridad, esta contraseña debe actualizarse mediante la opción de recuperación.";
  }
  return "Correo o contraseña incorrectos, o la cuenta no está disponible.";
}
