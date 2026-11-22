import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import {
  issueTeamInvite,
  acceptTeamInvite,
  removeTeamMember,
  type TeamState,
} from "@/lib/team-membership";
const state: TeamState = {
  tenantId: randomUUID(),
  version: 0,
  members: [{ id: randomUUID(), role: "admin" }],
  invites: [],
};
it("binds one-use invitations to verified recipient and tenant with expiry and CAS", () => {
  const recipientId = randomUUID(),
    inviteId = randomUUID(),
    issued = issueTeamInvite(
      state,
      {
        tenantId: state.tenantId,
        expected: 0,
        actorId: state.members[0].id,
        recipientId,
        inviteId,
        role: "member",
      },
      1000,
    );
  expect(JSON.stringify(issued.state)).not.toContain(issued.token);
  const command = {
    tenantId: state.tenantId,
    expected: 1,
    actorId: recipientId,
    inviteId,
    token: issued.token,
  };
  for (const patch of [
    { actorId: randomUUID() },
    { tenantId: randomUUID() },
    { expected: 0 },
  ])
    expect(() =>
      acceptTeamInvite(issued.state, { ...command, ...patch }, 1001),
    ).toThrow();
  expect(() => acceptTeamInvite(issued.state, command, 86401000)).toThrow();
  const accepted = acceptTeamInvite(issued.state, command, 1001);
  expect(accepted.members).toHaveLength(2);
  expect(() =>
    acceptTeamInvite(accepted, { ...command, expected: 2 }, 1001),
  ).toThrow();
  expect(state.members).toHaveLength(1);
});
it("prevents final administrator removal and ordinary-member elevation/removal", () => {
  expect(() =>
    removeTeamMember(state, {
      tenantId: state.tenantId,
      expected: 0,
      actorId: state.members[0].id,
      memberId: state.members[0].id,
    }),
  ).toThrow("LAST_ADMIN");
  const member = randomUUID(),
    s = {
      ...state,
      members: [...state.members, { id: member, role: "member" }],
    };
  expect(() =>
    removeTeamMember(s, {
      tenantId: state.tenantId,
      expected: 0,
      actorId: member,
      memberId: state.members[0].id,
    }),
  ).toThrow("FORBIDDEN");
  expect(() =>
    issueTeamInvite(s, {
      tenantId: state.tenantId,
      expected: 0,
      actorId: member,
      recipientId: randomUUID(),
      inviteId: randomUUID(),
      role: "admin",
    }),
  ).toThrow("FORBIDDEN");
});
