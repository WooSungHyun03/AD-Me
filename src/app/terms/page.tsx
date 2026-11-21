import Link from "next/link";
import { policyDocument } from "@/lib/consent";
export default function Terms() {
  const { version, content: c } = policyDocument;
  return (
    <section className="wrap prose">
      <h1 className="page-title">이용약관 검토본</h1>
      <p>버전 {version}</p>
      <p className="notice">{c.review}</p>
      <h2>서비스 범위</h2>
      <p>{c.service}</p>
      <p>{c.adult}</p>
      <h2>계정과 자료</h2>
      <p>{c.account}</p>
      <p>{c.collaboration}</p>
      <h2>안전한 이용과 운영 검토</h2>
      <p>{c.conduct}</p>
      <p>{c.source}</p>
      <h2>이용 중단과 권리 행사</h2>
      <p>{c.retention}</p>
      <p>{c.rights}</p>
      <h2>운영자</h2>
      <p>{c.operator}</p>
      <Link href="/privacy">개인정보 처리 안내</Link>
    </section>
  );
}
