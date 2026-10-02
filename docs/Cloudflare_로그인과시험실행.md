# Cloudflare 로그인·인증과 가상 시험 실행 — 2026-10-02

현재 작업: `rlasksk030/okgu-diary-alarm-`, `codex/2026-10-02-okgu-speed`. 시작 checkpoint는 `4ebf92c`이며 원격에서 이후 커밋이 없음을 확인했습니다. 실행 위치는 Codex 클라우드입니다. 실제 Cloudflare 시험 URL·배포 성능은 아직 없습니다. 인증/API 접근과 실제 시험 D1 생성·마이그레이션은 성공했고, R2 활성화 동의는 받았고, 사용자의 Cloudflare checkout 완료가 남아 있습니다.

## 최신 상태: R2 활성화 동의 완료·사용자 checkout 대기

2026-10-02 **18:15 KST** 확인: token active·Account ID/API 접근 성공, 시험 D1 `okgu-diary-trial` 생성 및 migration 0001~0004 적용 성공(업무 테이블23개, accounts0). 실제 계정은 아직 seed하지 않았습니다. Worker build/dry-run도 통과했습니다. [실제 API/D1 확인 결과](검증/cloudflare-stage-readiness-20261002.json)에 비밀값 없이 보존했습니다.

R2 조회는 HTTP403 / code10042, **Please enable R2 through the Cloudflare Dashboard**로 중단됐습니다. 실제 token/API 연결 문제와 다르며 token 재발급은 필요하지 않습니다. 현재 R2 bucket/Worker 배포/시험 URL/실제 속도는 미완료입니다. 아래 예전 인증 설정은 새 환경에서 재현할 때 사용합니다.

사용자 다음 클릭은 Cloudflare **Storage & databases → R2 → Overview**의 checkout(구독 등록)입니다. 현재 공식 get-started 문서에서 이 경로와 R2 subscription 필요 조건을 직접 HTTPS로 확인했습니다. 마지막 결제 버튼의 문구/금액은 계정 화면을 직접 볼 수 없어 확정하지 않습니다. 결제수단 등록 및 과금 가능 구독의 활성화는 아래 비용을 검토하고 **사용자가 동의한 뒤** 진행합니다. Codex는 구독/결제를 활성화하지 않았습니다.

사용자는 R2 결제수단 등록 및 활성화에 동의했습니다. Cloudflare checkout은 사용자가 직접 완료해야 하며 아직 완료됐다고 확인하지 않았습니다. 바로 열기: https://dash.cloudflare.com/?to=/:account/r2/overview

R2 기본 월 구독료 $0, 이번 작은 가상 시험은 무료 할당 내 사용료 $0 예상입니다. 무료10GB-month·Class A100만·B1천만/월, 초과 저장$0.015/GB-month·A$4.50/백만·B$0.36/백만 및 요금 단위 올림이 적용됩니다. 무료 할당은 계정 전체와 공유하므로 기존 사용량이 있으면 시험에도 추가 과금이 생길 수 있습니다. Workers Paid 기본 $5/월은 R2 승인에 포함하지 않으며 실제 필요가 확인되면 별도 승인받습니다.

R2 활성화 완료 후 바로 `npm run trial:launch`를 재실행합니다. 이미 생성한 시험 D1을 찾아 metadata를 검사하고 사용하므로 중복 D1을 만들지 않습니다. private R2 생성/검사 → Worker 배포 → 가상 seed → 실제 URL/health 확인 → `npm run trial:measure` 순서입니다.

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

## Codex가 자동 처리할 D1·R2와 배포

인증/접속이 준비되면 아래 명령을 순서대로 실행합니다. 비밀값을 명령행에 넣지 않습니다.

```sh
npm run trial:provision -- --plan
npm run trial:launch
npm run trial:measure
```

- Worker: **okgu-diary-trial**, D1: **okgu-diary-trial**, R2 Standard: **okgu-diary-trial-private**.
- `trial:launch`는 시험 브랜치와 token active 확인 → 같은 이름의 D1 조회/없으면 생성 → DB 이름·기존 계정 metadata가 가상 fixture와 일치하는지 검사 → R2 조회/없으면 생성 → Public development URL와 custom domain이 없는지 검사 → build → D1 migration → Worker deploy → 가상 seed → 실제 workers.dev URL/health 확인 순서입니다.
- 재실행은 같은 이름의 리소스를 찾아 사용하며 운영 이름/가상 계정 metadata 불일치/공개 버킷을 거부합니다. private 버킷 검사가 실패하면 공개 설정을 임의로 바꾸지 않고 멈춥니다. 계정·리소스 생성 API는 mock으로 검증했으며 실제 API 응답과 배포는 인증 후 확인해야 합니다.
- 계정 전용 workers.dev subdomain이 미설정이면 실제 오류/설정 화면을 확인한 뒤 필요한 클릭만 추가 안내합니다. 확인 전 시험 hostname을 추측해서 보고하지 않습니다.
- 로컬 연결 metadata는 `.local/trial-resources.json`, 실제 URL/health 확인 결과는 `.local/trial-deployment.json`에 저장합니다. 둘 다 Git 제외이며 새 환경에서는 인증 후 리소스를 다시 조회할 수 있습니다. 비밀 토큰은 파일에 저장하지 않습니다.
- 실제 시험 cron은 제거되고 `PUSH_MODE=disabled`입니다. 실제 학생 자료/학생 구독은 입력하지 않습니다.

배포 후 확인할 Cloudflare 메뉴: **Storage & databases → D1 → okgu-diary-trial**, **R2 Object Storage → okgu-diary-trial-private → Settings**. R2의 **Public Development URL**은 Disabled, **Custom Domains**는 연결 없음이어야 합니다. 사용자가 직접 생성할 필요가 있는 경우 D1의 **Create Database**에는 `okgu-diary-trial`, R2의 **Create bucket**에는 `okgu-diary-trial-private`, **Storage class**에는 Standard를 사용합니다. 결제수단/구독 동의가 요구되면 그 단계에서 멈춥니다.

## 가상 계정과 실제 측정

URL은 Cloudflare API에서 실제 계정 subdomain을 확인하고 `/api/health` 요청이 성공한 뒤에만 제공합니다. 화면 경로는 해당 시험 Worker의 `/okgu-diary-alarm-/`입니다. 가상 학생은 **시험학생01~시험학생13**, 교사는 **가상교사**, PIN은 **0042**(문자열 앞자리 0 포함)입니다. 현재는 해당 원격 계정/접속 주소가 생성되었다는 뜻이 아닙니다.

`trial:measure`는 실제 HTTPS 시험 origin과 health(push disabled)를 확인하고 API 회귀검사, 기존 화면 브라우저 검사, 13명 API 부하, 로그인 profiling, 13개 Chromium 모바일 viewport 측정을 순차 실행합니다. 결과는 ignored `artifacts/`에 기록합니다. API p95 목표는 로그인 1000ms/목록 500ms/글 저장 500ms/사진 1500ms입니다. API 목표 미달은 exit1로 남기고 진단·브라우저 측정을 계속하며, 기능검사/인증 실패는 후속 단계를 중단합니다. 실패가 있을 때 부분 결과만 생성될 수 있으므로 전체 성공으로 보고하지 않습니다.

측정 위치는 Codex 클라우드의 설정된 HTTPS proxy이며 학생 기기의 실물 모바일/학교망 측정이 아닙니다. 최초 접속은 DOMContentLoaded, 글·사진 저장은 실제 저장 후 목록 확인까지입니다. 첫 요청이라고 Worker cold start가 확정되지는 않습니다. API/모델 테스트 중 일부는 local SQLite/mock 검사이므로 원격 API 검증과 구분합니다. 별도 시험 정적 origin↔Workers CORS/인증 사진 검증과 실물 PWA/iOS/Android는 아직 남아 있습니다. 운영 GitHub Pages origin은 승인 전 시험 허용 목록에 넣지 않습니다.

## 비용과 로그인 p95 원인

최신 공식 문서 SHA `52f66cda7013e5fd9a4684015500ebd5734950bf`에서 Workers·D1·R2 가격/한도를 다시 확인했습니다. [전체 가격표와 사용량 가정](Cloudflare_시험배포.md) 및 [출처](공식문서_출처.json)를 참고합니다.

- 작은 가상 시험은 계정의 무료 사용량이 남아 있고 무료 Worker CPU 한도를 충족하면 **추가 사용료 $0 예상**입니다. 계정 전체 기존 사용량/구독 상태는 아직 미확인입니다.
- Workers Free는 요청당 **10ms CPU**, 하루 10만 요청입니다. Paid가 필요하면 계정 기본 **$5/월**(세금/환율 별도), 1천만 요청·3천만 CPU ms 포함입니다. 13명 규모의 일반 사용은 포함량 내를 예상하지만 실측 CPU와 전체 계정 사용량으로 확인합니다.
- R2 Standard 무료 할당은 저장 10GB-month, Class A 100만·B 1천만/월이며 egress 무료입니다. 초과 단가는 저장 $0.015/GB-month, A $4.50/백만, B $0.36/백만이고 단위 올림이 적용됩니다. 100KB 원본+10KB 썸네일, 13명 하루4사진이면 연 약2.06GB 증가로 다른 사용량이 없다면 무료 저장량 이내입니다. R2를 처음 쓰면 결제수단/구독 동의를 요구할 수 있으므로 사용자 승인 전 활성화하지 않습니다.

기존 local 13명 로그인 p95 1630ms를 분리 측정했습니다: 단일 순차 warm 로그인 p95 **132ms**, 13명 동시 warm 로그인 **1515ms**, 13명 세션 확인 **71ms**. Node PBKDF2 단일 verify 141ms/13개 병렬 총 wall811ms였습니다. PIN 검증의 계산과 동시 요청 경합이 큰 부분으로 보이지만 end-to-end 수치만으로 D1 대기·isolate queue·native crypto CPU를 완전히 분리하지 못합니다. Node microbenchmark는 Worker CPU 증거가 아닙니다. [로컬 원시 결과](검증/login-profile-20261002-local.json)에 조건/한계를 보존했습니다. PBKDF2 SHA256 **600,000회와 권한 검사 강도를 유지**했습니다. 실제 Worker CPU는 배포 후 **Metrics → Errors → Invocation Statuses** 및 CPU duration에서 확인합니다. 1102/exceededCpu가 발생하면 비용을 제시하고 승인을 받은 뒤에만 유료 전환을 진행합니다.

## 현재 확인한 결과와 차단된 단계

- 원격 브랜치는 `4ebf92c`, 운영 main은 `964985d3ff683617de18e89f71521f2c224d50f2`에서 시작했습니다. 새 코드는 작업 브랜치에만 보존합니다.
- local `npm test` **33/33**, 브라우저 **16개** 통과; TypeScript check 통과. Cloudflare 생성 API는 mock이며 실제 배포 결과가 아닙니다.
- 초기 환경은 token/account 부재 및 proxy CONNECT403이었으나, 사용자 설정 후 현재는 token active 및 Cloudflare API/D1 접근이 성공했습니다. R2 subscription은 아직 비활성입니다.
- 초기 `trial:launch`는 credentials 누락에서 멈췄고 최신 재실행은 시험 D1 생성/검사 후 R2 403/10042에서 중단됐습니다. 이어서 시험 D1 schema를 적용/검증했습니다. Worker 원격 배포와 trial:measure는 아직 미실행이며 실제 시험 URL·최초 접속/저장 속도는 미측정입니다.
- 유료 활성화, 운영 main 병합/화면 교체, 실제 학생 자료/실제 푸시, Supabase, 별도 하루의 행간 저장소 변경은 수행하지 않았습니다. 잘못 전달된 하루의 행간 조사 문서는 이번 작업에 반입하지 않았습니다.
