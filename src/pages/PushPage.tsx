import { useState } from 'react'
import { supabase } from '../lib/supabase'

function formatPhone(input: string) {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function toE164NoPlus(formatted: string) {
  const d = formatted.replace(/\D/g, '')
  return `82${d.replace(/^0/, '')}`
}

type SendResult = {
  sent: number
  total: number
  results: { device_id: string; platform: string | null; ok: boolean; error?: string }[]
}

export default function PushPage() {
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = phoneDigits.length === 11 && phoneDigits.startsWith('010')
  const canSend = phoneValid && title.trim().length > 0 && body.trim().length > 0

  const onSend = async () => {
    if (!canSend || busy) return
    setError(null)
    setResult(null)
    setBusy(true)

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setError('세션이 만료됐어요. 다시 로그인해주세요.')
      setBusy(false)
      return
    }

    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: toE164NoPlus(phone),
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || '/',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `발송 실패 (${res.status})`)
      } else {
        setResult(json as SendResult)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold">푸시 발송</h2>
      <p className="text-xs text-gray-500 mt-1">
        전화번호로 그 유저의 모든 구독 디바이스에 푸시를 보냅니다.
      </p>

      <div className="mt-6 max-w-md space-y-4 bg-white border border-gray-200 rounded-lg p-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1">받는 사람 전화번호</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            className="w-full bg-transparent border-b border-gray-300 py-1.5 text-sm outline-none focus:border-qanda-orange"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="w-full bg-transparent border-b border-gray-300 py-1.5 text-sm outline-none focus:border-qanda-orange"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">본문</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={200}
            rows={3}
            className="w-full bg-transparent border border-gray-300 rounded p-2 text-sm outline-none focus:border-qanda-orange resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">클릭 시 이동 URL (옵션)</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            className="w-full bg-transparent border-b border-gray-300 py-1.5 text-sm outline-none focus:border-qanda-orange"
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend || busy}
          className="w-full rounded-md bg-qanda-orange text-white py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? '발송 중...' : '발송'}
        </button>

        {error && <div className="text-xs text-rose-600">{error}</div>}
        {result && (
          <div className="text-xs space-y-2">
            <div className="text-emerald-700 font-medium">
              {result.sent}/{result.total} 디바이스 발송 완료
            </div>
            {result.results.length > 0 && (
              <ul className="space-y-1">
                {result.results.map((r) => (
                  <li
                    key={r.device_id}
                    className={r.ok ? 'text-gray-600' : 'text-rose-600'}
                  >
                    {r.platform || '?'} · {r.device_id.slice(0, 8)} ·{' '}
                    {r.ok ? 'OK' : r.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
