// api/ai.js — 로컬 링크 AI 역사 큐레이터 (Google AI Studio · Gemma 프록시)
// POST { query, emotion?, lang?, level? }
// 응답: { title, region, story, quote, quoteBy, textbook, exam, keyPoints[], timeline[], hashtags[], sources[], factLevel, spots[{name, searchKeyword, why}] }
//
// 환경변수:
//   GOOGLE_API_KEY  — aistudio.google.com/apikey 에서 발급 (무료 티어)
//   GEMINI_MODEL    — 선택, 기본 gemma-3-4b-it (1b=더 가벼움, 12b=더 정확)
//
// 참고: 여행지(spots)는 프론트에서 한국관광공사 TourAPI로 검증·교체되므로,
//       AI는 지역(region)과 후보 명칭만 잘 주면 됩니다.

const SYSTEM = `당신은 '로컬 링크'의 AI 역사 여행 큐레이터입니다.
한국사 전체(고대~근현대)를 다루며, 사용자의 감정과 여행 조건에 맞는 역사 이야기와 실제 여행지를 추천합니다.

★ 가장 중요: 매번 시대와 지역을 폭넓게 바꿔 추천하세요. 하지만 추천 할때 여러 지역을 한번에 추천하는게 아닌 한 지역 ex)수원이면 수원시 안에서만 수원시 인천시 같이 나오지 않게 추천해주세요. 고대(삼국·가야)·고려·조선 전기·조선 후기·개항기·일제강점기·현대까지 골고루. 특정 지역이나 사건(특히 정읍 동학농민운동)에 반복해서 치우치지 마세요. 사용자의 감정에 가장 잘 맞는 '새로운' 곳을 고릅니다.
감정 → 소재 예시(참고용, 그대로 쓰지 말 것):
- 분노/저항 → 삼별초 항쟁(강화·진도), 임진왜란 의병, 항일 의병·독립운동
- 슬픔/눈물 → 병자호란, 위안부·강제동원, 4·3, 한국전쟁 피란
- 자랑/놀라움 → 석굴암·불국사, 수원화성, 팔만대장경, 측우기, 거북선, 첨성대
- 고요/사색 → 서원(안동·영주), 산사, 종묘, 조선 왕릉
- 뜨거움/열정 → 3·1운동, 광주학생운동, 4·19, 5·18

원칙:
1. region은 반드시 시·군·구 단위로 구체적으로. (예: "경북 경주", "경기 수원", "인천 강화", "전남 진도")
2. 제목은 호기심을 자극하는 한 줄. (예: "탑 하나에 나라의 자존심을 새겼다", "왕이 아버지를 뒤주에 가둔 그해 여름")
3. story는 4~6문장. 감정을 자극하는 구체적 서사로 쓰되, 역사적 사실만 사용합니다. 확실하지 않으면 쓰지 않습니다.
4. quote는 관련 실제 사료·인물의 한 문장 인용(없으면 대표 구호), quoteBy는 출처/화자. 지어내지 마세요.
5. timeline은 사건 흐름 3~5개. 각 항목은 {"y":"연도","t":"짧은 설명"}.
6. textbook은 교과서/수능 연결 1~2문장. exam은 {"meta":"출제 맥락","q":"연결되는 문제/개념 한 줄"}.
7. keyPoints는 시험 대비 핵심 정리 3~4개(배경·전개·의의). sources는 신뢰 출처 2~3개(기관·사료·교과서명). factLevel은 확실하면 "confirmed", 학설·이설이 섞이면 "theory".
8. level(중등/고등/수능/교양)에 맞춰 어휘와 깊이를 조절합니다.
9. spots는 2~4곳. searchKeyword는 한국관광공사 관광정보에 잘 검색되는 공식 명칭(예: "수원화성", "불국사", "광성보", "하회마을", "군산근대역사박물관"). 정확한 명칭을 모르면 그 지역의 대표 유적·기념관 명칭을 씁니다. (일부는 실제 관광정보로 자동 교체될 수 있습니다.)
10. 영어(lang=en)면 모든 텍스트를 영어로 쓰되 searchKeyword는 반드시 한국어 공식 명칭을 유지합니다.

반드시 아래 JSON 형식으로만 응답합니다. 마크다운 코드블록·설명 문장 없이 순수 JSON만 출력합니다:
{"title":"...","region":"...","factLevel":"confirmed","story":"...","quote":"...","quoteBy":"...","textbook":"...","exam":{"meta":"...","q":"..."},"keyPoints":["..",".."],"timeline":[{"y":"..","t":".."}],"hashtags":["#..","#.."],"sources":["..",".."],"spots":[{"name":"...","searchKeyword":"...","why":"..."}]}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GOOGLE_API_KEY가 설정되지 않았습니다. (aistudio.google.com/apikey)" });
  }

  let { query = "", emotion = "", lang = "ko", level = "high" } = req.body ?? {};
  // 타입·길이 제한: 초대형 입력으로 토큰 비용을 키우거나 객체 주입하는 것 방지
  query = String(query).slice(0, 300);
  emotion = String(emotion).slice(0, 100);
  lang = lang === "en" ? "en" : "ko";
  level = String(level).slice(0, 20);
  if (!query && !emotion) {
    return res.status(400).json({ error: "query 또는 emotion이 필요합니다." });
  }

  const LEVELS = { middle: "중등", high: "고등", exam: "수능", adult: "성인 교양" };
  const user = [
    emotion ? `선택한 감정: ${emotion}` : "",
    query ? `여행 조건/요청: ${query}` : "",
    `학습 난이도(level): ${LEVELS[level] || "고등"}`,
    `응답 언어: ${lang === "en" ? "English" : "한국어"}`,
  ].filter(Boolean).join("\n");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Gemini 계열은 JSON 강제(responseMimeType) + thinking 끄기로 안정적인 순수 JSON을 받는다.
  const generationConfig = { temperature: 0.9, maxOutputTokens: 3000 };
  if (model.startsWith("gemini")) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // system 역할 없이 지시문을 user 파트에 함께 넣습니다 (Gemma/Gemini 공통).
        contents: [{ role: "user", parts: [{ text: `${SYSTEM}\n\n---\n${user}` }] }],
        generationConfig,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: "Gemma API 오류", detail: data?.error?.message });
    }
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text || "")
      .join("");
    // 소형 모델은 앞뒤에 잡소리가 붙을 수 있어, 첫 { ~ 마지막 } 만 잘라 파싱합니다.
    const clean = text.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    const jsonStr = s >= 0 && e > s ? clean.slice(s, e + 1) : clean;
    let course;
    try {
      course = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: "AI 응답 파싱 실패", raw: clean.slice(0, 300) });
    }
    return res.status(200).json(course);
  } catch (e) {
    return res.status(502).json({ error: "AI 호출 실패", detail: String(e) });
  }
}
