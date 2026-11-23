import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { localRuntime } from "./local-qa.mjs";
const doc = JSON.parse(readFileSync("src/lib/policy-document.json", "utf8"));
export function publicationArgs(scope, data, key = randomUUID()) {
  localRuntime();
  return {
    p_scope: scope,
    p_data: data,
    p_version: doc.version,
    p_hash: doc.documentHash,
    p_key: key,
  };
}
export function creatorPublicationData(profile) {
  return Object.fromEntries(
    [
      "name",
      "bio",
      "social_url",
      "portfolio_url",
      "owner_consent",
      "categories",
      "vibes",
      "formats",
      "platforms",
      "price_min_krw",
      "price_max_krw",
      "is_available",
      "published",
    ]
      .filter((k) => k in profile)
      .map((k) => [k, profile[k]])
      .concat([
        ["owner_consent", profile.owner_consent ?? false],
        ["published", profile.published ?? true],
      ]),
  );
}
export function brandPublicationData(args) {
  return {
    name: args.p_name,
    brandName: args.p_brand_name,
    industry: args.p_industry,
    introduction: args.p_introduction,
    published: args.p_published,
    contactName: args.p_contact_name,
    contactEmail: args.p_contact_email,
    contactVisibility: args.p_contact_visibility,
    ...(args.p_logo === undefined ? {} : { logoUploadId: args.p_logo }),
  };
}
