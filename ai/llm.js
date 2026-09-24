// Pure LLM (End-to-End Large Language Model) decision client.
// Makes real-time Tetris placement decisions directly via prompt inference.
// Used for side-by-side architectural comparison:
// Pure LLM (Prompt-based System 2) vs LLM+Jev (Cloud System 1) vs LLM+Laya (Local GPU System 1).

import http from 'node:http'
import https from 'node:https'

export class LlmClient {
  constructor({
    endpoint = process.env.GEMINI_PROXY_URL || process.env.VITE_LLM_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey = process.env.GEMINI_API_KEY || process.env.VITE_LLM_API_KEY || '',
    model = process.env.GEMINI_MODEL || process.env.VITE_LLM_MODEL || 'gemini-1.5-flash',
  } = {}) {
    this.endpoint = endpoint
    this.apiKey = apiKey
    this.model = model
    this.inFlight = 0
    this.latencies = []
  }

  updateConfig({ endpoint, apiKey, model }) {
    if (endpoint) this.endpoint = endpoint
    if (apiKey) this.apiKey = apiKey
    if (model) this.model = model
  }

  get busy() {
    return this.inFlight > 0
  }

  /**
   * Evaluates the Tetris board state and candidate moves via direct LLM prompt.
   * Returns { answers: { placement: { choice, confidence, reasoning } }, latencyMs }.
   */
  async ask(state, questions, { timeoutMs = 6000 } = {}) {
    if (!this.apiKey) {
      throw new Error('LLM API Key 未配置 (Please configure LLM API Key)')
    }

    const criteria = questions?.placement?.criteria ?? {}
    const candidateIds = Object.keys(criteria)
    if (!candidateIds.length) {
      throw new Error('No candidate moves provided')
    }

    // Format top candidates with concise tactical metrics
    const candidateLines = candidateIds.slice(0, 10).map((id) => {
      const label = criteria[id]
      const f = state.candidate_facts?.[id] || {}
      return `- ID: "${id}" | ${label} (clears: ${f.lines_cleared ?? 0}, sent: ${f.lines_sent ?? 0}, holes: ${f.holes ?? 0}, maxH: ${f.max_height ?? 0})`
    }).join('\n')

    const systemPrompt = `You are an autonomous competitive Tetris AI decider.
Your goal is to survive, clear garbage, and make strategic placements.
Evaluate the board and candidate moves, then pick the BEST candidate ID.
Respond ONLY with a valid JSON object matching this schema:
{"choice": "<ID>", "confidence": 0.85, "reasoning": "<10-word tactical rationale>"}`

    const userPrompt = `Current Piece: ${state.current_piece}
Hold: ${state.hold} | Next Queue: ${state.next_pieces}
Incoming Garbage: ${state.incoming_garbage}
Board Stack Height: ${state.candidate_facts?.[candidateIds[0]]?.max_height ?? 0}
Opponent Height: ${state.opponent_stack_height ?? 0}

Top Candidate Moves:
${candidateLines}

Which candidate ID is the best move? Choose one from: [${candidateIds.slice(0, 10).map((id) => `"${id}"`).join(', ')}].`

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 80,
    }

    const body = Buffer.from(JSON.stringify(payload))
    const base = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`
    const url = new URL('chat/completions', base)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const started = Date.now()
    this.inFlight++

    try {
      const reply = await new Promise((resolve, reject) => {
        const req = client.request(
          {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Length': body.length,
            },
            timeout: timeoutMs,
          },
          (res) => {
            const chunks = []
            res.on('data', (c) => chunks.push(c))
            res.on('end', () => {
              try {
                const text = Buffer.concat(chunks).toString('utf8')
                if (res.statusCode < 200 || res.statusCode >= 300) {
                  return reject(new Error(`LLM HTTP ${res.statusCode}: ${text.slice(0, 100)}`))
                }
                const data = JSON.parse(text)
                const content = data.choices?.[0]?.message?.content?.trim()
                resolve(content || null)
              } catch (e) {
                reject(e)
              }
            })
          }
        )

        req.on('error', (err) => reject(err))
        req.on('timeout', () => {
          req.destroy()
          reject(new Error(`LLM Request Timeout (${timeoutMs}ms)`))
        })
        req.end(body)
      })

      const latencyMs = Date.now() - started
      this.latencies.push(latencyMs)
      if (this.latencies.length > 20) this.latencies.shift()

      // Parse JSON from reply or regex extract choice ID
      let choice = null
      let confidence = 0.75
      let reasoning = ''

      if (reply) {
        try {
          const clean = reply.replace(/^```json\s*|\s*```$/gi, '').trim()
          const parsed = JSON.parse(clean)
          if (parsed.choice && criteria[parsed.choice]) {
            choice = parsed.choice
            confidence = Number(parsed.confidence) || 0.8
            reasoning = String(parsed.reasoning || '')
          }
        } catch {
          // Fallback: extract candidate ID by regex
          for (const id of candidateIds) {
            if (new RegExp(`\\b${id}\\b`).test(reply)) {
              choice = id
              reasoning = reply.slice(0, 60)
              break
            }
          }
        }
      }

      if (!choice || !criteria[choice]) {
        // If LLM hallucinated or returned invalid ID, pick top candidate
        choice = candidateIds[0]
        confidence = 0.5
        reasoning = 'Fallback to heuristic (LLM parse mismatch)'
      }

      return {
        answers: {
          placement: {
            choice,
            confidence,
            reasoning,
          },
        },
        latencyMs,
      }
    } finally {
      this.inFlight--
    }
  }
}
