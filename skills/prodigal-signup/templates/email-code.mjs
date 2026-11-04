// 이메일 인증 코드 발송과 검증. 화면 코드와 분리해서 어떤 프레임워크에서도 쓸 수 있다.
// client는 @supabase/supabase-js의 createClient 결과다.

function reasonOf(error) {
  if (error.status === 429 || /rate_limit/.test(error.code ?? '')) return 'rate_limited'
  if (error.status === 403 || error.code === 'otp_expired') return 'wrong_or_expired'
  return 'failed'
}

export function createEmailCode(client, { resendSeconds = 60, now = Date.now } = {}) {
  let lastSentAt = -Infinity
  const normalize = (email) => email.trim().toLowerCase()
  const secondsUntilResend = () =>
    Math.max(0, Math.ceil(resendSeconds - (now() - lastSentAt) / 1000))

  return {
    secondsUntilResend,

    async send(email) {
      const wait = secondsUntilResend()
      if (wait > 0) return { ok: false, reason: 'cooldown', wait }
      // 없는 이메일에서만 오류가 나면 가입 여부가 드러나므로 항상 true로 둔다.
      const { error } = await client.auth.signInWithOtp({
        email: normalize(email),
        options: { shouldCreateUser: true },
      })
      if (error) {
        console.error('email code send failed', error)
        return { ok: false, reason: reasonOf(error) }
      }
      lastSentAt = now()
      return { ok: true }
    },

    async verify(email, code) {
      const { data, error } = await client.auth.verifyOtp({
        email: normalize(email),
        token: code.trim(),
        type: 'email',
      })
      if (error) return { ok: false, reason: reasonOf(error) }
      return { ok: true, user: data.user, session: data.session }
    },
  }
}
