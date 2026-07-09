// api/config.js — 프론트가 사용할 공개 설정 전달
// 카카오 JavaScript 키는 도메인 제한이 걸려 있어 공개되어도 안전하지만,
// 키를 코드가 아닌 환경변수 한 곳에서 관리하기 위해 이 엔드포인트로 전달합니다.

export default function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300");
  res.status(200).json({
    kakaoJsKey: process.env.KAKAO_JS_KEY || "",
  });
}
