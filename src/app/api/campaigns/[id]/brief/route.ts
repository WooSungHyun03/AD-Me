import { createHash } from "node:crypto";
import { z } from "zod";
import {
  compatibleApiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import { storageAdmin, inspectFile, safeName } from "@/lib/uploads";
import {
  BRIEF_BUCKET,
  BRIEF_MAX_BYTES,
  briefFileChange,
  briefFileReceipt,
  briefFilesPage,
} from "@/lib/campaign-brief-files";
type Ctx = RouteContext<"/api/campaigns/[id]/brief">;
async function owner(ctx: Ctx) {
  const c = await requireContext();
  if (c.role !== "brand") fail("브랜드 계정에서 사용할 수 있습니다.", 403);
  const id = parseInput(
    z.uuid(),
    (await ctx.params).id,
    "캠페인을 확인해주세요.",
  );
  const result = await c.db.rpc("campaign_brief_page", { p_campaign: id });
  if (result.error)
    failDatabase(result.error, "첨부 이력을 불러오지 못했습니다.");
  const parsed = briefFilesPage.safeParse(result.data);
  if (!parsed.success) fail("첨부 이력을 확인하지 못했습니다.", 503);
  return { c, id, page: parsed.data };
}
const receipt = (data: unknown) => {
  const parsed = briefFileReceipt.safeParse(data);
  if (!parsed.success)
    fail(
      "저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.",
      503,
    );
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
};
export const GET = compatibleApiRoute(
  "campaign.brief.get",
  async (_req, ctx: Ctx) => {
    return Response.json((await owner(ctx)).page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);
export const PATCH = compatibleApiRoute(
  "campaign.brief.change",
  async (req, ctx: Ctx) => {
    const { c, id, page } = await owner(ctx);
    const change = await parseBody(
      req,
      briefFileChange,
      "첨부와 현재 버전을 확인해주세요.",
    );
    if (change.action === "restore" && !page.enabled)
      fail("첨부 파일 기능을 준비 중입니다.", 503);
    const admin = storageAdmin();
    if (!admin) fail("파일 저장 연결을 준비 중입니다.", 503);
    const result = await admin.rpc("campaign_brief_change", {
      p_actor: c.user.id,
      p_campaign: id,
      p_expected: change.expectedVersion,
      p_key: change.clientKey,
      p_action: change.action,
      p_file: change.fileId,
      p_metadata: null,
    });
    if (result.error)
      failDatabase(
        result.error,
        "변경하지 못했습니다. 현재 이력을 확인해주세요.",
      );
    return receipt(result.data);
  },
);
export const POST = compatibleApiRoute(
  "campaign.brief.upload",
  async (req, ctx: Ctx) => {
    const { c, id, page } = await owner(ctx);
    if (!page.enabled) fail("첨부 파일 기능을 준비 중입니다.", 503);
    const form = await req.formData().catch(() => null);
    const input = parseInput(
      z.strictObject({
        clientKey: z.uuid(),
        expectedVersion: z
          .string()
          .regex(/^(0|[1-9][0-9]{0,2})$/)
          .transform(Number)
          .pipe(z.number().int().max(199)),
        rights: z.literal("on"),
      }),
      {
        clientKey: form?.get("clientKey"),
        expectedVersion: form?.get("expectedVersion"),
        rights: form?.get("rights"),
      },
      "파일 권리 확인과 현재 버전을 확인해주세요.",
    );
    const file = form?.get("file");
    if (!(file instanceof File) || !file.size)
      fail("파일을 선택해주세요.", 422);
    if (file.size > BRIEF_MAX_BYTES)
      fail("파일은 4MB 이하만 올릴 수 있습니다.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = inspectFile(bytes, file.name, file.type);
    if ("error" in checked)
      fail(
        "파일의 형식과 내용을 확인해주세요. PNG·JPG·WEBP·PDF만 지원합니다.",
        415,
      );
    const path = `${id}/${input.clientKey}.${checked.ext}`;
    const hash = createHash("sha256").update(bytes).digest("hex");
    const metadata = {
      path,
      name: safeName(file.name),
      mime: checked.mime,
      size: bytes.length,
      sha256: hash,
    };
    const args = {
      p_campaign: id,
      p_key: input.clientKey,
      p_action: "upload",
      p_file: input.clientKey,
      p_metadata: metadata,
    };
    const retry = await c.db.rpc("campaign_brief_retry", args);
    if (retry.error)
      failDatabase(
        retry.error,
        "같은 요청의 파일이 변경되었습니다. 현재 이력을 확인해주세요.",
      );
    if (retry.data) return receipt(retry.data);
    if (input.expectedVersion !== page.revision)
      fail(
        "첨부 버전이 변경되었습니다. 이력을 확인하고 다시 시도해주세요.",
        409,
      );
    const admin = storageAdmin();
    if (!admin) fail("파일 저장 연결을 준비 중입니다.", 503);
    let createdObject = false;
    const stored = await admin.storage
      .from(BRIEF_BUCKET)
      .upload(path, bytes, { contentType: checked.mime, upsert: false });
    if (stored.error) {
      // A prior upload may have lost its acknowledgement before committing the pointer.
      // Reuse only byte-identical immutable content; never overwrite a conflicting object.
      const prior = await admin.storage.from(BRIEF_BUCKET).download(path);
      if (
        prior.error ||
        !prior.data ||
        prior.data.size !== bytes.length ||
        createHash("sha256")
          .update(new Uint8Array(await prior.data.arrayBuffer()))
          .digest("hex") !== hash
      )
        fail(
          "파일 전송 결과를 확인하지 못했습니다. 같은 파일로 다시 시도해주세요.",
          409,
        );
    } else createdObject = true;
    const result = await admin.rpc("campaign_brief_change", {
      ...args,
      p_actor: c.user.id,
      p_expected: input.expectedVersion,
    });
    if (result.error) {
      const recovered = await c.db.rpc("campaign_brief_retry", args);
      if (!recovered.error && recovered.data) return receipt(recovered.data);
      // Only a confirmed SQL rejection with no committed receipt is safe to clean up.
      if (
        createdObject &&
        !recovered.error &&
        /^[0-9A-Z]{5}$/.test(result.error.code ?? "")
      )
        await admin.storage.from(BRIEF_BUCKET).remove([path]);
      failDatabase(
        result.error,
        "파일을 활성화하지 못했습니다. 이력을 확인하고 같은 요청으로 다시 시도해주세요.",
      );
    }
    return receipt(result.data);
  },
  { maxBodyBytes: BRIEF_MAX_BYTES + 64 * 1024 },
);
