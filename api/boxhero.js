// 박스히어로 읽기 전용 프록시
//
// 토큰을 index.html 에 넣으면 소스 보기로 그대로 노출됩니다(쓰기 권한 토큰!).
// 그래서 토큰은 **서버 환경변수** 에만 두고, 브라우저는 이 함수를 거쳐서 읽습니다.
// 팀원은 토큰 없이 주소만 열면 됩니다.
//
// 설정: Vercel 프로젝트 → Settings → Environment Variables
//        BOXHERO_API_TOKEN = <박스히어로 앱 → 설정 → 연동에서 발급한 토큰>
//        저장 후 반드시 Redeploy.
//
// 보안 제한 (여기서 막습니다)
//   · GET 만 허용 — 등록·수정·삭제 요청은 통과하지 못합니다
//   · 아래 ALLOW 에 있는 경로만 허용 — 그 외는 403
//   · 응답에서 원가(cost)·판매가(price) 는 지웁니다

const BASE = 'https://rest.boxhero-app.com';

// 조회만, 그것도 화면에 필요한 것만.
const ALLOW = [
  /^v1\/teams\/linked$/,
  /^v1\/locations$/,
  /^v1\/transactions$/,
  /^v1\/transactions\/\d+$/,
  /^v1\/items$/
];

function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
}

// 원가·판매가 같은 값은 굳이 내보내지 않습니다.
function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === 'cost' || k === 'price') continue;
      o[k] = strip(x);
    }
    return o;
  }
  return v;
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: '조회만 가능합니다.' });
  }

  const token = process.env.BOXHERO_API_TOKEN;
  if (!token) {
    return res.status(503).json({
      success: false,
      reason: 'no-token',
      message: '서버에 BOXHERO_API_TOKEN 환경변수가 없습니다. Vercel Settings → Environment Variables 에 넣고 Redeploy 하세요.'
    });
  }

  const path = String(req.query.path || '').replace(/^\/+/, '');
  if (!ALLOW.some((re) => re.test(path))) {
    return res.status(403).json({ success: false, message: '허용되지 않은 경로입니다: ' + path });
  }

  // 페이지네이션·필터 파라미터만 그대로 넘깁니다.
  const qs = new URLSearchParams();
  for (const k of ['limit', 'cursor', 'type']) {
    if (req.query[k] != null && req.query[k] !== '') qs.set(k, String(req.query[k]));
  }

  try {
    const r = await fetch(`${BASE}/${path}` + (qs.toString() ? '?' + qs : ''), {
      headers: { Authorization: 'Bearer ' + token }
    });

    const body = await r.json().catch(() => null);
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        message: body?.title || ('박스히어로 API ' + r.status)
      });
    }
    return res.status(200).json(strip(body));
  } catch (error) {
    console.error('[boxhero proxy]', error);
    return res.status(502).json({ success: false, message: '박스히어로에 연결하지 못했습니다.' });
  }
}
