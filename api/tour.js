// api/tour.js — 한국관광공사 TourAPI 프록시
// 프론트에는 키가 노출되지 않고, Vercel 환경변수 TOUR_API_KEY만 사용합니다.
// 사용 예:
//   /api/tour?op=keyword&keyword=만석보
//   /api/tour?op=keyword&keyword=Manseokbo&lang=en
//   /api/tour?op=location&mapX=126.85&mapY=35.63&radius=5000
//   /api/tour?op=detail&contentId=126508

const BASE = {
  ko: "https://apis.data.go.kr/B551011/KorService2",
  en: "https://apis.data.go.kr/B551011/EngService2",
};

const OPS = {
  keyword: "searchKeyword2",
  area: "areaBasedList2",
  location: "locationBasedList2",
  detail: "detailCommon2",
};

export default async function handler(req, res) {
  const key = process.env.TOUR_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "TOUR_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요." });
  }

  const { op = "keyword", lang = "ko", ...rest } = req.query;
  const endpoint = OPS[op];
  if (!endpoint) {
    return res.status(400).json({ error: `지원하지 않는 op: ${op}` });
  }

  // 허용된 파라미터만 통과 (serviceKey·_type 덮어쓰기, 무제한 numOfRows 등 남용 차단)
  const ALLOWED = ["keyword", "mapX", "mapY", "radius", "contentId", "contentTypeId", "areaCode", "sigunguCode", "arrange", "pageNo", "numOfRows"];
  const params = {
    serviceKey: key, // 공공데이터포털 "디코딩(일반)" 키 사용
    MobileOS: "ETC",
    MobileApp: "LocalLink",
    _type: "json",
    numOfRows: "10",
    arrange: "O", // 기본값: 대표이미지 있는 항목만 (검증용 검색은 클라이언트가 arrange=A로 재정의)
  };
  for (const k of ALLOWED) {
    if (rest[k] != null && rest[k] !== "") params[k] = String(rest[k]);
  }
  params.numOfRows = String(Math.min(parseInt(params.numOfRows, 10) || 10, 20)); // 상한 20
  const url = new URL(`${BASE[lang === "en" ? "en" : "ko"]}/${endpoint}`);
  url.search = new URLSearchParams(params);

  try {
    const r = await fetch(url);
    const text = await r.text();
    // 키 오류 시 관광공사는 XML로 에러를 반환하므로 JSON 파싱 실패를 잡아준다
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "TourAPI 응답이 JSON이 아닙니다. 인증키(디코딩 키 사용 여부)를 확인하세요.", raw: text.slice(0, 300) });
    }
    const items = data?.response?.body?.items?.item ?? [];
    // 프론트에서 쓰기 좋은 형태로 축약
    const simplified = (Array.isArray(items) ? items : [items]).map((it) => ({
      contentId: it.contentid,
      contentTypeId: String(it.contenttypeid || ""), // 12 관광지 · 14 문화시설 · 32 숙박 · 39 음식점 …
      title: it.title,
      addr: it.addr1 || "",
      mapX: parseFloat(it.mapx), // 경도
      mapY: parseFloat(it.mapy), // 위도
      image: it.firstimage || "",
      tel: it.tel || "",
      overview: it.overview || "",
    })).filter((it) => it.title);

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ items: simplified });
  } catch (e) {
    return res.status(502).json({ error: "TourAPI 호출 실패", detail: String(e) });
  }
}
