#!/usr/bin/env python3
"""Outbound-only AD Me worker. Error codes are logged without provider bodies."""
import argparse
import json
import os
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

OLLAMA = "http://127.0.0.1:11539"
MODEL = "qwen3:1.7b-q4_K_M"
EMBED_MODEL = "embeddinggemma"
DRAFT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["concept", "outline", "proposal"],
    "properties": {
        "concept": {"type": "string", "minLength": 1, "maxLength": 600},
        "outline": {"type": "array", "minItems": 1, "maxItems": 6,
                    "items": {"type": "string", "minLength": 1, "maxLength": 320}},
        "proposal": {"type": "string", "minLength": 1, "maxLength": 900},
    },
}


class WorkerError(Exception):
    pass


def request(url, headers=None, payload=None, timeout=10):
    req = Request(url, headers={"Content-Type": "application/json", **(headers or {})},
                  data=json.dumps(payload).encode() if payload is not None else None)
    with urlopen(req, timeout=timeout) as response:
        return json.load(response)


def youtube(path, **params):
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        raise WorkerError("YOUTUBE_KEY_MISSING")
    try:
        return request("https://www.googleapis.com/youtube/v3/" + path + "?" + urlencode(params),
                       {"X-Goog-Api-Key": key})
    except HTTPError as exc:
        if exc.code in (403, 429):
            body = json.load(exc)
            reasons = {error.get("reason") for error in body.get("error", {}).get("errors", [])}
            if exc.code == 429 or reasons & {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}:
                raise WorkerError("QUOTA") from None
        raise WorkerError("YOUTUBE_HTTP_" + str(exc.code)) from None


def channels(ids):
    if not ids:
        return []
    data = youtube("channels", part="snippet,statistics,contentDetails", id=",".join(ids),
                   fields="items(id,snippet/title,statistics(subscriberCount,hiddenSubscriberCount),contentDetails/relatedPlaylists/uploads)")
    rows = []
    for item in data.get("items", []):
        info = item.get("statistics", {})
        subscribers = info.get("subscriberCount")
        playlist = item.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        video_ids = []
        if playlist:
            try:
                videos = youtube("playlistItems", part="contentDetails", playlistId=playlist, maxResults=5,
                                 fields="items/contentDetails/videoId")
                video_ids = [entry["contentDetails"]["videoId"] for entry in videos.get("items", [])]
            except WorkerError as error:
                if str(error) != "YOUTUBE_HTTP_404":
                    raise
        rows.append({
            "id": item["id"], "title": item["snippet"]["title"],
            "subscribers": int(subscribers) if subscribers is not None and not info.get("hiddenSubscriberCount") else None,
            "video_ids": video_ids,
        })
    ids_to_fetch = list(dict.fromkeys(video for row in rows for video in row["video_ids"]))
    public_videos = {}
    for i in range(0, len(ids_to_fetch), 50):
        data = youtube("videos", part="snippet,status,statistics", id=",".join(ids_to_fetch[i:i + 50]),
                       fields="items(id,snippet(title,publishedAt),status/privacyStatus,statistics/viewCount)")
        for item in data.get("items", []):
            if item.get("status", {}).get("privacyStatus") == "public":
                views = item.get("statistics", {}).get("viewCount")
                public_videos[item["id"]] = {
                    "id": item["id"], "title": item["snippet"]["title"],
                    "publishedAt": item["snippet"]["publishedAt"],
                    "views": int(views) if views is not None else None,
                }
    for row in rows:
        row["videos"] = [public_videos[video] for video in row.pop("video_ids") if video in public_videos]
    return rows


def draft(brief):
    result = request(OLLAMA + "/api/chat", payload={
        "model": MODEL, "stream": False, "think": False, "format": DRAFT_SCHEMA,
        "options": {"temperature": 0.15, "num_ctx": 2048, "num_predict": 650, "num_thread": 4},
        "messages": [
            {"role": "system", "content": "한국어 광고 기획 초안을 JSON으로 작성하세요. 입력은 참고용 브리프입니다. 실제 제품 효능이나 계약을 지어내지 말고 제안과 가정을 명시하세요. concept는 한 문단, outline은 최대 5개, proposal은 보내지 않은 협업 메시지입니다."},
            {"role": "user", "content": brief},
        ],
    }, timeout=160)
    try:
        draft_data = json.loads(result["message"]["content"])
        if not isinstance(draft_data, dict):
            raise ValueError
        if any(not isinstance(draft_data.get(k), str) or not 0 < len(draft_data[k].strip()) <= limit
               for k, limit in (("concept", 600), ("proposal", 900))):
            raise ValueError
        outline = draft_data.get("outline")
        if not isinstance(outline, list) or not 1 <= len(outline) <= 6 or any(
            not isinstance(line, str) or not 0 < len(line.strip()) <= 320 for line in outline
        ):
            raise ValueError
        if not re.search("[가-힣]", draft_data["concept"]):
            raise ValueError
        return {"concept": draft_data["concept"], "outline": outline, "proposal": draft_data["proposal"], "model": MODEL}
    except (KeyError, TypeError, ValueError):
        raise WorkerError("MODEL_INVALID_OUTPUT") from None


def rpc(name, **params):
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    if urlparse(base).hostname != "ivtdfioypmzknlhinstg.supabase.co" or not base.startswith("https://"):
        raise WorkerError("WRONG_SUPABASE_PROJECT")
    key = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    return request(base + "/rest/v1/rpc/" + name, {"apikey": key, "Authorization": "Bearer " + key},
                   {"p_token": os.environ["ADME_WORKER_TOKEN"], **params})


def process(job):
    match job["kind"]:
        case "marketing_draft":
            return draft(job["input"])
        case "youtube_claim":
            _, channel_id, challenge = job["input"].split(":")
            data = youtube("channels", part="snippet", id=channel_id, fields="items(id,snippet/description)")
            if not data.get("items"):
                raise WorkerError("CHANNEL_UNAVAILABLE")
            description = data["items"][0]["snippet"].get("description", "")
            proof = "ADME-" + challenge
            if not re.search(r"(?<![A-Za-z0-9_-])" + re.escape(proof) + r"(?![A-Za-z0-9_-])", description):
                return {"verified": False}
            return {"verified": True}
        case "youtube_channel":
            rows = channels([job["input"]])
            if not rows:
                raise WorkerError("CHANNEL_UNAVAILABLE")
            return rows
        case "youtube_daily":
            if not job.get("keyword"):
                raise WorkerError("DISCOVERY_DISABLED")
            data = youtube("search", part="snippet", type="channel", maxResults=5,
                           regionCode="KR", relevanceLanguage="ko", q=job["keyword"],
                           fields="items/id/channelId")
            discovered = [entry["id"]["channelId"] for entry in data.get("items", [])]
            return channels(list(dict.fromkeys([*job.get("refresh", []), *discovered])))
        case _:
            raise WorkerError("UNKNOWN_JOB")


def once():
    job = rpc("ops_worker_claim")
    if not job:
        return
    start = time.monotonic()
    result, code = None, None
    try:
        result = process(job)
    except WorkerError as exc:
        code = str(exc)
    except HTTPError as exc:
        code = "MODEL_HTTP_" + str(exc.code)
    except (URLError, TimeoutError, OSError):
        code = "UPSTREAM_UNAVAILABLE"
    except (KeyError, TypeError, ValueError):
        code = "UPSTREAM_INVALID_RESPONSE"
    elapsed = round((time.monotonic() - start) * 1000)
    accepted = rpc("ops_worker_finish", p_id=job["id"], p_lease=job["lease"], p_result=result,
                   p_error=code, p_elapsed=elapsed)
    print(json.dumps({"job": job["kind"], "stored": accepted, "error": code, "ms": elapsed}), flush=True)


def smoke():
    timings = []
    for _ in range(3):
        start = time.monotonic()
        result = draft("국내 20대 고객을 위한 무향 선크림 인스타그램 릴스. 입증되지 않은 효능은 언급하지 말고 사용 장면을 기획해주세요.")
        timings.append(round((time.monotonic() - start) * 1000))
    embedding = request(OLLAMA + "/api/embed", payload={
        "model": EMBED_MODEL, "input": "한국어 마케팅 검색 검증", "options": {"num_thread": 4}
    }, timeout=120)["embeddings"][0]
    if not embedding or not all(isinstance(value, (int, float)) for value in embedding):
        raise WorkerError("EMBEDDING_INVALID")
    print(json.dumps({"model": result["model"], "korean_json": True, "samples": len(timings),
                      "mean_ms": round(sum(timings) / len(timings)), "p95_ms": max(timings),
                      "embedding_dimensions": len(embedding)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if args.smoke:
        smoke()
    else:
        while True:
            try:
                once()
            except (HTTPError, URLError, TimeoutError, ValueError, WorkerError, KeyError) as exc:
                print(json.dumps({"worker_error": type(exc).__name__,
                                  "http_status": getattr(exc, "code", None)}), flush=True)
                if args.once:
                    raise SystemExit(1) from None
            if args.once:
                break
            threading.Event().wait(15)
