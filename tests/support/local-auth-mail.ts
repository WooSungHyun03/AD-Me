import { expect, type APIRequestContext } from "@playwright/test";
import { localRuntime } from "./local-qa.mjs";
export async function localProof(
  request: APIRequestContext,
  email: string,
  type: "email_change" | "recovery",
  skip = 0,
) {
  localRuntime();
  let inbox: { ID: string }[] = [];
  await expect
    .poll(async () => {
      const response = await request.get(
        "http://127.0.0.1:54324/api/v1/messages?limit=100",
      );
      expect(response.ok()).toBe(true);
      inbox = ((await response.json()).messages ?? []).filter(
        (m: { To: { Address: string }[] }) =>
          m.To.some((t) => t.Address === email),
      );
      return inbox.length;
    })
    .toBeGreaterThan(skip);
  const message = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${inbox[0].ID}`,
  );
  const html = (await message.json()).HTML as string;
  const link = /href="([^"]+token_hash=[^"]+)"/
    .exec(html)?.[1]
    ?.replaceAll("&amp;", "&");
  if (!link) throw Error("Local token-hash email template missing");
  const url = new URL(link);
  expect(url.origin).toBe("https://127.0.0.1:3143");
  expect(url.searchParams.get("type")).toBe(type);
  return url.href;
}
