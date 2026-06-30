# FAQ — Gap Research Terminal

**Is GRT a trading bot / will it place trades?**
No. GRT is a historical statistical research tool. It has no broker connection and produces
no orders, signals, predictions or recommendations. Research ends at export; any trading
system is a separate thing that begins after export.

**Does my data leave my computer?**
No. CSV parsing and all computation happen entirely in your browser. Nothing is uploaded to a
server.

**Will GRT tell me whether to buy or sell, or where price is going?**
No. The AI Research Assistant explains existing research and refuses any Buy/Sell or
prediction question. No module forecasts the market.

**What's the difference between Probability and Reliability?**
Probability is *what happened, how often* (historical frequency). Reliability is *how much to
trust that number* (sample quality + stability, scored 0–100). See the
[Research Guide](RESEARCH_GUIDE.md).

**Why default to a 15-day window?**
Gold Spot vs Gold Futures converge toward expiry, so older gaps are less representative of the
current contract. Recent windows (15–30 days) are prioritised; longer windows are allowed but
flagged.

**Can I trust the numbers?**
Every statistic is reproducible from the uploaded CSV and every calculation is deterministic.
The Quality Assurance module verifies this and issues a release certificate.

**What file format does GRT accept?**
MT5 GapMonitor CSV exports with the expected columns. Malformed rows are reported, not
silently trusted.

**Where are my strategies stored?**
In the in-browser Research Repository. Export a full backup to keep them; research is
deterministic, so it also reproduces if re-run from the same CSV.

**What export formats are available?**
Reports: PDF / CSV / JSON. EA Export: JSON / CSV / YAML / XML configuration profiles (with a
deterministic checksum, no executable code).

**Does the EA Export generate an Expert Advisor or MQL5 code?**
No. It emits configuration data only — parameters such as entry/recovery/SL, probability,
reliability and validation — never trading logic or code.

**How do I find a specific result fast?**
Press ⌘K / Ctrl-K for Universal Search; filter with expressions like `recovery > 90`,
`events > 100`, `session = London`.

**What version is this and what's next?**
This is GRT **v1.0.0**. v1.0 is frozen; future ideas live in the
[V2 Backlog](V2_BACKLOG.md). Only bug fixes land in v1.x.
