/* 구매 터미널 — 데이터
   원천은 가격 검색 사이트의 purchases.json · catalog.json 하나뿐이다.
   여기서 따로 집계 파일을 만들지 않는다. 그래야 갱신이 한 곳만 타면 된다. */
"use strict";

const T = {
  buy: [], cat: [], rows: [], items: [], years: [], price: new Map(), src: "",
};

/* 배포 위치에 따라 경로가 다르다 — 순서대로 시도한다 */
const PATHS = [
  "../data/",             // 저장소 배포:  /dashboard/ → /data/
  "data/",                // 같은 폴더에 data/ 를 둔 경우
  "../단가검색-site/",     // 로컬 작업 폴더
  "",                     // 바로 옆에 둔 경우
];

async function fetchFirst(name) {
  let last = "";
  for (const p of PATHS) {
    try {
      const r = await fetch(p + name, { cache: "no-store" });
      if (r.ok) { T.src = p || "./"; return await r.json(); }
      last = r.status;
    } catch (e) { last = e.message; }
  }
  throw new Error(name + " — " + last);
}

const nkey = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function load() {
  T.buy = await fetchFirst("purchases.json");
  try { T.cat = await fetchFirst("catalog.json"); } catch (e) { T.cat = []; }

  /* 발주 한 줄 한 줄로 펼친다. 모든 집계가 여기서 나온다.
     h = [발주일, 단가, 수량, 거래처, 요청부서, 발주금액, 구매업무] */
  T.buy.forEach(it => (it.h || []).forEach(x => {
    if (!x || !x[0]) return;
    const qty = x[2] || 0, price = x[1];
    T.rows.push({
      date: x[0], ym: x[0].slice(0, 7), y: x[0].slice(0, 4),
      code: it.code, name: it.name,
      price: price, qty: qty,
      ven: x[3] || "", dept: x[4] || "",
      amt: x[5] != null ? x[5] : (price || 0) * qty,
      biz: x[6] || "",
    });
  }));
  T.years = [...new Set(T.rows.map(r => r.y))].sort();

  /* 품목별로 묶는다 — 초과지출·단독거래처·단가변동의 재료 */
  const m = new Map();
  T.rows.forEach(r => {
    let s = m.get(r.code);
    if (!s) m.set(r.code, s = { code: r.code, name: r.name, rows: [], amt: 0,
                                ven: new Set(), y: {} });
    s.rows.push(r); s.amt += r.amt;
    if (r.ven) s.ven.add(r.ven);
    if (r.price > 0) (s.y[r.y] || (s.y[r.y] = [])).push(r.price);
  });
  T.items = [...m.values()];
  T.items.forEach(s => {
    /* 연도 대표단가는 중앙값으로 잡는다.
       ERP에서 수량이 안 넘어온 줄은 단가 칸에 총액이 들어와 있어서,
       "그 해 마지막 값"으로 잡으면 8원 → 68,400원 같은 헛수치가 나온다. */
    Object.keys(s.y).forEach(y => {
      const a = s.y[y].slice().sort((p, q) => p - q);
      s.y[y] = { p: a[a.length >> 1], n: a.length };
    });
    const ps = s.rows.map(r => r.price).filter(p => p > 0);
    s.mn = ps.length ? Math.min.apply(null, ps) : null;
    s.mx = ps.length ? Math.max.apply(null, ps) : null;
    /* 전부 최저가로 샀다면 얼마를 아꼈을까 */
    s.over = s.mn == null ? 0
      : s.rows.reduce((a, r) => a + ((r.price || s.mn) - s.mn) * (r.qty || 0), 0);
    /* 단가 × 수량 ≠ 금액인 줄이 있으면 이 품목 수치는 믿지 않는다 */
    s.dirty = s.rows.some(r => r.price != null && r.qty != null &&
                               Math.abs(r.price * r.qty - r.amt) > 1);
  });

  /* 단가표 — 품목코드별 가장 최근 계약가 */
  T.cat.forEach(c => {
    if (!c || !c.code || c.price == null) return;
    const k = nkey(c.code), cur = T.price.get(k);
    if (!cur || (c.year || 0) >= cur.year)
      T.price.set(k, { p: c.price, year: c.year || 0, sup: c.sup || c.vendor || "" });
  });
}

/* ── 숫자 ── */
const won = n => (n == null || n === "") ? "" : Math.round(Number(n)).toLocaleString("ko-KR");
function com(n) {                       // 억·만 — 축과 지표 띠에서만
  n = Number(n) || 0;
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e8) return s + (a / 1e8).toFixed(a >= 1e9 ? 0 : 1) + "억";
  if (a >= 1e4) return s + Math.round(a / 1e4).toLocaleString("ko-KR") + "만";
  return s + Math.round(a).toLocaleString("ko-KR");
}
const pc = v => (v > 0 ? "+" : "") + v.toFixed(1) + "%";

/* 키별 금액·건수·품목수 */
function roll(rows, keyf) {
  const m = new Map();
  rows.forEach(r => {
    const k = keyf(r); if (!k) return;
    let s = m.get(k); if (!s) m.set(k, s = { k, amt: 0, n: 0, it: new Set() });
    s.amt += r.amt; s.n++; s.it.add(r.code);
  });
  return [...m.values()].sort((a, b) => b.amt - a.amt);
}
