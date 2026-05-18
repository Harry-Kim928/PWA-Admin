import { useEffect, useState } from 'react'
import {
  CATEGORIES,
  LEVELS,
  SUBJECTS,
  type Category,
  type Level,
  type Subject,
} from '../lib/constants'
import { parseCSV } from '../lib/csv'
import { supabase } from '../lib/supabase'

type Textbook = {
  id: string
  level: Level
  subject: Subject
  category: Category
  title: string
  publisher: string
  isbn: string
  image_url: string | null
  created_at: string
}

type EditDraft = {
  title: string
  publisher: string
  isbn: string
}

async function fetchBookImage(
  isbn: string,
): Promise<{ image: string | null; title?: string; publisher?: string } | null> {
  try {
    const r = await fetch(`/api/book-image?isbn=${encodeURIComponent(isbn)}`)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export default function TextbooksPage() {
  const [level, setLevel] = useState<Level>('중등')
  const [subject, setSubject] = useState<Subject>('수학')
  const [category, setCategory] = useState<Category>('자습서')

  const [rows, setRows] = useState<Textbook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft>({ title: '', publisher: '', isbn: '' })

  // add new row form
  const [adding, setAdding] = useState(false)
  const [newDraft, setNewDraft] = useState<EditDraft>({ title: '', publisher: '', isbn: '' })
  const [addBusy, setAddBusy] = useState(false)

  // csv upload
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvParsed, setCsvParsed] = useState<EditDraft[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvProgress, setCsvProgress] = useState({ done: 0, total: 0 })
  const [csvBusy, setCsvBusy] = useState(false)

  const fetchRows = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('textbooks')
      .select('*')
      .eq('level', level)
      .eq('subject', subject)
      .eq('category', category)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRows((data || []) as Textbook[])
    setLoading(false)
  }

  useEffect(() => {
    void fetchRows()
    setEditingId(null)
    setAdding(false)
    setCsvFileName(null)
    setCsvParsed([])
    setCsvError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, subject, category])

  const startEdit = (row: Textbook) => {
    setEditingId(row.id)
    setDraft({ title: row.title, publisher: row.publisher, isbn: row.isbn })
  }

  const saveEdit = async (id: string) => {
    const t = draft.title.trim()
    const p = draft.publisher.trim()
    const i = draft.isbn.replace(/\D/g, '')
    if (!t || !p || !i) {
      alert('이름, 출판사, ISBN 모두 필요해요')
      return
    }
    const meta = await fetchBookImage(i)
    const { error } = await supabase
      .from('textbooks')
      .update({
        title: t,
        publisher: p,
        isbn: i,
        image_url: meta?.image || null,
      })
      .eq('id', id)
    if (error) {
      alert('수정 실패: ' + error.message)
      return
    }
    setEditingId(null)
    void fetchRows()
  }

  const removeRow = async (id: string) => {
    if (!confirm('이 교재를 삭제할까요?')) return
    const { error } = await supabase.from('textbooks').delete().eq('id', id)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    void fetchRows()
  }

  const addRow = async () => {
    const t = newDraft.title.trim()
    const p = newDraft.publisher.trim()
    const i = newDraft.isbn.replace(/\D/g, '')
    if (!t || !p || !i) {
      alert('이름, 출판사, ISBN 모두 필요해요')
      return
    }
    setAddBusy(true)
    const meta = await fetchBookImage(i)
    const { error } = await supabase.from('textbooks').insert({
      level,
      subject,
      category,
      title: t,
      publisher: p,
      isbn: i,
      image_url: meta?.image || null,
    })
    setAddBusy(false)
    if (error) {
      alert('추가 실패: ' + error.message)
      return
    }
    setNewDraft({ title: '', publisher: '', isbn: '' })
    setAdding(false)
    void fetchRows()
  }

  const onCsvUpload = async (file: File) => {
    setCsvError(null)
    setCsvParsed([])
    setCsvFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      const keys = parsed.length > 0 ? Object.keys(parsed[0]) : []
      const titleKey = keys.find((k) => /title|이름|제목|교재/.test(k)) || keys[0]
      const publisherKey = keys.find((k) => /publisher|출판사/.test(k)) || keys[1]
      const isbnKey = keys.find((k) => /isbn/i.test(k)) || keys[2]
      const drafts: EditDraft[] = parsed
        .map((row) => ({
          title: (row[titleKey] || '').trim(),
          publisher: (row[publisherKey] || '').trim(),
          isbn: (row[isbnKey] || '').replace(/\D/g, ''),
        }))
        .filter((d) => d.title && d.publisher && d.isbn)
      if (drafts.length === 0) {
        setCsvError('유효한 행이 없어요. 헤더: title/이름, publisher/출판사, isbn')
        return
      }
      setCsvParsed(drafts)
    } catch (err) {
      setCsvError((err as Error).message)
    }
  }

  const onCsvImport = async () => {
    if (csvParsed.length === 0 || csvBusy) return
    setCsvBusy(true)
    setCsvProgress({ done: 0, total: csvParsed.length })
    let inserted = 0
    let failed = 0
    for (const d of csvParsed) {
      const meta = await fetchBookImage(d.isbn)
      const { error } = await supabase.from('textbooks').upsert(
        {
          level,
          subject,
          category,
          title: d.title,
          publisher: d.publisher,
          isbn: d.isbn,
          image_url: meta?.image || null,
        },
        { onConflict: 'isbn' },
      )
      if (error) failed++
      else inserted++
      setCsvProgress((s) => ({ ...s, done: s.done + 1 }))
    }
    setCsvBusy(false)
    alert(`완료: ${inserted}건 삽입/갱신, ${failed}건 실패`)
    setCsvParsed([])
    setCsvFileName(null)
    void fetchRows()
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">교재 관리</h1>
          <p className="text-xs text-gray-500 mt-1">
            레벨/과목/카테고리 선택 후 교재를 추가하거나 CSV로 일괄 업로드합니다. 이미지는 ISBN으로 자동 페치.
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <RadioRow
          label="레벨"
          options={LEVELS}
          value={level}
          onChange={(v) => setLevel(v as Level)}
        />
        <RadioRow
          label="과목"
          options={SUBJECTS}
          value={subject}
          onChange={(v) => setSubject(v as Subject)}
        />
        <RadioRow
          label="카테고리"
          options={CATEGORIES}
          value={category}
          onChange={(v) => setCategory(v as Category)}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs px-3 py-1.5 rounded bg-qanda-orange text-white"
        >
          {adding ? '취소' : '교재 추가'}
        </button>
        <label className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white cursor-pointer">
          CSV 업로드
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onCsvUpload(e.target.files[0])}
          />
        </label>
        {csvFileName && (
          <span className="text-xs text-gray-500 self-center">
            {csvFileName} · {csvParsed.length}건
          </span>
        )}
        {csvParsed.length > 0 && (
          <button
            onClick={onCsvImport}
            disabled={csvBusy}
            className="text-xs px-3 py-1.5 rounded bg-gray-900 text-white disabled:opacity-40"
          >
            {csvBusy
              ? `업로드 중 ${csvProgress.done}/${csvProgress.total}`
              : `${csvParsed.length}건 일괄 등록`}
          </button>
        )}
        {csvError && <span className="text-xs text-rose-600 self-center">{csvError}</span>}
      </div>

      {adding && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg flex flex-wrap gap-3 items-end">
          <Field
            label="이름"
            value={newDraft.title}
            onChange={(v) => setNewDraft((d) => ({ ...d, title: v }))}
            className="flex-1 min-w-[200px]"
          />
          <Field
            label="출판사"
            value={newDraft.publisher}
            onChange={(v) => setNewDraft((d) => ({ ...d, publisher: v }))}
            className="w-40"
          />
          <Field
            label="ISBN"
            value={newDraft.isbn}
            onChange={(v) => setNewDraft((d) => ({ ...d, isbn: v.replace(/\D/g, '') }))}
            className="w-44"
          />
          <button
            onClick={addRow}
            disabled={addBusy}
            className="text-xs px-4 py-1.5 rounded bg-qanda-orange text-white disabled:opacity-40"
          >
            {addBusy ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-16">표지</th>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="px-3 py-2 font-medium w-44">출판사</th>
              <th className="px-3 py-2 font-medium w-44">ISBN</th>
              <th className="px-3 py-2 font-medium w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-gray-400">
                  로딩 중...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-rose-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-gray-400">
                  등록된 교재가 없습니다
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isEditing = editingId === r.id
                return (
                  <tr key={r.id} className="text-xs align-middle">
                    <td className="px-3 py-2">
                      <div className="w-10 h-14 bg-gray-100 rounded overflow-hidden">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={r.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={draft.title}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          className="w-full text-xs border-b border-gray-300 py-0.5 outline-none focus:border-qanda-orange"
                        />
                      ) : (
                        r.title
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {isEditing ? (
                        <input
                          value={draft.publisher}
                          onChange={(e) => setDraft({ ...draft, publisher: e.target.value })}
                          className="w-full text-xs border-b border-gray-300 py-0.5 outline-none focus:border-qanda-orange"
                        />
                      ) : (
                        r.publisher
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {isEditing ? (
                        <input
                          value={draft.isbn}
                          onChange={(e) =>
                            setDraft({ ...draft, isbn: e.target.value.replace(/\D/g, '') })
                          }
                          className="w-full text-xs border-b border-gray-300 py-0.5 outline-none focus:border-qanda-orange"
                        />
                      ) : (
                        r.isbn
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(r.id)}
                            className="text-xs text-emerald-700 mr-2"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-gray-500"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(r)}
                            className="text-xs text-gray-600 mr-2"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => removeRow(r.id)}
                            className="text-xs text-rose-600"
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RadioRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-500">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-3 py-1 rounded border ${
              value === o
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-gray-300 py-1.5 text-sm outline-none focus:border-qanda-orange"
      />
    </div>
  )
}
