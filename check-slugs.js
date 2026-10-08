import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Read from .env.local
const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    supabase.from("businesses").select("slug, name, active").then(({ data, error }) => {
        if (error) console.error(error);
        console.log(JSON.stringify(data, null, 2));
    });
} else {
    console.log("No env");
}
