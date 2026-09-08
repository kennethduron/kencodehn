# Ken Code CRM — checkpoints oficiales de implementación

**Producción:** `https://kencodehn.com`

**Zona horaria:** America/Tegucigalpa

**Fecha de registro:** 8 de septiembre de 2026

Este documento conserva la evidencia de aceptación posterior a la implementación de la auditoría profunda del 7 de septiembre de 2026. Las confirmaciones físicas proceden del Owner y se distinguen de la telemetría técnica registrada por el CRM.

## Checkpoint físico de Push en segundo plano

**Estado oficial:** `PHYSICAL BACKGROUND PUSH QA — PASS`

El Owner confirmó pruebas físicas reales realizadas el 7 de septiembre de 2026 con estos resultados:

| Plataforma o escenario | Resultado |
|---|---|
| Android físico | PASS |
| PWA instalada en Android | PASS |
| Aplicación en segundo plano o cerrada en Android | PASS |
| Pantalla bloqueada en Android | PASS |
| Notificación visible fuera de la aplicación en Android | PASS |
| iPhone físico | PASS |
| PWA instalada desde Home Screen en iPhone | PASS |
| Aplicación en segundo plano o cerrada en iPhone | PASS |
| Pantalla bloqueada en iPhone | PASS |
| Notificación visible fuera de la aplicación en iPhone | PASS |
| Destinatario | Owner |
| Duplicados anormales observados | Ninguno |

La confirmación humana completa la evidencia técnica previa del pipeline de Push: aceptación por el proveedor, procesamiento por el programador, envío a los dispositivos activos del Owner e idempotencia persistente.

No debe crearse otra tarea QA ni enviarse Push o correo adicional únicamente para repetir este checkpoint.

## Checkpoint de tarea programada

**Estado:** PASS

- Tarea controlada: `QA — Recordatorio programado — 2026-09-07`.
- ID: `011c496e-8889-45fd-8094-c4b4b5cea9f1`.
- Responsable exclusivo: Owner.
- Hora programada: 8 de septiembre de 2026, 17:00.
- Primera ejecución natural: 7 de septiembre de 2026, 18:20:00.
- Canales: notificación interna, Push y correo registrados como enviados.
- Deep link: `/admin/tareas`.
- Idempotencia: una fila de recordatorio, un intento, una notificación interna, un correo y un Push por cada uno de los dos dispositivos activos del Owner tras 142 ejecuciones del programador.
- Estado final de la tarea QA: completada por el Owner.
- Tarea legítima observada: procesada naturalmente para el Owner, sin modificación de fecha, responsable o estado.
- Programador: activo cada 5 minutos; 142 ejecuciones exitosas y 0 fallidas en la última comprobación.

## Checkpoints humanos restantes

Estos estados deben actualizarse únicamente con evidencia humana o con una prueba expresamente autorizada para ese propósito:

| Checkpoint | Estado actual |
|---|---|
| Mail real: salida, entrada/respuesta, adjunto y firma externa | Pendiente de consolidar evidencia humana |
| Acceso controlado por username y por email; recuperación de contraseña | Pendiente de consolidar evidencia humana |

## Checkpoint técnico de Mail real

**Estado de salida y entrega:** PASS

- Firma publicada: `Firma QA Kenneth — 2026-09-08`, versión 1.
- Alcance: exclusivamente la identidad `kenneth@kencodehn.com`; no se creó una firma global ni se modificaron firmas de otros usuarios.
- Imagen: logo oficial procesado por Sharp y guardado como WebP en `mail-signature-assets`; 600×600 y 23,996 bytes. La URL pública respondió correctamente fuera del CRM.
- Correo único autorizado: `kenneth@kencodehn.com` → `kencodehn@gmail.com`.
- Asunto: `QA — Ken Code Mail, firma y adjunto — 2026-09-08`.
- Hora de envío: 8 de septiembre de 2026, 07:10:56 America/Tegucigalpa.
- Thread: `ec7e8703-ef0a-4d6b-8b0b-01b2b1a0a048`.
- Mensaje: `97559599-6eeb-4d4f-be35-80ac5c03a3d7`.
- Proveedor: `2ae8b1e4-0072-4134-a649-57c8128151ea`.
- Entrega: `delivered`.
- Adjunto único: `QA-MAIL-CHECKPOINT-2026-09-08.txt`, `text/plain`, 190 bytes; quedó vinculado al mensaje y disponible en Enviados.
- Snapshot de firma: fuente corporativa, versión 1, identidad, HTML y URL del logo conservados en el mensaje.
- Idempotencia: un mensaje con ese asunto, cero borradores QA después del envío y ningún envío adicional.
- Verificación humana pendiente: abrir el correo en `kencodehn@gmail.com`, confirmar visualmente el logo en el cliente externo y responder en el mismo hilo para consolidar la entrada/respuesta.

## Checkpoint técnico de username del Owner

**Estado de configuración:** PASS

- Username aplicado: `kennethduron`.
- Perfil: únicamente el Owner `f2d4ab72-a373-53c3-8b9e-b8cf97174ed2`.
- Preflight: cero conflictos en perfiles, cero reservas históricas activas y cero coincidencias reservadas.
- Estado posterior: canónico `kennethduron`, Owner activo y sin bloqueo.
- Correo de perfil y Auth preservado: `kencodehn@gmail.com`.
- Acceso por contraseña preservado; proveedor `email` y correo verificado.
- Recuperación preparada sobre el correo verificado; no se inició recuperación ni se cambió contraseña.
- El endpoint de login resuelve el username sólo en servidor y devuelve el mismo error genérico sin exponer el correo asociado.
- Checkpoint humano pendiente: username + contraseña, correo + contraseña y recuperación mediante el correo verificado.
