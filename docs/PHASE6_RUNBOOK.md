# Runbook interno de operación y recuperación

Este documento cubre la operación actual de Ken Code CRM. Supabase es la fuente de verdad para Auth y datos; Firebase se conserva como referencia histórica y para Firebase Cloud Messaging (FCM).

## Despliegue

1. Confirmar que el repositorio está limpio y que el target enlazado es `Ken Code / kencodehn / nvtrgrltyzrkljarvwff`.
2. Ejecutar pruebas, TypeScript, `npm run check`, build, auditoría de dependencias y `git diff --check`.
3. Para migraciones: ejecutar primero un reset únicamente local, luego `supabase migration list` y `supabase db push --dry-run`.
4. Ejecutar `supabase db push` solo cuando el dry-run enumere exclusivamente las migraciones esperadas.
5. Publicar `main`, esperar que Vercel marque Production como READY y ejecutar el smoke final contra `https://kencodehn.com`.

Nunca ejecutar `supabase db reset --linked`, incluir seeds en Production ni aplicar SQL manual para evadir el historial de migraciones.

## Backup y restauración

El backup certificado contiene los esquemas `public` y `private`, datos de negocio y los binarios de Storage privado enumerados en su manifiesto. No incluye Auth, Vault, tokens de dispositivo ni secretos. SQL y objetos privados viajan dentro del mismo paquete cifrado con AES-256-GCM; el manifiesto externo conserva solamente rutas relativas, tamaños y checksums. La clave aleatoria queda protegida por Windows DPAPI para el usuario que lo creó.

Procedimiento:

1. Obtener schema/data mediante el mecanismo oficial de Supabase, exportar temporalmente cada objeto privado y crear el manifiesto de los buckets con ruta relativa, tamaño, SHA-256 y `export_file` acotado al staging.
2. Ejecutar `scripts/phase6-create-backup.mjs` fuera de Git.
3. Conservar juntos `.kcbackup`, `.key.dpapi`, `manifest.json` y `storage-manifest.json` en almacenamiento privado con control de acceso.
4. Verificar SHA-256 y descifrar con `scripts/phase6-restore-backup.mjs` en un entorno aislado.
5. Restaurar primero esquema, luego datos, con constraints activas; restaurar los objetos recuperados bajo `storage/<bucket>/...`, ejecutar `scripts/phase6-validate-restore.sql` y reconciliar conteos/finanzas/correo.

Nunca restaurar sobre Production. El staging de SQL y objetos sin cifrar debe eliminarse después de crear y comprobar el paquete; restaurar cada objeto en su ruta original solamente dentro del procedimiento aprobado.

Capacidad actual: la recuperación fue ensayada localmente. El tiempo real dependerá del acceso a Supabase/Vercel/Resend, del volumen y de la disponibilidad del operador; no existe un RTO/RPO contractual medido. Crear un backup antes y después de cambios de Production reduce la pérdida potencial, pero la frecuencia operativa debe definirse y calendarizarse externamente.

## Ken Code Mail y Resend

- El dominio y Receiving se administran en Resend; el endpoint canónico es `/api/webhooks/resend`.
- El webhook debe estar habilitado una sola vez para recepción y estados de envío soportados.
- La firma Svix, la deduplicación por evento y el hash del payload son obligatorios.
- Una identidad debe estar activa, asignada a un usuario activo y ser primaria cuando corresponda.
- Los mensajes y auditorías se preservan al archivar, mover a papelera, desactivar un empleado o reasignar una identidad.
- Un 401 indica firma inválida; un 503, configuración ausente; un 500 debe revisarse por `stage` y categoría segura, nunca por el cuerpo del correo.
- Ante un envío dudoso, reintentar con el mismo request ID. No crear otro envío hasta verificar el estado del primero.

## Scheduler

Los schedules versionados son generación recurrente `10 7 * * *` y recordatorios `*/15 * * * *`. La ejecución natural usa Supabase Cron/Vault. No ejecutar manualmente en Production para una prueba. Revisar `billing_job_runs`, errores categorizados, enviados/omitidos y deduplicación.

## Rollback

1. Registrar commit y deployment estable anterior antes de publicar.
2. Si el código falla pero la migración es compatible, promover el deployment estable anterior.
3. Las migraciones se corrigen con una nueva migración forward-only; no borrar historial ni resetear la base enlazada.
4. Si hay corrupción de datos, detener escrituras, preservar evidencia, crear snapshot y restaurar únicamente en un entorno aislado hasta aprobar el plan de recuperación.
5. No volver a Firebase Auth/Firestore sin una decisión explícita y una reconciliación de datos; Firebase histórico no es una réplica activa.

## Fallos comunes

- Login: validar Site URL, redirects, usuario activo/confirmado y rol, sin manipular confirmación administrativa.
- Finanzas: revisar código RPC y autorización; no corregir saldos editando filas.
- Mail inbound: validar dominio/MX, permiso Receiving de la API key, firma, identidad activa y evento deduplicado.
- Adjuntos: validar bucket privado, MIME/tamaño, ruta autorizada y referencia en DB.
- Reportes/exports: registrar solo categoría/operación; no PII ni contenido financiero detallado en logs.
