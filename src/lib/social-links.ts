export type SocialLink = {
  provider: "youtube" | "instagram" | "tiktok";
  href: string;
  videoId?: string;
};

const videoId = /^[A-Za-z0-9_-]{11}$/;
const youtubeChannel = /^UC[A-Za-z0-9_-]{22}$/;
const youtubeHandle = /^@[\p{L}\p{M}\p{N}_.-]{1,100}$/u;
const instagramProfile = /^[a-z0-9_][a-z0-9_.]{0,29}$/i;
const instagramReserved = new Set([
  "accounts",
  "about",
  "api",
  "challenge",
  "developer",
  "direct",
  "explore",
  "legal",
  "p",
  "reel",
  "reels",
  "stories",
  "web",
]);

export function safeHttpsLink(value: string | undefined) {
  if (!value || !/^https:\/\//i.test(value) || /[\\\s]/.test(value))
    return null;
  const url = URL.parse(value);
  return url?.protocol === "https:" && !url.username && !url.password
    ? url
    : null;
}

function youtubeVideo(id: string | null | undefined): SocialLink | null {
  return id && videoId.test(id)
    ? {
        provider: "youtube",
        href: `https://www.youtube.com/watch?v=${id}`,
        videoId: id,
      }
    : null;
}

export function normalizeSocialLink(
  value: string | undefined,
): SocialLink | null {
  const url = safeHttpsLink(value);
  if (!url || url.port || /%(?![a-f0-9]{2})|%2f|%5c/i.test(url.pathname))
    return null;
  const segments = url.pathname.replace(/^\/|\/$/g, "").split("/");
  let first: string;
  try {
    first = decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
  const [, second, third] = segments;

  switch (url.hostname) {
    case "youtu.be":
      return segments.length === 1 ? youtubeVideo(first) : null;
    case "youtube.com":
    case "www.youtube.com":
    case "m.youtube.com":
      if (segments.length === 1 && first === "watch") {
        const ids = url.searchParams.getAll("v");
        return ids.length === 1 ? youtubeVideo(ids[0]) : null;
      }
      if (segments.length === 2 && first === "shorts")
        return youtubeVideo(second);
      if (segments.length === 1 && youtubeHandle.test(first))
        return {
          provider: "youtube",
          href: `https://www.youtube.com/@${encodeURIComponent(first.slice(1))}`,
        };
      if (
        segments.length === 2 &&
        first === "channel" &&
        youtubeChannel.test(second)
      )
        return {
          provider: "youtube",
          href: `https://www.youtube.com/channel/${second}`,
        };
      return null;
    case "instagram.com":
    case "www.instagram.com":
      if (
        segments.length === 1 &&
        instagramProfile.test(first) &&
        !instagramReserved.has(first.toLowerCase())
      )
        return {
          provider: "instagram",
          href: `https://www.instagram.com/${first}/`,
        };
      if (
        segments.length === 2 &&
        ["p", "reel"].includes(first) &&
        /^[A-Za-z0-9_-]{1,32}$/.test(second)
      )
        return {
          provider: "instagram",
          href: `https://www.instagram.com/${first}/${second}/`,
        };
      return null;
    case "tiktok.com":
    case "www.tiktok.com":
      if (!/^@[a-z0-9_.]{1,24}$/i.test(first)) return null;
      if (segments.length === 1)
        return { provider: "tiktok", href: `https://www.tiktok.com/${first}` };
      if (
        segments.length === 3 &&
        second === "video" &&
        /^\d{1,25}$/.test(third)
      )
        return {
          provider: "tiktok",
          href: `https://www.tiktok.com/${first}/video/${third}`,
        };
      return null;
    default:
      return null;
  }
}

export function publicProfilePath(id: string, published: boolean) {
  return published && id ? `/creators/${encodeURIComponent(id)}` : null;
}
