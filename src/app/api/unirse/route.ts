import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomerSession, customerCookieName } from "@/lib/mimo-customer-session";

function clean(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function makeUniqueCode() {
    return `CLI-${Math.floor(10000 + Math.random() * 90000)}`;
}

async function creditStamp(supabase: any, customer: any, businessId: string, idempotencyKey: string) {
    const { data, error } = await supabase.rpc("record_loyalty_stamp", {
        p_customer_id: customer.id,
        p_business_id: businessId,
        p_method: "NFC",
        p_idempotency_key: idempotencyKey,
        p_cooldown_minutes: 0,
        p_enforce_cooldown: false,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error("No se pudo confirmar el sello.");
    return result;
}

export async function POST(request: Request) {
    const supabase: any = createAdminClient();

    try {
        const input = await request.json();
        const slug = clean(input.slug);
        const firstName = clean(input.nombre);
        const phone = clean(input.telefono).replace(/\s+/g, '');
        const birthdate = clean(input.fechaNacimiento);

        if (!slug || !firstName || !phone) {
            return NextResponse.json({ error: "Completá todos los campos para continuar." }, { status: 400 });
        }

        const { data: business } = await supabase
            .from("businesses")
            .select("id, active")
            .eq("slug", slug)
            .maybeSingle();

        if (!business || !business.active) {
            return NextResponse.json({ error: "Este programa no está disponible." }, { status: 410 });
        }

        const businessId = business.id;

        const { data: existingCustomer, error: existingError } = await supabase
            .from("customers")
            .select("id")
            .eq("business_id", businessId)
            .eq("phone", phone)
            .maybeSingle();

        if (existingError) throw existingError;

        let customerId = "";

        if (existingCustomer) {
            customerId = existingCustomer.id;
            try {
                await creditStamp(supabase, existingCustomer, businessId, crypto.randomUUID());
            } catch (e: any) {
                console.warn("Could not credit stamp to existing customer via unirse endpoint:", e);
            }
        } else {
            const { data: createdCustomer, error: customerError } = await supabase
                .from("customers")
                .insert({
                    business_id: businessId,
                    unique_code: makeUniqueCode(),
                    first_name: firstName,
                    last_name: "", // Fricción cero
                    phone: phone,
                    birthdate: birthdate || null, // Optional
                    current_stamps: 0,
                    total_visits: 0,
                })
                .select("id")
                .single();

            if (customerError || !createdCustomer) {
                throw customerError || new Error("No se pudo crear el cliente.");
            }

            customerId = createdCustomer.id;

            const { error: cardError } = await supabase.from("loyalty_cards").insert({
                customer_id: customerId,
                business_id: businessId,
                current_stamps: 0,
            });
            if (cardError) throw cardError;

            await creditStamp(supabase, createdCustomer, businessId, crypto.randomUUID());
        }

        const response = NextResponse.json({ success: true, message: "¡Listo! Tu primer sello ya está adentro.", customerId }, { status: 200 });
        response.cookies.set({
            name: customerCookieName(businessId),
            value: createCustomerSession(customerId),
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        });
        return response;

    } catch (error: any) {
        console.error("Unirse registration error:", error);
        return NextResponse.json({ error: error?.message || "Hubo un error al registrarte." }, { status: 500 });
    }
}
