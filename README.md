# 콴다과외 튜터 어드민

튜터 PWA 운영용 어드민 대시보드. 디바이스 트래킹 + 푸시 발송.

## 기능

- 디바이스 목록 (온라인/플랫폼/PWA/푸시 구독 상태)
- 전화번호로 푸시 알림 발송

## 스택

- React 19 + Vite + TypeScript + Tailwind
- Supabase Auth (전화번호 OTP, `admins` 테이블로 게이트)
- `web-push` (Vercel 서버리스 함수)

## 환경 변수

`.env`에 (로컬 개발용) 또는 Vercel Project Settings → Environment Variables에:

| Key | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | 클라이언트 | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 클라이언트 | publishable (anon) 키 |
| `SUPABASE_URL` | 서버 | 동일 URL (서버용 prefix 없는 버전) |
| `SUPABASE_PUBLISHABLE_KEY` | 서버 | 동일 publishable 키 (서버에서 토큰 검증용) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 | service_role 키 (RLS 우회용, **절대 클라이언트 노출 금지**) |
| `VAPID_PUBLIC_KEY` | 서버 | 튜터 앱에서 사용한 동일 키 |
| `VAPID_PRIVATE_KEY` | 서버 | VAPID 개인키 |
| `VAPID_SUBJECT` | 서버 | `mailto:` 또는 운영자 URL |

## 배포

1. Vercel에서 이 레포 import
2. Framework Preset: Vite (자동)
3. 위 환경 변수 모두 등록
4. Deploy

## 어드민 등록

본인을 어드민으로 등록:

```sql
insert into public.admins (user_id)
select id from auth.users where phone = '821011112222'
on conflict (user_id) do nothing;
```

## API

### `POST /api/send-push`

- Headers: `Authorization: Bearer <supabase access_token>`
- Body: `{ phone, title, body, url? }`
- 발송자가 `admins` 테이블에 있어야 함
- 해당 phone의 모든 구독된 디바이스에 발송
- 만료된 구독(410/404)은 자동으로 `push_subscription = null`로 정리
