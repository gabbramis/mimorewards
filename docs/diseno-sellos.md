# Diseño de sellos

## Puesta en marcha

Aplicar `database_migrations/012_business_stamp_design.sql` antes de desplegar el código. El proyecto usa el bucket público `logos` de Supabase Storage también para los pares de sellos generados, bajo `stamps/<business-id>/`.

## Colección mimo

El catálogo en `src/lib/stamp-catalog.ts` declara 23 motivos con identificadores estables. Sus imágenes finales no están en el repositorio. Cada entrada necesita un PNG completado y otro pendiente; hasta entonces se muestra como arte pendiente y no se puede guardar como selección. No se usan emojis ni iconos provisionales.

## Integración Wallet

Los PNG personalizados completado y pendiente se normalizan a 192 × 192 px y se guardan con el negocio para uso futuro por el compositor de Wallet. El procesamiento vive en `src/lib/stamp-image.ts` y `src/lib/stamp-storage.ts`, separado de los adaptadores de Apple y Google.

La edición de colores se usa al generar una nueva tarjeta Apple Wallet; Google Wallet admite en este código el color de fondo y el logo principal. Los sellos visuales guardados todavía no se incorporan a las tarjetas emitidas ni se envían actualizaciones automáticas a Wallet. Las tarjetas ya emitidas no se actualizan por guardar este formulario.

## Programa de fidelización

Una vez que el negocio tiene clientes, la API rechaza cambios en la meta y el premio. Así se evita reinterpretar los saldos existentes sin una migración específica del programa.
