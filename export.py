import json
import os

import duckdb

con = duckdb.connect("btc.duckdb", read_only=True)


def rows(sql, orient="records"):
    return json.loads(con.execute(sql).df().to_json(orient=orient))


out = {
    "updated": str(con.execute("SELECT MAX(date) FROM btc_daily").fetchone()[0]),
    "price_columns": ["date", "open", "high", "low", "close", "volume"],
    "prices": rows(
        """
        SELECT
            CAST(date AS VARCHAR) AS date,
            ROUND(open, 2) AS open,
            ROUND(high, 2) AS high,
            ROUND(low, 2) AS low,
            ROUND(close, 2) AS close,
            CAST(volume AS BIGINT) AS volume
        FROM btc_daily
        ORDER BY date
        """,
        orient="values",
    ),
    "major_cycles": rows(
        "SELECT * REPLACE (CAST(start_date AS VARCHAR) AS start_date, CAST(end_date AS VARCHAR) AS end_date) FROM btc_major_cycles ORDER BY start_date"
    ),
    "swings": rows(
        "SELECT * REPLACE (CAST(start_date AS VARCHAR) AS start_date, CAST(end_date AS VARCHAR) AS end_date) FROM btc_swings ORDER BY start_date"
    ),
    "halvings": rows(
        "SELECT * REPLACE (CAST(halving_date AS VARCHAR) AS halving_date) FROM halvings ORDER BY halving_date"
    ),
    "halving_performance": rows(
        "SELECT * REPLACE (CAST(halving_date AS VARCHAR) AS halving_date, CAST(peak_date AS VARCHAR) AS peak_date) FROM halving_performance ORDER BY halving_date"
    ),
}
con.close()

os.makedirs("data", exist_ok=True)
with open("data/btc.json", "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("data/btc.json written,", len(out["prices"]), "days, up to", out["updated"])
