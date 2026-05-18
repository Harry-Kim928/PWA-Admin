import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type DeviceRow = {
  id: string
  user_id: string
  phone: string | null
  device_id: string
  platform: string | null
  user_agent: string | null
  is_pwa: boolean | null
  push_subscription: unknown | null
  app_version: string | null
  last_seen_at: string
  created_at: string
}

const ONLINE_THRESHOLD_S = 60
const REFRESH_MS = 15_000

function secondsAgo(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
}

function relTime(seconds: number) {
  if (seconds < 60) return `${seconds}초 전`
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}시간 전`
  return `${Math.round(seconds / 86400)}일 전`
}

export default function DevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [filter, setFilter] = useState<'all' | 'online' | 'ios' | 'android' | 'desktop'>('all')

  const fetchRows = async () => {
    setError(null)
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('last_seen_at', { ascending: false })
    if (error) setError(error.message)
    else setRows((data || []) as DeviceRow[])
    setLoading(false)
  }

  useEffect(() => {
    void fetchRows()
    const id = window.setInterval(() => {
      void fetchRows()
      setNow(Date.now())
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const age = (now - new Date(r.last_seen_at).getTime()) / 1000
      if (filter === 'online') return age <= ONLINE_THRESHOLD_S
      if (filter === 'ios') return r.platform === 'ios'
      if (filter === 'android') return r.platform === 'android'
      if (filter === 'desktop') return r.platform === 'desktop'
      return true
    })
  }, [rows, filter, now])

  const onlineCount = rows.filter(
    (r) => (now - new Date(r.last_seen_at).getTime()) / 1000 <= ONLINE_THRESHOLD_S,
  ).length

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">디바이스</h2>
          <p className="text-xs text-gray-500 mt-1">
            총 {rows.length}대 · 온라인 {onlineCount}대 (최근 {ONLINE_THRESHOLD_S}초 이내)
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {(['all', 'online', 'ios', 'android', 'desktop'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full border ${
                filter === k
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {k === 'all' ? '전체' : k === 'online' ? '온라인' : k}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>
      ) : error ? (
        <div className="py-6 text-sm text-rose-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">디바이스가 없습니다</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">상태</th>
                <th className="text-left px-3 py-2 font-medium">전화번호</th>
                <th className="text-left px-3 py-2 font-medium">플랫폼</th>
                <th className="text-left px-3 py-2 font-medium">PWA</th>
                <th className="text-left px-3 py-2 font-medium">푸시</th>
                <th className="text-left px-3 py-2 font-medium">마지막 활동</th>
                <th className="text-left px-3 py-2 font-medium">디바이스 ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const age = secondsAgo(r.last_seen_at)
                const online = age <= ONLINE_THRESHOLD_S
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          online ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.phone || '-'}</td>
                    <td className="px-3 py-2">{r.platform || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.is_pwa ? '예' : '아니오'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.push_subscription ? '구독' : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{relTime(age)}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-400">
                      {r.device_id.slice(0, 8)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
