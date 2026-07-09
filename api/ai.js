// api/ai.js — 로컬 링크 AI 역사 큐레이터 (Anthropic Claude API 프록시)
// POST { query: "1박 2일 친구랑, 뜨거운 역사", emotion?: "...", lang?: "ko"|"en" }
// 응답: { title, region, story, textbook, hashtags[], spots[{name, searchKeyword, why}] }

const SYSTEM = `당신은 '로컬 링크'의 AI 역사 여행 큐레이터입니다.
한국사 전체(고대~현대)를 다루며, 사용자의 감정과 여행 조건에 맞는 역사 이야기와 실제 여행지를 추천합니다.

원칙:
1. 수도권 외 지방 도시를 우선 추천합니다. 특히 정읍, 강화, 공주, 부여, 안동은 우선 고려하되, 이야기에 더 맞는 지역이 있으면 자유롭게 선택합니다.
2. 제목은 호기심을 자극하는 한 줄로 씁니다. (예: "있는데 또 만들어서, 이중으로 뜯었다")
3. story는 4~6문장. 감정을 자극하는 구체적 서사로 쓰되, 역사적 사실만 사용합니다. 확실하지 않은 내용은 쓰지 않습니다.
4. textbook은 이 이야기가 교과서/수능의 어떤 내용과 연결되는지 1~2문장으로 씁니다.
5. spots는 2~4곳. searchKeyword는 한국관광공사 관광정보 검색에 잘 걸리는 공식 명칭으로 씁니다. (예: "만석보유지", "황토현전적", "전봉준유적")
6. 사용자가 영어(lang=en)를 쓰면 모든 텍스트를 영어로 쓰되 searchKeyword는 반드시 한국어 공식 명칭을 유지합니다.

반드시 아래 JSON 형식으로만 응답합니다. 마크다운 코드블록, 설명 문장 없이 순수 JSON만 출력합니다:
{"title":"...","region":"...","story":"...","textbook":"...","hashtags":["#..","#.."],"spots":[{"name":"...","searchKeyword":"...","why":"..."}]}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  }

  const { query = "", emotion = "", lang = "ko" } = req.body ?? {};
  if (!query && !emotion) {
    return res.status(400).json({ error: "query 또는 emotion이 필요합니다." });
  }

  const user = [
    emotion ? `선택한 감정: ${emotion}` : "",
    query ? `여행 조건/요청: ${query}` : "",
    `응답 언어: ${lang === "en" ? "English" : "한국어"}`,
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: "Claude API 오류", detail: data?.error?.message });
    }
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    let course;
    try {
      course = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: "AI 응답 파싱 실패", raw: clean.slice(0, 300) });
    }
    return res.status(200).json(course);
  } catch (e) {
    return res.status(502).json({ error: "AI 호출 실패", detail: String(e) });
  }
}
