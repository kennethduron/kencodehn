export type OwnerEmailTemplate = { subject: string; text: string; html: string };

function escapeOtp(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function ownerEmailVerificationTemplate(otp: string): OwnerEmailTemplate {
  const safeOtp = escapeOtp(otp);
  return {
    subject: "Código de verificación — Ken Code",
    text: `Verifique su correo de Ken Code\n\nCódigo: ${otp}\n\nEl código vence en 60 minutos y solo puede utilizarse una vez. No comparta este código.`,
    html: `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Código de verificación — Ken Code</title></head>
  <body style="margin:0;background:#020617;font-family:Inter,Arial,sans-serif;color:#e5eefc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#0f172a;border:1px solid #263247;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:30px 28px;">
            <p style="margin:0 0 18px;color:#00d9ff;font-size:15px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Ken Code</p>
            <h1 style="margin:0;color:#f8fafc;font-size:28px;line-height:1.2;">Verifique su correo</h1>
            <p style="margin:16px 0;color:#94a3b8;font-size:15px;line-height:1.7;">Ingrese este código temporal en la pantalla de verificación:</p>
            <div style="margin:24px 0;padding:18px;border:1px solid #285a78;border-radius:14px;background:#071323;color:#f8fafc;font-family:monospace;font-size:30px;font-weight:800;letter-spacing:.22em;text-align:center;">${safeOtp}</div>
            <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.7;">El código vence en 60 minutos y solo puede utilizarse una vez. No comparta este código.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
