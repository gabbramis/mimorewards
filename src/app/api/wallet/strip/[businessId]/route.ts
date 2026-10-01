import { NextResponse } from "next/server";
import { generateStripImage } from "@/lib/wallet/generateStrip";
import { createClient } from "@/lib/supabase/server";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ businessId: string }> }
) {
    try {
        const { searchParams } = new URL(request.url);
        const { businessId } = await params;

        let currentStamps = parseInt(searchParams.get("stamps") || "0");
        let maxStamps = parseInt(searchParams.get("max") || "0");
        let color = searchParams.get("color");

        // Si faltan parámetros de diseño, buscamos en DB
        if (!maxStamps || !color) {
            const supabase = await createClient();
            const { data: business } = await supabase
                .from("businesses")
                .select("reward_target, primary_color")
                .eq("id", businessId)
                .single();

            if (business) {
                if (!maxStamps) maxStamps = business.reward_target || 10;
                if (!color) color = business.primary_color || "#E84538";
            } else {
                maxStamps = 10;
                color = "#E84538";
            }
        }

        // Si la URL provee el color, usar con # precargado (puede venir sin hash por la URL)
        if (color && !color.startsWith("#")) {
            color = `#${color}`;
        }

        const buffer = await generateStripImage(maxStamps, currentStamps, color || "#E84538");

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600",
                "Content-Disposition": `inline; filename="strip.png"`
            },
        });
    } catch (error) {
        console.error("Error generating strip image:", error);
        return NextResponse.json({ error: "Failed to generate wallet strip" }, { status: 500 });
    }
}
