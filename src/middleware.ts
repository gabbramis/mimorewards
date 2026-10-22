import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isLoginRoute = pathname === '/login';

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Si faltan variables de entorno en producción, evitar crashear el servidor
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Middleware: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
        if ((pathname.startsWith('/admin') || pathname.startsWith('/caja')) && !isLoginRoute) {
            const redirectUrl = request.nextUrl.clone();
            redirectUrl.pathname = '/login';
            redirectUrl.search = '';
            return NextResponse.redirect(redirectUrl);
        }
        return supabaseResponse;
    }

    try {
        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                        supabaseResponse = NextResponse.next({
                            request,
                        });
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        // Refrescar y validar la sesión con Supabase Auth de forma segura
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error) {
            // Error al leer o validar el usuario (token expirado o inválido)
            // No lanzamos excepción para no romper la navegación general
        }

        // Proteger todo el segmento /admin (incluyendo /admin/caja) y /caja
        if (pathname.startsWith('/admin') || pathname.startsWith('/caja')) {
            if (!user) {
                // Evitar redirigir a /login si la petición ya está en /login (previene bucles)
                if (!isLoginRoute) {
                    const redirectUrl = request.nextUrl.clone();
                    redirectUrl.pathname = '/login';
                    redirectUrl.search = '';

                    const nextPath = `${pathname}${request.nextUrl.search}`;
                    // Evitar bucles si nextPath es /login o apunta recursivamente a login
                    if (nextPath && !nextPath.startsWith('/login')) {
                        redirectUrl.searchParams.set('next', nextPath);
                    }

                    const redirectResponse = NextResponse.redirect(redirectUrl);
                    // Copiar cookies refrescadas o invalidadas para que el navegador no quede en estado corrupto
                    supabaseResponse.cookies.getAll().forEach((cookie) => {
                        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
                    });
                    return redirectResponse;
                }
            }
        }

        return supabaseResponse;
    } catch (err) {
        console.error('Middleware Supabase error no controlado:', err);
        // Si ocurre un error no previsto al validar sesión en rutas protegidas, redirigir a login de forma segura
        if ((pathname.startsWith('/admin') || pathname.startsWith('/caja')) && !isLoginRoute) {
            const redirectUrl = request.nextUrl.clone();
            redirectUrl.pathname = '/login';
            redirectUrl.search = '';
            return NextResponse.redirect(redirectUrl);
        }
        return supabaseResponse;
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets (.svg, .png, .jpg, .jpeg, .gif, .webp)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
