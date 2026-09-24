// Real-time AI Commentary powered by LLM (Gemini 3.8 Flash High / OpenAI compatible)
// Analyzes the dynamic battle state between Jev (Cloud System 1) and Laya (GPU Local System 1).

import http from 'node:http'
import https from 'node:https'

export class CommentaryEngine {
  constructor({
    endpoint = process.env.GEMINI_PROXY_URL || process.env.VITE_LLM_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey = process.env.GEMINI_API_KEY || process.env.VITE_LLM_API_KEY || '',
    model = process.env.GEMINI_MODEL || process.env.VITE_LLM_MODEL || 'gemini-1.5-flash',
  } = {}) {
    this.endpoint = endpoint
    this.apiKey = apiKey
    this.model = model
    this.lastCommentTime = 0
    this.minIntervalMs = 3500 // avoid spamming LLM
    this.history = []
  }

  updateConfig({ endpoint, apiKey, model }) {
    if (endpoint) this.endpoint = endpoint
    if (apiKey) this.apiKey = apiKey
    if (model) this.model = model
  }

  /**
   * Generates or fetches a tactical commentary for the current duel state.
   */
  async commentate(state) {
    const now = Date.now()
    if (now - this.lastCommentTime < this.minIntervalMs && !state.winner) {
      return this.history[this.history.length - 1] ?? null
    }
    this.lastCommentTime = now

    const gameType = state.game || 'tetris'

    let systemPrompt = ''
    if (gameType === 'snake') {
      systemPrompt = `你是一位专业且极具激情的贪吃蛇 AI 巅峰决战电竞解说员。
比赛双方是顶级 AI 决策引擎：
- 【TypeSafe Jev】：云端大模型 System 1，精于空间广度搜索 (BFS) 与长远死锁规避。
- 【Laya】：本地 TITAN RTX GPU ModernBERT，决策仅需 35-45ms，以极速变向与超高频吃苹果见长。
请根据当前双方蛇长、得分、陷阱危险度，输出一段 50~80 字的精彩快评（中文），热血、一针见血，无需多余客套话。`
    } else if (gameType === 'sokoban') {
      systemPrompt = `你是一位严谨幽默的推箱子 AI 解谜大赛官方解说。
参赛双方：
- 【TypeSafe Jev】：云端大模型，深谋远虑，善于推演多步箱子落位与死角规避。
- 【Laya】：本地 GPU ModernBERT，毫秒级即时推演，步频极高。
请根据双方完成箱子数、当前步数与死锁风险，输出一段 50~80 字的精妙快评（中文），点出战术差异。`
    } else {
      systemPrompt = `你是一位专业且极具激情的俄罗斯方块世界锦标赛 AI 解说员。
比赛双方是顶级决策大模型：
- 【TypeSafe Jev】：云端 System 1，沉稳老练，精于大局规划、Back-to-Back 连锁与 T-Spin Double 暴击。
- 【Laya】：本地 GPU ModernBERT (TITAN RTX)，决策仅 40ms，快如闪电，极速落子与消行防守。
请根据给定的实时局势，输出一段 50~80 字的精彩快评（中文），风格热血专业。`
    }

    try {
      const payload = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `当前实时战况：${JSON.stringify(state)}` },
        ],
        temperature: 0.7,
        max_tokens: 150,
      }

      const body = Buffer.from(JSON.stringify(payload))
      const base = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`
      const url = new URL('chat/completions', base)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const text = await new Promise((resolve, reject) => {
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
            timeout: 10000,
          },
          (res) => {
            const chunks = []
            res.on('data', (c) => chunks.push(c))
            res.on('end', () => {
              try {
                const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                const reply = data.choices?.[0]?.message?.content?.trim()
                resolve(reply || null)
              } catch (e) {
                reject(e)
              }
            })
          }
        )

        req.on('error', (err) => reject(err))
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Commentary request timeout'))
        })
        req.end(body)
      })

      if (text) {
        this.history.push(text)
        if (this.history.length > 20) this.history.shift()
        return text
      }
    } catch (err) {
      console.warn('Commentary generation failed:', err.message)
    }

    // Dynamic tactical fallback
    return this.generateFallbackCommentary(state, gameType)
  }

  generateFallbackCommentary(state, gameType) {
    if (state.winner) {
      return `🏁 比赛结束！【${state.winner}】在激烈的 AI 巅峰对决中力克对手，摘得桂冠！`
    }

    if (gameType === 'snake') {
      const jLen = state.jev?.length ?? 3
      const lLen = state.laya?.length ?? 3
      if (jLen > lLen + 3) return `🐍 JEV 凭借深层避障规划，蛇身迅速壮大到 ${jLen} 节，牢牢掌控场地中心！`
      if (lLen > jLen + 3) return `⚡ LAYA 凭借 40ms 超敏捷转向连续收割苹果，蛇长达到 ${lLen} 节反超领跑！`
      return `⚔️ 贪吃蛇胶着对峙！JEV 稳健寻路防自锁，LAYA 疾风骤雨穿插游走，双方互不相让！`
    }

    if (gameType === 'sokoban') {
      const jSolved = state.jev?.solved ?? 0
      const lSolved = state.laya?.solved ?? 0
      if (jSolved > lSolved) return `📦 JEV 率先破局，成功将关键箱子推入目标点位！大局观推演展露成效！`
      if (lSolved > jSolved) return `⚡ LAYA 步频极快，连续精准推移化解死角障碍，局势大好！`
      return `🧩 推箱子竞速白热化！双方正对核心交叉点展开深度推演，力避死角陷阱！`
    }

    // Tetris fallback
    const jH = state.jev?.height ?? 0
    const lH = state.laya?.height ?? 0
    if (jH > 14) return `⚠️ JEV 场地已堆积至 ${jH} 行危急线！正在深搜 T-Spin 爆发化解死局！`
    if (lH > 14) return `⚠️ LAYA 面临 ${lH} 行高位压制！TITAN RTX 40ms 极速防守展开狂风暴雨般的消行！`
    return `🔥 巅峰对局如火如荼！JEV 大局观战术蓄力，LAYA 极速落子防守，毫厘之间见真章！`
  }
}
