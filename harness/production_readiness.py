#!/usr/bin/env python3
"""Render and validate the production-readiness handoff from its canonical JSON."""
import argparse
import csv
import io
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "production-readiness"
FIELDS = {
    "id", "title", "category", "priority", "severity", "problem", "reproduction",
    "pages", "code_files", "database", "expected", "implementation", "change_files",
    "new_files", "depends_on", "impact", "security", "tests", "acceptance",
    "points", "owner", "blockers", "evidence", "status",
}
STATES = {"TODO", "IN_PROGRESS", "BLOCKED", "IMPLEMENTED", "TESTED",
          "INTEGRATED", "DEPLOYED", "VERIFIED"}
OWNERS = {"DEV-A", "DEV-B", "OPERATOR"}
OPERATOR_TRACKS = {
    "LOCAL_AI": "Local AI 호스트·모델 운영",
    "DEPLOYMENT": "배포 사이트·DB·도메인",
    "API_KEYS": "API 키·공급자 승인",
    "WEB_DESIGN": "웹디자인 시안·화면 승인",
    "BUSINESS_APPROVAL": "서비스 운영·사업 승인",
}
LABELS = {
    "problem": "현재 문제", "reproduction": "재현·관찰", "pages": "화면",
    "code_files": "관련 코드", "database": "DB·RPC", "expected": "기대 동작",
    "implementation": "구현", "change_files": "변경 파일", "new_files": "신규 파일",
    "depends_on": "선행 티켓", "impact": "영향", "security": "보안",
    "tests": "검증", "acceptance": "완료 조건", "blockers": "차단 요인",
    "evidence": "증빙",
}


def validate(data):
    tickets = data["tickets"]
    records = {row["id"]: row for row in tickets}
    assert len(tickets) == len(records), "duplicate ID"
    original = json.loads((ROOT / "harness/service_backlog_v2.json").read_text())
    original_ids = {row["id"] for key in ("tickets", "user_tickets") for row in original[key]}
    assert original_ids <= records.keys(), "missing legacy ID"
    assert len({row["title"] for row in tickets}) == len(records), "duplicate title"
    for row in tickets:
        assert FIELDS <= row.keys(), f"{row['id']}: missing {FIELDS - row.keys()}"
        assert row["owner"] in OWNERS and row["status"] in STATES
        if row["owner"] == "OPERATOR":
            assert row.get("execution_track") in OPERATOR_TRACKS, row["id"]
            assert row["points"] is None, row["id"]
        assert row["priority"] in {"P0", "P1", "P2", "P3"}
        assert all(row[key] for key in FIELDS - {"depends_on", "points"}), row["id"]
        assert set(row["depends_on"]) <= records.keys(), row["id"]
        assert len(set(row["depends_on"])) == len(row["depends_on"]), row["id"]
        assert row["status"] != "VERIFIED" or row.get("verified_scope"), row["id"]
    visiting, visited = set(), set()
    def visit(ticket):
        assert ticket not in visiting, f"cycle at {ticket}"
        if ticket in visited:
            return
        visiting.add(ticket)
        for predecessor in records[ticket]["depends_on"]:
            visit(predecessor)
        visiting.remove(ticket)
        visited.add(ticket)
    for ticket in records:
        visit(ticket)
    totals = workloads(tickets)
    a, b = [totals[owner]["points"] for owner in ("DEV-A", "DEV-B")]
    assert abs(a-b) / max(a, b) <= 0.10, f"workload A={a} B={b}"
    return records


def workloads(rows):
    return {
        owner: {
            "tickets": len(active),
            "points": sum(row["points"] or 0 for row in active),
            "p0": sum(row["priority"] == "P0" for row in active),
        }
        for owner in ("DEV-A", "DEV-B")
        for active in [[r for r in rows if r["owner"] == owner and r["scope"] == "ACTIVE"
                        and r["status"] != "VERIFIED"]]
    }


def printable(value):
    return " · ".join(value) if isinstance(value, list) else str(value)


def ticket_text(row):
    pieces = [
        f"## {row['id']} · {row['title']}",
        "",
        f"{row['owner']} · {row['priority']} · {row['severity']} · {row['category']} · "
        f"{row['status']} · {row['points'] if row['points'] is not None else '외부'} SP · {row['scope']}",
        "",
    ]
    for field, label in LABELS.items():
        text = printable(row[field]) if row[field] else "없음"
        pieces.append(f"- **{label}** — {text}")
    if row.get("verified_scope"):
        pieces.append(f"- **검증 범위** — {row['verified_scope']}")
    if row.get("previous_owner"):
        pieces.append(f"- **이전 담당 기록** — {row['previous_owner']}")
    if row.get("prior_status"):
        pieces.append(f"- **이전 기록** — {row['prior_status']}")
    return "\n".join(pieces)


def render_developer(owner, rows, summary, records):
    own = sorted((row for row in rows if row["owner"] == owner),
                 key=lambda row:(row["scope"] != "ACTIVE", row["priority"], row["id"]))
    direction = {
        "DEV-A": "YouTube 출처·수집, 검색·추천·태그, Local AI 호출 코드와 데이터 투영·권한 기반. 탐색/추천 화면, API, DB 및 테스트를 함께 수정한다.",
        "DEV-B": "브랜드·크리에이터 여정, 공고·지원·채팅, 결제·HOT, 운영 화면·웹디자인 구현·릴리스 패킷. 해당 화면, API, DB 및 테스트를 함께 수정한다.",
    }[owner]
    waves = {
        "DEV-A": "첫 착수는 D003·D004 환경/API 계약이다. B의 D017 허용 범위가 준비되면 D018·D019로 DTO와 원본 수집을 고정하고 D021·D075를 격리에서 검증한다. D044·D045와 PR-001/002는 승인된 데이터와 D039 조건 변환을 사용한다.",
        "DEV-B": "첫 착수는 D001 무료/TEST 분리와 D017 허용 목록의 운영 입력이다. D087 복원과 D085 통합 기준을 격리에서 준비하는 동안 D043·D049 공고·지원 계약을 확정한다. D051·D052 채팅과 D065–D070 TEST/HOT을 해당 선행 뒤 검증한다.",
    }[owner]
    links = []
    for row in own:
        for need in row["depends_on"]:
            pred = records[need]
            if pred["owner"] != owner and row["scope"] == "ACTIVE":
                links.append(f"- {row['id']} ← {need} ({pred['owner']}) · {pred['acceptance']}")
    prompt = f"""# AD Me {owner} 독립 실행 문서

너는 AD Me의 {owner} 역할을 수행한다. 이 문서의 담당 티켓을 우선 구현하고 SHARED_CONTRACT를 준수한다. 기존 코드를 보존하고 실제 테스트 증거를 남긴 뒤 main에 push한다. 검증하지 않은 기능은 완료로 표시하지 않는다.

## 시작 프롬프트

> 저장소의 AGENTS.md와 docs/production-readiness/SHARED_CONTRACT.md, 본 문서를 읽어라. git fetch origin main, git status --short, git rev-parse HEAD를 실행해 최신 main 기준의 독립 작업트리를 사용하라. 본 문서에서 선행 조건이 충족된 ACTIVE P0를 한 건 골라 관련 화면·API·DB·테스트를 함께 조사하라. 재현을 기록하고 가장 작은 호환 변경을 구현하라. 로컬 복제 DB에서 역할별 성공·거부·재시도를 확인하고 desktop/mobile evidence를 남겨라. 운영자 작업이 막힌 경우 해당 실제 환경 검증만 BLOCKED로 남기고, 먼저 진행 가능한 계약·단위 테스트를 실행하라. 테스트 후 한 티켓 커밋으로 저장하고 상대 담당과 공유 파일을 통합한 뒤 일반 push로 main에 반영하라. 운영 마이그레이션·라이브 결제·외부 승인 대행은 별도 승인 없이 실행하지 마라.

{direction}

현재 운영은 https://be-celeb.org 의 YouTube 전용 무료 베타이며 Toss TEST는 격리한다. main과 운영 스키마 차이는 D085에서 다룬다. 테스트 데이터를 운영 공개 목록에 게시하지 않는다. ARCHIVED는 과거 기록으로 유지한다. GATED는 외부 승인 없이 운영에 적용하지 않는다.

미완료 ACTIVE {summary['tickets']}건 · {summary['points']} SP · P0 {summary['p0']}건.

## 착수 순서 및 공유 계약

{waves}

아래 외부 인계를 먼저 확인한다. 디렉터리 전체를 재작성하지 말고 담당 티켓 범위의 실제 계약·테스트를 수정한다. 각 티켓의 `변경 파일`은 진입점이며 실제 코드를 읽어 확정한다. 번호가 할당된 마이그레이션은 편집하지 않으며 CLI로 새 파일을 생성한다. 시간은 UTC 저장/KST 표시, 금액은 정수 KRW, 공개 DTO에는 내부 소유자 ID나 개인정보를 포함하지 않는다.

A→B · 승인 필드와 출처·갱신·결측을 포함한 공개 채널 DTO 및 추천 스냅샷 계약을 전달한다.
B→A · 캠페인 입력, 지원 상태, 결제·이용권 결과와 채팅 참가자 권한을 합의한다.
운영자에게 넘길 모델·배포·키·디자인 작업은 [운영자 실행 문서](OPERATOR_TICKETS.md)에 있다. 운영 변경 전에 마이그레이션 적용과 앱 교체 순서, 무료/TEST 격리, 실패 복구 조건을 교차 리뷰한다.

### 상대 개발자 및 운영자 선행

{chr(10).join(links) or '없음'}

## 완료 보고 형식

`ID / 상태 / main SHA / 변경 파일 / SQL·API 계약 / 실행 명령과 통과·실패 / desktop·mobile / 권한·재시도 / 남은 운영자 게이트 / 운영 검증 여부 / 증빙 경로`. 이전 증빙은 새 결과와 구분한다. 상태 변경은 ALL_TICKETS.json에 반영한 뒤 `python3 harness/production_readiness.py`로 파생 원장을 다시 생성한다.

"""
    return prompt + "\n\n".join(map(ticket_text, own)) + "\n"


def render_operator(rows):
    own = [row for row in rows if row["owner"] == "OPERATOR"]
    active = sum(row["scope"] == "ACTIVE" and row["status"] != "VERIFIED" for row in own)
    intro = f"""# AD Me 운영자 독립 실행 문서

너는 AD Me 운영자다. Local AI 실행 환경, 배포 사이트와 운영 DB, 공급자/API 키, 웹디자인 시안·승인, 외부 운영 결정을 맡는다. 각 티켓의 선행 상태를 먼저 확인한다. 확정한 결정과 실제 성공 증거를 원장에 기록한다.

전체 {len(own)}건 · ACTIVE 미완료 {active}건. 기존 U 번호는 유지한다. 사업 관련 기존 BUSINESS 항목은 운영자 문서에서 함께 관리하고 해당 책임자·전문기관·공급자가 실제 승인을 한다.

## 시작 프롬프트

> 최신 main과 [공유 계약](SHARED_CONTRACT.md)을 확인한다. 아래 분야에서 착수 가능한 티켓을 골라 운영 기준과 확인할 항목을 먼저 적는다. 브라우저 승인·동의·키 등록은 해당 계정에서 처리한다. 에이전트가 실행할 수 있는 터미널·리포트 작업은 승인된 범위에서 맡긴다. 변경 뒤 실제 호스트 또는 URL과 영향받는 기능을 확인한다. 공급자 키와 고객 자료는 채팅·문서·Git에 넣지 않는다.

## 분야별 실행·인수 기준

| 분야 | 운영자가 할 일 | 개발자 인수물 및 확인 |
|---|---|---|
| Local AI · PR-003 | 호스트·GPU·Ollama·모델 버전, loopback, 실행 서비스 상태, 실패·복구 확인 | A의 D048 실행 파일과 B의 D086 큐·경보 계약을 인수한다. 합성 입력을 사용한 승인된 격리 시험의 버전·latency·실패·복구 결과를 남긴다. |
| 배포 사이트 · U004/U005/U017 | 운영 DB 적용·Vercel 승격·도메인·롤백 | B의 D085/D087 변경·복원 패킷과 A의 D075 권한 증거를 확인한다. 스키마 기준과 배포 SHA 대조 후 운영 URL·권한·핵심 흐름을 확인한다. |
| API 키 · U006/U007/U009/U015 | 키 발급·환경별 비공개 등록·제한·회전 및 공급자 콘솔 승인 | A의 D003 설정명과 필요한 스코프를 인수한다. 키 대신 환경·범위·검증 결과를 공유하고 무료/TEST/라이브 구분을 확인한다. |
| 웹디자인 · O001 | 브랜드 톤과 페이지 우선순위, 시안 제작·선택, 프리뷰 승인 | 기준서와 시안을 B에게 넘긴다. B가 공통 UI에 적용하면 A가 탐색·추천 표시를, 운영자가 desktop/mobile 실화면을 확인한다. |
| 서비스·사업 | 출시 범위, 개인정보·콘텐츠 권리, 실결제 여부와 공식 계약 승인 | [외부 조치](EXTERNAL_ACTIONS.md)와 [출시 판정](GO_NO_GO.md)의 증거로 확인한다. 현재 사업자 미등록 방침에 따라 라이브 판매는 gated다. |

운영 적용은 [릴리스 체크리스트](RELEASE_CHECKLIST.md)를 따른다. 이전 마이그레이션 패킷은 현재 운영 스키마와 검증 기준을 대조한 뒤 적용한다. 로컬 모델 변경은 공유 GPU와 기존 워커 상태를 확인한 뒤 진행한다.

## 완료 보고 형식

ID · 상태 · 실행 환경/URL · 계정 승인자 · 기준 SHA/모델 버전 · 실행 및 성공/실패 · 변경된 설정명(값 제외) · 증빙 · 롤백·다음 담당. ALL_TICKETS.json을 수정하고 python3 harness/production_readiness.py로 세 실행 문서를 다시 생성한다.
"""
    sections = [intro]
    for key, name in OPERATOR_TRACKS.items():
        tickets = sorted((row for row in own if row["execution_track"] == key),
                         key=lambda row: (row["scope"] != "ACTIVE", row["priority"], row["id"]))
        sections.append(f"# {name}\n\n" + "\n\n".join(map(ticket_text, tickets)))
    return "\n\n".join(sections) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = json.loads((DOC / "ALL_TICKETS.json").read_text())
    records = validate(data)
    tickets = data["tickets"]
    totals = workloads(tickets)
    csv_out = io.StringIO(newline="")
    fieldnames = list(dict.fromkeys(key for row in tickets for key in row))
    writer = csv.DictWriter(csv_out, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for row in tickets:
        writer.writerow({key: printable(value) for key, value in row.items()})
    expected = {
        "ALL_TICKETS.md": "# AD Me 전체 출시 티켓\n\n"
        "ALL_TICKETS.json에서 생성했다. 상태와 기존 이력은 검증 범위별로 구분한다.\n\n"
        + "\n\n".join(map(ticket_text, tickets)) + "\n",
        "ALL_TICKETS.csv": csv_out.getvalue(),
        "DEV_A_TICKETS.md": render_developer("DEV-A", tickets, totals["DEV-A"], records),
        "DEV_B_TICKETS.md": render_developer("DEV-B", tickets, totals["DEV-B"], records),
        "OPERATOR_TICKETS.md": render_operator(tickets),
    }
    for filename, contents in expected.items():
        path = DOC / filename
        if args.check:
            assert path.read_text() == contents, f"stale artifact: {filename}"
        else:
            path.write_text(contents)
    for document in ("MASTER_AUDIT.md", "GO_NO_GO.md", "SHARED_CONTRACT.md",
                     "RELEASE_CHECKLIST.md", "EXTERNAL_ACTIONS.md", "PROGRESS.md",
                     "DEV_A_TICKETS.md", "DEV_B_TICKETS.md", "OPERATOR_TICKETS.md"):
        path = DOC / document
        for link in re.findall(r"\[[^\]]*\]\(([^)]+)\)", path.read_text()):
            target = link.split("#", 1)[0]
            if target and not target.startswith(("https:", "http:")):
                assert (path.parent / target).exists(), f"broken link: {document} -> {target}"
    states = Counter(row["status"] for row in tickets)
    print(f"PASS {len(tickets)} tickets; states={dict(states)}; workload={totals}")


if __name__ == "__main__":
    main()
