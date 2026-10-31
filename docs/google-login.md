# Acceso al panel: contraseña y Google

`/login` permite ingresar con el correo y contraseña existentes o continuar con Google. Google muestra el selector de cuenta y crea la cuenta de Auth cuando el correo todavía no existe. Los administradores conservan sus permisos por perfil o `admin_whitelist`, y los miembros existentes entran al panel de su comercio activo.

Una cuenta sin comercio activo llega a `/#acceso`, el único formulario público de la landing. Solicita nombre, negocio, email y WhatsApp y explica que el equipo se pondrá en contacto. `/registrarse` solo redirige a este formulario. El envío usa `/api/landing-leads` y el SMTP existente y no concede permisos.

La solicitud no crea comercios, perfiles ni membresías y no agrega cuentas a la whitelist. El administrador revisa la solicitud y habilita el acceso por las herramientas existentes. Se quitó el endpoint de alta automática y se restauró el comportamiento anterior de los límites de planes.

## Configuración de Supabase y Google

1. En Supabase, Authentication → Providers → Google, habilitar el proveedor y configurar el Client ID y Client Secret.
2. En Google Cloud, configurar como URI de redirección autorizada el callback de Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. En Supabase, Authentication → URL Configuration, configurar Site URL con el dominio público y agregar a Redirect URLs `https://mimorewards.com/auth/callback` y los callbacks de los dominios que se usen (por ejemplo, `https://www.mimorewards.com/auth/callback` y `http://localhost:3000/auth/callback`). Si se conservan destinos con `?next=...`, autorizar también esas variantes; para desarrollo se puede usar `http://localhost:3000/auth/callback**`.
4. Mantener habilitado el acceso por correo y contraseña en Supabase.

El middleware recupera el código de OAuth si Supabase vuelve a la raíz o a `/login`, y lo envía a `/auth/callback` para guardar la sesión. Conviene corregir igualmente la lista de URLs autorizadas para que el retorno vaya directo al callback.

Documentación: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google) y [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Verificación

Ejecutar `node --experimental-strip-types --test tests/login-access.test.mjs tests/landing-leads.test.mjs`.

Comprobar que `/registrarse` redirige a `/#acceso`, que una cuenta sin asociación llega al formulario y que una cuenta autorizada vuelve al panel. El envío del formulario debe confirmarse solo cuando el canal de correo acepte el mensaje.

Verificar en el navegador con cuentas de prueba: contraseña de un usuario existente, administrador con perfil anterior, administrador autorizado por correo y Google del mismo correo de un comercio. Verificar también que volver de Google conserve la sesión al recargar el panel y que no permita entrar al comercio de otro usuario.
