import { Redis } from '@upstash/redis'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response('', { status: 400 })
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
  const data = await redis.get<string>(id)
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(typeof data === 'string' ? data : JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
