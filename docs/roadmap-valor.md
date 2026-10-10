# Roadmap de valor de mimo

## Propuesta inicial

**Primer mercado:** cafeterías, heladerías y otros comercios gastronómicos de cercanía. El modelo debe poder replicarse en otros rubros después de validar el primer piloto.

**Oferta propuesta:** plan de USD 25 por mes; el kit físico se cobra aparte y su precio se confirma antes de comenzar. El comercio recibe una caja mimo con dos soportes NFC y el programa configurado. La tarjeta digital lleva el logo y los colores del local. El comercio decide qué compra habilita un sello y cuál es la recompensa. El personal presenta el NFC después de la compra; el cliente se registra en el primer toque y recibe su primer sello. En compras posteriores, toca el soporte y suma el sello automáticamente. Puede ver su tarjeta digital; el comercio consulta clientes, sellos y canjes. No se promete un aumento porcentual de ventas sin medición propia.

**Diferencia a demostrar:** el toque NFC simplifica el registro y la suma de sellos frente a un programa basado principalmente en QR. El soporte físico se presenta por el personal después de la compra. El kit debe ser real y fotografiado antes de presentarlo como producto entregable. El sistema limita toques repetidos durante tres horas, pero no comprueba por sí solo la compra en la caja.

## Orden de trabajo

| Etapa | Entregable | Criterio para avanzar |
| --- | --- | --- |
| 1. Recorrido real | Alta por NFC y QR, tarjeta, sello, canje y panel probados con un comercio de prueba | El equipo puede hacer una demo completa sin datos ficticios ni botones inactivos. |
| 2. Oferta piloto | Caja física final, precio del kit, tiempo de instalación, alcance del soporte y plan de USD 25/mes | Una persona puede entender qué recibe y el costo total antes de aceptar. |
| 3. Landing clara y demo | Explicación del recorrido NFC, ejemplo gastronómico, capturas reales y coordinación de una demo por email | Una persona entiende qué se vende, cómo se suma un sello, qué recibe el comercio y cómo pedir una demo. |
| 4. Primeros comercios | Instalaciones piloto con permiso de documentar resultados | Hay evidencia de uso cotidiano y obstáculos operativos reales. |
| 5. Ampliación | Wallet confiable en ambos sistemas y envío real de campañas, con consentimiento | Cada función supera una prueba completa antes de anunciarse. |
| 6. Consultas | Configuración del formulario y recepción por email | Las solicitudes llegan a contactomimorewards@gmail.com y el flujo se prueba de extremo a extremo. |

## Precio y costos pendientes

El precio inicial comunicado es **USD 25/mes** y el kit físico se cobra aparte. Antes de aceptar comercios, definir el precio del kit y los costos de personalización, fabricación, reposición, envío, soporte y mensajería. Confirmar también las condiciones comerciales del abono. La referencia competitiva de USD 24,99/mes no incluye necesariamente el mismo servicio físico; revisar el margen real antes de cerrar la oferta.

## Medición del piloto

Por comercio, registrar: personas que abren el enlace, registros completados, segunda visita en 30 y 60 días, sellos emitidos, recompensas alcanzadas y canjeadas, tiempo de puesta en marcha y tiempo de operación en caja. Comparar cohortes con reglas claras. Publicar resultados solo con consentimiento del comercio y sin atribuir causalidad que los datos no demuestren.

## Estado de funciones al revisar el código

- Alta por NFC, registro de sellos y canjes tienen rutas y paneles implementados; falta validar todo el recorrido contra un entorno real del piloto.
- El flujo NFC ahora abre la tarjeta real. Google Wallet aparece allí solo cuando puede generarse el enlace. Apple Wallet todavía no emite un pase.
- La demostración de mensajes en la landing es ilustrativa. El motor de automatizaciones crea registros `GENERADO`; no hay pasarela de envío conectada.
- Las métricas y clientes mostrados en la landing son ejemplos, no datos de un comercio activo.
- La demo se solicita por email a contactomimorewards@gmail.com; todavía no hay calendario de reservas. El formulario de consultas queda para la última etapa.
