import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

const ssm = new SSMClient({})
const UEX_BASE = 'https://api.uexcorp.space/2.0'

// Cold-start cache: read SSM params once per Lambda container lifecycle
let uexToken = null
let cfSecret = null

async function getParam(name) {
  const { Parameter } = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  )
  return Parameter.Value
}

async function ensureSecrets() {
  if (!uexToken) {
    uexToken = await getParam(process.env.SSM_PARAM_UEX_TOKEN)
  }
  if (!cfSecret) {
    cfSecret = await getParam(process.env.SSM_PARAM_CF_SECRET)
  }
}

// In-memory response cache: path+query → { body, headers, ts }
const cache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const handler = async (event) => {
  try {
    await ensureSecrets()
  } catch (err) {
    console.error('Failed to load secrets:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration error' }) }
  }

  // Reject requests not from CloudFront
  const incomingSecret = event.headers?.['x-cf-secret']
  if (incomingSecret !== cfSecret) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  // Build upstream path: strip /api/uex prefix
  const rawPath = event.rawPath ?? event.path ?? '/'
  const upstreamPath = rawPath.replace(/^\/api\/uex\/?/, '')
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : ''
  const upstreamUrl = `${UEX_BASE}/${upstreamPath}${qs}`

  const cacheKey = `${upstreamPath}${qs}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      body: cached.body,
    }
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${uexToken}`,
  }
  if (process.env.UEX_CLIENT_VERSION) {
    headers['X-Client-Version'] = process.env.UEX_CLIENT_VERSION
  }

  const resp = await fetch(upstreamUrl, { headers })
  const body = await resp.text()

  if (resp.ok) {
    cache.set(cacheKey, { body, ts: Date.now() })
  }

  return {
    statusCode: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
    body,
  }
}
