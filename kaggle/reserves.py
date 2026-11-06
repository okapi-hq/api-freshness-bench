"""What Kaggle reserves for one request of each model, for kaggle/queue_runs.py.

    python3 kaggle/reserves.py -m gpt-6.1-sol -m claude-opus-5-5-default ... > reserves.json

Kaggle's model proxy holds a request's worst-case cost before running it: the output
cap (MAX_OUTPUT_TOKENS in build.py) at the model's output price, plus the prompt. The
prices come from models.dev. A model it doesn't list gets `--default` dollars.
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build import MAX_OUTPUT_TOKENS  # noqa: E402

MODELS_DEV = "https://models.dev/api.json"
PROVIDERS = {"claude": "anthropic", "gpt": "openai", "gemini": "google", "gemma": "google"}
PROMPT_TOKENS = 2000
MARGIN = 1.1


def price_of(catalog: dict, slug: str) -> "dict | None":
    """The models.dev price of a Kaggle model slug (`claude-opus-5-5-default`, `gpt-5.4-2026-03-05`)."""
    provider = next((p for k, p in PROVIDERS.items() if slug.startswith(k)), None)
    models = catalog.get(provider, {}).get("models", {}) if provider else {}
    for name in (slug, slug.replace("-default", ""), re.sub(r"-\d{8}$", "", slug), re.sub(r"-\d{4}-\d\d-\d\d$", "", slug)):
        if models.get(name, {}).get("cost"):
            return models[name]["cost"]
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--model", action="append", required=True)
    ap.add_argument("--default", type=float, default=0.2, help="dollars for a model models.dev doesn't price")
    args = ap.parse_args()
    request = urllib.request.Request(MODELS_DEV, headers={"User-Agent": "okapi-bench"})
    with urllib.request.urlopen(request, timeout=60) as res:
        catalog = json.loads(res.read())
    out = {}
    for slug in args.model:
        cost = price_of(catalog, slug)
        if cost is None:
            out[slug] = args.default
            continue
        worst = (MAX_OUTPUT_TOKENS * cost.get("output", 0) + PROMPT_TOKENS * cost.get("input", 0)) / 1e6
        out[slug] = round(worst * MARGIN, 3)
    print(json.dumps(out, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
