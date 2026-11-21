import "server-only";
import { parseConfig } from "./config-schema";

export function getConfig() {
  return parseConfig({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TOSS_CLIENT_KEY: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    ADME_SERVICE_MODE: process.env.ADME_SERVICE_MODE,
    ADME_FEATURE_MAIL: process.env.ADME_FEATURE_MAIL,
    ADME_FEATURE_TEST_BILLING: process.env.ADME_FEATURE_TEST_BILLING,
    ADME_FEATURE_INGESTION: process.env.ADME_FEATURE_INGESTION,
    ADME_FEATURE_LLM: process.env.ADME_FEATURE_LLM,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
