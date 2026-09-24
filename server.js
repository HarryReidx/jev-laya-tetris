// Human vs Jev / Laya: Tetris decision endpoint & static server.
// High-performance real-time decision evaluation for Jev (Cloud System 1)
// and Laya (Local TITAN RTX ModernBERT), plus live Gemini AI commentary
// and dynamic service re-configuration.

import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { COLS, ROWS } from './engine/pieces.js'
import { JevClient, loadEnv } from './ai/jev.js'
import { LayaClient, buildLayaDecision, combineWithPrior } from './ai/laya.js'
import { CommentaryEngine } from './ai/commentary.js'
import {
  candidatesFor, buildBattleState, buildBattleQuestions, readBattleDecision,
} from './ai/battle.js'

loadEnv()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8089)

const REQUEST_MS = 6_000
const BODY_MAX = 64 * 1024

const DECIDER = process.env.DECIDER === 'laya' ? 'laya' : 'jev'
const clients = { laya: new LayaClient() }
const commentary = new CommentaryEngine()
let jevError = null
try {
  clients.jev = new JevClient()
} catch (err) {
  jevError = err.message
}

function mask(k) {
  if (!k) return ''
  if (k.length <= 8) return '****'
  return `${k.slice(0, 4)}...${k.slice(-4)}`
}

function updateEnvFile(newValues) {
  const envPath = path.resolve(__dirname, '.env')
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  for (const [key, val] of Object.entries(newValues)) {
    if (val === undefined || val === null || String(val).includes('...')) continue
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${val}`)
    } else {
      content += `\n${key}=${val}`
    }
    process.env[key] = String(val)
  }
  fs.writeFileSync(envPath, content.trim() + '\n')
}

// --- Tetris decisions -----------------------------------------------------------

const TYPES = new Set(['I', 'O', 'T', 'S', 'Z', 'J', 'L'])

function parsePosition(body) {
  const p = JSON.parse(body)
  const okBoard =
    Array.isArray(p.board) &&
    p.board.length === ROWS &&
    p.board.every((r) => Array.isArray(r) && r.length === COLS)
  if (!okBoard) throw new Error('board must be ROWS x COLS')
  if (!p.current || !TYPES.has(p.current.type)) throw new Error('bad current piece')
  for (const k of ['rot', 'x', 'y']) {
    if (!Number.isInteger(p.current[k])) throw new Error(`bad current.${k}`)
  }
  if (!Array.isArray(p.queue) || !p.queue.every((t) => TYPES.has(t))) throw new Error('bad queue')
  if (p.hold != null && !TYPES.has(p.hold)) throw new Error('bad hold')
  return {
    board: p.board.map((r) => r.map((c) => (c ? String(c).slice(0, 1) : null))),
    current: { type: p.current.type, rot: p.current.rot, x: p.current.x, y: p.current.y },
    hold: p.hold ?? null,
    queue: p.queue.slice(0, 12),
    canHold: p.canHold !== false,
    combo: Number.isInteger(p.combo) ? p.combo : -1,
    b2b: Number.isInteger(p.b2b) ? p.b2b : -1,
    incoming: Number(p.incoming) || 0,
    opponent: p.opponent && Number.isFinite(p.opponent.maxHeight) ? { maxHeight: p.opponent.maxHeight } : null,
  }
}

const wire = (c) => ({
  id: c.id, useHold: c.useHold, type: c.type, rot: c.rot, x: c.x, y: c.y,
  spin: c.spin, cells: c.cells, path: c.path, sent: c.sent, lines: c.lines, label: c.label,
})

let decided = 0

async function decide(pos, model) {
  const client = clients[model]
  const found = candidatesFor(pos)
  const { total, heuristic } = found
  if (!found.candidates.length) return { choice: null, options: 0, total }

  let candidates, state, questions
  if (model === 'laya') {
    ;({ candidates, state, questions } = buildLayaDecision(pos, found.candidates))
  } else {
    candidates = found.candidates
    state = buildBattleState(pos, candidates, pos.opponent)
    questions = buildBattleQuestions(candidates)
  }

  let d = null
  let error = null
  try {
    if (!client) throw new Error(jevError ?? `unknown model ${model}`)
    let response = await client.ask(state, questions, { timeoutMs: REQUEST_MS, retries: 0 })
    if (model === 'laya') response = combineWithPrior(response, candidates)
    d = readBattleDecision(response, candidates)
    d.modelChoice = response.answers?.placement?.layaChoice ?? null
  } catch (err) {
    error = err.message
  }

  const fallback = !d?.chosen
  const chosen = fallback ? heuristic : d.chosen
  const probs = d?.probabilities
    ? Object.entries(d.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([id, p]) => ({ id, p, label: candidates.find((c) => c.id === id)?.label ?? id }))
    : null

  decided++
  console.log(
    `  [TETRIS #${String(decided).padStart(4)}] ${model.padEnd(4)} ${chosen.type} ${chosen.id.padEnd(12)}` +
      ` sends ${chosen.sent} conf ${(d?.confidence ?? 0).toFixed(2)} ${String(d?.latencyMs ?? '--').padStart(4)}ms` +
      `${fallback ? `  FALLBACK (${error})` : ''}`
  )

  return {
    choice: wire(chosen),
    confidence: d?.confidence ?? null,
    probabilities: probs,
    latencyMs: d?.latencyMs ?? null,
    options: candidates.length,
    total,
    fallback,
    error,
    overruled: d?.modelChoice && d.modelChoice !== chosen.id
      ? candidates.find((c) => c.id === d.modelChoice)?.label ?? d.modelChoice
      : null,
  }
}

// --- Health & Config ------------------------------------------------------------

async function health() {
  let laya
  try {
    const res = await fetch(new URL('/health', clients.laya.baseUrl), { signal: AbortSignal.timeout(2000) })
    const data = await res.json().catch(() => ({}))
    laya = {
      ok: res.ok,
      model: data.default_model ?? clients.laya.model,
      device: data.device ?? 'gpu',
      gpu_name: data.gpu_name ?? 'NVIDIA TITAN RTX',
      ...clients.laya.stats(),
    }
  } catch (err) {
    laya = { ok: false, error: err.message, ...clients.laya.stats() }
  }
  const jev = clients.jev
    ? { ok: true, model: clients.jev.model, ...clients.jev.stats() }
    : { ok: false, error: jevError }
  return {
    ok: true,
    model: DECIDER,
    models: { jev, laya },
    commentary: {
      ok: Boolean(commentary.apiKey),
      model: commentary.model,
      endpoint: commentary.endpoint,
    },
  }
}

// --- HTTP ------------------------------------------------------------------------

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }

const STATIC = {
  '/': 'public/index.html',
  '/app.js': 'public/app.js',
  '/i18n.js': 'public/i18n.js',
  '/style.css': 'public/style.css',
  '/render.js': 'public/render.js',
  '/input.js': 'public/input.js',
  '/bot.js': 'public/bot.js',
  '/predict.js': 'public/predict.js',
  '/engine/pieces.js': 'engine/pieces.js',
  '/engine/engine.js': 'engine/engine.js',
  '/engine/rules.js': 'engine/rules.js',
  '/engine/rng.js': 'engine/rng.js',
  '/engine/search.js': 'engine/search.js',
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  // 1. Commentary
  if (req.method === 'POST' && url.pathname === '/commentary') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > BODY_MAX) req.destroy()
    })
    req.on('end', async () => {
      try {
        const state = JSON.parse(body || '{}')
        const result = await commentary.commentate(state)
        json(res, 200, { ok: true, comment: result })
      } catch (err) {
        json(res, 500, { ok: false, error: err.message })
      }
    })
    return
  }

  // 2. Tetris Decision
  if (req.method === 'POST' && url.pathname === '/decide') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > BODY_MAX) req.destroy()
    })
    req.on('end', async () => {
      let pos
      try {
        pos = parsePosition(body)
      } catch (err) {
        return json(res, 400, { error: err.message })
      }
      try {
        const model = url.searchParams.get('model') ?? DECIDER
        if (!(model in clients) && model !== 'jev') return json(res, 400, { error: `unknown model ${model}` })
        json(res, 200, await decide(pos, model))
      } catch (err) {
        console.error('  ! decide failed:', err)
        json(res, 500, { error: err.message })
      }
    })
    return
  }

  // 3. Config Get
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return json(res, 200, {
      ok: true,
      llm: {
        endpoint: commentary.endpoint,
        model: commentary.model,
        apiKey: mask(commentary.apiKey),
        hasKey: Boolean(commentary.apiKey),
      },
      laya: {
        baseUrl: clients.laya.baseUrl,
        model: clients.laya.model,
        path: clients.laya.path,
      },
      jev: {
        baseUrl: clients.jev?.baseUrl ?? 'https://api.typesafe.ai',
        model: clients.jev?.model ?? 'jev-latest',
        apiKey: mask(clients.jev?.apiKey),
        hasKey: Boolean(clients.jev?.apiKey),
      },
    })
  }

  // 4. Config Post (Update)
  if (req.method === 'POST' && url.pathname === '/api/config') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > BODY_MAX) req.destroy()
    })
    req.on('end', async () => {
      try {
        const cfg = JSON.parse(body || '{}')
        const envUpdates = {}

        if (cfg.llm) {
          if (cfg.llm.endpoint) {
            commentary.endpoint = cfg.llm.endpoint
            envUpdates.GEMINI_PROXY_URL = cfg.llm.endpoint
          }
          if (cfg.llm.model) {
            commentary.model = cfg.llm.model
            envUpdates.GEMINI_MODEL = cfg.llm.model
          }
          if (cfg.llm.apiKey && !cfg.llm.apiKey.includes('...')) {
            commentary.apiKey = cfg.llm.apiKey
            envUpdates.GEMINI_API_KEY = cfg.llm.apiKey
          }
        }

        if (cfg.laya) {
          if (cfg.laya.baseUrl) envUpdates.LAYA_URL = cfg.laya.baseUrl
          if (cfg.laya.model) envUpdates.LAYA_MODEL = cfg.laya.model
          if (cfg.laya.path) envUpdates.LAYA_PATH = cfg.laya.path
          clients.laya = new LayaClient({
            baseUrl: cfg.laya.baseUrl || clients.laya.baseUrl,
            model: cfg.laya.model || clients.laya.model,
          })
        }

        if (cfg.jev) {
          if (cfg.jev.baseUrl) envUpdates.TYPESAFE_BASE_URL = cfg.jev.baseUrl
          if (cfg.jev.apiKey && !cfg.jev.apiKey.includes('...')) {
            envUpdates.TYPESAFE_API_KEY = cfg.jev.apiKey
          }
          try {
            clients.jev = new JevClient({
              baseUrl: cfg.jev.baseUrl || clients.jev?.baseUrl,
              apiKey: cfg.jev.apiKey && !cfg.jev.apiKey.includes('...') ? cfg.jev.apiKey : clients.jev?.apiKey,
              model: cfg.jev.model || clients.jev?.model,
            })
            jevError = null
          } catch (err) {
            jevError = err.message
          }
        }

        updateEnvFile(envUpdates)
        json(res, 200, { ok: true, message: '配置已更新并实时生效' })
      } catch (err) {
        json(res, 500, { ok: false, error: err.message })
      }
    })
    return
  }

  // 5. Test Service Connectivity
  if (req.method === 'POST' && url.pathname === '/api/test-service') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > BODY_MAX) req.destroy()
    })
    req.on('end', async () => {
      try {
        const { service, config = {} } = JSON.parse(body || '{}')
        const started = Date.now()

        if (service === 'laya') {
          const targetUrl = new URL('/health', config.baseUrl || clients.laya.baseUrl)
          const testRes = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) })
          const latencyMs = Date.now() - started
          const data = await testRes.json().catch(() => ({}))
          if (testRes.ok) {
            return json(res, 200, {
              ok: true,
              latencyMs,
              message: `LAYA 服务在线 (${data.gpu_name || 'TITAN RTX'}, 耗时 ${latencyMs}ms)`,
            })
          }
          return json(res, 400, { ok: false, error: `LAYA 返回状态码 ${testRes.status}` })
        }

        if (service === 'llm') {
          const endpoint = config.endpoint || commentary.endpoint
          const base = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
          const urlObj = new URL('chat/completions', base)
          const key = config.apiKey && !config.apiKey.includes('...') ? config.apiKey : commentary.apiKey
          const modelName = config.model || commentary.model

          const testPayload = {
            model: modelName,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }

          const testRes = await fetch(urlObj, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(8000),
          })
          const latencyMs = Date.now() - started
          if (testRes.ok) {
            return json(res, 200, {
              ok: true,
              latencyMs,
              message: `LLM 连通成功 (${modelName}, 耗时 ${latencyMs}ms)`,
            })
          }
          const errText = await testRes.text()
          return json(res, 400, { ok: false, error: `HTTP ${testRes.status}: ${errText.slice(0, 80)}` })
        }

        if (service === 'jev') {
          const baseUrl = config.baseUrl || clients.jev?.baseUrl || 'https://api.typesafe.ai'
          const key = config.apiKey && !config.apiKey.includes('...') ? config.apiKey : clients.jev?.apiKey
          const testRes = await fetch(new URL('/v1/systemone', baseUrl), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: config.model || 'jev-latest',
              state: { ping: true },
              questions: { q: { type: 'choice', instructions: 'choose', criteria: { A: 'A' } } },
            }),
            signal: AbortSignal.timeout(6000),
          })
          const latencyMs = Date.now() - started
          if (testRes.ok) {
            return json(res, 200, {
              ok: true,
              latencyMs,
              message: `JEV 云端连通成功 (耗时 ${latencyMs}ms)`,
            })
          }
          const errText = await testRes.text()
          return json(res, 400, { ok: false, error: `JEV HTTP ${testRes.status}: ${errText.slice(0, 80)}` })
        }

        json(res, 400, { ok: false, error: `未知服务: ${service}` })
      } catch (err) {
        json(res, 500, { ok: false, error: err.message })
      }
    })
    return
  }

  // 6. Health
  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
    return health().then((h) => {
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end()
      } else {
        json(res, 200, h)
      }
    })
  }

  // 7. Static Assets
  const rel = STATIC[url.pathname]
  if ((req.method === 'GET' || req.method === 'HEAD') && rel) {
    const file = path.join(__dirname, rel)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'text/plain',
      'Cache-Control': 'no-store',
    })
    if (req.method === 'HEAD') {
      res.end()
    } else {
      res.end(fs.readFileSync(file))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`port ${PORT} is already in use.`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`Jev / Laya Tetris Battle  ->  http://localhost:${PORT}`)
  console.log(`jev  ${clients.jev ? `${clients.jev.model} via ${clients.jev.baseUrl}` : `unavailable: ${jevError}`}`)
  console.log(`laya ${clients.laya.model} via ${clients.laya.baseUrl}\n`)
})
