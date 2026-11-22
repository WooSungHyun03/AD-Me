import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const role = z.enum(["admin", "member"]);
const inviteSchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  recipientId: z.uuid(),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().nonnegative(),
  role,
  used: z.boolean(),
});
export const teamStateSchema = z
  .strictObject({
    tenantId: z.uuid(),
    version: z.number().int().nonnegative(),
    members: z
      .array(z.strictObject({ id: z.uuid(), role }))
      .min(1)
      .max(20),
    invites: z.array(inviteSchema).max(50),
  })
  .superRefine((s, c) => {
    if (
      !s.members.some((m) => m.role === "admin") ||
      new Set(s.members.map((m) => m.id)).size !== s.members.length ||
      new Set(s.invites.map((i) => i.id)).size !== s.invites.length ||
      s.invites.some((i) => i.tenantId !== s.tenantId)
    )
      c.addIssue({ code: "custom", message: "Invalid tenant membership" });
  });
export type TeamState = z.infer<typeof teamStateSchema>;
function load(input: unknown, tenantId: string, expected: number) {
  const state = teamStateSchema.parse(input);
  if (state.tenantId !== tenantId) throw Error("TEAM_FORBIDDEN");
  if (state.version !== expected) throw Error("TEAM_STALE_VERSION");
  return state;
}
export function issueTeamInvite(
  input: unknown,
  command: {
    tenantId: string;
    expected: number;
    actorId: string;
    recipientId: string;
    inviteId: string;
    role: "admin" | "member";
  },
  now = Date.now(),
) {
  const state = load(input, command.tenantId, command.expected);
  if (
    !state.members.some((m) => m.id === command.actorId && m.role === "admin")
  )
    throw Error("TEAM_FORBIDDEN");
  if (
    state.members.some((m) => m.id === command.recipientId) ||
    state.invites.some((i) => i.id === command.inviteId) ||
    state.invites.length >= 50 ||
    state.members.length >= 20
  )
    throw Error("TEAM_INVITE_UNAVAILABLE");
  const token = randomBytes(32).toString("base64url");
  const invite = inviteSchema.parse({
    id: command.inviteId,
    tenantId: state.tenantId,
    recipientId: command.recipientId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: now + 86400000,
    role: command.role,
    used: false,
  });
  return {
    state: teamStateSchema.parse({
      ...state,
      version: state.version + 1,
      invites: [...state.invites, invite],
    }),
    token,
  };
}
// Persist with tenant/version CAS. actorId must come from verified Auth, never a submitted payload.
export function acceptTeamInvite(
  input: unknown,
  command: {
    tenantId: string;
    expected: number;
    actorId: string;
    inviteId: string;
    token: string;
  },
  now = Date.now(),
) {
  const state = load(input, command.tenantId, command.expected),
    invite = state.invites.find((i) => i.id === command.inviteId);
  if (
    !invite ||
    invite.recipientId !== command.actorId ||
    invite.used ||
    invite.expiresAt <= now ||
    !/^[\w-]{43}$/.test(command.token)
  )
    throw Error("TEAM_INVITE_INVALID");
  const hash = createHash("sha256").update(command.token).digest();
  if (
    !timingSafeEqual(hash, Buffer.from(invite.tokenHash, "hex")) ||
    state.members.some((m) => m.id === command.actorId) ||
    state.members.length >= 20
  )
    throw Error("TEAM_INVITE_INVALID");
  const next = structuredClone(state);
  next.version++;
  next.members.push({ id: command.actorId, role: invite.role });
  next.invites.find((i) => i.id === invite.id)!.used = true;
  return teamStateSchema.parse(next);
}
export function removeTeamMember(
  input: unknown,
  command: {
    tenantId: string;
    expected: number;
    actorId: string;
    memberId: string;
  },
) {
  const state = load(input, command.tenantId, command.expected),
    actor = state.members.find((m) => m.id === command.actorId),
    target = state.members.find((m) => m.id === command.memberId);
  if (!actor || !target || (actor.id !== target.id && actor.role !== "admin"))
    throw Error("TEAM_FORBIDDEN");
  if (
    target.role === "admin" &&
    state.members.filter((m) => m.role === "admin").length === 1
  )
    throw Error("TEAM_LAST_ADMIN");
  return teamStateSchema.parse({
    ...state,
    version: state.version + 1,
    members: state.members.filter((m) => m.id !== target.id),
  });
}
