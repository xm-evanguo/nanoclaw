#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# ///
"""Read-only Polymarket data helper backed by the public Gamma API."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any

BASE_URL = "https://gamma-api.polymarket.com"
USER_AGENT = "codex-polymarket-data/1.0"


def fetch_json(endpoint: str, params: dict[str, Any] | None = None) -> Any:
    query = urllib.parse.urlencode(params or {}, doseq=True)
    url = f"{BASE_URL}{endpoint}"
    if query:
        url = f"{url}?{query}"

    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fail(message: str, exit_code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(exit_code)


def maybe_json_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return parsed
    return []


def safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def format_probability(value: Any) -> str:
    number = safe_float(value)
    if number is None:
        return "N/A"
    return f"{number * 100:.1f}%"


def format_money(value: Any) -> str:
    number = safe_float(value)
    if number is None:
        return "N/A"
    if number >= 1_000_000_000:
        return f"${number / 1_000_000_000:.2f}B"
    if number >= 1_000_000:
        return f"${number / 1_000_000:.2f}M"
    if number >= 1_000:
        return f"${number / 1_000:.1f}K"
    return f"${number:.0f}"


def parse_iso_date(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def format_date(value: Any) -> str | None:
    parsed = parse_iso_date(value)
    if parsed is None:
        return None
    return parsed.strftime("%Y-%m-%d")


def first_present(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def event_list_params(limit: int, include_closed: bool) -> dict[str, Any]:
    return {
        "closed": str(include_closed).lower(),
        "limit": limit,
        "order": "volume24hr",
        "ascending": "false",
    }


def extract_market_pairs(market: dict[str, Any]) -> list[tuple[str, Any]]:
    outcomes = maybe_json_list(market.get("outcomes"))
    prices = maybe_json_list(market.get("outcomePrices"))
    if not prices:
        return []

    labels: list[str] = []
    for index, _ in enumerate(prices):
        if index < len(outcomes) and outcomes[index]:
            labels.append(str(outcomes[index]))
        else:
            labels.append(f"Outcome {index + 1}")

    return list(zip(labels, prices))


def format_market_odds(market: dict[str, Any]) -> tuple[str, str]:
    pairs = extract_market_pairs(market)
    if pairs:
        shown = ", ".join(
            f"{label}: {format_probability(price)}" for label, price in pairs[:3]
        )
    else:
        shown = "Odds unavailable"

    volume = first_present(market, "volume", "volumeNum")
    volume_part = f" | Volume {format_money(volume)}" if volume is not None else ""
    return shown, volume_part


def format_market_line(market: dict[str, Any]) -> str:
    question = first_present(market, "question", "title", "groupItemTitle") or "Unknown market"
    shown, volume_part = format_market_odds(market)
    return f"- {question} | {shown}{volume_part}"


def format_event_summary(event: dict[str, Any], markets_limit: int = 3) -> str:
    title = first_present(event, "title", "question") or "Unknown event"
    slug = event.get("slug")
    url_part = f"https://polymarket.com/event/{slug}" if slug else None

    lines = [title]

    volume = first_present(event, "volume", "volume24hr")
    if volume is not None:
        label = "24h volume" if event.get("volume24hr") is not None else "Volume"
        lines.append(f"Volume: {label} {format_money(volume)}")

    end_date = format_date(first_present(event, "endDate", "end_date_iso"))
    if end_date:
        lines.append(f"Ends: {end_date}")

    markets = event.get("markets") or []
    if isinstance(markets, list) and markets:
        lines.append("Top markets:")
        for market in markets[:markets_limit]:
            if isinstance(market, dict):
                lines.append(format_market_line(market))
        remaining = len(markets) - min(len(markets), markets_limit)
        if remaining > 0:
            lines.append(f"- ... and {remaining} more")

    if url_part:
        lines.append(f"URL: {url_part}")

    return "\n".join(lines)


def format_market_summary(market: dict[str, Any]) -> str:
    question = first_present(market, "question", "title") or "Unknown market"
    slug = first_present(market, "slug", "market_slug")
    shown, volume_part = format_market_odds(market)
    lines = [question, f"Odds: {shown}{volume_part}"]

    end_date = format_date(first_present(market, "endDate", "end_date_iso"))
    if end_date:
        lines.append(f"Ends: {end_date}")
    if slug:
        lines.append(f"URL: https://polymarket.com/event/{slug}")
    return "\n".join(lines)


def normalize_search_results(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []

    for key in ("events", "markets", "data", "results"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def fetch_event_slug(slug: str) -> dict[str, Any]:
    data = fetch_json(f"/events/slug/{slug}")
    if isinstance(data, list):
        if not data:
            fail(f"No event found for slug: {slug}")
        data = data[0]
    if not isinstance(data, dict):
        fail(f"Unexpected event payload for slug: {slug}")
    return data


def search_events(query: str, limit: int, include_closed: bool) -> list[dict[str, Any]]:
    params = {"query": query, "limit": limit}
    try:
        data = fetch_json("/search", params)
        results = normalize_search_results(data)
        if results:
            return results[:limit]
    except urllib.error.HTTPError:
        pass

    events = fetch_json(
        "/events",
        event_list_params(max(limit * 8, 50), include_closed),
    )
    if not isinstance(events, list):
        return []

    lowered = query.lower()
    matches: list[dict[str, Any]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        haystacks = [
            str(first_present(event, "title", "question") or "").lower(),
            str(event.get("description") or "").lower(),
        ]
        if any(lowered in haystack for haystack in haystacks):
            matches.append(event)
            continue

        markets = event.get("markets") or []
        if not isinstance(markets, list):
            continue
        for market in markets:
            if not isinstance(market, dict):
                continue
            question = str(first_present(market, "question", "title") or "").lower()
            if lowered in question:
                matches.append(event)
                break

    return matches[:limit]


def filter_category(events: list[dict[str, Any]], category: str) -> list[dict[str, Any]]:
    lowered = category.lower()
    matches: list[dict[str, Any]] = []

    for event in events:
        title = str(first_present(event, "title", "question") or "").lower()
        tags = event.get("tags") or []
        tag_labels = [
            str(tag.get("label")).lower()
            for tag in tags
            if isinstance(tags, list) and isinstance(tag, dict) and tag.get("label")
        ]
        if lowered in title or lowered in tag_labels:
            matches.append(event)

    return matches


def output_results(items: Any, json_output: bool, formatter) -> None:
    if json_output:
        print(json.dumps(items, indent=2, sort_keys=True))
        return

    if isinstance(items, list):
        if not items:
            print("No matching Polymarket events found.")
            return
        for index, item in enumerate(items):
            if index:
                print()
            print(formatter(item))
        return

    print(formatter(items))


def cmd_trending(args: argparse.Namespace) -> None:
    data = fetch_json("/events", event_list_params(args.limit, args.closed))
    if not isinstance(data, list):
        fail("Unexpected response for trending events.")
    output_results(data[: args.limit], args.json, format_event_summary)


def cmd_search(args: argparse.Namespace) -> None:
    results = search_events(args.query, args.limit, args.closed)

    def formatter(item: dict[str, Any]) -> str:
        if item.get("markets"):
            return format_event_summary(item)
        return format_market_summary(item)

    output_results(results, args.json, formatter)


def cmd_event(args: argparse.Namespace) -> None:
    data = fetch_event_slug(args.slug)
    output_results(data, args.json, format_event_summary)


def cmd_category(args: argparse.Namespace) -> None:
    data = fetch_json("/events", event_list_params(max(args.limit * 8, 50), args.closed))
    if not isinstance(data, list):
        fail("Unexpected response for category query.")
    matches = filter_category([item for item in data if isinstance(item, dict)], args.category)
    output_results(matches[: args.limit], args.json, format_event_summary)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fetch read-only market data from Polymarket's public Gamma API."
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    trending = subcommands.add_parser("trending", help="Show high-volume active events.")
    trending.add_argument("--limit", type=int, default=5, help="Number of events to return.")
    trending.add_argument(
        "--closed",
        action="store_true",
        help="Include closed events instead of only open ones.",
    )
    trending.add_argument("--json", action="store_true", help="Emit raw JSON.")
    trending.set_defaults(handler=cmd_trending)

    search = subcommands.add_parser("search", help="Search events or markets by text query.")
    search.add_argument("query", help="Search text.")
    search.add_argument("--limit", type=int, default=5, help="Number of results to return.")
    search.add_argument(
        "--closed",
        action="store_true",
        help="Include closed events instead of only open ones.",
    )
    search.add_argument("--json", action="store_true", help="Emit raw JSON.")
    search.set_defaults(handler=cmd_search)

    event = subcommands.add_parser("event", help="Fetch one event by slug.")
    event.add_argument("slug", help="Event slug on Polymarket.")
    event.add_argument("--json", action="store_true", help="Emit raw JSON.")
    event.set_defaults(handler=cmd_event)

    category = subcommands.add_parser(
        "category",
        help="Filter active events by category or tag label.",
    )
    category.add_argument("category", help="Category or tag label.")
    category.add_argument("--limit", type=int, default=5, help="Number of results to return.")
    category.add_argument(
        "--closed",
        action="store_true",
        help="Include closed events instead of only open ones.",
    )
    category.add_argument("--json", action="store_true", help="Emit raw JSON.")
    category.set_defaults(handler=cmd_category)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.handler(args)
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace").strip()
        fail(f"Polymarket API request failed ({error.code}): {message or error.reason}")
    except urllib.error.URLError as error:
        fail(f"Polymarket API request failed: {error.reason}")


if __name__ == "__main__":
    main()
