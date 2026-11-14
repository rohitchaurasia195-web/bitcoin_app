import altair as alt
import duckdb
import streamlit as st

st.set_page_config(page_title="Bitcoin History", layout="wide")
alt.data_transformers.disable_max_rows()


def query(sql):
    con = duckdb.connect("btc.duckdb", read_only=True)
    try:
        return con.execute(sql).df()
    finally:
        con.close()


prices = query("SELECT date, close FROM btc_daily ORDER BY date")
latest = prices.iloc[-1]

st.title("Bitcoin History")
st.caption(f"Data up to {latest['date']:%d %b %Y}. Last close {latest['close']:,.0f} USD")

log = st.toggle("Log scale", value=True)
chart = (
    alt.Chart(prices)
    .mark_line()
    .encode(
        x=alt.X("date:T", title=None),
        y=alt.Y("close:Q", title="Close price in USD", scale=alt.Scale(type="log" if log else "linear")),
        tooltip=["date:T", "close:Q"],
    )
    .properties(height=420)
)
st.altair_chart(chart)

st.subheader("Major bull and bear periods")
st.dataframe(query("SELECT * FROM btc_major_cycles ORDER BY start_date"), hide_index=True)

st.subheader("After each halving")
st.dataframe(query("SELECT * FROM halving_performance ORDER BY halving_date"), hide_index=True)
