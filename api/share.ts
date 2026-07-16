import { Redis } from '@upstash/redis'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('', { status: 405 })
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
  const data = await req.text()
  const id = Math.random().toString(36).slice(2, 10)
  await redis.set(id, data, { ex: 60 * 60 * 24 * 90 })
  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
