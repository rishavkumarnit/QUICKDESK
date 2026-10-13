"""Run from backend: python -m app.check_services [--openai].

The optional OpenAI checks make two tiny billable requests with synthetic text.
Credentials and raw provider error messages are never printed.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor

import httpx
from pymongo import MongoClient
from sqlalchemy import create_engine, text

from app.config import settings


def postgres() -> str:
    if not settings.database_url:
        return "MISSING: DATABASE_URL"
    engine = create_engine(settings.database_url, connect_args={"connect_timeout": 10})
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return "OK"
    finally:
        engine.dispose()


def mongodb() -> str:
    if not settings.mongodb_uri:
        return "MISSING: MONGODB_URI"
    with MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=10000,
                     connectTimeoutMS=10000, socketTimeoutMS=10000) as client:
        client.admin.command("ping")
        # Verify access to the configured collection without inserting data.
        client[settings.mongodb_database][settings.mongodb_collection].find_one({}, {"_id": 1})
    return "OK (connection and collection read access)"


def openai_request(path: str, key: str, payload: dict) -> dict:
    with httpx.Client(timeout=25) as client:
        response = client.post(
            "https://api.openai.com/v1/" + path,
            headers={"Authorization": "Bearer " + key}, json=payload,
        )
        response.raise_for_status()
        return response.json()


def generation() -> str:
    if settings.llm_provider.lower() != "openai":
        return "ERROR: LLM_PROVIDER must be openai"
    if not settings.llm_api_key or not settings.llm_model:
        return "MISSING: LLM_API_KEY or LLM_MODEL"
    data = openai_request("chat/completions", settings.llm_api_key, {
        "model": settings.llm_model,
        "messages": [{"role": "user", "content": "Reply with OK."}],
        # Reasoning models consume this budget before producing visible text.
        "max_completion_tokens": 1024,
    })
    if not data.get("choices", [{}])[0].get("message", {}).get("content"):
        return "ERROR: no generated text"
    return "OK"


def embeddings() -> str:
    if not settings.embedding_api_key or not settings.embedding_model:
        return "MISSING: EMBEDDING_API_KEY or EMBEDDING_MODEL"
    data = openai_request("embeddings", settings.embedding_api_key, {
        "model": settings.embedding_model, "input": "QuickDesk connection check",
    })
    dimensions = len(data["data"][0]["embedding"])
    return f"OK ({dimensions} dimensions)" if dimensions else "ERROR: empty embedding"


def check(item):
    name, function = item
    try:
        result = function()
    except httpx.HTTPStatusError as error:
        status = error.response.status_code
        hints = {401: "check API key", 403: "check project/model permissions",
                 404: "check model name/access", 429: "check quota or rate limits"}
        result = f"ERROR: HTTP {status}; {hints.get(status, 'provider rejected request')}"
    except Exception as error:
        result = f"ERROR: {type(error).__name__} (details suppressed to protect credentials)"
    return name, result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--openai", action="store_true")
    args = parser.parse_args()
    checks = [("PostgreSQL", postgres), ("MongoDB", mongodb)]
    if args.openai:
        checks += [("OpenAI generation", generation), ("OpenAI embeddings", embeddings)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check, checks))
    for name, result in results:
        print(f"{name}: {result}")
    return 0 if all(result.startswith("OK") for _, result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
