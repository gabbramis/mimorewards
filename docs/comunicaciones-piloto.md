# Comunicaciones: piloto de cercanía Wallet

## Alcance de esta entrega

- Comunicaciones en el panel interno y, cuando se habilita, en el panel del negocio.
- Resumen, Geolocalización, Historial de sincronización y Configuración disponibles. Campañas y Automatizaciones muestran su estado pendiente sin acciones de envío.
- Hasta 10 ubicaciones por negocio, con coordenadas, dirección/referencia, estado y texto de relevancia Apple.
- Todas las tarjetas del negocio comparten las ubicaciones activas. Esta fase no asigna tarjetas ni usuarios a sucursales independientes.
- `locations` / `relevantText` para Apple y `merchantLocations` a nivel de clase Google. Sin geofencing propio, radios configurables ni garantías de visualización.
- Guardado transaccional con revisión para evitar sobrescribir cambios de otra persona.
- Cola persistente exclusiva de sincronización de ubicaciones, con lotes de 10, leases, tres intentos y espera exponencial. No es todavía un motor de campañas ni una cola de actualización de sellos.

## Seguridad y compatibilidad

Solo `profiles.role = superadmin` puede habilitar/deshabilitar el piloto. Los miembros `merchant` del negocio pueden configurar sus ubicaciones una vez habilitado. Los usuarios `staff` quedan sin acceso al módulo hasta implementar permisos por sucursal; no se les concede acceso a otras sucursales implícitamente.

Las tablas nuevas tienen RLS. Los clientes autenticados no escriben directamente en ubicaciones, no ejecutan las funciones de guardado/procesamiento y no leen la cola que contiene tokens privados. El servidor verifica sesión, pertenencia y capacidad antes de usar `service_role`.

El piloto está desactivado por defecto. Sin la migración 020, las tarjetas existentes siguen funcionando sin ubicaciones y el módulo informa que requiere instalación. Un error transitorio de lectura no se interpreta como una orden de borrar ubicaciones en el proveedor.

Se bloquean los POST promocionales antiguos y su servicio de difusión. Las promociones activas previamente guardadas conservan su efecto sobre los sellos hasta su vencimiento o cancelación; esta migración no modifica sus multiplicadores. Los mensajes promocionales ya guardados en Google no se borran automáticamente. Apple deja de incluir el campo promocional `changeMessage`. La actualización de saldo Google hace PATCH sin agregar un mensaje por cada sello.

Los endpoints de generación de muestras requieren superadmin; el endpoint de simulación de saldo devuelve 410. La emisión Google del cliente verifica su sesión de tarjeta y el negocio activo. El servicio legacy de actualización Apple reutiliza el handler autenticado actual. Los nombres de certificados documentados se aceptan también en el cargador real.

## Instalación y prueba piloto

1. Antes de aplicar: confirmar en el proyecto Supabase correcto las migraciones 004, 013 y 016 y las tablas `businesses`, `business_members`, `profiles`, `loyalty_cards`, `wallet_registrations` y `wallet_devices`. Los scripts del repositorio no demuestran qué está aplicado remotamente.
2. Revisar/aplicar `database_migrations/020_wallet_locations_pilot.sql`. No contiene datos de clientes ni activa negocios existentes. No se aplica automáticamente al compilar o abrir el panel.
3. Configurar las credenciales Wallet solo en el servidor. Nunca pegarlas en el frontend o en el chat.
4. Entrar como superadmin en `/admin/comunicaciones`, seleccionar Coffe Dreams (slug `coffe-dreams`) y usar **Usar coordenadas del piloto**. Precarga `-34.9056557, -56.1706692` como borrador desactivado, con una referencia GPS; reemplazarla por la dirección postal si se desea. No crea filas ni activa nada automáticamente.
5. Activar la ubicación y el piloto, guardar. Se encola la sincronización incluso si no hay credenciales disponibles. Ver el estado en Historial; una configuración ausente nunca se presenta como envío aceptado.
6. Para el piloto se puede ejecutar **Procesar próximo lote** desde Historial. Guardar nuevamente tras corregir un problema crea una revisión nueva; los trabajos antiguos que aún no se enviaron se omiten al detectar la revisión más reciente.
7. Para procesamiento continuo, conectar n8n u otro planificador a `POST /api/internal/wallet-locations/process` cada minuto, autenticado con `x-mimo-automation-key: <MIMO_AUTOMATION_SECRET>`. Cada llamada procesa como máximo 10 trabajos. El endpoint no crea un cron por sí mismo. El primer lote se intenta con `after()` al guardar; los siguientes lotes y reintentos necesitan el planificador o la acción manual.
8. Instalar las tarjetas reales en iPhone y Android. Cambiar una ubicación, verificar su presencia en los datos del pase/clase y su actualización sin reinstalar. Probar también desactivar la ubicación y luego todo el piloto.
9. Probar sellado NFC, sellado manual y canje por los caminos existentes. La consistencia entre esas operaciones, recompensas acumuladas y su cola durable sigue siendo una entrega posterior, no se da por resuelta aquí.

La configuración de proveedor presente no verifica firma válida, certificado vigente, permisos de emisor Google, instalación o funcionamiento de APNs. APNs y Google deben validarse desde el entorno publicado y en dispositivos reales.

Los pases Apple usan como servicio el origen HTTPS real desde el que se descargan, más `/api/apple-wallet`, para evitar depender de una URL de marketing o del dominio sin `www` que redirige. Si se requiere un servicio fijo, configurar `APPLE_WALLET_WEB_SERVICE_URL` con una URL HTTPS pública completa sin `/v1` ni redirecciones. Los pases que ya se instalaron conservan su URL anterior hasta recibir una versión nueva: después de desplegar esta corrección, volver a agregarlos/actualizarlos desde Safari antes de probar sellos. El trabajo de actualización por sellos, canjes y altas usa `after()` para completar las llamadas al proveedor después de responder; sigue sin ser una cola durable de sellos.

Si Wallet no cambia el saldo, verificar primero que el iPhone figure en `wallet_registrations` para el negocio. Los logs del servidor etiquetados `[Apple Wallet Registration]` distinguen registro aceptado, autenticación rechazada y error de almacenamiento sin imprimir el token del dispositivo ni la credencial del pase. Un contador de registros en cero impide dar por validada la actualización automática.

Durante el piloto se verificaron dos registros Apple, respuesta 200 de APNs a una actualización vacía y respuesta 200 del listado de pases modificados. Los logs publicados de iOS mostraron intentos de descarga desde `https://mimorewards.com/api/apple-wallet` con `Authentication failure`. Ese host redirige a `www`. El resolvedor normaliza ambos dominios de producción a `www`, incluso si el servidor recibe internamente el host sin `www`. Los errores de descarga distinguen ahora cabecera de autorización ausente y credencial inválida sin registrar su valor. Las solicitudes APNs de tipo background usan prioridad 5, según la documentación del proveedor.

Si el pase instalado sigue conservando la URL vieja, después de publicar la corrección retirar únicamente ese pase de prueba de Wallet y agregar de nuevo la tarjeta existente desde Safari, sin crear otro cliente. Esto no borra los sellos guardados en Supabase. Verificar el número de serie/código de la tarjeta exacta y su registro, ya que puede haber varias tarjetas de prueba. No dar por resuelta la entrega hasta observar la actualización de saldo en ese dispositivo sin reinstalar.

Al identificar la tarjeta de prueba exacta, el usuario confirmó que recibió la actualización directa desde APNs. Los errores anteriores de autenticación correspondían a otros números de serie; no atribuirlos automáticamente a todas las tarjetas del negocio. El procesamiento posterior a un sello registra `[Wallet Customer Update]` con cantidades aceptadas/fallidas de Apple y estados de Google, sin tokens ni datos personales. Las tarjetas exclusivamente Apple sin identificador Google no realizan solicitudes a Google; un error de credenciales Google no debe confundirse con el resultado de Apple.

Verificación de solo lectura del entorno conectado (27 de octubre de 2026): se encontró el negocio activo **Coffe & Dreams**, slug `coffe-dreams`, ID `918af233-f7fd-445f-8de0-d3fcab60c1f4`. Después de que el usuario aplicó la migración, se confirmó la disponibilidad de las columnas de habilitación, las tablas y la función de resumen de la migración 020. El agente no aplicó cambios remotos. Esta comprobación no reemplaza la prueba funcional de guardado y sincronización publicada.

## Prueba sin NFC físico

El cliente puede abrir `https://www.mimorewards.com/t/coffe-dreams` en su teléfono, registrarse o recuperar su tarjeta y agregarla a Apple/Google Wallet. El NFC físico solo abre una URL: no es necesario para probar instalación o relevancia por ubicación. Para probar cercanía, la tarjeta debe estar instalada en Wallet y el teléfono debe estar cerca de las coordenadas configuradas, con los permisos correspondientes; abrir la página por sí solo no activa un aviso.

Para probar un nuevo sello, usar el sellado autorizado del panel o generar el link de prueba del cliente desde `/admin/contactos`. Este último usa el recorrido de NFC por URL, vence en 10 minutos y mantiene la espera de 180 minutos entre sellos NFC/QR. Recargar `/t/coffe-dreams` no equivale por sí solo a registrar una nueva visita.

## Estados observables

Historial resume la última revisión: pendientes, procesando, aceptadas por proveedor, fallidas y omitidas. Un trabajo Apple equivale a token + tipo de pase, y un trabajo Google equivale al PATCH de una clase; **no son cantidades de clientes alcanzados**. No se muestran aperturas ni entregas efectivas. La vista de errores recibe códigos acotados y no tokens ni respuestas con credenciales.

Los reintentos repiten operaciones idempotentes: PATCH de la configuración actual o push vacío de actualización. No envían `TEXT_AND_NOTIFY`. Una solicitud aceptada no confirma que el dispositivo descargó o visualizó el pase. Si se agotan tres intentos, el trabajo queda fallido hasta guardar una nueva revisión después de corregir el problema.

## Verificación local sin producción

Con Node 22.17 o superior:

```powershell
npm run test:wallet
```

Para ejecutar la migración y los permisos en PostgreSQL temporal en memoria (sin `.env`, sin Supabase y sin nuevas dependencias de producción):

```powershell
npm install --prefix .tmp/wallet-validation --cache .npm-cache --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.12
npm run test:wallet-db
```

Se prueban validación de coordenadas/límites, permisos, aislamiento entre negocios, transacciones, conflictos de revisión, deduplicación, lotes, leases y fin de reintentos. También se genera un pase Apple firmado con material efímero de prueba para inspeccionar su `pass.json`, y se verifican los payloads Google con una API simulada. Esto no contacta proveedores ni demuestra la confianza del certificado de producción. La prueba de base crea un esquema mínimo equivalente a las tablas usadas por la migración, no certifica el esquema remoto completo.

Para comprobar el editor en un navegador real (después de compilar), con respuestas de API simuladas y sin usar producción:

```powershell
npm install --prefix .tmp/wallet-validation --cache .npm-cache --no-package-lock --ignore-scripts esbuild@0.28.2 @playwright/test@1.64.1
$env:PLAYWRIGHT_EXECUTABLE_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:wallet-ui
```

La prueba usa el componente real con navegación mediante enlaces simples en el entorno aislado, verifica guardado y ausencia de acciones de envío, y genera capturas de escritorio/celular en `.tmp/communications-*.png`. El resto del panel y la autenticación publicada requieren la prueba integrada del piloto.

Antes del despliegue: `npm run build`. Las guías de Next correspondientes están en `node_modules/next/dist/docs/`.

## Restricciones oficiales

- Apple: https://developer.apple.com/documentation/walletpasses/showing-a-pass-on-the-lock-screen
- Apple: https://developer.apple.com/design/human-interface-guidelines/wallet/
- Google: https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications

La relevancia Apple se prueba en hardware real. Google requiere permisos de ubicación y notificaciones adecuados y decide el texto y momento. Las campañas promocionales quedan para la siguiente etapa con consentimiento por canal/finalidad, destinatarios individuales, bajas y cuotas por tarjeta.
