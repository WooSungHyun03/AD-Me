// Publish a creator's own profile exactly like POST /api/profile: through the D073 versioned
// publication transaction (direct published writes are refused). Needs no DEV-A runtime file.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const policy = JSON.parse(readFileSync("src/lib/policy-document.json", "utf8"));
const FIELDS = [
  "name", "bio", "social_url", "portfolio_url", "categories", "vibes", "formats",
  "platforms", "price_min_krw", "price_max_krw", "is_available",
];

export function publishCreator(db, profile, published = true) {
  const data = Object.fromEntries(FIELDS.filter((k) => k in profile).map((k) => [k, profile[k]]));
  return db.rpc("save_publication", {
    p_scope: "creator",
    p_data: { bio: "", social_url: "", portfolio_url: "", ...data, owner_consent: profile.owner_consent ?? false, published },
    p_version: policy.version,
    p_hash: policy.documentHash,
    p_key: randomUUID(),
  });
}
