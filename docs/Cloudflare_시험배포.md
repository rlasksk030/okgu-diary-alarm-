# Cloudflare 시험 배포 설정 — 2026-10-02

**최신 반복 배포 수정(2026-10-03):** 새 셸의 deploy:trial이 빈 WEB_ORIGINS를 만들던 문제를 해결했습니다. 생략 시 실제 trial API와 별도 시험 화면의 정확한 origin/APP_URL을 기본으로 유지하며 GitHub origin은 별도 명시 옵션일 때만 허용합니다. 새 버전 `868a2faf-4fba-4e2e-a025-ad5c0328e9ee`에서 가상 교사 로그인/피드 재조회 검증 통과. 운영 연결은 여전히 GAS이며 [최신 운영 진행 문서](피드오류_최종변화분_실행_2026-10-03.md)가 아래 과거 승인 설명보다 우선합니다. 시험 cron/PUSH는 꺼져 있습니다.

운영 main과 기존 GitHub Pages 주소를 유지하는 별도 가상 시험입니다. **2026-10-03 최신: Paid 전환 없이1102 해결·실제13명 API/browser 실패0**. 같은600,000회 KDF만 무료 비공개 Durable Object로 분리했고 DB는 D1/사진은private R2입니다. 로그인/목록/글 속도 목표는 미달했습니다. [최신 원인·측정·비용](로그인_CPU_무료해결_2026-10-03.md). 실제 학생/main/Pages/실제 푸시는 최종 승인 전 변경하지 않습니다.

## 최신 최종 검증 — 2026-10-03 KST

[최종 결과](최종검증_2026-10-03.md)와 [승인 전 실행안](운영전환_실행안_2026-10-03.md)이 아래 과거 상태보다 우선합니다. 조회·글·사진 API 목표는 충족했지만 로그인1초 목표는 미달입니다. 운영 전환은 실행하지 않았습니다.

현재 별도 화면: https://okgu-diary-pages-trial.rlasksk030.workers.dev/okgu-diary-alarm-/ , 기존 통합 시험 화면도 유지합니다. 두 화면 모두 가상 시험학생01~13/가상교사만 사용합니다. `npm run deploy:trial:frontend`는 asset-only Worker이며 D1/R2 binding이 없습니다. 운영 Pages source/브랜치를 바꾸거나 기존 Git 연동 화면의 Deploy를 누를 필요가 없습니다.

기존 CLI 시험을 재현할 때 환경 값:

```sh
OKGU_TRIAL_API_ORIGIN=https://okgu-diary-trial.rlasksk030.workers.dev
OKGU_TRIAL_FRONTEND_ORIGIN=https://okgu-diary-pages-trial.rlasksk030.workers.dev
OKGU_TRIAL_PAGES_CORS=yes
OKGU_TRIAL_WRITE_MODE=active
```

위 값은 Codex/CI 환경 설정 또는 셸 환경 변수로 설정합니다. Git 연동 시험을 사용할 때도 Build variables에 동일 값을 넣어 cross-origin allowlist를 유지합니다. D1 UUID와 기존 토큰/Account ID는 안전한 기존 환경 설정을 재사용합니다. 진단 변수는 평소 설정하지 않습니다. Trial deploy는 main을 거부하지만 실제 계정의 Git 연결/자동 빌드 브랜치 화면은 직접 확인하지 못했으므로 main 자동 연결이 없다고 단정하지 않습니다. 사용자는 기존 설정을 유지하고 운영 Pages는 건드리지 않습니다.

PWA 예행연습 재현은 먼저 `npm run deploy:trial:frontend -- --legacy-sw`, 이어서 `npm run test:pwa:trial`입니다. 뒤 명령은 가상 화면에 새 SW를 배포하며 operating Pages는 변경하지 않습니다. 성능 검사는 배포/다른 suite와 겹치지 않게 실행합니다.

## 최신 교사 학생 PIN 재설정

기존 시험 주소에서 **가상교사 로그인 → 대시보드 → 학생 → PIN 재설정**을 사용할 수 있습니다. 시험학생09의 앞자리0 새 PIN 로그인, 모든 이전 세션 무효화와 다른 사용자/자료 보존을 실제 브라우저로 검증했습니다. 검증 뒤 공통 시험 PIN으로 복원했습니다. Worker version `eedbfe11-fb19-440a-860d-d856c0e171c4`. 새 사용자 인증·리소스·과금 설정은 필요 없습니다. [메뉴·검증·재현·한계](학생_PIN_재설정_2026-10-03.md).

## 이번 시험의 권장 경로: Codex에서 CLI 배포

[로그인·인증과 시험 실행](Cloudflare_로그인과시험실행.md)에 사용자 설정을 한 번에 정리했습니다. Cloudflare 토큰과 Account ID를 Codex 환경에 안전하게 연결하면 `npm run trial:launch`가 독립 시험 D1·비공개 R2를 생성/확인하고 build·migration·배포·가상 seed·health 확인까지 진행합니다. Git 연동 화면에서 Deploy를 누르는 것은 선행조건이 아닙니다. 실제 시험 주소는 https://okgu-diary-trial.rlasksk030.workers.dev/okgu-diary-alarm-/ 입니다. 아래 Git 연동 값은 대안이며 이번 배포는 CLI로 수행했습니다. Git 연동 화면의 Deploy를 추가로 누를 필요가 없습니다.

## Set up your application 입력값

| 항목 | 정확한 값 |
|---|---|
| Repository | `rlasksk030/okgu-diary-alarm-` |
| Worker/application name | `okgu-diary-trial` |
| Production/deployment branch (Cloudflare에서 붙인 명칭) | `codex/2026-10-02-okgu-speed` |
| Root directory | `/` (저장소 루트; 선택형 화면에서는 빈칸을 그대로 두면 루트) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:trial` |
| Preview/non-production branch builds | Disabled |

**기본값 main을 시험 브랜치로 반드시 바꾸십시오.** Deploy 누르기 전 브랜치와 Worker 이름을 다시 확인합니다. 이미 연결한 Worker에서는 Workers & Pages → okgu-diary-trial → Settings → Builds → Git repository/Branch control에서 변경합니다. 화면에 브랜치 선택이 없다면 먼저 연결을 중단하고 올바른 브랜치 선택이 가능한 연결 설정으로 돌아갑니다. 이 문서는 계정 화면을 직접 확인한 결과가 아니라 공식 Workers Builds 문서에 따른 안내입니다.

배포 스크립트도 `WORKERS_CI_BRANCH`를 확인하여 main과 다른 브랜치의 배포를 거부합니다. 하지만 Cloudflare 화면의 브랜치 연결을 바꾸는 대신 사용할 수는 없습니다. 기존 Pages 설정과 main에는 손대지 않습니다.

## Git 연동으로 배포할 경우 필요한 시험 리소스

시험 D1/R2와 private LOGIN_KDF/PinKdf binding은 이미 CLI로 생성/연결했습니다. 아래 값은 새 계정에서 재현할 때 사용하고 같은 이름을 중복 생성하지 않습니다. `deploy:trial`이 항상 시험 화면을 다시 빌드하며 DO `new_sqlite_classes` migration으로 무료 지원 SQLite backend를 선언합니다.

1. Storage & databases → D1 → Create Database에서 **okgu-diary-trial**을 만듭니다. 운영 자료를 넣지 않습니다.
2. R2 Object Storage에서 **okgu-diary-trial-private** Standard 버킷을 만듭니다. Public development URL과 Custom domain은 활성화하지 않습니다. R2는 결제수단 등록/구독 동의 화면이 나올 수 있으므로 아래 비용을 먼저 검토하십시오. 이 시험 버킷은 승인된 R2 활성화 후 이미 생성했고 비공개 설정을 실제 API로 확인했습니다. 같은 이름의 리소스를 중복 생성하지 마십시오.
3. 시험 D1의 UUID를 Worker → Settings → Builds → Variables and secrets의 **Build variable** `OKGU_TRIAL_D1_DATABASE_ID`에 입력합니다. 이는 인증키가 아닙니다. 동일 Build 설정에 `NODE_VERSION=24.19.0`도 지정합니다.
4. 기본 동작은 Worker에서 별도 시험 화면도 제공합니다. `OKGU_TRIAL_API_ORIGIN`과 `OKGU_TRIAL_FRONTEND_ORIGIN`은 처음에는 생략할 수 있습니다. 같은 Worker origin은 서버가 허용합니다. 배포 뒤 URL을 확인하여 APP_URL/교차 origin 시험 설정에 반영합니다.
5. Workers Builds에서 자동 생성한 배포 API 토큰이 이 계정의 Workers Scripts Edit, D1 Edit, R2 Edit 권한을 가지는지 확인합니다. Billing Edit는 필요하지 않습니다. 계정/토큰을 채팅 또는 Git에 넣지 않습니다.
6. Deploy는 migrations 적용 후 Worker를 배포하지만 **가상 계정은 자동 생성하지 않습니다**. 배포 후 Codex에서 시험 전용 인증이 준비되면 `OKGU_ALLOW_SYNTHETIC_TRIAL_SEED=yes npm run seed -- --remote`를 실행합니다. `.wrangler-trial.json`은 배포 스크립트에서 생성되는 비공개 로컬 파일입니다. 다시 생성하려면 `npm run deploy:trial -- --prepare-only`를 사용합니다.

시험 배포에서는 PUSH_MODE=disabled, 예약 작업도 비활성화됩니다. 실제 학생 구독/실제 자료는 반입하지 않습니다. 가상 시험 계정과 PIN은 공개 시험용 자료이며 실제 학생 인증값이 아닙니다.

## 실제 시험에서 수행할 확인

- Worker URL과 `/api/health` 확인, 가상 이름/PIN 로그인.
- `OKGU_TRIAL_API_ORIGIN=https://실제시험Worker주소 npm run test:load`: 13명 동시 로그인/조회/글/사진 저장. 결과 JSON의 region이 실제 배포라고 명시되는지 확인합니다.
- 별도 시험 정적 origin과 Worker origin으로 CORS preflight, 허용하지 않은 origin 거부, 학생/교사/개인 사진 접근을 확인합니다. 운영 `rlasksk030.github.io` origin은 승인 전 배포 설정에 추가하지 않습니다.
- `OKGU_TRIAL_API_ORIGIN=https://시험Worker주소 npm run test:browser` 및 `npm run test:load:browser`는 실제 시험 주소를 지원합니다. 별도 정적 origin은 `OKGU_TRIAL_FRONTEND_ORIGIN`도 설정합니다. API와 브라우저 성능 검사는 순차 실행합니다. 브라우저 13 context의 최초 접속/로그인/재접속/글 저장/사진 저장 시간을 별도로 기록하며 실물 모바일 검증과 구분합니다.
- Workers CPU duration와 D1 read/write 지표를 확인합니다. 로컬 workerd 속도는 실제 배포 속도가 아닙니다.

## 공식 요금과 예상 비용

확인일 2026-10-02. 초기에는 웹사이트 직접 접근이 차단되어 Cloudflare 공식 `cloudflare/cloudflare-docs` 최신 원격 HEAD 커밋 `52f66cda7013e5fd9a4684015500ebd5734950bf`의 문서를 HTTPS Git 경로로 읽었습니다. 실제 확인 SHA는 `docs/공식문서_출처.json`에 보존합니다. 이후 환경 설정 적용으로 공식 Workers/R2 가격 페이지를 proxy/TLS 검증을 유지한 직접 HTTPS로 재확인했습니다. 사용자의 R2 checkout 완료 화면을 확인했습니다. 계정 전체 기존 사용량은 미확인입니다. 미국 달러, 세금/환율 별도입니다.

| 서비스 | 무료/포함 사용량 | 초과/유료 가격 |
|---|---|---|
| Workers Free | 100,000 요청/일, 10ms CPU/요청 | 무료 한도 초과 시 제한 |
| Workers Paid | 최소 $5/월, 1천만 요청·3천만 CPU ms/월 포함 | 추가 100만 요청 $0.30, 100만 CPU ms $0.02 |
| D1 Free | 500MB/DB, 전체 5GB; 500만 rows read/일, 10만 rows write/일 | 한도 초과 시 제한 |
| D1 Paid | 전체 저장 5GB, 250억 read·5천만 write/월 포함 | $0.75/GB-month, read $0.001/백만, write $1/백만 |
| R2 Standard | 10GB-month, Class A 100만·B 1천만/월, egress 무료 | $0.015/GB-month, A $4.50/백만, B $0.36/백만 |

R2 사용량은 요금 단위로 올림됩니다. Infrequent Access에는 무료 할당이 없어 선택하지 않습니다. 무료 할당은 이 앱 전용이 아니라 계정 전체 사용량과 합산됩니다.

13명 × 하루 4사진 × 30일 = 월 1,560사진. 평균 100KB 압축 사진이면 월 약 0.156GB, 1년 약 1.87GB 증가로 R2 무료 저장 범위 안입니다. 사진 1MB 최대치가 매번 발생하면 1년 약 18.7GB로 무료 10GB 초과분의 저장료가 월 약 $0.14 수준으로 증가할 수 있습니다. 파일 보존 기간과 기존 계정 사용량에 따라 다릅니다. 별도 작은 썸네일을 원본과 함께 저장하므로 저장량에 썸네일도 더합니다(예: 10KB/개이면 연 약 0.19GB 추가). Class A 업로드 약 3,120/월 및 일반적인 조회는 무료 요청 범위 이내로 예상합니다.

직접 Worker의600,000회 KDF는 실제CPU1102를 발생시켰습니다. 현재 같은 계산을 무료 SQLite Durable Objects의 별도 기본30초 CPU 예산으로 분리해 해결했습니다. DO Free는10만요청/일·13,000GB-s/일·SQL 저장5GB이며 초과하면 제한됩니다. DB 학생 자료를 DO에 저장하지 않습니다. 현재 작은 시험의 기본 예상 추가비용$0, 공용 계정 사용량/R2 초과는 별도입니다. Workers Paid 기본$5/월은 보류를 유지했고 활성화하지 않았습니다. Paid 허용량 증가가 native PBKDF2 iteration 상한이나 로그인 속도를 자동 해결하지 않습니다.

공식 출처:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

D1은 PostgreSQL/RLS/interactive transaction을 제공하지 않습니다. D1 batch는 순차 실행하며 전체 실패 시 롤백됩니다. 모든 권한은 Worker의 세션/계정/학급/visibility 검사와 atomic batch 내 재검사로 구현합니다. 현재 DB schema의 SQL은 SQLite/D1용입니다.

준비 스크립트는 계정 화면의 main 자동배포 설정을 직접 변경하지 못합니다. GitHub에서 시험 브랜치만 push하더라도 Cloudflare에 연결된 실제 branch control과 GitHub Pages의 배포 branch를 사용자가 확인해야 합니다. 기존 main/Pages 설정을 변경하지 않습니다.

실제 trial은 cron 전체 제거 및 PUSH_MODE disabled입니다. 운영용 예약은 22:00 KST(13:00 UTC)에 미작성 job을 만들고 한 번에 최대 8개씩 발송합니다. 13명이 전원 미작성인 경우 나머지는 다음 분의 dispatcher에서 처리하는 설계이며 정확히 22:00:00 도착을 보장하지 않습니다. 발송 시 최신 공개 범위/작성 여부를 다시 확인하며 timeout 결과는 unknown으로 남기고 자동 재발송하지 않습니다. 미사용 업로드·제거한 사진은 7일 후 청소하고 삭제 R2 작업은 실패 시 재시도합니다. 삭제 일기의 사진은 복귀를 위해 보존합니다. 보존량은 비용 예산에 포함해야 합니다.
