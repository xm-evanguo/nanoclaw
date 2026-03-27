# Skill Maintenance

- `SKILL.md` is the source of truth for triggers and workflow.
- Keep `agents/openai.yaml` synchronized with the skill name, description, and default prompt.
- Keep references lean and load-on-demand. Do not duplicate detailed guidance into `SKILL.md`.
- Keep the source map aligned with the actual local paths for `finance-page`, `second-brain`, `TradingAgents`, `polymarket-data`, and `etf-portfolio-backtester`.
- Treat `/home/evan/second-brain` as the canonical trusted-note root. Review relevant Deep Van and Rhino investment insight notes when they matter to the request.
- Preserve the portfolio-data guardrail: use `finance-page` APIs or its agent-facing CLI for live holdings and RSU context, and do not fall back to local CSV files, sqlite files, or source-file inspection.
- Preserve the trading-analysis usage rule: prefer lighter analysis for routine refreshes, and reserve slower deep-analysis paths for detailed requests that justify the extra runtime.
- Preserve these guardrails unless the user explicitly changes them: Canada-first, selective US allocation, long-first core/satellite posture, no direct WDAY trade recommendations, and Polymarket as supplementary event context rather than a primary valuation source.
