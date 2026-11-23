# AD Me 구현 기준점

2026-11-20 조사. GitHub main은 4437eb1에서 시작했다. 앞선 배포에 쓰인 인증·Toss 변경은 기존 브랜치의 d1b2aa5에 있었고, 그 커밋을 로컬 main에 fast-forward해 배포 기능을 보존했다. GitHub main에는 필수 리뷰 1인 및 checks 보호 규칙이 있다.

Next.js 16.4.6 App Router와 React 19, Supabase Auth 및 PostgreSQL, Vercel을 사용한다. 캠페인, 즐겨찾기, 프로필, 협업, 신고는 사용자 세션을 사용한다. 결제 승인은 Toss TEST API를 호출하는 Supabase Edge Function이 처리한다. 기존 관리자 페이지는 profiles.role이 admin일 때 접근한다. 기존 AI 스튜디오와 추천은 규칙 기반이다. GitHub CI는 lint, 타입, 단위 테스트, 빌드와 Harness 검사를 한다.

로컬 개발 및 추론 호스트는 Ubuntu 24.04.3, i7-13700 24 논리 CPU, RAM 62GiB, RTX 4080 16,376MiB, NVIDIA 580.173.02, 드라이버 표기 CUDA 13.0, Docker 28.5.1이다. 시작 시 GPU 메모리 8,072MiB 사용, 사용률 94%였고 Python 연구 프로세스가 VRAM 5,836MiB를 사용하고 있었다. 디스크 여유 428G. 운영 PostgreSQL 17.12와 로컬 검증 PostgreSQL 17.11을 분리했다.

신규 작업은 Supabase 비공개 스키마와 제한된 RPC를 거친다. 웹 요청, 원본 수집, 로컬 생성 AI는 별도 경계로 처리한다.
