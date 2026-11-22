import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
const bindingSchema = z.strictObject({
  ownerId: z.uuid(),
  appId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  keyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
});
export type InstagramBinding = z.infer<typeof bindingSchema>;
const grantSchema = z.strictObject({
  accessToken: z.string().min(1).max(8192),
  subject: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  scopes: z
    .array(z.string().regex(/^[a-zA-Z0-9_]{1,100}$/))
    .min(1)
    .max(20),
  expiresAt: z.iso.datetime({ offset: true }),
});
export type InstagramGrant = z.infer<typeof grantSchema>;
const envelopeSchema = z.strictObject({
  version: z.literal(1),
  keyId: bindingSchema.shape.keyId,
  nonce: z.string().regex(/^[\w-]{16}$/),
  tag: z.string().regex(/^[\w-]{22}$/),
  ciphertext: z.string().regex(/^[\w-]{1,20000}$/),
});
export type InstagramEnvelope = z.infer<typeof envelopeSchema>;
function aad(binding: InstagramBinding) {
  return Buffer.from(
    JSON.stringify({
      provider: "instagram",
      ...bindingSchema.parse(binding),
      version: 1,
    }),
  );
}
export function sealInstagramGrant(
  grant: unknown,
  binding: InstagramBinding,
  key: Uint8Array,
) {
  if (key.byteLength !== 32) throw Error("INSTAGRAM_VAULT_KEY_REQUIRED");
  const value = grantSchema.parse(grant),
    nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return envelopeSchema.parse({
    version: 1,
    keyId: binding.keyId,
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  });
}
export function openInstagramGrant(
  envelope: unknown,
  binding: InstagramBinding,
  key: Uint8Array,
): InstagramGrant {
  try {
    const e = envelopeSchema.parse(envelope);
    if (e.keyId !== binding.keyId || key.byteLength !== 32) throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(e.nonce, "base64url"),
    );
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(Buffer.from(e.tag, "base64url"));
    return grantSchema.parse(
      JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(e.ciphertext, "base64url")),
          decipher.final(),
        ]).toString("utf8"),
      ),
    );
  } catch {
    throw Error("INSTAGRAM_CREDENTIAL_UNAVAILABLE");
  }
}
export function createInstagramState(
  binding: InstagramBinding,
  now = Date.now(),
) {
  bindingSchema.parse(binding);
  const state = randomBytes(32).toString("base64url");
  return {
    state,
    record: {
      ownerId: binding.ownerId,
      appId: binding.appId,
      hash: createHash("sha256").update(state).digest("hex"),
      issuedAt: now,
      expiresAt: now + 300000,
    },
  };
}
// The repository must atomically consume the bound state once; a matching hash alone is insufficient.
export async function consumeInstagramState(
  state: string,
  record: ReturnType<typeof createInstagramState>["record"],
  binding: InstagramBinding,
  consumeOnce: (
    hash: string,
    ownerId: string,
    appId: string,
  ) => Promise<boolean>,
  now = Date.now(),
) {
  if (
    !/^[\w-]{43}$/.test(state) ||
    !/^[a-f0-9]{64}$/.test(record.hash) ||
    record.ownerId !== binding.ownerId ||
    record.appId !== binding.appId ||
    record.issuedAt > now ||
    record.expiresAt <= now ||
    record.expiresAt - record.issuedAt !== 300000
  )
    throw Error("INSTAGRAM_STATE_INVALID");
  const hash = createHash("sha256").update(state).digest();
  if (
    !timingSafeEqual(hash, Buffer.from(record.hash, "hex")) ||
    !(await consumeOnce(record.hash, binding.ownerId, binding.appId))
  )
    throw Error("INSTAGRAM_STATE_INVALID");
}
export async function refreshInstagramGrant(
  input: {
    active: boolean;
    generation: number;
    binding: InstagramBinding;
    envelope: InstagramEnvelope;
    key: Uint8Array;
    approvedScopes: readonly string[];
  },
  ports: {
    refresh: (grant: InstagramGrant, signal: AbortSignal) => Promise<unknown>;
    saveIfActive: (
      generation: number,
      envelope: InstagramEnvelope,
    ) => Promise<boolean>;
  },
  now = Date.now(),
) {
  if (
    !input.active ||
    !Number.isSafeInteger(input.generation) ||
    input.generation < 0 ||
    !input.approvedScopes.length
  )
    throw Error("INSTAGRAM_CONNECTION_DISABLED");
  const old = openInstagramGrant(input.envelope, input.binding, input.key);
  if (
    Date.parse(old.expiresAt) <= now ||
    old.scopes.some((s) => !input.approvedScopes.includes(s))
  )
    throw Error("INSTAGRAM_REAUTH_REQUIRED");
  const next = grantSchema.parse(
    await ports.refresh(old, AbortSignal.timeout(10000)),
  );
  if (
    next.subject !== old.subject ||
    Date.parse(next.expiresAt) <= now ||
    input.approvedScopes.some((s) => !next.scopes.includes(s)) ||
    next.scopes.some((s) => !input.approvedScopes.includes(s))
  )
    throw Error("INSTAGRAM_REAUTH_REQUIRED");
  const sealed = sealInstagramGrant(next, input.binding, input.key);
  if (!(await ports.saveIfActive(input.generation, sealed)))
    throw Error("INSTAGRAM_CONNECTION_CHANGED");
  return { expiresAt: next.expiresAt };
}
