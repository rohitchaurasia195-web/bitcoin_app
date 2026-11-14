import yfinance as yf

df = yf.Ticker("BTC-USD").history(period="max", interval="1d")
df = df.reset_index()
df["Date"] = df["Date"].dt.date
df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]
df.columns = ["date", "open", "high", "low", "close", "volume"]
df.to_csv("btc_daily.csv", index=False)
print(len(df), "rows saved")
print(df.head(1).to_string(index=False))
print(df.tail(1).to_string(index=False))
