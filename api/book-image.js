// GET /api/book-image?isbn=9789...
// Looks up book via Naver Book Search API and returns image/title/publisher.

export default async function handler(req, res) {
  const isbn = (req.query.isbn || '').toString().replace(/\D/g, '')
  if (!isbn) return res.status(400).json({ error: 'isbn required' })

  const CLIENT_ID = process.env.NAVER_CLIENT_ID
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Naver API credentials not configured' })
  }

  try {
    const r = await fetch(
      `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(isbn)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': CLIENT_ID,
          'X-Naver-Client-Secret': CLIENT_SECRET,
        },
      },
    )
    if (!r.ok) {
      return res.status(502).json({ error: `Naver API ${r.status}` })
    }
    const data = await r.json()
    const item = data.items?.[0]
    if (!item) {
      return res.status(404).json({ error: 'Book not found' })
    }
    const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    return res.status(200).json({
      image: item.image || null,
      title: strip(item.title),
      publisher: strip(item.publisher),
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
