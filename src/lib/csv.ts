// Minimal CSV parser. Doesn't handle commas inside quoted fields perfectly,
// but fine for our two cases: a single-phone column and 3 simple book columns.

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^﻿/, '') // strip BOM
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  const splitRow = (s: string) => s.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
  const headers = splitRow(lines[0])

  return lines.slice(1).map((line) => {
    const cells = splitRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    return row
  })
}

// Tolerant phone extractor: accept various header names, fall back to first column.
export function extractPhones(rows: Record<string, string>[]): string[] {
  if (rows.length === 0) return []
  const keys = Object.keys(rows[0])
  const phoneKey =
    keys.find((k) => /phone|전화|번호|연락/.test(k)) ?? keys[0]
  return rows
    .map((r) => r[phoneKey] ?? '')
    .map((s) => s.replace(/\D/g, ''))
    .filter((d) => d.length === 11 && d.startsWith('010'))
    .map((d) => `82${d.replace(/^0/, '')}`)
}
