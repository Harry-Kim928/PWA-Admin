// GET /api/book-image?isbn=...&title=...
// Looks up a book via Naver Book Search.
// Tries ISBN first, falls back to title.

async function naverSearch(query, clientId, clientSecret) {
  const r = await fetch(
    `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=1`,
    {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    },
  )
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Naver API ${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json()
}

const strip = (s) =>
  (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()

export default async function handler(req, res) {
  const isbn = (req.query.isbn || '').toString().replace(/\D/g, '')
  const title = (req.query.title || '').toString().trim()

  if (!isbn && !title) {
    return res.status(400).json({ error: 'isbn 또는 title 중 하나가 필요해요' })
  }

  const CLIENT_ID = process.env.NAVER_CLIENT_ID
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({
      error:
        'Naver API 자격증명이 설정되어 있지 않아요. Vercel 환경변수에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 등록 후 재배포 필요.',
    })
  }

  try {
    let item = null
    let usedQuery = null

    if (isbn) {
      const data = await naverSearch(isbn, CLIENT_ID, CLIENT_SECRET)
      if (data.items?.length) {
        item = data.items[0]
        usedQuery = `ISBN:${isbn}`
      }
    }

    if (!item && title) {
      const data = await naverSearch(title, CLIENT_ID, CLIENT_SECRET)
      if (data.items?.length) {
        item = data.items[0]
        usedQuery = `title:${title}`
      }
    }

    if (!item) {
      return res.status(404).json({
        error: 'Naver 책 검색에서 결과를 찾지 못했어요.',
        triedIsbn: !!isbn,
        triedTitle: !!title,
      })
    }

    return res.status(200).json({
      image: item.image || null,
      title: strip(item.title),
      publisher: strip(item.publisher),
      matchedBy: usedQuery,
    })
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Naver API 호출 실패' })
  }
}
