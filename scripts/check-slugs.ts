import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Read from .env.local
const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

async function main() {
    if (urlMatch && keyMatch) {
        const supabase = createClient(urlMatch[1], keyMatch[1]);
        const { data, error } = await supabase.from("businesses").select("slug, name, active");
        if (error) console.error(error);
        console.log("SLUGS:", JSON.stringify(data, null, 2));
    } else {
        console.log("No env");
    }
}
main();
