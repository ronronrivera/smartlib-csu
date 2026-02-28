import { createClient } from "@supabase/supabase-js";
import { ENV } from "./ENV.ts";


if (!ENV.SUPABASE_URL || !ENV.SUPABASE_PUB_KEY) {
    console.error("SUPABASE environment variables are not defined (SUPABASE_URL and/or SUPABASE_PUB_KEY).");
    throw new Error("Missing required Supabase environment variables");
}
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUB_KEY);


