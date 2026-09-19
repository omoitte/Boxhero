/* 구매 터미널 — 화면 */
"use strict";

const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const charts = {};

function table(node, cols, rows) {
  node.innerHTML = "";
  if (!rows.length) { node.appendChild(el("caption", "none", "해당 없음")); return; }
  const htr = el("tr");
  cols.forEach(c => htr.appendChild(el("th", c.cls || "", c.t)));
  const th = el("thead"); th.appendChild(htr); node.appendChild(th);
  const tb = el("tbody");
  rows.forEach((r, i) => {
    const tr = el("tr");
    cols.forEach(c => {
      const td = el("td", c.cls || "");
      const v = c.get(r, i);
      if (v instanceof Node) td.appendChild(v); else td.textContent = v == null ? "" : v;
      if (c.title) td.title = c.title(r);
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  node.appendChild(tb);
}

function rank(node, rows, labf, valf, subf) {
  node.innerHTML = "";
  const max = rows.reduce((m, r) => Math.max(m, valf(r)), 0) || 1;
  rows.forEach((r, i) => {
    const d = el("div", "rk");
    const f = el("div", "fill"); f.style.width = (valf(r) / max * 100) + "%"; d.appendChild(f);
    d.appendChild(el("div", "i", i + 1));
    const l = el("div", "l"); l.appendChild(document.createTextNode(labf(r)));
    if (subf) l.appendChild(el("s", null, subf(r)));
    d.appendChild(l);
    d.appendChild(el("div", "v", com(valf(r))));
    d.title = labf(r) + "   " + won(valf(r)) + "원";
    node.appendChild(d);
  });
}

/* ── 차트 공통 ── */
const AX = { color: "#5a5a5a", font: { size: 9.5, family: "Consolas" } };
function tip(label) {
  return { backgroundColor: "#000", borderColor: "#3a3a3a", borderWidth: 1,
           titleColor: "#ff9e1b", bodyColor: "#e8e8e8",
           titleFont: { family: "Consolas", size: 11 },
           bodyFont: { family: "Consolas", size: 11 },
           displayColors: false, padding: 7, callbacks: { label } };
}
function draw(id, cfg) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), cfg);
}

/* ── 전체 그리기 ── */
function render(yf) {
  const R = yf ? T.rows.filter(r => r.y === yf) : T.rows;
  const yrs = yf ? [yf] : T.years;
  const LAST = T.years[T.years.length - 1], PREV = T.years[T.years.length - 2];

  /* 올해가 아직 안 끝났으니 전년도도 같은 달까지만 잘라서 비교한다 */
  const lastMon = T.rows.filter(r => r.y === LAST)
    .reduce((m, r) => r.ym > m ? r.ym : m, "").slice(5, 7) || "12";
  const ytd = y => T.rows.filter(r => r.y === y && r.ym.slice(5, 7) <= lastMon)
    .reduce((a, r) => a + r.amt, 0);
  const cur = LAST ? ytd(LAST) : 0, prv = PREV ? ytd(PREV) : 0;
  const yoy = prv > 0 ? (cur - prv) / prv * 100 : null;

  const totAmt = R.reduce((a, r) => a + r.amt, 0);
  const items  = new Set(R.map(r => r.code)).size;
  const vens   = new Set(R.map(r => r.ven).filter(Boolean)).size;
  const bad    = R.filter(r => r.price != null && r.qty != null &&
                               Math.abs(r.price * r.qty - r.amt) > 1);

  const dates = R.map(r => r.date).sort();
  $("rtSpan").textContent = (dates[0] || "") + " · " + (dates[dates.length - 1] || "");
  $("stRows").textContent = won(T.rows.length);
  $("stSrc").textContent  = T.src;

  /* 지표 띠 */
  $("tape").innerHTML = "";
  [ ["발주금액", com(totAmt), "", won(totAmt) + "원"],
    ["발주 건수", won(R.length), "", "품목 " + won(items) + "종"],
    ["거래처", won(vens), "", items ? "품목당 " + (R.length / items).toFixed(1) + "회" : ""],
    [(yf || LAST) + " 누계", com(yf ? totAmt : cur), "",
      yf ? "선택 연도 전체" : "1~" + Number(lastMon) + "월"],
    ["전년 동기비",
      yoy == null ? "—" : (yoy > 0 ? "▲" : "▼") + Math.abs(yoy).toFixed(1) + "%",
      yoy == null ? "" : (yoy > 0 ? "dn" : "up"),
      PREV ? PREV + " " + com(prv) : ""],
    ["정합성 이상", won(bad.length), bad.length ? "dn" : "",
      com(bad.reduce((a, r) => a + r.amt, 0)) + "원"],
  ].forEach(([k, v, cls, s]) => {
    const c = el("div", "c");
    c.appendChild(el("div", "k", k));
    c.appendChild(el("div", "v " + cls, v));
    c.appendChild(el("div", "s", s));
    $("tape").appendChild(c);
  });

  /* 1) 월별 추이 */
  $("tagMon").textContent = yrs.join(" / ");
  const LINE = ["#ff9e1b", "#00d4ff", "#b388ff", "#00e676"];
  draw("cMon", {
    type: "line",
    data: {
      labels: ["1","2","3","4","5","6","7","8","9","10","11","12"],
      datasets: yrs.map((y, i) => {
        const arr = new Array(12).fill(null);
        T.rows.forEach(r => { if (r.y === y) {
          const m = Number(r.ym.slice(5, 7)) - 1; arr[m] = (arr[m] || 0) + r.amt; } });
        const c = LINE[i % LINE.length];
        return { label: y, data: arr, borderColor: c, backgroundColor: c + "14",
                 borderWidth: 1.4, pointRadius: 1.8, pointBackgroundColor: c,
                 tension: 0, fill: i === yrs.length - 1, spanGaps: false };
      })
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#8a8a8a", boxWidth: 8, boxHeight: 8,
                            font: { size: 10, family: "Consolas" } } },
        tooltip: tip(c => c.dataset.label + "년  " + won(c.raw) + "원") },
      scales: {
        y: { beginAtZero: true, grid: { color: "#1a1a1a" }, border: { display: false },
             ticks: Object.assign({}, AX, { callback: v => com(v) }) },
        x: { grid: { display: false }, border: { color: "#3a3a3a" }, ticks: AX } }
    }
  });

  /* 2) 연도별 */
  table($("tYr"),
    [ { t:"연도", get:r => r.y },
      { t:"발주금액", cls:"r w", get:r => won(r.amt) },
      { t:"건수", cls:"r d", get:r => won(r.n) },
      { t:"품목", cls:"r d", get:r => won(r.it) } ],
    T.years.map(y => {
      const s = T.rows.filter(r => r.y === y);
      return { y, amt: s.reduce((a, r) => a + r.amt, 0), n: s.length,
               it: new Set(s.map(r => r.code)).size };
    }));
  $("nYr").textContent = LAST && PREV
    ? LAST + "년은 " + Number(lastMon) + "월까지. 같은 기간 " + PREV + "년 " + com(prv) + "원."
    : "";

  /* 3) 계약 방식 */
  const BZ = ["#ff9e1b","#00d4ff","#b388ff","#00e676","#ff3b30","#6b7f92","#c9a227","#5eead4"];
  const biz = roll(R, r => r.biz).slice(0, 8);
  const bt = biz.reduce((a, b) => a + b.amt, 0);
  draw("cBiz", {
    type: "doughnut",
    data: { labels: biz.map(b => b.k),
            datasets: [{ data: biz.map(b => b.amt), backgroundColor: BZ,
                         borderWidth: 1, borderColor: "#000" }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "56%",
      layout: { padding: 2 },
      plugins: {
        legend: { position: "bottom", align: "start",
          labels: { color: "#8a8a8a", boxWidth: 8, boxHeight: 8, padding: 5,
            font: { size: 10 },
            generateLabels: ch => ch.data.labels.map((l, i) => ({
              text: (l.length > 16 ? l.slice(0, 16) + "…" : l) + "  " +
                    (bt ? (biz[i].amt / bt * 100).toFixed(0) : 0) + "%",
              fillStyle: BZ[i % BZ.length], strokeStyle: "#000", lineWidth: 1,
              fontColor: "#8a8a8a", index: i })) } },
        tooltip: tip(c => won(c.raw) + "원  " + (bt ? (c.raw / bt * 100).toFixed(1) : 0) + "%") } }
  });

  /* 4) 거래처 · 8) 부서 */
  const ven = roll(R, r => r.ven);
  rank($("rVen"), ven.slice(0, 20), r => r.k, r => r.amt,
       r => won(r.n) + "건 " + r.it.size + "종");
  rank($("rDept"), roll(R, r => r.dept).slice(0, 14), r => r.k, r => r.amt,
       r => won(r.n) + "건");
  $("tagVen").textContent = "전체 " + won(ven.length) + "곳";

  /* 5) 6) 단가 변동 */
  const A = yf || LAST, B = yf ? String(Number(yf) - 1) : PREV;
  const byCode = new Map(T.items.map(s => [s.code, s]));
  const chg = [];
  T.items.forEach(s => {
    if (s.dirty) return;                       // 수량 누락 줄이 있으면 단가를 믿을 수 없다
    const p0 = (s.y[B] || {}).p, p1 = (s.y[A] || {}).p;
    if (!p0 || !p1 || s.amt < 1e6) return;
    const d = (p1 - p0) / p0 * 100;
    if (Math.abs(d) < 1 || Math.abs(d) > 200) return;   // 200% 넘는 건 규격이 바뀐 것
    chg.push({ code: s.code, name: s.name, p0, p1, d, amt: s.amt });
  });
  const chgCols = cls => [
    { t:"코드", cls:"cy", get:r => r.code },
    { t:"품목명", cls:"nm", get:r => r.name, title:r => r.name },
    { t:B, cls:"r d", get:r => won(r.p0) },
    { t:A, cls:"r w", get:r => won(r.p1) },
    { t:"증감", cls:"r " + cls, get:r => pc(r.d) },
    { t:"누적", cls:"r dd", get:r => com(r.amt) },
  ];
  table($("tUp"), chgCols("dn"), chg.filter(r => r.d > 0).sort((a, b) => b.d - a.d).slice(0, 25));
  table($("tDn"), chgCols("up"), chg.filter(r => r.d < 0).sort((a, b) => a.d - b.d).slice(0, 25));

  /* 7) 초과지출 — 여기가 돈이다 */
  const sp = T.items.filter(s => s.ven.size >= 2 && s.rows.length >= 3 && s.mx > s.mn)
                    .sort((a, b) => b.over - a.over).slice(0, 25);
  table($("tOver"),
    [ { t:"코드", cls:"cy", get:s => s.code },
      { t:"품목명", cls:"nm", get:s => s.name, title:s => s.name },
      { t:"최저", cls:"r up", get:s => won(s.mn) },
      { t:"최고", cls:"r dn", get:s => won(s.mx) },
      { t:"배수", cls:"r d", get:s => s.mn ? (s.mx / s.mn).toFixed(1) + "x" : "" },
      { t:"거래처", cls:"r d", get:s => s.ven.size },
      { t:"발주", cls:"r d", get:s => s.rows.length },
      { t:"누적", cls:"r dd", get:s => won(s.amt) },
      { t:"초과지출", cls:"r am", get:s => won(s.over) } ],
    sp);
  $("tagOver").textContent = "상위 25 합계 " + com(sp.reduce((a, s) => a + s.over, 0)) + "원";

  /* 9) 계약가 초과 구매 */
  const ovc = [];
  T.items.forEach(s => {
    const c = T.price.get(nkey(s.code));
    if (!c) return;
    const last = s.rows.reduce((m, r) => (!m || r.date > m.date) ? r : m, null);
    if (!last || !last.price || last.price <= c.p) return;
    ovc.push({ code: s.code, name: s.name, con: c.p, act: last.price,
               date: last.date, ven: last.ven, d: (last.price - c.p) / c.p * 100 });
  });
  ovc.sort((a, b) => b.d - a.d);
  table($("tOvc"),
    [ { t:"코드", cls:"cy", get:r => r.code },
      { t:"품목명", cls:"nm", get:r => r.name, title:r => r.name },
      { t:"계약가", cls:"r d", get:r => won(r.con) },
      { t:"최근구매", cls:"r w", get:r => won(r.act) },
      { t:"차이", cls:"r dn", get:r => pc(r.d) },
      { t:"거래처", cls:"nm d", get:r => r.ven } ],
    ovc.slice(0, 25));
  $("tagOvc").textContent = won(ovc.length) + "품목";

  /* 10) 단독 거래처 */
  table($("tSole"),
    [ { t:"코드", cls:"cy", get:s => s.code },
      { t:"품목명", cls:"nm", get:s => s.name, title:s => s.name },
      { t:"거래처", cls:"nm d", get:s => [...s.ven][0] || "" },
      { t:"누적", cls:"r w", get:s => won(s.amt) },
      { t:"발주", cls:"r d", get:s => s.rows.length } ],
    T.items.filter(s => s.ven.size === 1 && s.rows.length >= 3)
           .sort((a, b) => b.amt - a.amt).slice(0, 25));

  /* 11) 정합성 이상 */
  table($("tBad"),
    [ { t:"발주일", cls:"d", get:r => r.date },
      { t:"거래처", cls:"nm d", get:r => r.ven },
      { t:"품목명", cls:"nm", get:r => r.name, title:r => r.code + "  " + r.name },
      { t:"단가", cls:"r w", get:r => won(r.price) },
      { t:"수량", cls:"r d", get:r => won(r.qty) },
      { t:"발주금액", cls:"r w", get:r => won(r.amt) },
      { t:"차액", cls:"r dn", get:r => won(r.price * r.qty - r.amt) } ],
    bad.slice().sort((a, b) => b.amt - a.amt).slice(0, 25));
  $("tagBad").textContent = bad.length > 25
    ? "상위 25 / 전체 " + won(bad.length) + "건" : won(bad.length) + "건";
}
