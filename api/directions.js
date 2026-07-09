// api/directions.js — 카카오모빌리티 자동차 길찾기 프록시
// REST 키는 서버에만 보관합니다.
// 사용 예: /api/directions?originX=126.97&originY=37.55&destX=126.85&destY=35.63

export default async function handler(req, res) {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) {
    return res.status(500).json({ error: "KAKAO_REST_KEY가 설정되지 않았습니다." });
  }
  const { originX, originY, destX, destY } = req.query;
  if (!originX || !originY || !destX || !destY) {
    return res.status(400).json({ error: "originX, originY, destX, destY가 모두 필요합니다." });
  }

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.search = new URLSearchParams({
    origin: `${originX},${originY}`,
    destination: `${destX},${destY}`,
    summary: "true",
  });

  try {
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: "카카오 길찾기 오류", detail: data });
    }
    const s = data?.routes?.[0]?.summary;
    if (!s) return res.status(200).json({ found: false });
    return res.status(200).json({
      found: true,
      durationMin: Math.round(s.duration / 60),
      distanceKm: Math.round(s.distance / 100) / 10,
      tollFare: s.fare?.toll ?? 0,
      taxiFare: s.fare?.taxi ?? 0,
    });
  } catch (e) {
    return res.status(502).json({ error: "길찾기 호출 실패", detail: String(e) });
  }
}
