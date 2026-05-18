import { useEffect, useMemo, useState } from 'react'
import Pagination from '../components/Pagination'
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
const PAGE_SIZE = 10
const REFRESH_MS = 15_000

type Filters = {
  phone: string
  deviceId: string
  platform: '' | 'ios' | 'android' | 'desktop' | 'other'
  isPwa: '' | 'true' | 'false'
  hasPush: '' | 'true' | 'false'
  onlineOnly: boolean
}

const EMPTY_FILTERS: Filters = {
  phone: '',
  deviceId: '',
  platform: '',
  isPwa: '',
  hasPush: '',
  onlineOnly: false,
}

function relTime(seconds: number) {
  if (seconds < 60) return `${seconds}초 전`
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}시간 전`
  return `${Math.round(seconds / 86400)}일 전`
}

export default function DevicesPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<DeviceRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const fetchPage = useMemo(() => {
    return async (currentFilters: Filters, currentPage: number) => {
      setError(null)
      let q = supabase
        .from('devices')
        .select('*', { count: 'exact' })
        .order('last_seen_at', { ascending: false })

      if (currentFilters.phone) {
        const cleaned = currentFilters.phone.replace(/\D/g, '')
        if (cleaned) q = q.ilike('phone', `%${cleaned}%`)
      }
      if (currentFilters.deviceId) {
        q = q.ilike('device_id', `%${currentFilters.deviceId}%`)
      }
      if (currentFilters.platform) q = q.eq('platform', currentFilters.platform)
      if (currentFilters.isPwa) q = q.eq('is_pwa', currentFilters.isPwa === 'true')
      if (currentFilters.hasPush === 'true') q = q.not('push_subscription', 'is', null)
      if (currentFilters.hasPush === 'false') q = q.is('push_subscription', null)
      if (currentFilters.onlineOnly) {
        const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_S * 1000).toISOString()
        q = q.gte('last_seen_at', cutoff)
      }

      const from = currentPage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, count, error } = await q.range(from, to)
      if (error) {
        setError(error.message)
        setRows([])
        setTotal(0)
      } else {
        setRows((data || []) as DeviceRow[])
        setTotal(count || 0)
      }
      setLoading(false)
    }
  }, [])

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0)
  }, [filters])

  useEffect(() => {
    setLoading(true)
    void fetchPage(filters, page)
  }, [filters, page, fetchPage])

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchPage(filters, page)
      setNow(Date.now())
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [filters, page, fetchPage])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="px-8 py-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">디바이스</h1>
          <p className="text-xs text-gray-500 mt-1">
            총 {total.toLocaleString()}건 · 최근 {ONLINE_THRESHOLD_S}초 내 활동 시 온라인 표시
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="text-xs text-gray-500 underline underline-offset-2"
        >
          필터 초기화
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 px-3 py-1.5 rounded border border-gray-200 bg-white">
          <input
            type="checkbox"
            checked={filters.onlineOnly}
            onChange={(e) => update('onlineOnly', e.target.checked)}
          />
          온라인만
        </label>
        <select
          value={filters.platform}
          onChange={(e) => update('platform', e.target.value as Filters['platform'])}
          className="text-xs px-3 py-1.5 rounded border border-gray-200 bg-white"
        >
          <option value="">플랫폼 전체</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
          <option value="desktop">Desktop</option>
          <option value="other">기타</option>
        </select>
        <select
          value={filters.isPwa}
          onChange={(e) => update('isPwa', e.target.value as Filters['isPwa'])}
          className="text-xs px-3 py-1.5 rounded border border-gray-200 bg-white"
        >
          <option value="">PWA 전체</option>
          <option value="true">PWA 설치</option>
          <option value="false">브라우저</option>
        </select>
        <select
          value={filters.hasPush}
          onChange={(e) => update('hasPush', e.target.value as Filters['hasPush'])}
          className="text-xs px-3 py-1.5 rounded border border-gray-200 bg-white"
        >
          <option value="">푸시 전체</option>
          <option value="true">구독</option>
          <option value="false">미구독</option>
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-12">상태</th>
              <th className="px-3 py-2 font-medium">전화번호</th>
              <th className="px-3 py-2 font-medium">플랫폼</th>
              <th className="px-3 py-2 font-medium">PWA</th>
              <th className="px-3 py-2 font-medium">푸시</th>
              <th className="px-3 py-2 font-medium">마지막 활동</th>
              <th className="px-3 py-2 font-medium">디바이스 ID</th>
            </tr>
            <tr className="text-left bg-white">
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">
                <input
                  type="text"
                  value={filters.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="번호 검색"
                  className="w-full text-xs border-b border-gray-200 py-0.5 outline-none focus:border-qanda-orange placeholder:text-gray-300"
                />
              </th>
              <th colSpan={3}></th>
              <th></th>
              <th className="px-3 py-2">
                <input
                  type="text"
                  value={filters.deviceId}
                  onChange={(e) => update('deviceId', e.target.value)}
                  placeholder="ID 검색"
                  className="w-full text-xs border-b border-gray-200 py-0.5 outline-none focus:border-qanda-orange placeholder:text-gray-300"
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-gray-400">
                  로딩 중...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-rose-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-gray-400">
                  조건에 맞는 디바이스가 없습니다
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const age = Math.max(
                  0,
                  Math.round((now - new Date(r.last_seen_at).getTime()) / 1000),
                )
                const online = age <= ONLINE_THRESHOLD_S
                return (
                  <tr key={r.id} className="text-xs">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          online ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                        title={online ? '온라인' : '오프라인'}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{r.phone || '-'}</td>
                    <td className="px-3 py-2">{r.platform || '-'}</td>
                    <td className="px-3 py-2">{r.is_pwa ? '예' : '아니오'}</td>
                    <td className="px-3 py-2">
                      {r.push_subscription ? '구독' : '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{relTime(age)}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-400">
                      {r.device_id.slice(0, 8)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onChange={setPage}
      />
    </div>
  )
}
