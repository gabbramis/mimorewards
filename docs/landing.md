# Landing mimo rewards

La página pública está en `src/app/page.tsx`. Los componentes reutilizables están en `src/components/landing/` y los estilos están limitados a `.m-landing` en `src/app/landing.css` para no modificar los paneles existentes.

El proyecto usa TypeScript con `tsconfig.json`; las páginas y componentes usan `.ts`/`.tsx`, las rutas API usan `.ts` y `jsconfig.json` ya no se utiliza.

## Contacto

Agregar `NEXT_PUBLIC_MIMO_CONTACT_EMAIL` en `.env.local` o en el entorno de despliegue. El formulario valida los datos y prepara un correo con nombre, comercio, WhatsApp y email. La persona debe enviarlo desde su aplicación de correo. No hay almacenamiento de consultas ni envío automático.

Mientras la variable esté vacía, se informa que las solicitudes todavía no están habilitadas y no se envía ningún dato. No se muestra una confirmación falsa. Las variables `NEXT_PUBLIC_` se incorporan al compilar: reiniciar el servidor de desarrollo o recompilar después de completarlas.

Configurar `NEXT_PUBLIC_MIMO_SITE_URL` con el dominio público final para que los metadatos sociales usen la URL correcta. El valor local por defecto es `http://localhost:3000`.

## Experiencias de demostración

- La tarjeta empieza con 4/10 sellos. El botón suma sellos hasta habilitar la recompensa de café gratis; luego permite reiniciar la demostración.
- Apple Wallet / Google Wallet cambian la vista previa. No emiten pases reales.
- Los siete filtros de segmentación operan sobre una lista local de clientes ficticios.
- Las métricas del panel y los mensajes son ejemplos explícitos. No leen ni modifican datos de Supabase.
- Los accesos a `/caja` y `/admin` se mantienen en la sección para comercios, el menú móvil y el pie.
- Los avisos de privacidad y términos describen únicamente esta etapa y el formulario de consulta.

## Recursos visuales

El logo reutiliza `public/mimo-logo`, actualizado al wordmark `mimo rewards` y copiado a `public/images/mimo-logo.png`. `public/images/mimo-wordmark.png` contiene el mismo archivo recortado al contenido visible para evitar espacio transparente excesivo. La landing usa ese wordmark en header, footer, dashboard y mockup del teléfono.

La fotografía conceptual se generó con la herramienta integrada ImageGen usando la referencia de identidad compartida para alinear el soporte, el círculo NFC, el packaging, la paleta y la tarjeta del celular. La landing usa `public/images/mimo-identity-kit.webp` (1672 × 941, aproximadamente 160 KB) en el hero y en la sección del kit. Se conserva `mimo-cafe.webp` como recurso anterior por si se necesita una variante.

Prompt final usado para el recurso de identidad:

> Use case: product-mockup. Create a photorealistic premium hero image for the mimo rewards landing page, using the identity board only as visual reference for brand style, colors, logo treatment, and product direction. Warm cream #FFF6EE background, vivid mimo red #FF1F2D, soft pink #FFD9DC, charcoal accents. A real café counter scene with one customized red acrylic NFC countertop stand in the foreground. Stand has a rounded rectangular face, cream circular NFC contactless symbol with black waves, small white mimo rewards wordmark near top, and subtle pink heart shapes along its lower edge. Beside it, a modern dark phone is held close to the NFC circle and shows a simple cream digital loyalty card with four red stamp hearts, 4/10 sellos, and a soft pink reward panel. Include a second small round NFC sticker, a compact cream setup card, and branded cream packaging in the background. Softly blurred neighborhood café, warm natural daylight, tactile wood, tasteful shadows, friendly editorial product photography. Wide landscape composition with clean negative space on the left for web copy, product cluster on the right. Keep typography minimal and legible; Spanish phrases only if naturally readable: “ACERCÁ TU CELULAR” and “Sumate a nuestro programa de beneficios”. No blue, no gradients, no futuristic tech, no watermark, no extra logos, no collage, no identity-board layout.

## Validación local

```powershell
npm run lint
npm run build
```
