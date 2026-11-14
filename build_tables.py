import duckdb
import pandas as pd

con = duckdb.connect("btc.duckdb")
df = con.execute("SELECT date, close FROM btc_daily ORDER BY date").df()
df["date"] = pd.to_datetime(df["date"])
dates = df["date"].tolist()
closes = df["close"].tolist()


def save(name, frame, date_cols):
    con.register("frame_view", frame)
    replace = ", ".join(f"CAST({c} AS DATE) AS {c}" for c in date_cols)
    con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * REPLACE ({replace}) FROM frame_view")
    con.unregister("frame_view")


def find_cycles(threshold):
    t = threshold / 100
    pivots = [0]
    trend = 0
    hi = lo = ext = 0
    for i in range(1, len(closes)):
        c = closes[i]
        if trend == 0:
            if c > closes[hi]:
                hi = i
            if c < closes[lo]:
                lo = i
            if c <= closes[hi] * (1 - t):
                if hi != 0:
                    pivots.append(hi)
                trend, ext = -1, i
            elif c >= closes[lo] * (1 + t):
                if lo != 0:
                    pivots.append(lo)
                trend, ext = 1, i
        elif trend == 1:
            if c > closes[ext]:
                ext = i
            elif c <= closes[ext] * (1 - t):
                pivots.append(ext)
                trend, ext = -1, i
        else:
            if c < closes[ext]:
                ext = i
            elif c >= closes[ext] * (1 + t):
                pivots.append(ext)
                trend, ext = 1, i
    if ext != pivots[-1]:
        pivots.append(ext)
    rows = []
    for k in range(len(pivots) - 1):
        a, b = pivots[k], pivots[k + 1]
        rows.append({
            "cycle_type": "bull" if closes[b] > closes[a] else "bear",
            "start_date": dates[a],
            "end_date": dates[b],
            "days": (dates[b] - dates[a]).days,
            "start_price": round(closes[a], 2),
            "end_price": round(closes[b], 2),
            "change_pct": round((closes[b] / closes[a] - 1) * 100, 2),
            "status": "ongoing" if k == len(pivots) - 2 else "completed",
        })
    return pd.DataFrame(rows)


save("btc_major_cycles", find_cycles(50), ["start_date", "end_date"])
save("btc_swings", find_cycles(20), ["start_date", "end_date"])

con.execute("""
    CREATE OR REPLACE TABLE btc_drawdown AS
    SELECT
        date,
        close,
        MAX(close) OVER (ORDER BY date) AS peak_close,
        ROUND((close / MAX(close) OVER (ORDER BY date) - 1) * 100, 2) AS drawdown_pct
    FROM btc_daily
""")

halvings = pd.DataFrame({
    "halving_number": [1, 2, 3, 4],
    "halving_date": pd.to_datetime(["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20"]),
    "block_reward_after": [25.0, 12.5, 6.25, 3.125],
})
save("halvings", halvings, ["halving_date"])

price = df.set_index("date")["close"]
halving_dates = halvings["halving_date"].tolist()
rows = []
for idx, d in enumerate(halving_dates):
    if d not in price.index:
        continue
    p0 = price[d]
    row = {
        "halving_number": idx + 1,
        "halving_date": d,
        "price_on_halving": round(p0, 2),
    }
    for k in [30, 90, 180, 365]:
        target = d + pd.Timedelta(days=k)
        row[f"change_pct_{k}d"] = round((price[target] / p0 - 1) * 100, 2) if target in price.index else None
    end = halving_dates[idx + 1] if idx + 1 < len(halving_dates) else price.index[-1]
    window = price[d:end]
    peak_date = window.idxmax()
    row["peak_date"] = peak_date
    row["peak_price"] = round(window.max(), 2)
    row["days_to_peak"] = (peak_date - d).days
    row["gain_to_peak_pct"] = round((window.max() / p0 - 1) * 100, 2)
    rows.append(row)
save("halving_performance", pd.DataFrame(rows), ["halving_date", "peak_date"])

for name in ["btc_major_cycles", "btc_swings", "btc_drawdown", "halvings", "halving_performance"]:
    print(name, con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0], "rows")
print()
print(con.execute("SELECT * FROM btc_major_cycles ORDER BY start_date").df().to_string(index=False))
print()
print(con.execute("SELECT * FROM halving_performance ORDER BY halving_date").df().to_string(index=False))
con.close()
