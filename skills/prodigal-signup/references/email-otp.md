# 이메일 인증 코드 실제 발송 (Supabase)

아래 순서대로 설정한다. 숫자와 메뉴 이름은 바뀔 수 있으니 대시보드 화면을 기준으로 삼는다.

## 1. 프로젝트 만들기

사용자가 Supabase에서 프로젝트를 만들고 Project URL과 공개 키를 준다. 공개 키는 브라우저에 넣어도 되는 키다.

무료 프로젝트는 일주일 동안 활동이 없으면 일시 정지될 수 있다. 포트폴리오처럼 오래 열어 둘 페이지라면 사용자에게 알린다.

## 2. 메일 템플릿을 코드 방식으로 바꾸기

**4번의 메일 서버 연결을 먼저 끝낸다.** 무료 플랜의 내장 메일로는 템플릿 수정이 막히거나 기본값으로 되돌아간다. 이 상태에서는 저장해도 코드 메일이 나가지 않는다.

템플릿은 **두 개**를 바꿔야 한다. 처음 온 이메일에는 Confirm signup 메일이, 이미 인증된 이메일에는 Magic Link 메일이 나간다. Magic Link만 바꾸면 신규 가입자에게 "Confirm your email address" 링크 메일이 간다. 템플릿에 `{{ .ConfirmationURL }}`이 남아 있으면 코드 대신 링크가 나간다.

1. Authentication의 Email Templates에서 Confirm signup을 연다.
2. `templates/email-code-mail.html`의 내용을 넣는다. 핵심은 `{{ .Token }}`이다.
3. 제목을 서비스 이름과 화자에 맞게 쓴다.
4. Magic Link 템플릿에도 같은 내용과 제목을 넣는다.

Authentication의 URL Configuration에서 Site URL도 실제 서비스 주소로 바꾼다. 기본값 `localhost:3000`이 남아 있으면 링크 메일을 누른 사람이 연결 오류를 본다.

## 3. 코드 자릿수 맞추기

공식 문서에 6자리와 8자리 설명이 함께 있다. 실제로 새 프로젝트에서 8자리 코드가 온 사례가 있다. 입력칸의 `maxlength`가 더 짧으면 뒤 숫자가 잘려서 맞는 코드도 불일치로 나온다. 문서를 믿지 말고 실제 메일로 자릿수를 확인한 뒤, 입력칸 길이를 맞춘다.

## 4. 메일 서버 연결

내장 메일은 시험용이다. 시간당 2통으로 제한된다는 안내가 있어서, 다른 사람이 쓰면 금방 막힌다. Authentication의 SMTP 설정에서 외부 메일 서버를 연결한다. 이 기능은 무료 플랜에서도 쓸 수 있다.

| 항목 | Brevo 예시 |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Brevo SMTP 설정에 표시된 로그인 |
| Password | Brevo의 SMTP 키 (API 키가 아님) |
| Sender email | Brevo에 등록한 발신 주소와 정확히 같은 주소 |

시연용으로 다른 서비스 가입 없이 쓰려면 Gmail을 연결할 수 있다. 실제로 동작을 확인한 설정이다.

| 항목 | Gmail 예시 |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | Gmail 주소 전체 |
| Password | Google 앱 비밀번호 16자리, 공백 없이 (2단계 인증 필요) |
| Sender email | Username과 같은 주소 |

앱 비밀번호 메뉴는 Google 계정 화면에 보이지 않을 수 있어서 `https://myaccount.google.com/apppasswords`로 직접 들어간다. 대시보드에 개인 메일용이라는 경고가 뜨고, 발신 주소가 개인 Gmail로 노출된다. 실서비스에는 쓰지 않는다.

도메인이 없으면 Brevo는 자체 주소로 발송한다고 안내한다. 자체 도메인을 인증하면 스팸함에 덜 들어간다. Resend는 발신 도메인 인증이 필요할 수 있으니 공식 문서를 확인한다. 무료 한도는 각 서비스 요금 페이지에서 확인한다.

## 5. 발송 한도 올리기

외부 메일 서버를 연결해도 기본 한도는 시간당 30통으로 안내되어 있다. 필요하면 Rate Limits 화면에서 올린다.

## 6. 앱에 연결하기

```js
import { createClient } from '@supabase/supabase-js'
import { createEmailCode } from './email-code.mjs'

const client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY)
const emailCode = createEmailCode(client)

const sent = await emailCode.send(email)      // { ok: true } 또는 { ok: false, reason }
const checked = await emailCode.verify(email, code)  // { ok: true, user, session } 또는 { ok: false, reason }
```

`reason`별 화면 처리:

| reason | 뜻 | 화면 |
|---|---|---|
| `cooldown` | 재발송 대기 중, `wait`에 남은 초 | 버튼을 잠그고 남은 시간 표시 |
| `rate_limited` | 발송 또는 시도 한도 초과 | 잠시 뒤 다시 시도 안내 |
| `wrong_or_expired` | 코드가 틀렸거나 만료 | 코드 불일치 안내, 입력칸 비우기 |
| `failed` | 네트워크나 설정 문제 | 다시 시도 안내, 원인은 콘솔에만 기록 |

`shouldCreateUser`를 항상 `true`로 둔다. `false`로 두면 없는 이메일에서만 오류가 나서 가입 여부가 드러난다.

재발송 대기는 60초를 기본으로 두었다. 프로젝트 설정이 다르면 `createEmailCode(client, { resendSeconds })`로 맞춘다. 코드 유효 시간도 대시보드에서 확인해 화면 안내와 맞춘다.

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 코드 대신 링크가 온다 | Confirm signup과 Magic Link 두 템플릿 모두에 `{{ .Token }}`이 있는지 |
| 템플릿을 바꿨는데 "Your sign-in link" 같은 기본 메일이 온다 | 외부 메일 서버 연결 여부. 연결 뒤 템플릿을 다시 저장 |
| 메일 링크가 `localhost:3000` 오류로 열린다 | 코드 템플릿 적용 여부와 Site URL |
| 메일이 안 온다 | 스팸함, SMTP의 발신 주소 일치, 메일 서비스의 발송 기록 |
| 몇 통 뒤 막힌다 | 외부 메일 서버 연결과 Rate Limits |
| 맞는 코드가 실패한다 | 입력칸 `maxlength`와 코드 자릿수, 만료 시간, 코드를 재발송해서 이전 코드가 무효가 됐는지 |

## 출처

- [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [signInWithOtp](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod.md)
- [Brevo의 Supabase SMTP 안내](https://developers.brevo.com/docs/supabase-smtp-integration)
- [기본 메일 제공 방식 변경 공지](https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider)
- [Supabase 메일 템플릿 정리(제3자, 2026)](https://dreamlit.ai/blog/supabase-email-templates)
