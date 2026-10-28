# Apple Wallet en Mimo

El Pass Type ID es `pass.com.mimorewards.loyalty` y el Team ID es `K4TTF9N96K`. La tarjeta se emite como un pase `storeCard` firmado con el certificado de Apple. No necesita una app de iOS.

## Prueba local

Los archivos de firma están en `.secrets/apple-wallet/`, que Git ignora. La ruta `/api/wallet/apple/[customerId]` genera el pase del cliente que tiene una sesión válida en el navegador. El botón aparece al registrarse y en la tarjeta digital. Para instalarlo, abrí la tarjeta desde Safari en un iPhone y tocá **Agregar a Apple Wallet**.

Hay un pase de muestra firmado en `.secrets/apple-wallet/mimo-demo.pkpass` para comprobar la instalación sin usar datos reales.

## Publicación

Configurá las tres variables de entorno del servidor que figuran en `.env.example`: `APPLE_WALLET_SIGNER_CERT_BASE64`, `APPLE_WALLET_SIGNER_KEY_BASE64` y `APPLE_WALLET_WWDR_CERT_BASE64`. Cada valor es el contenido completo del archivo PEM correspondiente codificado en base64. No uses el prefijo `NEXT_PUBLIC_` ni subas la clave privada al repositorio.

Después de publicar, verificá la descarga de un pase real desde un iPhone. El certificado actual vence el 11 de noviembre de 2027 y deberá renovarse para seguir emitiendo pases.

## Sellos

Cada descarga toma los sellos actuales de la base de datos. Mimo emite el mismo número de serie para esa tarjeta. El repositorio incluye el web service de actualización y el envío de push vacío por APNs; su funcionamiento requiere validación en el entorno publicado y en un iPhone real. La existencia del código o de certificados locales no confirma entrega.

La configuración de cercanía, los permisos y la cola del piloto se describen en [Comunicaciones: piloto](comunicaciones-piloto.md). Los pases no utilizan mensajes de cambio para promociones.
