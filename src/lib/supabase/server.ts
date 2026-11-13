import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_SERVER_FETCH_TIMEOUT_MS = 8000

function serverFetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
        controller.abort(new Error(`Timeout de conexión a Supabase Auth/SSR (${SUPABASE_SERVER_FETCH_TIMEOUT_MS}ms)`))
    }, SUPABASE_SERVER_FETCH_TIMEOUT_MS)

    const existingSignal = init?.signal
    if (existingSignal) {
        if (existingSignal.aborted) {
            clearTimeout(timeoutId)
            controller.abort(existingSignal.reason)
        } else {
            existingSignal.addEventListener(
                'abort',
                () => {
                    clearTimeout(timeoutId)
                    controller.abort(existingSignal.reason)
                },
                { once: true }
            )
        }
    }

    return fetch(input, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timeoutId)
    })
}

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                fetch: serverFetchWithTimeout,
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}
