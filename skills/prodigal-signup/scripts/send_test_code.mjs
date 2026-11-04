#!/usr/bin/env node
// 대시보드 설정이 끝났는지 실제 메일 한 통으로 확인한다.
// 사용법: node send_test_code.mjs <Project URL> <공개 키> <받는 이메일>

const [url, key, email] = process.argv.slice(2)
if (!url || !key || !email) {
  console.error('사용법: node send_test_code.mjs <Project URL> <공개 키> <받는 이메일>')
  process.exit(2)
}

const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/otp`, {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, create_user: true }),
})

if (res.ok) {
  console.log(`요청 성공. ${email} 메일함과 스팸함을 확인한다.`)
  console.log('코드가 아니라 링크가 왔다면 Confirm signup과 Magic Link 템플릿에 {{ .Token }}을 넣어야 한다.')
} else {
  console.error(`요청 실패 ${res.status}: ${await res.text()}`)
  if (res.status === 429) console.error('발송 한도 초과. SMTP 연결과 Rate Limits를 확인한다.')
  process.exit(1)
}
