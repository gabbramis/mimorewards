import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Endpoint de seeding restringido a entorno de desarrollo." }, { status: 403 });
    }

    try {
        const supabase: any = createAdminClient();

        // 1. Get or create business
        let { data: business } = await supabase
            .from('businesses')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (!business) {
            const { data, error } = await supabase.from('businesses').insert({
                name: 'Mimo Café',
                slug: 'mimo-cafe-dev-' + Date.now(),
                reward_target: 8,
                active: true,
                reward_description: 'Café de especialidad'
            }).select().single();

            if (error) throw new Error("Fallo al crear negocio: " + error.message);
            business = data;
        }

        // 2. Get or create customer
        let { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('business_id', business.id)
            .limit(1)
            .maybeSingle();

        if (!customer) {
            const { data, error } = await supabase.from('customers').insert({
                business_id: business.id,
                first_name: 'Franco',
                last_name: 'Dev',
                unique_code: crypto.randomUUID().substring(0, 10).toUpperCase(),
                birthdate: '1995-10-01',
                phone: '1122334455',
                current_stamps: 2,
                total_visits: 1
            }).select().single();

            if (error) throw new Error("Fallo al crear cliente: " + error.message);
            customer = data;
        }

        // 3. Return JSON pointers
        const customerId = customer.id;
        const clientCardUrl = `http://localhost:3000/tarjeta/${customerId}`;

        // Depending on routing, admin URL can be `/caja` o `/comercio/.../clientes`
        const adminPanelUrl = `http://localhost:3000/comercio/${business.id}/clientes`;
        const cajaUrl = `http://localhost:3000/caja`;

        return NextResponse.json({
            success: true,
            customerId,
            businessId: business.id,
            clientCardUrl,
            adminPanelUrl,
            cajaUrl
        });

    } catch (err: any) {
        console.error("Dev Seed error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
