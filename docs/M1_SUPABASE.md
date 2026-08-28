# Fase M1: fundación Supabase

M1 prepara Supabase sin cambiar el proveedor activo de producción. Firebase Auth, Firestore y FCM continúan activos; no existe dual-write y el valor por defecto de `CRM_DATA_PROVIDER` es `firebase`.

## Proyecto de destino

- Organización: Ken Code
- Proyecto: kencodehn
- Región: `us-east-2`
- Project ref: `nvtr…vwff` (el valor completo solo se guarda en la configuración local ignorada del CLI después del enlace)
- GitHub integration de Supabase: deliberadamente no conectada en M1

## Inventario Firebase focalizado

| Servicio | Archivos principales | Uso actual | Destino posterior |
| --- | --- | --- | --- |
| Firebase Auth Web | `src/lib/firebase/client.ts`, `src/components/admin/admin-login.tsx` | Login email/password y token ID | Supabase Auth en un cutover posterior |
| Firebase Admin Auth | `src/lib/firebase/admin.ts`, `src/lib/admin/auth.ts`, `src/lib/admin/users.ts` | Cookies administrativas, perfiles, invitaciones | Supabase Auth + `profiles` |
| Firestore Admin | `src/lib/admin/data.ts`, `users.ts`, `settings.ts`, `reminders.ts`, `cleanup.ts` | Datos CRM y automatizaciones | Tablas PostgreSQL versionadas |
| Firestore logs | `src/lib/email/service.ts`, `src/lib/push/service.ts` | Logs de entrega | `email_logs`, `push_logs` |
| FCM Admin | `src/lib/firebase/admin.ts`, `src/lib/push/service.ts` | Envío Web Push | Se mantiene temporalmente |
| FCM Web | `src/components/admin/push-settings.tsx`, `src/app/firebase-messaging-sw.js/route.ts` | Registro de token y service worker | Se mantiene temporalmente |

Variables Firebase que siguen vigentes: `FIREBASE_SERVICE_ACCOUNT_KEY` o sus componentes server-side; `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`; y para FCM, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` y `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

## Colecciones y equivalencias

| Firestore | Campos/relaciones relevantes | PostgreSQL |
| --- | --- | --- |
| `adminUsers` | UID, email, nombre, rol, active, invitación, last login | `profiles` + `auth.users` |
| `leads` | identidad, pipeline, valores, billing legacy, follow-up, assignment, tags, `crm` legacy | `leads` |
| `notes` | `leadId`, texto, autor UID/email, fecha | `lead_notes` con FK |
| `tasks` | lead opcional, assignee/creator/completer, status/type/priority, due/reminder markers | `tasks` |
| `notifications` | recipient opcional (legacy global), lead/task, read/deleted | `notifications` |
| `activityLogs` | entidad, lead/task/note, actor/recipient, before/after | `activity_logs` append-oriented |
| `emailLogs` | tipo, recipient, provider IDs, relaciones, idempotency | `email_logs` |
| `pushLogs` | token, resultado, relaciones, idempotency | `push_logs` |
| `deviceTokens` | UID, FCM token, platform/user agent, active | `device_tokens` |
| `adminSettings` | flags tipados de notificación/reminders/UI | `admin_settings` singleton |
| `reminderEvents` | deterministic ID, lease, retry, channel states, attempts | `reminder_events` |

Los timestamps Firestore pueden ser ISO, `Timestamp` o `Date`. M2 debe convertir instantes a `TIMESTAMPTZ`. Fechas civiles como `billing_start_date` y el día local de una tarea usan `DATE`, manteniendo `America/Tegucigalpa` como zona de negocio.

## Decisiones de datos

- IDs de negocio: UUID determinístico derivado de colección + Firebase ID; cada tabla conserva además `firebase_id UNIQUE`.
- Usuarios: `profiles.id` siempre es el UUID real de `auth.users`; `firebase_uid UNIQUE` sirve para traducción, nunca se fuerza a UUID.
- Dinero: enteros `BIGINT` en unidades menores y `currency` ISO 4217 de tres letras. M1 usa USD como fallback documentado para los datos actuales sin moneda explícita.
- Integridad: enums/checks, FKs `RESTRICT` para no borrar trazabilidad, y `migration_id_map` para reanudación, checksum e idempotencia.
- Settings: tabla singleton tipada, no un key/value arbitrario.

## RLS

Todas las tablas públicas sensibles tienen RLS `ENABLE` y `FORCE`. Los helpers `SECURITY DEFINER` usan `search_path = pg_catalog` y referencias totalmente calificadas.

- Owner/Admin: operaciones globales donde corresponden; la gestión funcional reservada sigue siendo server-side.
- Manager: lectura y edición global de leads; el trigger de assignment impide que cambie ownership directamente.
- Viewer: lectura global de leads.
- Sales Agent: solo leads asignados, notas de esos leads, tasks propias cuyo lead también le pertenece, notificaciones propias y activity dentro de su scope.
- Notifications legacy sin recipient: únicamente Owner/Admin.
- Profiles: cliente autenticado solo puede leer su propio perfil; Owner puede leer todos. No existe policy ni grant de actualización cliente para `role`, `active`, UID o metadata administrativa.
- Logs y `migration_id_map`: sin escritura cliente. `activity_logs` no concede update/delete.

## Auth y correo futuro

Se preparan clientes browser, SSR y admin, pero ningún flujo activo los usa. Las redirects se reducen a orígenes Ken Code y paths `/admin`, evitando open redirects. En una fase posterior, Supabase Auth usará Custom SMTP con Resend y marca **Ken Code** para invitation, recovery, confirmation, magic link, email change y security notifications. M1 no configura SMTP ni envía mensajes.

La migración de Auth debe ocurrir antes que ownership de datos: exportar usuarios Firebase con `email_verified`, `disabled`, `display_name`, hashes y parámetros de hash mediante herramientas oficiales; importar mediante el mecanismo soportado por Supabase; verificar cada UUID de `auth.users`; entonces construir `firebase_uid -> profiles.id`. M1 no exporta hashes ni usuarios.

## Tooling M2

`npm run migrate:supabase` no abre conexiones y termina en dry-run informativo. `--source-read` habilita solo una lectura Firestore acotada y no imprime PII. Aun con `--write`, M1 bloquea escrituras deliberadamente después de validar dos confirmaciones explícitas. El writer real debe implementarse y revisarse en M2 después de migrar Auth.

El orden recomendado para M2 es: inventario final read-only; export Auth cifrado y controlado; importar Auth; validar mapping; dry-run Firestore; resolver referencias faltantes; aplicar lotes idempotentes por FK; comparar conteos/checksums; shadow reads; plan de rollback; y solo después evaluar cutover. Legacy RTDB `conversations`/`followups` queda fuera de M1.

