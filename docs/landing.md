# Landing mimo rewards

La página pública está en `src/app/page.tsx`. Los componentes reutilizables están en `src/components/landing/` y los estilos están limitados a `.m-landing` en `src/app/landing.css` para no modificar los paneles existentes.

El proyecto usa TypeScript con `tsconfig.json`; las páginas y componentes usan `.ts`/`.tsx`, las rutas API usan `.ts` y `jsconfig.json` ya no se utiliza.

## Story del cliente

`IntroScrollStory.tsx` presenta el programa de sellos con NFC, la tarjeta digital y la transición roja hacia el resto de la landing. Reutiliza `LoyaltyCard.tsx` y el wordmark existente; `PhoneWallet.tsx` y `MimoGraphicElements.tsx` completan la composición. Los estilos están en `src/app/intro-story.css`. La escena de Wallet es ilustrativa: la disponibilidad de los pases se confirma para el lanzamiento.

En mobile el teléfono ocupa hasta 39vw y entra desde abajo a la derecha. La tarjeta se acopla después de aproximadamente 1,3 pantallas de scroll mediante un único progreso normalizado. Con `prefers-reduced-motion`, hero y Wallet se muestran de forma estática. El ancla `#como-funciona` abre el estado final; `#nfc` se conserva como compatibilidad.

La composición mantiene el crema de marca, con corazones grandes recortados en los bordes y parallax sutil. “Siempre con ellos.” incluye una explicación breve. Durante la salida, tarjeta y teléfono se retiran mientras se expande una forma roja; “Hacé que vuelvan.” aparece antes de que el rojo cubra el viewport, enlazando con el contenido para comercios sin una pantalla vacía.

Después de la story, `ValueStory.tsx` explica la oferta en tres filas editoriales: programa configurado para el comercio, sellos y utilidad de los datos. Siguen el recorrido del cliente, las recompensas, el panel ilustrativo, los mensajes, la caja mimo, los tres planes de lanzamiento, la invitación a demo y las FAQ.

## Planes de lanzamiento

`plans.ts` centraliza la oferta pública que usan `PlansStory.tsx`, las FAQ y el diálogo de términos. Precios en pesos uruguayos (UYU):

- Inicial: $0/mes, 50 clientes activos, QR en PDF sin hardware y diseño básico con logo, color y sellos estándar.
- Profesional: $990/mes, hasta 500 clientes activos, kit de $1.290 por única vez con tótem de acrílico QR/NFC NTAG. Diseño completo de Wallet, sellos propios, sin marca de mimo y métricas.
- Premium: $1.990/mes, clientes activos ilimitados, kit de $1.490 por única vez con tótem personalizado y llaveros NTAG. Suma push, automatizaciones y CRM. Las solicitudes de reseñas de Google Maps están señaladas como próximas, ya que el módulo no está implementado.

La presentación conserva crema, rojo, tipografías y botones de Mimo; Profesional es el destacado. En móvil los planes se apilan. `#planes` es el destino principal y `#precio` se conserva dentro de la sección. Cada CTA lleva a `#acceso` y recuerda el plan elegido; no crea cuentas ni suscripciones automáticamente.

Estos cambios corresponden a la landing: no implementan cobros ni límites de clientes en el producto. Antes de activar la oferta, definir la ventana de “cliente activo” y aplicar permisos y cupos por plan. El criterio propuesto al superar el cupo es impedir nuevas altas, conservando las tarjetas existentes.

## Demo y contacto

Los CTA llevan al formulario compacto `#acceso`: nombre, negocio y WhatsApp. No hay campo de código, cuenta, correo del visitante ni base de datos de consultas. El plan elegido viaja como dato interno. Al enviar, la persona acepta que el equipo responda por WhatsApp; el aviso de privacidad está al lado del botón.

`POST /api/landing-leads` valida y normaliza los datos, verifica origen, tamaño y campo trampa y limita reenvíos por teléfono durante un minuto en memoria, y envía directamente a `contactomimorewards@gmail.com` mediante Nodemailer/SMTP, siguiendo el mecanismo de Gaia. No usa Supabase ni necesita una migración. El formulario confirma solo cuando el servidor de correo acepta el mensaje; ante un error conserva los campos para reintentar.

La configuración privada está en `MAIL_HOST`, `MAIL_PORT` (587 por defecto), `MAIL_USER`, `MAIL_PASS` y `MAIL_TO` (correo de Mimo por defecto). Se reutiliza el remitente SMTP de Gaia con nombre visible “mimo rewards”. Se verifica TLS y no se muestran credenciales ni datos de consultas en logs. Para el despliegue se requieren estas mismas variables en el servidor.

Configurar `NEXT_PUBLIC_MIMO_SITE_URL` con el dominio público final para que los metadatos sociales usen la URL correcta. El valor local por defecto es `http://localhost:3000`.

## Experiencias de demostración

- La animación de recompensas llena los sellos y rota ejemplos como café, helado y merienda. Los premios reales los define cada comercio.
- Apple Wallet / Google Wallet cambian la vista previa. No emiten pases reales.
- Los siete filtros de segmentación operan sobre una lista local de clientes ficticios.
- Las métricas del panel y los mensajes son ejemplos explícitos. No leen ni modifican datos de Supabase.
- Los accesos a `/caja` y `/login` se mantienen en el menú móvil y el pie.
- Los avisos de privacidad y términos describen la etapa de lanzamiento, los tres planes, los kits separados y las consultas mediante formulario y WhatsApp.

## Entrada NFC

El soporte usa `/api/tap?tag=...`. Si el cliente todavía no está registrado, el flujo lo lleva a `/t/[nfcId]`, donde ve el alta de nombre, apellido, celular y fecha de nacimiento. `POST /api/customers` crea la tarjeta y acredita el primer sello. Si ya tiene una sesión válida, `/api/tap` agrega un sello automáticamente con un límite de tres horas entre toques. La compra no se verifica contra la caja: el personal presenta el NFC después de una compra habilitada. El QR de respaldo usa el mismo destino.

Para resolver soportes reales, aplicar [`database_migrations/001_nfc_flow.sql`](../database_migrations/001_nfc_flow.sql) y activar `MIMO_NFC_DIRECTORY_ENABLED=true`. Mientras se prepara ese inventario, `MIMO_DEFAULT_BUSINESS_ID` funciona como fallback para tokens como `ABC123`.

## Recursos visuales

El logo reutiliza `public/mimo-logo`, actualizado al wordmark `mimo rewards` y copiado a `public/images/mimo-logo.png`. `public/images/mimo-wordmark.png` contiene el mismo archivo recortado al contenido visible para evitar espacio transparente excesivo. La landing usa ese wordmark en header, footer, dashboard y mockup del teléfono.

La fotografía conceptual se generó con la herramienta integrada ImageGen usando la referencia de identidad compartida para alinear el soporte, el círculo NFC, el packaging, la paleta y la tarjeta del celular. La landing usa `public/images/mimo-identity-kit.webp` (1672 × 941, aproximadamente 160 KB) en el hero y en la sección del kit. Se conserva `mimo-cafe.webp` como recurso anterior por si se necesita una variante.

Prompt final usado para el recurso de identidad:

> Use case: product-mockup. Create a photorealistic premium hero image for the mimo rewards landing page, using the identity board only as visual reference for brand style, colors, logo treatment, and product direction. Warm cream #FFF6EE background, vivid mimo red #FF1F2D, soft pink #FFD9DC, charcoal accents. A real café counter scene with one customized red acrylic NFC countertop stand in the foreground. Stand has a rounded rectangular face, cream circular NFC contactless symbol with black waves, small white mimo rewards wordmark near top, and subtle pink heart shapes along its lower edge. Beside it, a modern dark phone is held close to the NFC circle and shows a simple cream digital loyalty card with four red stamp hearts, 4/10 sellos, and a soft pink reward panel. Include a second small round NFC sticker, a compact cream setup card, and branded cream packaging in the background. Softly blurred neighborhood café, warm natural daylight, tactile wood, tasteful shadows, friendly editorial product photography. Wide landscape composition with clean negative space on the left for web copy, product cluster on the right. Keep typography minimal and legible; Spanish phrases only if naturally readable: “ACERCÁ TU CELULAR” and “Sumate a nuestro programa de beneficios”. No blue, no gradients, no futuristic tech, no watermark, no extra logos, no collage, no identity-board layout.

## Validación local

```powershell
npm run lint
npm run build
node --experimental-strip-types --test tests/landing-leads.test.mjs
```

