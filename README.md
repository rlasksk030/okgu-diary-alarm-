최신 UI 비교·복원: [운영 main과 학생·교사 화면 대조](docs/운영main_화면비교_2026-10-03.md). 비교110+24개, 로컬49tests/16화면, 실제 시험16화면 통과. 기본 디자인/문구/메뉴를 보존하고 데이터 처리에서 생긴 표시·흐름 차이를 복원했습니다.

# 옥구 다이어리 — Cloudflare 이전 시험 브랜치

기존 GitHub Pages 화면을 보존하면서 Apps Script 서버 호출을 Workers + D1 + 비공개 R2로 옮기는 작업입니다. 운영 main·학생용 주소·Supabase는 변경하지 않습니다.

2026-10-03 최신: **유료 전환 없이 로그인1102 해결**, 같은600,000회 PIN 계산을 무료 비공개 Durable Object에 분리했습니다. 계정·자료는 D1에 유지하고 계산 객체에는 저장하지 않습니다. 실제 원격 API 기능15개/화면16개, 로컬46tests/16browser 통과. 가상13명 API/browser 실패0이지만 로그인·목록·글 저장의 API p95 목표는 미달했습니다.

시험 화면: https://okgu-diary-trial.rlasksk030.workers.dev/okgu-diary-alarm-/ — 가상 `시험학생01~13` 또는 `가상교사`, PIN `0042`. 현재 로그인 가능합니다. 실제 자료/푸시는 사용하지 않습니다.

실제13명 API p95: 로그인4513ms·재접속142ms·목록706ms·글791ms·사진 업로드+저장1345ms. 별도13개 Chromium 화면 p95: 최초1452ms·로그인5594ms·재접속339ms·글725ms·사진2804ms. Codex 클라우드/proxy 측정으로 학교망·실물 기기·cold Worker 결과가 아닙니다.

상세: [CPU 원인·무료 구성·실측·비용](docs/로그인_CPU_무료해결_2026-10-03.md), [작업 인계](2026-10-02_옥구다이어리_작업인계.md), [배포 입력값](docs/Cloudflare_시험배포.md), [기능 대응표](docs/기능대응표.md).

## 다른 Codex 환경에서 재현

Node 24, npm, Linux Chromium 필요. 기존 체크아웃에서 `codex/2026-10-02-okgu-speed`를 선택합니다. 별도 Git worktree는 필요하지 않습니다. 설치/로컬 검증에는 Cloudflare 계정이나 비밀키가 필요하지 않습니다.

```sh
npm ci --cache /tmp/okgu-npm-cache --no-audit --no-fund
npm run build:local
npm run seed
npm start
```

`npm start`는 별도 장기 실행 프로세스로 유지합니다. 다른 터미널에서:

```sh
npm run check
npm test
npm run test:browser
npm run test:load
npm run migrate
npm run migrate:delta:rehearsal
npm run test:load:browser
```

Chromium은 `/usr/bin/chromium`을 사용합니다. 경로가 다르면 `CHROME_PATH`를 설정하거나 `npx playwright install chromium`으로 설치하고 브라우저 스크립트의 executablePath 설정을 조정합니다. Windows/macOS 자체 개발은 별도 검증하지 않았습니다.

`npm test`의 Worker 통합 검증은 3020 포트의 로컬 서버가 먼저 실행되어야 합니다. 시험 데이터만 사용합니다. 로컬 D1/R2는 `.local/cloudflare`에 저장되고 Git에서 제외합니다. 로그인 가상 계정은 시험학생01~13, 가상교사, PIN 0042입니다. 실제 학생 인증값이 아닙니다.

성능 스크립트는 오류가 없어도 설정된 p95 목표를 넘으면 exit 1입니다. 목표 미달을 통과로 보고하지 않습니다. 결과는 `artifacts`에 생성되며 검토한 가상 자료의 측정값만 docs에 복사합니다.

실제 시험 배포는 [인증 안내](docs/Cloudflare_로그인과시험실행.md)대로 Codex 환경에 Cloudflare 인증을 설정한 뒤 `npm run trial:launch`, 측정은 `npm run trial:measure`입니다. 이름이 고정된 독립 시험 D1·비공개 R2만 생성/사용하고 원격 DB의 가상 계정 여부를 먼저 검사합니다. 과금 활성화는 자동 처리하지 않습니다. `npm run deploy:trial`은 이미 준비된 시험 리소스를 사용하는 개별 배포 명령입니다. Cloudflare 화면/인증이 없는 동안도 로컬 개발은 계속 가능합니다. GitHub Pages 운영 화면을 이 시험 bundle로 교체하지 마십시오.

자료 이전·격리 복원·신규 기록 보존 절차는 [자료 이전과 복귀](docs/자료이전_전환_복귀.md)에 있습니다. 성능 검사는 다른 suite와 동시에 실행하지 않습니다. 정적 bundle 재생성·Wrangler 설정 reload 동안 suite를 실행하지 않습니다. 기존 서버가 취소/asset500을 반환하면 이 작업의 서버만 재시작합니다. `deploy:trial`은 항상 시험 bundle을 다시 만들고 원격 측정은 loopback API 설정을 거부합니다.

로그인 없이 실제 시험 화면만 확인하려면 `OKGU_TRIAL_API_ORIGIN=https://okgu-diary-trial.rlasksk030.workers.dev npm run test:visit`를 사용합니다. Chromium proxy CA 신뢰와 TLS 검증을 유지하는 재현 절차는 [인증·시험 안내](docs/Cloudflare_로그인과시험실행.md)에 있습니다. Paid 보류는 유지하지만 무료 DO 경로가 검증돼 `trial:measure`를 수행할 수 있습니다. 성능 목표 미달을 성공으로 바꾸지 않습니다.
