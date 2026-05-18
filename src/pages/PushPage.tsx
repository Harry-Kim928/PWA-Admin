import { useState } from 'react'
import { extractPhones, parseCSV } from '../lib/csv'
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

type SingleResult = {
  sent: number
  total: number
  results: { device_id: string; platform: string | null; ok: boolean; error?: string }[]
}

type BulkResult = {
  phone: string
  ok: boolean
  sent?: number
  total?: number
  error?: string
}

export default function PushPage() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')

  // single mode
  const [phone, setPhone] = useState('')
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null)

  // bulk mode
  const [bulkPhones, setBulkPhones] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid = phoneDigits.length === 11 && phoneDigits.startsWith('010')

  const messageValid = title.trim().length > 0 && body.trim().length > 0

  const sendOne = async (e164Phone: string, token: string) => {
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phone: e164Phone,
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || '/',
      }),
    })
    const json = await res.json()
    return { ok: res.ok, status: res.status, json }
  }

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  const onSendSingle = async () => {
    if (!phoneValid || !messageValid || busy) return
    setError(null)
    setSingleResult(null)
    setBusy(true)
    const token = await getToken()
    if (!token) {
      setError('세션이 만료됐어요. 다시 로그인해주세요.')
      setBusy(false)
      return
    }
    try {
      const { ok, json } = await sendOne(toE164NoPlus(phone), token)
      if (!ok) setError(json.error || '발송 실패')
      else setSingleResult(json as SingleResult)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onCsvUpload = async (file: File) => {
    setCsvError(null)
    setBulkPhones([])
    setBulkResults([])
    setCsvFileName(file.name)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      const phones = extractPhones(rows)
      const unique = Array.from(new Set(phones))
      if (unique.length === 0) {
        setCsvError('유효한 휴대폰 번호를 찾지 못했어요. (010 시작, 11자리)')
        return
      }
      setBulkPhones(unique)
    } catch (err) {
      setCsvError((err as Error).message)
    }
  }

  const onSendBulk = async () => {
    if (bulkPhones.length === 0 || !messageValid || busy) return
    setError(null)
    setBulkResults([])
    setBusy(true)
    const token = await getToken()
    if (!token) {
      setError('세션이 만료됐어요. 다시 로그인해주세요.')
      setBusy(false)
      return
    }

    setBulkProgress({ done: 0, total: bulkPhones.length })
    const results: BulkResult[] = []
    // serial to avoid overwhelming the function
    for (const p of bulkPhones) {
      try {
        const { ok, json } = await sendOne(p, token)
        if (ok) {
          results.push({ phone: p, ok: true, sent: json.sent, total: json.total })
        } else {
          results.push({ phone: p, ok: false, error: json.error || '실패' })
        }
      } catch (err) {
        results.push({ phone: p, ok: false, error: (err as Error).message })
      }
      setBulkProgress((s) => ({ ...s, done: s.done + 1 }))
    }
    setBulkResults(results)
    setBusy(false)
  }

  return (
    <div className="px-8 py-6">
      <h1 className="text-xl font-bold">푸시 알림</h1>
      <p className="text-xs text-gray-500 mt-1">
        구독된 디바이스로 알림을 발송합니다.
      </p>

      <div className="mt-5 inline-flex rounded-md border border-gray-200 bg-white text-xs overflow-hidden">
        <button
          onClick={() => setMode('single')}
          className={`px-4 py-1.5 ${mode === 'single' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}
        >
          단일 발송
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`px-4 py-1.5 ${mode === 'bulk' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}
        >
          CSV 일괄 발송
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          {mode === 'single' ? (
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
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">CSV 파일</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && onCsvUpload(e.target.files[0])}
                className="block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:border-0 file:bg-gray-100 file:text-gray-700 file:rounded file:text-xs"
              />
              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                첫 번째 열이 전화번호 또는 "phone"/"전화번호" 헤더 사용. 010xxxxxxxx 형식이면 자동으로 +82로 변환합니다.
              </p>
              {csvFileName && (
                <div className="mt-2 text-xs text-gray-600">
                  {csvFileName} · 유효 번호 <span className="font-semibold">{bulkPhones.length}</span>개
                </div>
              )}
              {csvError && <div className="mt-2 text-xs text-rose-600">{csvError}</div>}
            </div>
          )}

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
            <label className="block text-xs text-gray-500 mb-1">클릭 시 URL (옵션)</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/"
              className="w-full bg-transparent border-b border-gray-300 py-1.5 text-sm outline-none focus:border-qanda-orange"
            />
          </div>

          {mode === 'single' ? (
            <button
              type="button"
              onClick={onSendSingle}
              disabled={!phoneValid || !messageValid || busy}
              className="w-full rounded-md bg-qanda-orange text-white py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy ? '발송 중...' : '발송'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSendBulk}
              disabled={bulkPhones.length === 0 || !messageValid || busy}
              className="w-full rounded-md bg-qanda-orange text-white py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy
                ? `발송 중 ${bulkProgress.done}/${bulkProgress.total}...`
                : `${bulkPhones.length}명에게 발송`}
            </button>
          )}

          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">결과</h2>
          {mode === 'single' ? (
            singleResult ? (
              <div className="text-xs space-y-2">
                <div className="text-emerald-700 font-medium">
                  {singleResult.sent}/{singleResult.total} 디바이스 발송 완료
                </div>
                <ul className="space-y-1">
                  {singleResult.results.map((r) => (
                    <li
                      key={r.device_id}
                      className={r.ok ? 'text-gray-600' : 'text-rose-600'}
                    >
                      {r.platform || '?'} · {r.device_id.slice(0, 8)} ·{' '}
                      {r.ok ? 'OK' : r.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-xs text-gray-400">아직 발송한 내역이 없습니다.</div>
            )
          ) : bulkResults.length > 0 ? (
            <div className="text-xs space-y-2">
              <div className="font-medium">
                성공 {bulkResults.filter((r) => r.ok).length}건 · 실패{' '}
                {bulkResults.filter((r) => !r.ok).length}건 / 총 {bulkResults.length}건
              </div>
              <div className="max-h-80 overflow-y-auto border-t border-gray-100 divide-y divide-gray-100">
                {bulkResults.map((r) => (
                  <div
                    key={r.phone}
                    className={`py-1.5 flex justify-between ${r.ok ? '' : 'text-rose-600'}`}
                  >
                    <span className="font-mono">{r.phone}</span>
                    <span>
                      {r.ok ? `${r.sent}/${r.total} 발송` : r.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : busy ? (
            <div className="text-xs text-gray-500">
              발송 중 {bulkProgress.done}/{bulkProgress.total}
            </div>
          ) : (
            <div className="text-xs text-gray-400">CSV 업로드 후 발송 결과가 표시됩니다.</div>
          )}
        </div>
      </div>
    </div>
  )
}
