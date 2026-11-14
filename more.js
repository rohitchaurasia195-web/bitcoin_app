const more = { tab: null, charts: {} };
const moreTabs = [
  ["returns", "Returns"],
  ["trend", "Trend"],
  ["volatility", "Volatility"],
  ["compare", "Halving compare"],
  ["records", "Records"],
];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

moreTabs.forEach(([name, label]) => {
  $("tabs").insertAdjacentHTML("beforeend", `<button data-tab="${name}">${label}</button>`);
});

document.querySelector("main").insertAdjacentHTML(
  "beforeend",
  `
  <section id="tab-returns" class="card hidden">
    <div class="metrics" id="returnMetrics"></div>
    <h2>Return for each year</h2>
    <div class="chartbox" style="height:260px"><canvas id="yearChart"></canvas></div>
    <h2>Return for each month</h2>
    <p class="note">Green is a gain, red is a loss. The last row is the average for that calendar month.</p>
    <div class="scroll" id="monthTable"></div>
  </section>
  <section id="tab-trend" class="card hidden">
    <p class="note">Orange is the price. Blue is the 50 day average. Purple is the 200 day average.</p>
    <div class="metrics" id="trendMetrics"></div>
    <div class="chartbox"><canvas id="trendChart"></canvas></div>
    <h2>Golden and death crosses</h2>
    <p class="note">Golden cross: the 50 day average moves above the 200 day average. Death cross is the opposite.</p>
    <div class="scroll" id="crossTable"></div>
  </section>
  <section id="tab-volatility" class="card hidden">
    <p class="note">How wild the price moves were, measured over the last 30 days and shown as a yearly figure.</p>
    <div class="metrics" id="volMetrics"></div>
    <div class="chartbox" style="height:280px"><canvas id="volChart"></canvas></div>
    <h2>By day of the week</h2>
    <div class="scroll" id="weekdayTable"></div>
  </section>
  <section id="tab-compare" class="card hidden">
    <p class="note">Price after each halving, shown as a multiple of the price on the halving day. 1 means no change, 2 means doubled. The period filter does not change this chart.</p>
    <div class="chartbox"><canvas id="compareChart"></canvas></div>
    <div class="scroll" id="compareTable" style="margin-top:10px"></div>
  </section>
  <section id="tab-records" class="card hidden">
    <p class="note">All time records from the full history. The period filter does not change this tab.</p>
    <div class="metrics" id="recordMetrics"></div>
    <h2>Longest waits for a new all time high</h2>
    <div class="scroll" id="waitTable"></div>
  </section>
  `
);

function draw(id, config) {
  if (more.charts[id]) more.charts[id].destroy();
  more.charts[id] = new Chart($(id), config);
}

function bucketReturns(keyLength) {
  const out = [];
  let prevClose = store.close[0];
  let key = store.dates[0].slice(0, keyLength);
  for (let i = 1; i <= store.dates.length; i++) {
    const next = i < store.dates.length ? store.dates[i].slice(0, keyLength) : null;
    if (next !== key) {
      const close = store.close[i - 1];
      out.push({ key, change: (close / prevClose - 1) * 100 });
      prevClose = close;
      key = next;
    }
  }
  return out;
}

function movingAverage(n) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < store.close.length; i++) {
    sum += store.close[i];
    if (i >= n) sum -= store.close[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

function heatColor(value) {
  const strength = Math.min(Math.abs(value) / 40, 1) * 0.7 + 0.08;
  return value >= 0 ? `rgba(31,157,85,${strength.toFixed(2)})` : `rgba(214,69,69,${strength.toFixed(2)})`;
}

function renderReturns(start, end) {
  const years = bucketReturns(4).filter((y) => y.key >= start.slice(0, 4) && y.key <= end.slice(0, 4));
  const months = bucketReturns(7).filter((m) => m.key >= start.slice(0, 7) && m.key <= end.slice(0, 7));
  const best = months.reduce((a, b) => (b.change > a.change ? b : a), months[0]);
  const worst = months.reduce((a, b) => (b.change < a.change ? b : a), months[0]);
  const positive = months.filter((m) => m.change > 0).length;
  const goodYears = years.filter((y) => y.change > 0).length;
  $("returnMetrics").innerHTML =
    metricCard("Best month", pct(best.change), best.key, "up") +
    metricCard("Worst month", pct(worst.change), worst.key, "down") +
    metricCard("Months with a gain", Math.round((positive / months.length) * 100) + "%", `${positive} of ${months.length}`) +
    metricCard("Years with a gain", `${goodYears} of ${years.length}`);
  const options = baseOptions();
  options.plugins.tooltip = { callbacks: { label: (item) => pct(item.parsed.y) } };
  draw("yearChart", {
    type: "bar",
    data: {
      labels: years.map((y) => y.key),
      datasets: [{ data: years.map((y) => Number(y.change.toFixed(1))), backgroundColor: years.map((y) => (y.change >= 0 ? css("--up") : css("--down"))) }],
    },
    options,
  });
  const byYear = {};
  months.forEach((m) => {
    const year = m.key.slice(0, 4);
    byYear[year] = byYear[year] || {};
    byYear[year][Number(m.key.slice(5, 7)) - 1] = m.change;
  });
  const cell = (value) => (value === undefined ? "<td></td>" : `<td style="background:${heatColor(value)}">${pct(value, 0)}</td>`);
  let html = "<table><thead><tr><th>Year</th>" + monthNames.map((m) => `<th>${m}</th>`).join("") + "</tr></thead><tbody>";
  Object.keys(byYear).sort().forEach((year) => {
    html += `<tr><td>${year}</td>` + monthNames.map((_, i) => cell(byYear[year][i])).join("") + "</tr>";
  });
  html += "<tr><td>Average</td>" + monthNames.map((_, i) => {
    const values = Object.values(byYear).map((y) => y[i]).filter((v) => v !== undefined);
    return values.length ? cell(values.reduce((s, v) => s + v, 0) / values.length) : "<td></td>";
  }).join("") + "</tr></tbody></table>";
  $("monthTable").innerHTML = html;
}

function renderTrend(i0, i1) {
  const ma50 = movingAverage(50);
  const ma200 = movingAverage(200);
  const labels = store.dates.slice(i0, i1 + 1);
  let above = 0;
  let counted = 0;
  for (let i = i0; i <= i1; i++) {
    if (ma200[i] === null) continue;
    counted++;
    if (store.close[i] > ma200[i]) above++;
  }
  const ratio = ma200[i1] === null ? null : store.close[i1] / ma200[i1];
  $("trendMetrics").innerHTML =
    metricCard("Price against 200 day average", ratio === null ? "No data" : ratio.toFixed(2) + " times", ratio === null ? "" : ratio >= 1 ? "Price is above the average" : "Price is below the average", ratio !== null && ratio >= 1 ? "up" : "down") +
    metricCard("200 day average", ma200[i1] === null ? "No data" : money(ma200[i1])) +
    metricCard("Days above 200 day average", counted ? Math.round((above / counted) * 100) + "%" : "No data");
  const options = baseOptions();
  options.scales.y.type = $("logScale").checked ? "logarithmic" : "linear";
  options.plugins.tooltip = { callbacks: { label: (item) => item.dataset.label + ": " + money(item.parsed.y) } };
  const line = (label, data, color, width) => ({ label, data: data.slice(i0, i1 + 1), borderColor: color, borderWidth: width, tension: 0, spanGaps: false });
  draw("trendChart", {
    type: "line",
    data: { labels, datasets: [line("Price", store.close, css("--accent"), 1.4), line("50 day", ma50, "#3b82f6", 1.3), line("200 day", ma200, "#a855f7", 1.3)] },
    options,
  });
  const crosses = [];
  const last = store.close.length - 1;
  for (let i = Math.max(i0, 200); i <= i1; i++) {
    const before = ma50[i - 1] - ma200[i - 1];
    const now = ma50[i] - ma200[i];
    if (before <= 0 && now > 0) crosses.push({ date: store.dates[i], kind: "Golden cross", close: store.close[i], i });
    if (before >= 0 && now < 0) crosses.push({ date: store.dates[i], kind: "Death cross", close: store.close[i], i });
  }
  crosses.forEach((c) => {
    c.after90 = c.i + 90 <= last ? (store.close[c.i + 90] / c.close - 1) * 100 : null;
    c.after365 = c.i + 365 <= last ? (store.close[c.i + 365] / c.close - 1) * 100 : null;
  });
  $("crossTable").innerHTML = table(
    [
      { key: "date", label: "Date" },
      { key: "kind", label: "Type" },
      { key: "close", label: "Price", fmt: money },
      { key: "after90", label: "After 90 days", fmt: (n) => pct(n), tone: true },
      { key: "after365", label: "After 365 days", fmt: (n) => pct(n), tone: true },
    ],
    crosses.reverse()
  );
}

function renderVolatility(i0, i1) {
  const logReturn = store.close.map((c, i) => (i === 0 ? 0 : Math.log(c / store.close[i - 1])));
  const vol = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 1; i < logReturn.length; i++) {
    sum += logReturn[i];
    sumSq += logReturn[i] * logReturn[i];
    if (i > 30) {
      sum -= logReturn[i - 30];
      sumSq -= logReturn[i - 30] * logReturn[i - 30];
    }
    vol[i] = i >= 30 ? Math.sqrt(Math.max(sumSq / 30 - (sum / 30) * (sum / 30), 0)) * Math.sqrt(365) * 100 : null;
  }
  vol[0] = null;
  const slice = vol.slice(i0, i1 + 1);
  const known = slice.filter((v) => v !== null);
  const peakAt = slice.indexOf(Math.max(...known));
  $("volMetrics").innerHTML = known.length
    ? metricCard("Now", known[known.length - 1].toFixed(0) + "%") +
      metricCard("Average in period", (known.reduce((s, v) => s + v, 0) / known.length).toFixed(0) + "%") +
      metricCard("Wildest time", Math.max(...known).toFixed(0) + "%", store.dates[i0 + peakAt])
    : metricCard("Volatility", "Not enough data");
  const options = baseOptions();
  options.plugins.tooltip = { callbacks: { label: (item) => item.parsed.y.toFixed(0) + "%" } };
  draw("volChart", {
    type: "line",
    data: { labels: store.dates.slice(i0, i1 + 1), datasets: [{ data: slice.map((v) => (v === null ? null : Number(v.toFixed(1)))), borderColor: "#3b82f6", borderWidth: 1.3, tension: 0 }] },
    options,
  });
  const days = dayNames.map((name) => ({ name, total: 0, count: 0, up: 0 }));
  for (let i = Math.max(i0, 1); i <= i1; i++) {
    const d = days[new Date(store.dates[i] + "T00:00:00Z").getUTCDay()];
    d.total += store.change[i];
    d.count++;
    if (store.change[i] > 0) d.up++;
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  $("weekdayTable").innerHTML = table(
    [
      { key: "name", label: "Day" },
      { key: "average", label: "Average one day change", fmt: (n) => pct(n, 2), tone: true },
      { key: "share", label: "Days with a gain", fmt: (n) => n.toFixed(0) + "%" },
      { key: "count", label: "Days counted" },
    ],
    order.map((k) => days[k]).filter((d) => d.count).map((d) => ({ name: d.name, average: d.total / d.count, share: (d.up / d.count) * 100, count: d.count }))
  );
}

function renderCompare() {
  const colors = ["#f7931a", "#3b82f6", "#a855f7", "#1f9d55", "#d64545"];
  const span = 1460;
  const datasets = [];
  const rows = [];
  store.data.halvings.forEach((h, n) => {
    const at = lowerBound(h.halving_date);
    if (store.dates[at] !== h.halving_date) return;
    const base = store.close[at];
    const series = [];
    for (let d = 0; d <= span && at + d < store.close.length; d++) series.push(Number((store.close[at + d] / base).toFixed(3)));
    datasets.push({ label: "Halving " + h.halving_number + " (" + h.halving_date.slice(0, 4) + ")", data: series, borderColor: colors[n % colors.length], borderWidth: 1.5, tension: 0 });
    const pick = (d) => (d < series.length ? series[d] : null);
    rows.push({ name: "Halving " + h.halving_number, date: h.halving_date, d180: pick(180), d365: pick(365), d545: pick(545), d730: pick(730), d1095: pick(1095) });
  });
  const options = baseOptions();
  options.plugins.legend = { display: true, labels: { color: css("--text"), boxWidth: 14 } };
  options.plugins.tooltip = { callbacks: { title: (items) => "Day " + items[0].label, label: (item) => item.dataset.label + ": " + item.parsed.y.toFixed(2) + " times" } };
  options.scales.y.type = "logarithmic";
  options.scales.x.title = { display: true, text: "Days after the halving", color: css("--muted") };
  draw("compareChart", { type: "line", data: { labels: Array.from({ length: span + 1 }, (_, i) => i), datasets }, options });
  const times = (n) => n.toFixed(2) + " times";
  $("compareTable").innerHTML = table(
    [
      { key: "name", label: "Halving" },
      { key: "date", label: "Date" },
      { key: "d180", label: "Day 180", fmt: times },
      { key: "d365", label: "Day 365", fmt: times },
      { key: "d545", label: "Day 545", fmt: times },
      { key: "d730", label: "Day 730", fmt: times },
      { key: "d1095", label: "Day 1095", fmt: times },
    ],
    rows
  );
}

function renderRecords() {
  const last = store.close.length - 1;
  const waits = [];
  let peakAt = 0;
  let lowest = 0;
  let highDays = 1;
  for (let i = 1; i <= last; i++) {
    if (store.close[i] > store.close[peakAt]) {
      if (i - peakAt > 1) waits.push({ peak: store.dates[peakAt], back: store.dates[i], days: i - peakAt, deepest: lowest });
      peakAt = i;
      lowest = 0;
      highDays++;
    } else {
      lowest = Math.min(lowest, (store.close[i] / store.close[peakAt] - 1) * 100);
    }
  }
  if (last > peakAt) waits.push({ peak: store.dates[peakAt], back: "Still waiting", days: last - peakAt, deepest: lowest });
  const cheaper = store.close.filter((c) => c < store.close[last]).length;
  const gap = (store.close[last] / store.close[peakAt] - 1) * 100;
  $("recordMetrics").innerHTML =
    metricCard("All time high close", money(store.close[peakAt]), store.dates[peakAt]) +
    metricCard("Days since all time high", (last - peakAt).toLocaleString("en-US")) +
    metricCard("Now against all time high", pct(gap), "", tone(gap)) +
    metricCard("Days that set a new high", highDays.toLocaleString("en-US")) +
    metricCard("Days cheaper than today", Math.round((cheaper / store.close.length) * 100) + "%", `${cheaper.toLocaleString("en-US")} of ${store.close.length.toLocaleString("en-US")} days`);
  $("waitTable").innerHTML = table(
    [
      { key: "peak", label: "Old high" },
      { key: "back", label: "New high" },
      { key: "days", label: "Days waited" },
      { key: "deepest", label: "Deepest fall", fmt: (n) => pct(n), tone: true },
    ],
    waits.sort((a, b) => b.days - a.days).slice(0, 10)
  );
}

function renderMore() {
  if (!store.data || !more.tab) return;
  const [start, end] = currentRange();
  const i0 = lowerBound(start);
  const i1 = upperIndex(end);
  if (start > end || i1 - i0 < 1) return;
  if (more.tab === "returns") renderReturns(store.dates[i0], store.dates[i1]);
  if (more.tab === "trend") renderTrend(i0, i1);
  if (more.tab === "volatility") renderVolatility(i0, i1);
  if (more.tab === "compare") renderCompare();
  if (more.tab === "records") renderRecords();
}

$("tabs").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const name = button.dataset.tab;
  more.tab = moreTabs.some(([n]) => n === name) ? name : null;
  moreTabs.forEach(([n]) => $("tab-" + n).classList.toggle("hidden", n !== name));
  renderMore();
});
["period", "from", "to", "logScale"].forEach((id) => $(id).addEventListener("change", renderMore));
