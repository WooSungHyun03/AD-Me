import { z } from "zod";

export type ServiceMode = "free_beta" | "test_demo";
type ModeSetting = "ADME_SERVICE_MODE" | "SERVICE_MODE";
export function resolveServiceMode(
  env: Readonly<Record<string, string | undefined>>,
) {
  const names: ModeSetting[] = ["ADME_SERVICE_MODE", "SERVICE_MODE"];
  const present = names.filter((name) => Boolean(env[name]));
  const invalid = present.filter(
    (name) => !["free_beta", "test_demo"].includes(env[name]!),
  );
  const conflict =
    !invalid.length && new Set(present.map((name) => env[name])).size > 1;
  const issues: { name: ModeSetting; reason: "invalid" | "conflict" }[] =
    invalid.map((name) => ({ name, reason: "invalid" }));
  if (conflict)
    issues.push(
      ...present.map((name) => ({ name, reason: "conflict" as const })),
    );
  const value: ServiceMode =
    !invalid.length &&
    present.length > 0 &&
    present.every((name) => env[name] === "test_demo")
      ? "test_demo"
      : "free_beta";
  return { value, issues };
}

function originSchema(allowLocalHttp: boolean) {
  return z
    .string()
    .regex(/^https?:\/\/[^/?#\\\s]+\/?$/i)
    .transform((value, ctx) => {
      const url = URL.parse(value);
      const local =
        url && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        !url ||
        url.username ||
        url.password ||
        (url.protocol !== "https:" &&
          !(allowLocalHttp && local && url.protocol === "http:"))
      ) {
        ctx.addIssue({ code: "custom", message: "Invalid origin" });
        return z.NEVER;
      }
      return url.origin;
    });
}

const supabasePublicKeySchema = z.string().refine((value) => {
  if (/^sb_publishable_[\w-]+$/.test(value)) return true;
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) return false;
  try {
    const [, payload] = value.split(".");
    return (
      JSON.parse(Buffer.from(payload, "base64url").toString()).role === "anon"
    );
  } catch {
    return false;
  }
});

export function parseConfig(env: Readonly<Record<string, string | undefined>>) {
  const origin = originSchema(env.NODE_ENV !== "production");
  const schemas = {
    NEXT_PUBLIC_APP_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublicKeySchema,
    NEXT_PUBLIC_TOSS_CLIENT_KEY: z.string().regex(/^test_ck_[A-Za-z0-9_-]+$/),
    ADME_SERVICE_MODE: z.enum(["free_beta", "test_demo"]),
    ADME_FEATURE_MAIL: z.enum(["off", "on"]),
    ADME_FEATURE_TEST_BILLING: z.enum(["off", "on"]),
    ADME_FEATURE_INGESTION: z.enum(["off", "on"]),
    ADME_FEATURE_LLM: z.enum(["off", "on"]),
    SUPABASE_SERVICE_ROLE_KEY: z.string().refine((value) => {
      if (/^sb_secret_[\w-]+$/.test(value)) return true;
      try {
        return (
          JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString())
            .role === "service_role"
        );
      } catch {
        return false;
      }
    }),
  };
  type Setting = keyof typeof schemas;
  const settings: {
    name: Setting | ModeSetting;
    reason: "missing" | "invalid" | "conflict";
  }[] = [];

  function read<Name extends Setting>(
    name: Name,
    fallback?: string,
  ): z.output<(typeof schemas)[Name]> | null {
    const value = env[name] || fallback;
    const result = schemas[name].safeParse(value);
    if (result.success) return result.data as z.output<(typeof schemas)[Name]>;
    settings.push({ name, reason: value?.trim() ? "invalid" : "missing" });
    return null;
  }

  const appOrigin = read("NEXT_PUBLIC_APP_URL");
  const supabaseUrl = read("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabase =
    supabaseUrl && supabaseKey ? { url: supabaseUrl, key: supabaseKey } : null;
  const resolvedMode = resolveServiceMode(env);
  const serviceMode = resolvedMode.value;
  settings.push(...resolvedMode.issues);
  const mailFlag = read("ADME_FEATURE_MAIL", "off");
  const billingFlag = read("ADME_FEATURE_TEST_BILLING", "off");
  const ingestionFlag = read("ADME_FEATURE_INGESTION", "off");
  const llmFlag = read("ADME_FEATURE_LLM", "off");
  const tossClientKey =
    env.NEXT_PUBLIC_TOSS_CLIENT_KEY ||
    (serviceMode === "test_demo" && billingFlag === "on")
      ? read("NEXT_PUBLIC_TOSS_CLIENT_KEY")
      : null;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
    ? read("SUPABASE_SERVICE_ROLE_KEY")
    : null;
  const uploads = Boolean(supabase && serviceRole);
  const features = {
    mail:
      mailFlag !== "on"
        ? "off"
        : supabase && appOrigin
          ? "enabled"
          : "missing_prerequisites",
    testBilling:
      serviceMode !== "test_demo" || billingFlag !== "on"
        ? "off"
        : supabase && tossClientKey
          ? "enabled"
          : "missing_prerequisites",
    ingestion:
      ingestionFlag !== "on"
        ? "off"
        : supabase
          ? "enabled"
          : "missing_prerequisites",
    llm:
      llmFlag !== "on" ? "off" : supabase ? "enabled" : "missing_prerequisites",
  } as const;

  return {
    appOrigin,
    supabase,
    serviceMode,
    testBillingClientKey:
      features.testBilling === "enabled" ? tossClientKey : null,
    features,
    diagnostics: {
      settings,
      availability: { account: Boolean(supabase), uploads, ...features },
    },
  };
}
