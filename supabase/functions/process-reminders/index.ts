import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidEmail = Deno.env.get('VAPID_EMAIL') ?? 'mailto:notifications@pendy.app'
const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ─── VAPID helpers (Web Crypto API — no npm dependency) ───────────────────────

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function buildVapidHeaders(
  endpoint: string,
  privateKeyB64: string,
  publicKeyB64: string,
  email: string
): Promise<{ Authorization: string; 'Crypto-Key': string }> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60 // 12h

  const header = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  )
  const payload = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp, sub: email }))
  )
  const sigInput = `${header}.${payload}`

  // Import private key (raw 32-byte scalar as PKCS8)
  const rawPriv = base64urlToUint8Array(privateKeyB64)

  // Build PKCS8 DER for P-256 private key from raw scalar
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, // SEQUENCE
    0x02, 0x01, 0x00, // INTEGER version=0
    0x30, 0x13, // SEQUENCE
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x27, // OCTET STRING
    0x30, 0x25, // SEQUENCE
    0x02, 0x01, 0x01, // INTEGER version=1
    0x04, 0x20, // OCTET STRING (32 bytes key)
  ])
  const pkcs8 = new Uint8Array(pkcs8Header.length + rawPriv.length)
  pkcs8.set(pkcs8Header)
  pkcs8.set(rawPriv, pkcs8Header.length)

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(sigInput)
  )

  const sig = uint8ArrayToBase64url(new Uint8Array(sigBytes))
  const jwt = `${sigInput}.${sig}`

  return {
    Authorization: `vapid t=${jwt},k=${publicKeyB64}`,
    'Crypto-Key': `p256ecdsa=${publicKeyB64}`,
  }
}

// ─── Send a Web Push notification ────────────────────────────────────────────

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ ok: boolean; status?: number }> {
  // Encrypt payload using ECDH + AES-128-GCM (RFC 8291)
  const encrypted = await encryptPayload(sub.p256dh, sub.auth, payload)

  const vapidHeaders = await buildVapidHeaders(
    sub.endpoint,
    vapidPrivateKey,
    vapidPublicKey,
    vapidEmail
  )

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      ...vapidHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body: encrypted,
  })

  return { ok: res.ok, status: res.status }
}

// ─── RFC 8291 AES-128-GCM payload encryption ─────────────────────────────────

async function encryptPayload(
  p256dhB64: string,
  authB64: string,
  plaintext: string
): Promise<Uint8Array> {
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )
  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey)
  )

  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    base64urlToUint8Array(p256dhB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeys.privateKey,
      256
    )
  )

  const authSecret = base64urlToUint8Array(authB64)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF
  const ikm = await hkdf(authSecret, sharedSecret, buildInfo('auth', new Uint8Array(0)), 32)
  const cek = await hkdf(salt, ikm, buildInfo('aesgcm128', serverPublicRaw), 16)
  const nonce = await hkdf(salt, ikm, buildInfo('nonce', serverPublicRaw), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const data = new TextEncoder().encode(plaintext)

  // Padding: 2-byte pad length (0) + data
  const padded = new Uint8Array(2 + data.length)
  padded.set(data, 2)

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, padded)
  )

  // aes128gcm record: salt(16) + rs(4) + keyid_len(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096, false)
  const result = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length)
  let offset = 0
  result.set(salt, offset); offset += 16
  result.set(rs, offset); offset += 4
  result[offset] = 65; offset += 1
  result.set(serverPublicRaw, offset); offset += 65
  result.set(ciphertext, offset)
  return result
}

function buildInfo(type: string, context: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode(`Content-Encoding: ${type}\0`)
  const info = new Uint8Array(label.length + context.length)
  info.set(label)
  info.set(context, label.length)
  return info
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, keyMaterial, length * 8)
  )
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Validate cron secret (skip if not configured for manual testing)
  if (cronSecret) {
    const auth = req.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const now = new Date().toISOString()

  // Get pending reminders with task info
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id, user_id, task_id, tasks(title)')
    .eq('is_sent', false)
    .eq('type', 'push')
    .lte('remind_at', now)
    .limit(100)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!reminders || reminders.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0

  for (const reminder of reminders) {
    // Get push subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', reminder.user_id)

    if (!subs || subs.length === 0) {
      // No subscriptions — mark as sent anyway to avoid retrying endlessly
      await supabase.from('reminders').update({ is_sent: true }).eq('id', reminder.id)
      continue
    }

    const task = reminder.tasks as { title: string } | null
    const payload = JSON.stringify({
      title: 'Pendy — Recordatorio',
      body: task?.title ?? 'Tienes una tarea pendiente',
      url: `/app/task/${reminder.task_id}`,
      tag: `reminder-${reminder.id}`,
    })

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        const res = await sendPush(sub, payload)
        if (!res.ok && res.status === 410) {
          // Subscription expired — remove it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
        return res
      })
    )

    const anySucceeded = results.some(
      (r) => r.status === 'fulfilled' && r.value.ok
    )

    if (anySucceeded) {
      sent++
    } else {
      failed++
    }

    // Mark as sent regardless (avoid infinite retries)
    await supabase.from('reminders').update({ is_sent: true }).eq('id', reminder.id)
  }

  return new Response(
    JSON.stringify({ processed: reminders.length, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
