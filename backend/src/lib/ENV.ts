import "dotenv/config"

export const ENV = {
    PORT: process.env.PORT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUB_KEY: process.env.SUPABASE_PUB_KEY,
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_URL: process.env.CLIENT_URL,
    SERVERLESS: process.env.SERVERLESS
}
