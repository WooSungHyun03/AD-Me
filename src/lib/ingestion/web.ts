import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { z } from "zod";

const policySchema = z.strictObject({
  approved: z.literal(true),
  version: z.string().min(1).max(80),
  reviewRef: z.string().min(8).max(300),
  host: z
    .string()
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
  paths: z
    .array(z.string().regex(/^\/[a-zA-Z0-9/_-]*$/))
    .min(1)
    .max(20),
  expiresAt: z.iso.datetime({ offset: true }),
  minIntervalSeconds: z.number().int().min(10).max(86400),
  userAgent: z.string().regex(/^ADMe\/1\.0 \(https:\/\/[^\s()]+\)$/),
});
export type ApprovedWebPolicy = z.infer<typeof policySchema>;
export function isPublicWebAddress(address: string) {
  // IPv6 is deliberately unsupported until its complete special-use ranges are reviewed.
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
function approvedUrl(raw: string, p: ApprovedWebPolicy) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.hostname !== p.host ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    /[%\\]/.test(u.pathname) ||
    !p.paths.some(
      (path) =>
        u.pathname === path ||
        u.pathname.startsWith(path.endsWith("/") ? path : path + "/"),
    )
  )
    throw Error("WEB_URL_NOT_APPROVED");
  return u;
}
// Only a conservative, literal-prefix robots subset is supported. Wildcards/unknown delay syntax fail closed.
export function robotsPermit(text: string, path: string, interval: number) {
  const groups: { agents: string[]; rules: [string, string][] }[] = [];
  let group = { agents: [] as string[], rules: [] as [string, string][] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const at = line.indexOf(":");
    if (at < 0) return false;
    const key = line.slice(0, at).trim().toLowerCase(),
      value = line.slice(at + 1).trim();
    if (key === "user-agent") {
      if (group.rules.length) {
        groups.push(group);
        group = { agents: [], rules: [] };
      }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length) group.rules.push([key, value]);
  }
  groups.push(group);
  const specific = groups.filter((g) => g.agents.includes("adme"));
  const selected = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes("*"));
  if (!selected.length) return false;
  let length = -1,
    allowed = true;
  for (const g of selected)
    for (const [key, value] of g.rules) {
      if (key === "crawl-delay") {
        if (!/^\d+$/.test(value) || Number(value) > interval) return false;
        continue;
      }
      if (key !== "allow" && key !== "disallow") continue;
      if (value && (!value.startsWith("/") || /[*$%\\]/.test(value)))
        return false;
      if (
        value &&
        path.startsWith(value) &&
        (value.length > length || (value.length === length && key === "allow"))
      ) {
        length = value.length;
        allowed = key === "allow";
      }
    }
  return allowed;
}
type Download = { status: number; contentType: string; body: string };
export async function pinnedWebDownload(
  url: URL,
  address: string,
  userAgent: string,
  maxBytes: number,
): Promise<Download> {
  if (!isPublicWebAddress(address)) throw Error("WEB_PRIVATE_ADDRESS");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        agent: false,
        signal: AbortSignal.timeout(5000),
        family: 4,
        lookup: (_host, _opts, done) => done(null, address, 4),
        headers: {
          "User-Agent": userAgent,
          Accept: "text/plain,text/html",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        if (
          res.headers["content-encoding"] &&
          res.headers["content-encoding"] !== "identity"
        ) {
          res.destroy();
          reject(Error("WEB_ENCODING_REVIEW_REQUIRED"));
          return;
        }
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) res.destroy(Error("WEB_BODY_LIMIT"));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}
export async function fetchApprovedWeb(
  raw: string,
  policy: unknown,
  ports: {
    reserve: (
      host: string,
      requests: number,
      minIntervalSeconds: number,
    ) => Promise<boolean>;
    resolve?: (host: string) => Promise<string[]>;
    download?: typeof pinnedWebDownload;
  },
  now = Date.now(),
) {
  const p = policySchema.parse(policy);
  if (Date.parse(p.expiresAt) <= now) throw Error("WEB_REVIEW_EXPIRED");
  const url = approvedUrl(raw, p);
  if (!(await ports.reserve(p.host, 2, p.minIntervalSeconds)))
    throw Error("WEB_RATE_LIMIT");
  const addresses = await (
    ports.resolve ??
    (async (host) => (await lookup(host, { all: true })).map((x) => x.address))
  )(p.host);
  if (!addresses.length || addresses.some((a) => !isPublicWebAddress(a)))
    throw Error("WEB_PRIVATE_ADDRESS");
  const download = ports.download ?? pinnedWebDownload;
  const robots = await download(
    new URL("/robots.txt", url.origin),
    addresses[0],
    p.userAgent,
    65536,
  );
  if (
    robots.status !== 200 ||
    robots.body.length > 65536 ||
    !robotsPermit(robots.body, url.pathname, p.minIntervalSeconds)
  )
    throw Error("WEB_ROBOTS_DENIED");
  const page = await download(url, addresses[0], p.userAgent, 262144);
  if (page.status >= 300 && page.status < 400)
    throw Error("WEB_REDIRECT_REVIEW_REQUIRED");
  if (
    page.status !== 200 ||
    !/^text\/html(?:;|$)/i.test(page.contentType) ||
    Buffer.byteLength(page.body) > 262144 ||
    /captcha|type=["']password["']|sign in to continue/i.test(page.body)
  )
    throw Error("WEB_CONTENT_NOT_ALLOWED");
  return {
    html: page.body,
    sourceUrl: url.href,
    policyVersion: p.version,
    reviewRef: p.reviewRef,
  };
}
