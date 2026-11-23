import { z } from "zod";
import {
  compatibleApiRoute,
  fail,
  failDatabase,
  parseInput,
  requireContext,
} from "@/lib/api";
import { BRIEF_BUCKET } from "@/lib/campaign-brief-files";
export const POST = compatibleApiRoute(
  "campaign.brief.download",
  async (_req, ctx: RouteContext<"/api/campaigns/[id]/brief/[fileId]">) => {
    const c = await requireContext();
    if (c.role !== "brand") fail("브랜드 계정에서 사용할 수 있습니다.", 403);
    const { id, fileId } = parseInput(
      z.strictObject({ id: z.uuid(), fileId: z.uuid() }),
      await ctx.params,
      "첨부 파일을 확인해주세요.",
    );
    const result = await c.db.rpc("campaign_brief_file", {
      p_campaign: id,
      p_file: fileId,
    });
    if (result.error) failDatabase(result.error, "파일을 찾을 수 없습니다.");
    const data = z
      .strictObject({
        path: z
          .string()
          .regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp|pdf)$/),
        name: z.string().max(120),
      })
      .safeParse(result.data);
    if (!data.success) fail("파일을 찾을 수 없습니다.", 404);
    const signed = await c.db.storage
      .from(BRIEF_BUCKET)
      .createSignedUrl(data.data.path, 60, {
        download:
          "brief-" +
          fileId.slice(0, 8) +
          "." +
          data.data.path.split(".").at(-1),
      });
    if (signed.error || !signed.data) fail("파일을 찾을 수 없습니다.", 404);
    return Response.json(
      { url: signed.data.signedUrl, expiresIn: 60 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
);
