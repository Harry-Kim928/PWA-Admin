type Props = {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export default function Pagination({ page, pageSize, total, onChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (pageCount <= 1) return null

  const windowSize = 5
  const start = Math.max(0, Math.min(page - 2, pageCount - windowSize))
  const end = Math.min(pageCount, start + windowSize)
  const pages = Array.from({ length: end - start }, (_, i) => start + i)

  return (
    <div className="flex items-center justify-center gap-1 py-4 text-sm">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-2 py-1 text-gray-500 disabled:text-gray-300"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-7 h-7 rounded ${
            p === page
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {p + 1}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="px-2 py-1 text-gray-500 disabled:text-gray-300"
      >
        ›
      </button>
      <span className="ml-3 text-xs text-gray-400">
        {total.toLocaleString()}건
      </span>
    </div>
  )
}
