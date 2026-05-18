import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function formatPhone(input: string) {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function toE164(formatted: string) {
  const d = formatted.replace(/\D/g, '')
  return `+82${d.replace(/^0/, '')}`
}

export default function LoginPage() {
  const { sendOtp, verifyOtp, session, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/devices'

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && session && isAdmin) navigate(from, { replace: true })
  }, [loading, session, isAdmin, from, navigate])

  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = phoneDigits.length === 11 && phoneDigits.startsWith('010')

  const onSendOtp = async () => {
    if (!phoneValid || busy) return
    setError(null)
    setBusy(true)
    const { error } = await sendOtp(toE164(phone))
    setBusy(false)
    if (error) return setError(error)
    setStep('code')
    setCode('')
  }

  const onVerify = async () => {
    if (code.length !== 6 || busy) return
    setError(null)
    setBusy(true)
    const { error } = await verifyOtp(toE164(phone), code)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div className="min-h-full flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 100 100" className="w-14 h-14">
            <circle cx="49" cy="49" r="36" fill="#000" />
            <circle cx="49" cy="49" r="13" fill="#fff" />
            <circle cx="74" cy="74" r="13" fill="#FF6B1A" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 text-center">어드민 로그인</h1>
        <p className="mt-1 text-xs text-gray-500 text-center">
          어드민으로 등록된 휴대폰 번호로만 접근 가능합니다.
        </p>

        {step === 'phone' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSendOtp()
            }}
            className="mt-6"
          >
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-1234-5678"
              className="w-full bg-transparent border-b-2 border-qanda-orange py-2 text-sm outline-none placeholder:text-gray-300"
              autoFocus
            />
            <button
              type="submit"
              disabled={!phoneValid || busy}
              className="mt-6 w-full rounded-md bg-qanda-orange text-white py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy ? '전송 중...' : '인증번호 받기'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onVerify()
            }}
            className="mt-6"
          >
            <div className="text-xs text-gray-500">{phone}</div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6자리 인증번호"
              className="mt-2 w-full bg-transparent border-b-2 border-qanda-orange py-2 text-sm outline-none placeholder:text-gray-300 tracking-[0.4em] placeholder:tracking-normal"
              autoFocus
            />
            <button
              type="submit"
              disabled={code.length !== 6 || busy}
              className="mt-6 w-full rounded-md bg-qanda-orange text-white py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy ? '확인 중...' : '확인'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
              className="mt-2 w-full text-center text-xs text-gray-500 py-2"
            >
              번호 다시 입력
            </button>
          </form>
        )}

        {error && <div className="mt-4 text-xs text-rose-600">{error}</div>}
        {!loading && session && !isAdmin && (
          <div className="mt-4 text-xs text-rose-600">이 계정은 어드민이 아닙니다.</div>
        )}
      </div>
    </div>
  )
}
