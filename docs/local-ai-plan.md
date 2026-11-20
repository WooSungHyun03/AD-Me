# 로컬 AI 운영

Vercel이 사용자 소유 AI 작업을 Supabase에 등록한다. 로컬 워커는 외부로 나가는 HTTPS 연결로 작업을 하나씩 가져오고, loopback Ollama에 요청한 뒤 DB에 결과를 기록한다. 공개 추론 포트는 필요 없다. 워커 전용 토큰의 SHA-256만 DB에 저장한다. Supabase service-role 키는 워커에 필요 없다.

Ollama 0.32.1, Qwen3 1.7B Q4_K_M 및 EmbeddingGemma를 분리된 로컬 모델 저장소에 설치했다. 다른 프로세스의 GPU 점유를 고려해 현재 CPU만 사용하고 CPUQuota 400%, 메모리 7GiB, 동시에 모델 1개 및 추론 1개로 설정했다. 한국어 JSON 3건의 평균 7,246ms, 관측 p95 15,327ms, 임베딩 768차원. 표본이 작아 처리량 기준으로 해석하지 않는다.

Qwen3는 가벼운 다국어 구조화 출력에 적합하며, Ollama는 이미 설치되어 운영 변경 범위가 작았다. vLLM은 GPU가 전용일 때 배치 처리에 적합하다. llama.cpp 직접 운영은 세부 제어가 가능하지만 모델 서빙과 상태 관리가 추가로 필요하다. EmbeddingGemma는 [모델 이용 조건](https://ai.google.dev/gemma/terms)을 따른다. [Qwen3 모델](https://ollama.com/library/qwen3).

AI-07의 광고 콘셉트, 영상 구성, 협업 제안 초안은 브랜드 계정으로 요청할 수 있다. 생성 모델에는 DB 조회, 협업 전송, 결제, 운영 명령 권한이 없다. AI-01/02/03/05/06/08/09의 분석·검색·에이전트 범위와 캐시, GPU 운용, 임베딩 저장은 후속 항목이다. AI-04는 기존 규칙 추천을 유지한다.
