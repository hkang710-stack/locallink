# 로컬 링크 (Local Link) — AI 역사 여행 큐레이터

감정으로 진입 → 서사로 몰입 → 교과서 연결 → 즉시 출발.
한국관광공사 TourAPI + 카카오맵 + Claude AI로 동작하는 역사 여행 추천 사이트입니다.

## 폴더 구조

```
locallink/
├── index.html          # 메인 앱 (랜딩 + 코스 생성 + 지도, KO/EN 지원)
├── api/
│   ├── ai.js           # Claude AI 큐레이터 프록시 (한국사 전체 → 이야기 + 여행지 JSON)
│   ├── tour.js         # 한국관광공사 TourAPI 프록시 (키워드/지역/좌표/상세, 한·영)
│   ├── directions.js   # 카카오모빌리티 자동차 길찾기 프록시
│   └── config.js       # 프론트에 카카오 JS 키 전달
├── .env.example        # 환경변수 템플릿
└── package.json
```

동작 흐름: 사용자가 감정/조건 입력 → `/api/ai`가 이야기·여행지 후보 생성 →
`/api/tour`로 실제 관광지 좌표·사진 매칭 → 카카오맵에 마커 표시 → `/api/directions`로 서울 기준 자동차 경로 안내.

API 키가 하나도 없어도 사이트는 열리고 **데모 코스(만석보)** 가 표시되므로, 먼저 배포하고 키를 나중에 붙여도 됩니다.

---

## 1단계 — API 키 4개 발급 (약 30분)

### ① 한국관광공사 TourAPI (무료)
1. [공공데이터포털](https://www.data.go.kr) 회원가입 → "한국관광공사 국문 관광정보 서비스" 검색 → **활용신청** (자동승인)
2. 마이페이지 → 해당 API → **일반 인증키(Decoding)** 복사
3. ⚠ 흔한 실수: **인코딩 키를 넣으면 인증 오류**가 납니다. 반드시 디코딩(일반) 키 사용.
4. 영어 서비스도 쓰려면 "영문 관광정보 서비스(EngService)"도 같은 방법으로 활용신청 (같은 키로 호출됩니다).

### ② 카카오 (무료)
1. [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 애플리케이션 추가
2. [앱 키] 메뉴에서 **JavaScript 키**, **REST API 키** 복사
3. [플랫폼 → Web] 에 도메인 등록 — 이걸 안 하면 지도가 안 뜹니다:
   - `http://localhost:3000` (로컬 개발용)
   - `https://프로젝트명.vercel.app` (배포 후 추가)
   - 커스텀 도메인 (연결 후 추가)
4. 길찾기용: [카카오모빌리티 디벨로퍼스](https://developers.kakaomobility.com)에서 같은 앱에 길찾기 API 사용 설정

### ③ Anthropic (Claude API)
1. [console.anthropic.com](https://console.anthropic.com) → API Keys → 키 생성
2. ⚠ **Claude Max 구독과 별개 서비스**입니다. API는 사용량만큼 과금되며 크레딧 충전이 필요합니다.
   (claude-sonnet-4-6 기준 코스 1회 생성에 약 1~3원 수준이라 부담은 크지 않습니다.)

---

## 2단계 — 배포 (GitHub + Vercel, 약 20분)

1. GitHub에 새 저장소 생성 → 이 폴더 전체 push
   ```bash
   git init && git add . && git commit -m "로컬 링크 v1"
   git remote add origin https://github.com/내계정/locallink.git
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) 가입(GitHub 연동) → **Add New → Project** → 저장소 import → Deploy
3. Vercel 프로젝트 → **Settings → Environment Variables** 에 4개 등록:
   `TOUR_API_KEY`, `KAKAO_JS_KEY`, `KAKAO_REST_KEY`, `ANTHROPIC_API_KEY`
4. **Deployments 탭에서 Redeploy** (환경변수는 재배포해야 반영됨)
5. 발급된 `https://xxx.vercel.app` 주소를 카카오 [플랫폼 → Web]에 추가

### 커스텀 도메인 (카페24에서 구매한 도메인)
Vercel 프로젝트 → Settings → Domains → 도메인 입력 → 안내되는 A/CNAME 레코드를
카페24 도메인 관리의 DNS 설정에 그대로 입력 → 연결 후 카카오 플랫폼에도 도메인 추가.

---

## 3단계 — 수정 워크플로우 (실시간 반영)

```
파일 수정 → git add . → git commit -m "설명" → git push
→ 약 1분 뒤 실서비스 자동 반영 (실수 시 Vercel에서 클릭 한 번으로 롤백)
```

Claude Code를 쓰면 "만석보 카드에 사진 슬라이드 넣어줘" 같은 요청으로
수정→커밋→푸시까지 대화로 처리할 수 있습니다.

### 로컬에서 미리 보기 (선택)
```bash
npm i -g vercel
cp .env.example .env   # 실제 키 입력
vercel dev             # http://localhost:3000 (서버리스 함수까지 로컬 실행)
```

---

## 자주 나는 오류

| 증상 | 원인 · 해결 |
|---|---|
| 코스가 항상 "데모 코스"로만 나옴 | `ANTHROPIC_API_KEY` 미설정/크레딧 부족 → Vercel 환경변수와 콘솔 크레딧 확인 후 재배포 |
| 지도가 "카카오 JS 키를 설정하세요"로 표시 | `KAKAO_JS_KEY` 미설정 또는 카카오 플랫폼에 현재 도메인 미등록 |
| TourAPI 오류 "응답이 JSON이 아닙니다" | 인코딩 키를 넣은 경우가 대부분 → 디코딩(일반) 키로 교체 |
| 교통수단 카드가 안 보임 | `KAKAO_REST_KEY` 미설정 또는 카카오모빌리티 길찾기 미신청 (부가 기능이라 없어도 사이트는 정상) |

## 다음 확장 아이디어
- 대중교통(KTX/버스): ODsay API 연동 또는 예매 링크 안내
- 코스 저장/공유: Vercel KV 또는 Supabase
- 유료 PDF 문장 모음집: 코스 결과 → PDF 생성 파이프라인
