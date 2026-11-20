import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { DraftQueue } from "./queue";

export default async function LocalTools() {
  const c = await context();
  if (!c) redirect("/login");
  return (
    <section className="wrap">
      <h1 className="page-title">AI 캠페인 초안</h1>
      <p>
        상품, 고객, 플랫폼, 표현상 주의점을 입력하면 광고 콘셉트와 협업 메시지
        초안을 만듭니다.
      </p>
      {c.role === "brand" ? (
        <DraftQueue />
      ) : (
        <p>브랜드 계정으로 이용할 수 있습니다.</p>
      )}
      <Link href="/tools">AI 스튜디오 도구 보기</Link>
    </section>
  );
}
