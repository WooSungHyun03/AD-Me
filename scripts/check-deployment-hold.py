"""Keep development integration separate from an explicitly coordinated release."""
import json
from pathlib import Path


def check(root: Path) -> None:
    config = json.loads((root / "vercel.json").read_text(encoding="utf-8"))
    # Exact rules avoid a later wildcard true overriding main:false in Vercel.
    expected = {"main": False, "codex/dev-a-p0-continue": False}
    if config.get("git", {}).get("deploymentEnabled") != expected:
        raise SystemExit("Deployment hold changed: coordinate USER release before changing these rules.")
    print("PASS: main and DEV-A Git deployments held; other branches retain Vercel defaults.")


if __name__ == "__main__":
    check(Path(__file__).resolve().parents[1])
