// Vercel Serverless Function: POST /api/send-push
// Auth: Authorization: Bearer <supabase access_token> (must be an admin)
// Body: { phone, title, body, url? }

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res
      .status(500)
      .json({ error: 'Server env missing (SUPABASE_*, VAPID_*)' })
  }

  const authHeader = req.headers.authorization || req.headers.Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }
  const token = authHeader.slice('Bearer '.length)

  const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  const { data: userData, error: userErr } = await userClient.auth.getUser(token)
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: adminRow, error: adminErr } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (adminErr) {
    return res.status(500).json({ error: 'Admin check failed: ' + adminErr.message })
  }
  if (!adminRow) {
    return res.status(403).json({ error: 'Not an admin' })
  }

  const { phone, title, body, url } = req.body || {}
  if (!phone || !title || !body) {
    return res.status(400).json({ error: 'phone, title, body required' })
  }

  const { data: devices, error: devErr } = await admin
    .from('devices')
    .select('id, device_id, platform, push_subscription')
    .eq('phone', phone)
    .not('push_subscription', 'is', null)

  if (devErr) {
    return res.status(500).json({ error: devErr.message })
  }
  if (!devices || devices.length === 0) {
    return res.status(404).json({ error: 'No subscribed devices for this phone' })
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/',
  })

  const results = await Promise.all(
    devices.map(async (d) => {
      try {
        await webpush.sendNotification(d.push_subscription, payload)
        return { device_id: d.device_id, platform: d.platform, ok: true }
      } catch (err) {
        const code = err && err.statusCode
        if (code === 404 || code === 410) {
          await admin
            .from('devices')
            .update({ push_subscription: null })
            .eq('id', d.id)
        }
        return {
          device_id: d.device_id,
          platform: d.platform,
          ok: false,
          error: (err && err.body) || (err && err.message) || 'send failed',
        }
      }
    }),
  )

  const sent = results.filter((r) => r.ok).length
  return res.status(200).json({ sent, total: devices.length, results })
}
