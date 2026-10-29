import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Read from .env.local
const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

async function main() {
    if (urlMatch && keyMatch) {
        const supabaseUrl = urlMatch[1].trim();
        const supabaseKey = keyMatch[1].trim();
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.from("businesses").select("slug, name, active");
        if (error) {
            console.error("Supabase Error:", error);
            return;
        }
        console.log("SLUGS:", JSON.stringify(data, null, 2));
    } else {
        console.log("No env");
    }
}
main();
