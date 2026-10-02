# Cloudflare 로그인·인증과 가상 시험 실행 — 2026-10-02

작업 저장소 `rlasksk030/okgu-diary-alarm-`, 브랜치 `codex/2026-10-02-okgu-speed`. 기존4ebf92c → 배포 준비39b6258 → 인증/D1/R2 승인 checkpoint9c21c4f 이후 실제 배포까지 이어갔습니다. 실행 위치는 **Codex 클라우드**입니다. 운영 main·GitHub Pages·실제 학생 자료·실제 푸시·Supabase·별도 하루의 행간 저장소는 변경하지 않습니다.

## 최신 상태 — 2026-10-03 KST: 무료 로그인 해결·실제13명 시험 완료

**https://okgu-diary-trial.rlasksk030.workers.dev/okgu-diary-alarm-/**

현재 가상 `시험학생01~13`/`가상교사`, PIN `0042`로 로그인 가능합니다. 기존 Worker/D1/비공개 R2에 무료 비공개 DO 계산 바인딩을 추가해1102를 해결했습니다. 계정/자료는 D1에 유지하고 계산 객체에 저장하지 않으며 PIN600,000회와 모든 권한 검사를 보존했습니다. Workers Paid는 계속 보류, R2는 기존 승인·활성화 상태입니다. 추가 로그인/과금 버튼 클릭은 필요하지 않습니다.

실제 API 기능15개(전체 npm test46 중 나머지31은 Node/model/crypto), 화면16 통과. 가상13명 API/browser 실패0. API p95 로그인4513·재접속142·목록706·글791·사진1345ms. 별도13개 화면 p95 최초1452·로그인5594·재접속339·글725·사진2804ms. Codex 클라우드/proxy의 실제 시험 서버 측정이며 실물 기기/학교망/cold Worker 결과가 아닙니다. 로그인/목록/글 목표 미달로 전체 harness는exit1, allChecksPassed=false입니다.

[CPU 원인·보안·모든 수치·비용·재현](로그인_CPU_무료해결_2026-10-03.md), [최신 보존 상태](검증/cloudflare-preserved-state-20261003.json). 유료 설정·운영 main/학생 자료/Pages/Supabase/실제 푸시는 변경하지 않습니다.

## 사용자가 한 번에 할 인증 설정 (이미 완료; 새 환경 재현용)

Cloudflare 계정 화면을 직접 열어 확인하지는 못했습니다. 아래 메뉴/버튼은 2026-10-02 최신 공식 문서 기준이며 표시 언어에 따라 번역되어 있을 수 있습니다.

1. https://dash.cloudflare.com/profile/api-tokens/ 에 로그인합니다. **My Profile → API Tokens → Create Token → Custom token의 Get started**를 선택합니다.
2. **Token name**: `okgu-diary-trial-codex`. **Permissions**를 다음처럼 추가합니다.

   | 종류 | 권한 | 수준 |
   |---|---|---|
   | Account | Workers Scripts | Edit |
   | Account | D1 | Edit |
   | Account | Workers R2 Storage | Edit |
   | Account | Account Settings | Read |

   **Account Resources → Include → Specific account**에서 시험 계정을 선택합니다. Billing 권한은 추가하지 않습니다. **Continue to summary → Create Token**을 선택하고 토큰을 안전하게 복사합니다.
3. 이 대화에 연결된 **Codex 환경 설정**에서 저장된 `CLOUDFLARE_API_TOKEN` secret에 값을 입력합니다. 비밀값은 GitHub/채팅/터미널 로그에 넣지 않습니다. secret 전달 대상은 `api.cloudflare.com`입니다.
4. Cloudflare **Workers & Pages → Account Details → Account ID**를 복사하거나, 상단 **Search**(Ctrl/Cmd+K)에서 `Copy account ID`를 검색하여 선택합니다. 같은 Codex 환경의 환경변수 `CLOUDFLARE_ACCOUNT_ID`에 입력합니다(32자리 hex, 비밀키가 아님).
5. Codex 환경 설정에서 저장된 네트워크 허용 목록을 반영해 저장합니다. 이번에 필요한 목적지는 `api.cloudflare.com`, `*.workers.dev`입니다. 공식 문서용 `developers.cloudflare.com`과 기존 다른 목적지도 보존했습니다. secret과 변수의 입력 위치는 Cloudflare Build variables가 아니라 **Codex 개발 환경**입니다.

환경 초안 저장은 현재 실행 환경에 인증/네트워크를 적용하거나 환경을 게시하는 동작이 아닙니다. 설정 저장 후 Codex가 값 존재 여부와 실제 API 접속을 다시 확인합니다. 기존 실행 환경에 반영되지 않으면 저장된 설정을 사용하는 새 Codex 작업에서 같은 브랜치를 선택해 재개합니다. GitHub 토큰은 별도로 필요하지 않습니다.

현재 열어 둔 **Set up your application**의 Deploy는 CLI 시험 배포의 선행조건이 아닙니다. 화면을 닫아도 됩니다. Git 자동배포를 연결한다면 [시험 배포 입력값](Cloudflare_시험배포.md)의 브랜치를 반드시 선택합니다. 이 작업은 Cloudflare 실제 branch control을 읽거나 바꾼 것이 아니며, main 연결이 해제되었다고 확인하지 않았습니다. GitHub Pages/운영 main 설정을 수정하지 않습니다.

## 배포 도구와 새 Codex 환경의 재현

기존 CLI 배포와 무료 DO 연결은 완료됐습니다. Paid 보류는 유지합니다. 승인된 시험 변경에는 아래 도구를 사용할 수 있으며 정상 배포는 진단 로그를 제거합니다. 새 환경에서 로컬 검증은 Cloudflare와 독립적으로 실행할 수 있습니다.

```sh
npm ci --cache /tmp/okgu-npm-cache --no-audit --no-fund
npm run build:local
npm run seed
npm start
```

다른 터미널에서 `npm run check`, `npm test`, `npm run test:browser`. Node24·Linux Chromium이 필요합니다. 최신36/36 및16개 통과는 로컬 synthetic D1/R2 결과입니다. 생성 파일/프로세스/.local DB는 Git에 없으므로 새 환경에서는 재현합니다. 사용자 PC를 끄더라도 GitHub 소스는 보존되지만 Codex 프로세스의 무기한 실행은 보장하지 않습니다.

배포 도구의 재현 절차(승인된 변경을 재개할 때만):

```sh
npm run trial:provision -- --plan
npm run trial:launch
npm run trial:measure
```

- 고정 Worker/D1 `okgu-diary-trial`, R2 `okgu-diary-trial-private`. 같은 이름의 리소스를 재사용하고 계정 metadata가 가상 fixture와 일치하는지 확인합니다. 새 환경에서 .local metadata가 없어도 API 조회로 복원할 수 있습니다.
- `trial:launch`: branch/token/provenance/private 버킷 검사 → build/migration/deploy → 가상 seed → 실제 workers.dev subdomain/health 확인. trial branch만 허용하고 main/운영 Pages origin을 거부합니다. PUSH_MODE disabled, TEST_MODE synthetic-trial, cron 제거. Billing API를 호출하지 않습니다.
- 배포는 반드시 시험 static bundle을 다시 만들고 LOGIN_KDF private DO와SQLite migration을 연결합니다. `trial:launch`는 중복 build를 하지 않고 deploy에 위임합니다. 작은 가상 SQL은 D1 query API를 사용합니다. 원격 scope에는 `--persist-to`를 넣지 않습니다.80KB 초과 seed는 검토 전 차단하며 대량 실제 이전 도구로 사용하지 않습니다. Wrangler file import의 임시 서명 staging host를 임의로 허용하지 않습니다.
- `.local/trial-resources.json`, `.local/trial-deployment.json`, `.wrangler-trial.json`은 Git 제외입니다. Cloudflare token/account는 안전한 환경 설정으로 제공합니다. signed URL·비밀값·학생 자료를 로그에 넣지 않습니다.
- 현재 `trial:measure`는 CPU 문제 해결 후 실행 완료됐지만 속도 목표 미달로exit1입니다. 추가 변경을 검증할 때 실제 HTTPS health → API 회귀 → browser 회귀 → API13 → profile → browser13을 순차 실행합니다. 기능/인증 실패는 후속 단계 중단, p95 목표 미달은 실패로 남깁니다. 부분 성공을 전체 성공으로 보고하지 않습니다.

배포된 화면만 읽기 전용 확인(로그인·과금 변경 없음):

```sh
OKGU_TRIAL_API_ORIGIN=https://okgu-diary-trial.rlasksk030.workers.dev npm run test:visit
```

## Chromium proxy CA 신뢰 설정

환경의 Node/curl과 Chromium 신뢰 저장소가 다르면 ERR_CERT_AUTHORITY_INVALID가 생길 수 있습니다. 이번 환경에서는 제공된 `/usr/local/share/ca-certificates/environment-proxy-ca.crt` 공개 root CA가 기존 NSS 인증서와 달랐습니다. 공식 Chromium Linux 인증서 문서에 따라 실제 브라우저가 사용하는 NSS DB에 이 CA를 등록한 뒤 정상 TLS 검증으로 시험 화면에 접속했습니다. 인증서/개인키/DB 파일을 Git에 복사하지 않습니다. proxy를 해제하거나 ignoreHTTPSErrors/ignore-certificate-errors를 사용하지 않습니다.

이번 환경에서 통과한 명령(쓰기 권한이 필요한 경우 Codex가 도구의 sandbox 승인을 받아 실행):

```sh
certutil -A -d sql:/home/agent/.pki/nssdb -t 'C,,' -n Codex-environment-proxy -i /usr/local/share/ca-certificates/environment-proxy-ca.crt
OKGU_TRIAL_API_ORIGIN=https://okgu-diary-trial.rlasksk030.workers.dev npm run test:visit
```

CA 등록과 브라우저 실행을 **같은 승인된 실행 환경**에서 수행해야 합니다. 이번 managed 환경에서는 일반 실행과 승인된 실행의 home 신뢰 저장소 변경이 공유되지 않았고, 같은 승인된 실행 안에서 등록 후 browser를 실행했을 때 성공했습니다. 새 환경에서는 제공 CA와 실제 NSS 경로를 다시 확인합니다. Chromium146+는 기본 ~/.local/share/pki/nssdb를 쓰지만 기존 ~/.pki/nssdb가 있으면 그것을 사용합니다. 시스템 변수를 임의로 재지정하지 않습니다.

## PIN 호환성과 비용 판단

공식 workerd `51a48a5bb7863fbeab791358bee8dff22c3ce83f`의 limit-enforcer/crypto 구현 및 실제 오류에서 native PBKDF2 기본 상한100,000회를 확인했습니다. Node crypto 경로도 같은 상한을 검사합니다. `@noble/hashes`2.4.0 PBKDF2-HMAC-SHA256 대체 경로는 기존600,000회·salt 인코딩·256bit 출력 형식을 유지하고 독립 Node crypto 결과와 일치합니다. 해당 상한 오류만 대체하며 다른 crypto 오류는 실패합니다. 앞자리0 보존/강도 하한 테스트가 있습니다. async yield는 CPU 과금/한도를 피하지 않습니다.

기존 local 로그인p95 1630ms 원인 분리: 단일warm132ms,13명warm1515ms,13명session71ms. Node PBKDF2 verify141ms/13개 병렬총wall811ms로 계산과 동시 경합이 큰 부분입니다. D1 대기/isolate queue/native CPU를 완전히 분리한 증거는 아니며 [로컬 프로파일](검증/login-profile-20261002-local.json)은 Worker CPU 측정이 아닙니다. 최신 실제 성공 성능과 CPU 분리는 위 무료 해결 보고를 봅니다. Paid 전환만으로1초 목표 달성을 보장하지 않습니다.

공식 가격을2026-10-02 다시 확인했습니다. [가격표/사용 가정](Cloudflare_시험배포.md), [출처](공식문서_출처.json):

- Workers Free10ms CPU/요청·10만요청/일. 직접 Worker 계산의 과거1102는 무료 DO 분리로 해결했습니다. Paid 기본$5/월·1천만요청·3천만CPUms 포함, 추가100만요청$0.30/100만CPUms$0.02. 일반13명 사용은 포함량 내 예상이나 전체 사용량/실측CPU로 확인하며 세금·환율 별도입니다. **유료 전환 보류 유지**. 무료 DO 경로가 검증돼 기본 예상 추가비용은$0이며 공용 무료 사용량/R2 초과는 별도입니다.
- R2 Standard 기본구독$0, 무료10GB-month·Class A100만·B1천만/월, 초과$0.015/GB-month·$4.50/백만A·$0.36/백만B 및 단위올림, egress무료. 사용자 승인·활성화 완료. 작은 시험은 무료 할당 내$0 예상이며 계정 전체 기존 사용량은 미확인입니다.100KB 원본+10KB 썸네일·13명하루4사진이면 연약2.06GB 증가로 다른 사용량이 없다면 무료 저장량 이내입니다.

남은 작업은 CPU 제한 해결 후 로그인/저장/사진/13명 실제 측정, 별도 시험 origin CORS/사진 ACL 검증, 실물 모바일·PWA 전체 업데이트, 실제 시트 헤더/mapping/원본 백업·변화분·신규 기록 보존 복귀 검증입니다. 실제 학생 반입·main 병합·운영 화면 교체·실제 푸시 전환은 결과와 전환안을 제시한 뒤 최종 승인받습니다.
