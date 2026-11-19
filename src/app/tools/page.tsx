import { AiStudio } from "@/components/ai-studio";
export default function Tools() {
  return (
    <section className="wrap">
      <span className="eyebrow">AI studio / draft workspace</span>
      <h1 className="page-title">좋은 협업은, 좋은 이야기에서.</h1>
      <p>
        광고 콘셉트와 제안 메시지의 출발점. API 키 없이 작동하는 규칙 기반 초안
        도구입니다.
      </p>
      <AiStudio />
    </section>
  );
}
