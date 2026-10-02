# 옥구 다이어리 — Cloudflare 이전 시험 브랜치

기존 GitHub Pages 화면을 보존하면서 Apps Script 서버 호출을 Workers + D1 + 비공개 R2로 옮기는 작업입니다. 운영 main은 변경하지 않습니다. Supabase를 사용하거나 수정하지 않습니다. 아직 실제 Cloudflare 시험 배포/운영 전환은 완료하지 않았습니다.

상세 현황: [작업 인계](2026-10-02_옥구다이어리_작업인계.md), [Cloudflare 입력값·비용](docs/Cloudflare_시험배포.md), [기능 대응표](docs/기능대응표.md).

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

자료 이전·격리 복원·신규 기록 보존 절차는 [자료 이전과 복귀](docs/자료이전_전환_복귀.md)에 있습니다. 성능 검사는 다른 suite와 동시에 실행하지 않습니다. 정적 bundle 재생성 후 기존 서버가 asset 500을 반환하면 이 작업의 서버만 재시작합니다.
