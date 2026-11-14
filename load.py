import duckdb

con = duckdb.connect("btc.duckdb")
con.execute("CREATE OR REPLACE TABLE btc_daily AS SELECT * FROM read_csv_auto('btc_daily.csv')")
rows, first_day, last_day = con.execute("SELECT COUNT(*), MIN(date), MAX(date) FROM btc_daily").fetchone()
print(rows, "rows loaded, from", first_day, "to", last_day)
con.close()
