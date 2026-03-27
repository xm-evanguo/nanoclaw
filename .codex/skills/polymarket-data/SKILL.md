---
name: polymarket-data
description: Use this skill to fetch read-only data from Polymarket prediction markets, including trending events, search results, category views, and event-level implied odds. Trigger when the user mentions Polymarket, prediction markets, event odds, market-implied probabilities, or wants macro, politics, crypto, rates, or commodity sentiment from Polymarket.
---

# Polymarket Data

Use this skill for read-only Polymarket market data. It is for fetching and summarizing market-implied probabilities, not for placing trades.

## Quick Start
- Use `uv run scripts/polymarket.py trending --limit 5` for active high-volume events.
- Use `uv run scripts/polymarket.py search "fed cuts" --limit 5` for topical discovery.
- Use `uv run scripts/polymarket.py event <slug>` when the event slug is known.
- Use `uv run scripts/polymarket.py category crypto --limit 5` for broad category sweeps.
- Add `--json` when another skill needs structured output instead of formatted text.

## Workflow
1. Start with `search` unless you already know the exact Polymarket event slug.
2. Use `event` to inspect all markets under one event and surface the current implied odds.
3. For investment workflows, use this as supplemental evidence for:
   - election and policy odds
   - rate path, inflation, or recession expectations
   - crypto narrative temperature
   - commodity, war, or geopolitics-sensitive event risk
4. State clearly that Polymarket odds are market prices, not ground truth.
5. Do not use Polymarket as the only reason to recommend an investment action.

## Commands
- `uv run scripts/polymarket.py trending --limit 5`
- `uv run scripts/polymarket.py search "query" --limit 5`
- `uv run scripts/polymarket.py event event-slug`
- `uv run scripts/polymarket.py category politics --limit 5`

Supported categories are free-form, but `politics`, `crypto`, `business`, `science`, `sports`, `tech`, and `entertainment` are the most reliable.

## Output Expectations
- Prefer concise summaries with title, top market odds, volume, end date, and Polymarket URL.
- When the request is investment-related, explain why the odds matter for the thesis.
- If the market is thin or noisy, say that explicitly instead of overselling the signal.

## Do Not
- Do not place or recommend trades from this skill.
- Do not treat Polymarket odds as a valuation model.
- Do not skip fresher or more direct evidence when the question is about company fundamentals or current prices.
