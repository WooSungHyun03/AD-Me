# Harness / Loop engineering operational model

## Not a magical background agent
ChatGPT Desktop의 파일 접근/컴퓨터 사용 모드 또는 연결된 개발 CLI가 **실제로 작동 중인 동안** 반복 실행할 수 있다. `harness/loop.py`는 AI를 자체 호출하지 않으며 작업 상태·의존성·증거를 추적한다. 한 세션 종료 후 다음 세션에서 재개할 수 있다.

## Loop state machine
`pending` -> `in_progress` -> `done` or `blocked` (with explicit reason). `done` requires a non-empty evidence field. `blocked` can later `reopen` to pending. Task dependencies all done before task ready. P0 first, then P1, P2.

```
OBSERVE   (read state, git diff, CI/test log)
SELECT    (next ready ID)
PLAN      (affected files, API+DB contract, test list)
IMPLEMENT (minimal end-to-end product increment)
VERIFY    (lint + types + tests + build + browser)
CRITIQUE  (UI, permission abuse, billing abuse, provenance)
REPAIR    (root cause, bounded 3 tries)
RECORD    (session_log, evidence, task status, decision)
NEXT      (repeat)
```

## CLI
```
python3 harness/selftest.py
python3 harness/loop.py status
python3 harness/loop.py next
python3 harness/loop.py start T001
python3 harness/loop.py complete T001 --evidence "npm run test passed; screenshot path; changed file list"
python3 harness/loop.py block T002 --reason "Need Supabase project credentials"
python3 harness/loop.py reopen T002
python3 harness/check.py --mode scaffold   # baseline harness checks only
python3 harness/check.py --mode all        # requires complete application; CI-like gates
```

## Reviews after each vertical slice
- Does a real user complete the journey with real DB state, not UI-only mock?
- Are test seed, estimates, and verified fields visibly distinguished?
- Would an unauthorized user obtain/change another role's data?
- Does the match result change when tags/budget change; does missing data affect confidence, not fabricated score?
- Would modifying URL/order amount grant membership without Toss confirmation?
- Is the UI understandable in under 30s at 390px/1440px?

## Separate development and review roles
You may run distinct review passes inside the same agent session:
- Architect: schema/contracts/risks
- Implementer: code + tests
- Test engineer: adversarial tests & screenshot walkthrough
- Design critic: hierarchy, accessibility, logo fidelity
- Payment security reviewer: IDOR/replay/amount/idempotency
Reviewer must offer concrete failing test/URL or documented evidence, not generic praise.

## Stop/Resume
If session stops: append date, last task, commands/tests and blocker to `harness/session_log.md`; do not claim background work. Next prompt: "Read AGENTS.md, docs/HARNESS.md, harness/tasks.json and harness/session_log.md; resume the next ready task and continue verify/repair loop; deploy via Vercel + Supabase and verify URL once release gates and credentials permit."
