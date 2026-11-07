import { NextResponse } from "next/server";
import { generateStripImage } from "@/lib/wallet/generateStrip";
import { createClient } from "@/lib/supabase/server";
import { sanitizeWalletConfig } from "@/lib/wallet-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        let bgColor = searchParams.get("bg");
        let textColor = searchParams.get("text") || "#FFFFFF";

        if (!maxStamps || !color || !bgColor) {
            const supabase = await createClient();
            const { data: business } = await supabase
                .from("businesses")
                .select("*")
                .eq("id", businessId)
                .single();

            if (business) {
                const wallet = sanitizeWalletConfig(business.wallet_config);
                if (!maxStamps) maxStamps = business.reward_target || 10;
                if (!color) color = business.primary_color || "#FF1F2D";
                if (!bgColor) bgColor = business.stamp_background_color || wallet.stampBackgroundColor || business.primary_color || "#FF1F2D";
                if (business.card_text_color) textColor = business.card_text_color;
            } else {
                maxStamps = maxStamps || 10;
                color = color || "#FF1F2D";
                bgColor = bgColor || color;
            }
        }

        if (color && !color.startsWith("#")) color = `#${color}`;
        if (bgColor && !bgColor.startsWith("#")) bgColor = `#${bgColor}`;
        if (textColor && !textColor.startsWith("#")) textColor = `#${textColor}`;

        const buffer = await generateStripImage(
            maxStamps,
            currentStamps,
            color || "#FF1F2D",
            bgColor || color || "#FF1F2D",
            textColor
        );

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
