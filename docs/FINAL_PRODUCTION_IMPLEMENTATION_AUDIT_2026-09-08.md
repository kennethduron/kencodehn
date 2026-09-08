# Ken Code CRM — re-auditoría final de implementación

**Fecha:** 8 de septiembre de 2026

**Producción:** `https://kencodehn.com`

**Commit desplegado:** `bbd5945`

**Proyecto Supabase:** `nvtrgrltyzrkljarvwff`

**Estado:** **SOFTWARE IMPLEMENTATION PASS — HUMAN QA PENDING**

Este informe compara la auditoría del 7 de septiembre con el código y la producción actuales. No se creó una segunda tarea QA, no se ejecutó manualmente ningún cron y no se enviaron Push o correos para repetir el checkpoint físico.

## A. P1

1. **Ocho P1 originales:** KC-01 frecuencia de recordatorios; KC-02 bucle de borradores; KC-03 adjuntos invisibles; KC-04 imágenes y marcador de firmas; KC-05 firma corporativa/herencia; KC-06 login por username; KC-07 asignación sin Push/correo; KC-08 aviso foreground insuficiente.
2. **Causas raíz:** cron diario incompatible con ventanas cortas; versión del borrador dentro del efecto; carga de thread sin adjuntos; saneador y modelo de firmas incompletos; ausencia de modelo corporativo versionado; Auth recibía únicamente email; falta de dispatcher multicanal de asignación; handler foreground solo mostraba eventos `system`.
3. **Correcciones:** Supabase Cron cada cinco minutos; fingerprint estable y debounce; adjuntos autorizados en el thread; imágenes seguras y marcador persistente; versiones corporativas y snapshots; username canónico resuelto solo en servidor; outbox idempotente de asignación; toast visible para eventos operativos foreground.
4. **Validación:** 1272 pruebas, E2E local aislado, build, TypeScript, producción autenticada, telemetría de colas y checkpoint físico Owner.
5. **Estado:** los ocho P1 están cerrados en software. KC-04/KC-05 y KC-06 esperan aceptación operativa porque producción aún tiene cero firmas publicadas y cero usernames configurados.

## B. Push

6. **Pipeline de prueba:** usa el pipeline FCM/Web Push real; PASS.
7. **Foreground:** alerta visible en la aplicación y regresión automatizada; PASS.
8. **Background:** confirmación física del Owner; PASS.
9. **PWA cerrada:** Android e iPhone confirmados físicamente; PASS.
10. **Pantalla bloqueada:** Android e iPhone confirmados físicamente; PASS.
11. **Android físico:** PASS oficial.
12. **iPhone físico/Home Screen:** PASS oficial.
13. **Deep links:** worker restringe navegación a `/admin`; tarea validada con `/admin/tareas`; PASS.
14. **Ciclo de token:** `last_seen_at`, expiración, nombre de dispositivo, limpieza a 180 días e invalidación por proveedor; PASS de software. Producción: cuatro dispositivos activos y cero activos obsoletos.

## C. Tareas

15. **Programación:** `*/5 * * * *`, job 3 activo; PASS.
16. **Asignación:** outbox multicanal con evento determinístico; PASS.
17. **Interna:** una notificación para la tarea QA; PASS.
18. **Push:** un envío por cada dispositivo Owner; PASS técnico y físico.
19. **Correo:** un envío aceptado por el proveedor para el Owner; PASS técnico.
20. **Preferencias:** se aplican canal maestro y preferencia de evento; PASS.
21. **Scope:** destinatario exacto por UUID activo; ningún cliente; PASS.

## D. Mail

22. **Inbox:** carga de conversaciones existente y producción accesible; PASS estructural.
23. **Enviados:** destinatario, asunto, fecha y estados Enviado/Entregado visibles; PASS.
24. **Autoguardado:** fingerprint excluye versión del servidor y evita escrituras sin cambios; PASS.
25. **Reducción de escrituras:** antes se observaron 245 actualizaciones en siete días; la regresión prueba cero guardados por cambio exclusivo de versión. Falta una ventana operativa de siete días para una comparación real equivalente.
26. **Adjuntos:** metadata autorizada y enlaces de descarga visibles en el thread; PASS de software.
27. **Salida real:** infraestructura vigente; no se envió correo durante este re-audit; checkpoint humano pendiente.
28. **Entrada real/respuesta:** webhook y threading pasan regresiones; cero mensajes nuevos desde el despliegue; checkpoint humano pendiente.
29. **Threading:** Message-ID, In-Reply-To, References y candidatos acotados; PASS.
30. **Entrega:** estados y webhook sin fallos desde el despliegue; la prueba humana de extremo a extremo posterior al cambio sigue pendiente.

## E. Firmas

31. **Corporativa:** modelo y publicación atómica implementados; PASS de software.
32. **Herencia:** corporativa antes de personal y variables del usuario; PASS.
33. **Por identidad:** firma global o asociada a identidad; PASS.
34. **Carga de imagen:** PNG/JPG/WebP, límite de 500 KB y conversión segura con Sharp; PASS.
35. **Reemplazo:** nueva versión inmutable y asset validado; PASS local.
36. **Eliminación:** logo anulable en versión posterior; PASS de software.
37. **Entrega externa:** URL pública controlada y saneada; pendiente de comprobar en un correo real Owner-controlado.
38. **Snapshot:** `signature_snapshot` conserva selección, versión, HTML y logo; PASS.
39. **Reply/forward:** elimina firmas del bloque citado e inserta una firma antes del historial; PASS.
40. **Permisos:** publicación corporativa solo Owner; firma personal para usuario Mail; PASS.

## F. Plantillas

41. **Corporativas:** publicación versionada implementada; PASS de software.
42. **Bloqueadas:** `locked=true`, contenido publicado para uso sin edición de marca; PASS.
43. **Variables:** cliente, negocio, vendedor, proyecto, propuesta y módulo; PASS. Adjuntos de plantilla e imágenes editables siguen fuera del alcance implementado.
44. **Owner:** crea y publica; PASS.
45. **Manager:** ya no posee `mail:manage_templates`; PASS.
46. **Sales:** puede usar plantillas publicadas mediante `mail:use`; PASS.

## G. Username

47. **Modelo:** `username`, canónico e historial reservado; PASS.
48. **Asignación:** UI de Equipo y RPC Owner; PASS de software.
49. **Normalización:** trim y minúsculas; PASS.
50. **Unicidad:** índice único canónico y prueba concurrente local; PASS.
51. **Login por email:** se conserva; pendiente de ejecutar junto con el mismo usuario controlado.
52. **Login por username:** resolución únicamente server-side; PASS local, checkpoint humano de producción pendiente.
53. **Error genérico:** no revela si existe el email o username; PASS.
54. **Enumeración:** retardo mínimo y registro acotado de intentos; PASS.
55. **Invitación:** puede comunicar username sin incluir contraseña; PASS de software.
56. **Recuperación:** sigue basada en el correo de Auth; PASS estructural, checkpoint humano pendiente.
57. **Inactivo:** sesión y resolución de username cierran acceso; PASS.
58. **Reutilización:** historial reserva nombres anteriores por 180 días; PASS.

## H. Equipo

59. **Nunca usado:** elegibilidad se determina por historial real, no solo por rol; PASS.
60. **Invitación pendiente:** puede revocarse y queda inválida; PASS de software.
61. **Eliminar:** botón definitivo solo aparece cuando la preevaluación permite la acción; observado en producción; PASS.
62. **Desactivar:** preserva historial para usuarios con actividad; PASS.
63. **Preservación:** FKs y flujo de desactivación conservan autoría/asignaciones; PASS.

## I. Leads

64. **Eliminar vacío:** flujo seguro disponible tras evaluación; PASS.
65. **Archivar con historia:** usa estado perdido/archivo y conserva actividad; PASS.
66. **Convertido:** se preserva; PASS.
67. **Lead público:** persistencia idempotente, canales secundarios y deep link exacto; PASS. No se envió un formulario real durante el re-audit.

## J. Rendimiento

68. **Antes/después:** medianas actuales frente a la muestra anterior: Seguridad 1526→782 ms; Cliente 1353→607; Proyecto 1101→629; Perfil 995→711; Mail 964→642; Configuración 947→613; Cobros 941→761; Módulos 867→617; Clientes 814→705; Reportes 793→738.
69. **Cantidad de solicitudes:** bootstrap y consultas de Equipo/Mail reducidos; los logs visibles mostraron solo respuestas 200. Falta telemetría persistente por navegación para comparación histórica exacta.
70. **Duplicados:** outbox y recordatorios demostraron idempotencia; badge y foreground mantienen refresco explícito, sin tormenta observada.
71. **Consultas:** conteos de Equipo agregados y bootstrap de Mail paralelo; PASS parcial.
72. **Navegación:** loading granular añadido a Mail, Equipo, Seguridad, Cliente y Proyecto; PASS parcial porque no todas las rutas tienen segmento propio.
73. **Mail:** consultas de configuración paralelas y autoguardado corregido; PASS.
74. **Dashboard:** conserva carga paralela; mediana observada 837 ms, sin una línea base individual exacta comparable.
75. **Respuesta percibida:** toast global, estados de carga y retorno de foco cubiertos; PASS.

## K. Lenguaje

76. **Términos técnicos:** no aparecen en los recorridos ordinarios auditados; PASS.
77. **Español:** etiquetas visibles corregidas, incluido «Agente de ventas»; PASS con revisión editorial continua recomendada para plantillas.
78. **Errores:** rutas modificadas devuelven mensajes de negocio y ocultan errores del proveedor; PASS.

## L. Responsive

79. **320–2560:** pruebas estructurales y matrices previas cubren el rango; la repetición actual de contacto cubrió 14 anchos hasta 1920 y pasó en tres motores.
80. **Teléfono horizontal:** 568×320 y 844×390 en auth; 844×390 en contacto; PASS.
81. **Tablet:** 768/820/834/1024/1180/1194 cubiertos según matriz; PASS.
82. **Chromium:** auth, recuperación, invitación, contacto y worker; PASS.
83. **WebKit:** auth, recuperación, invitación, contacto y worker; PASS.
84. **Firefox:** auth, recuperación, invitación, contacto y worker; PASS.

## M. Seguridad

85. **RLS:** cero tablas públicas sin RLS y cero sin `FORCE ROW LEVEL SECURITY`; PASS.
86. **Autorización server-side:** Owner, Admin, Manager, Sales, Viewer e Inactive cubiertos; PASS.
87. **Ataques a username:** caso, reservados, ambigüedad, duplicados y enumeración; PASS.
88. **Cross-user:** tareas, notificaciones, Leads y preferencias aisladas; PASS.
89. **Cross-Mail:** identidad, adjuntos, threads y outbox con alcance/autorización; PASS.
90. **Inactivo:** sin sesión, asignación o entregas; PASS.

## N. Pruebas

91. **Baseline anterior:** 1257 pruebas.
92. **Nuevas regresiones:** 15 adicionales para los hallazgos de auditoría.
93. **Total actual:** 1272/1272 PASS.
94. **RLS E2E:** cobertura por rol existente; E2E específico nuevo corrió solo contra loopback y pasó.
95. **TypeScript:** `tsc --noEmit` PASS.
96. **Check:** `npm run check` PASS.
97. **Build:** Next.js 16.3.3, compilación y 86 páginas PASS.
98. **Audit:** ocho avisos moderados transitivos bajo Firebase Admin; la única corrección completa sugerida por npm implica cambio incompatible. No se ejecutó `--force`.
99. **Diff check:** PASS.

## O. Despliegue

100. **Migraciones:** `20260907000100`, `20260907000200`, `20260907000300`; presentes 3/3.
101. **Dry-run:** realizado antes del push oficial contra el proyecto exacto.
102. **Push SQL:** realizado y verificado en `nvtrgrltyzrkljarvwff`.
103. **Commits:** grupos separados para notificaciones, Mail, username y activación segura.
104. **Git final:** `origin/main` y `origin/m3-supabase-preview` apuntan al código desplegado `bbd5945`; este re-audit y el registro de checkpoints se conservan en el commit documental posterior. La auditoría fuente y sus evidencias permanecen locales sin seguimiento.
105. **Vercel:** despliegue Production `bbd5945` Ready.
106. **Logs:** muestra visible de 50 solicitudes recientes, todas 200; cero 4xx/5xx en esa muestra.
107. **Registros financieros alterados inesperadamente:** 0; no se ejecutaron mutaciones financieras.
108. **Correos inesperados a clientes:** 0.
109. **Push inesperados:** 0; no se repitió la prueba física.
110. **Cron de billing manual:** NO. Salud natural de siete días: 7 generaciones y 671 entregas exitosas, 4 mensajes enviados, 0 fallos; media 98 ms y 1231 ms respectivamente.

## P. Re-auditoría

111. **P0 original:** 0.
112. **P0 restante:** 0. Integridad: cero balances negativos, cero cobros cancelados con monto pagado y cero recordatorios pendientes para cobros cancelados.
113. **P1 original:** 8.
114. **P1 restante:** 0 en software; aceptación operativa de Mail/firmas y username aún pendiente.
115. **P2 restante:** telemetría Push recibido/abierto, Server-Timing/trazas por ruta, cobertura completa de loading granular, adjuntos/imágenes gobernados en plantillas y equivalencia de la preferencia Push de billing para personal.
116. **P3 restante:** revisión editorial continua de textos internos de email y prefijos interoperables de asunto; no bloquea operación.

## Checkpoints que faltan para el estado final

- **Mail real:** publicar/configurar una firma controlada y validar salida, entrada/respuesta, adjunto e imagen externa con un buzón del Owner.
- **Username:** asignar un username a una cuenta controlada y validar username+contraseña, email+contraseña y recuperación.

Hasta recibir esas dos evidencias humanas, el estado oficial permanece:

**SOFTWARE IMPLEMENTATION PASS — HUMAN QA PENDING**
