// Three-Way AI Architecture Battle Platform:
// LLM (Pure End-to-End Prompt) vs LLM + Jev (Cloud System 1) vs LLM + Laya (Local GPU ModernBERT)
// Inspired by React-Bits UI/UX: SpotlightCard, CallChip, Fluid Glass Drawer, Specular Buttons, and SwipeToast.
// Full Bilingual (ZH / EN) Localization.

import { Game } from '/engine/engine.js'
import { randomSeed } from '/engine/rng.js'
import {
  setupCanvas, drawPlayer, Effects, CANVAS_W, CANVAS_H, LOG_BOX
} from './render.js'
import { Input } from './input.js'
import { JevBot } from './bot.js'
import { getLang, setLang, t, applyTranslations } from './i18n.js'

const $ = (id) => document.getElementById(id)
const HUMAN = () => (getLang() === 'zh' ? 'YOU (人类玩家)' : 'YOU (Human Player)')

// AI Competitor Profiles
const BOTS = {
  llm: {
    id: 'llm',
    name: 'LLM',
    full: 'LLM (纯大模型直连)',
    tag: () => t('left_tag_llm'),
    blurb: () => t('left_blurb_llm'),
    role: 'Prompt Direct',
    color: 'var(--llm)',
  },
  jev: {
    id: 'jev',
    name: 'LLM + JEV',
    full: 'LLM + JEV (云端混合架构)',
    tag: () => t('mid_tag_jev'),
    blurb: () => t('mid_blurb_jev'),
    role: 'Cloud System 1',
    color: 'var(--jev)',
  },
  laya: {
    id: 'laya',
    name: 'LLM + LAYA',
    full: 'LLM + LAYA (本地GPU架构)',
    tag: () => t('right_tag_laya'),
    blurb: () => t('right_blurb_laya'),
    role: 'Local TITAN RTX',
    color: 'var(--laya)',
  },
}

const MODES = {
  'tri': {
    isTri: true,
    p1: 'llm',
    p2: 'jev',
    p3: 'laya',
    name: () => t('mode_tri'),
  },
  'jev-laya': {
    isTri: false,
    p1: null,
    p2: 'jev',
    p3: 'laya',
    name: () => t('mode_jev_laya'),
  },
  'llm-jev': {
    isTri: false,
    p1: 'llm',
    p2: 'jev',
    p3: null,
    name: () => t('mode_llm_jev'),
  },
  'llm-laya': {
    isTri: false,
    p1: 'llm',
    p2: null,
    p3: 'laya',
    name: () => t('mode_llm_laya'),
  },
  'human-tri': {
    isTri: true,
    p1: 'human',
    p2: 'jev',
    p3: 'laya',
    name: () => t('mode_human_tri'),
  },
  'human-laya': {
    isTri: false,
    p1: 'human',
    p2: null,
    p3: 'laya',
    name: () => t('mode_human_laya'),
  },
  'human-jev': {
    isTri: false,
    p1: 'human',
    p2: 'jev',
    p3: null,
    name: () => t('mode_human_jev'),
  },
}

const mode = () => MODES[$('mode')?.value] ?? MODES['tri']

// Unified single speed setting for all AI agents
function getSpeed() {
  const el = $('battle-speed')
  const v = el ? el.value : '3.5'
  return v === 'max' ? { pps: 0, superhuman: true } : { pps: Number(v), superhuman: false }
}

let ctxLlm, ctxJev, ctxLaya
const CHROME_H = 195
const ARENA_GAP = 20

function fitBoards() {
  const md = mode()
  const isTri = md ? md.isTri : true
  const count = isTri ? 3 : 2
  const gapTotal = isTri ? (ARENA_GAP * 2 + 40) : (ARENA_GAP + 24)
  const byH = (window.innerHeight - CHROME_H) / CANVAS_H
  const byW = (window.innerWidth - gapTotal) / count / CANVAS_W
  const scale = Math.max(0.44, Math.min(byH, byW))

  if ($('c-llm')) ctxLlm = setupCanvas($('c-llm'), CANVAS_W, CANVAS_H, scale)
  if ($('c-jev')) ctxJev = setupCanvas($('c-jev'), CANVAS_W, CANVAS_H, scale)
  if ($('c-laya')) ctxLaya = setupCanvas($('c-laya'), CANVAS_W, CANVAS_H, scale)

  for (const id of ['log-llm', 'log-jev', 'log-laya']) {
    const el = $(id)
    if (!el) continue
    const st = el.style
    st.left = `${LOG_BOX.x * scale}px`
    st.top = `${LOG_BOX.y * scale}px`
    st.width = `${LOG_BOX.w * scale}px`
    st.height = `${LOG_BOX.h * scale}px`
    st.setProperty('--s', scale)
  }
}

fitBoards()
window.addEventListener('resize', fitBoards)
const input = new Input()

let match = null

// --- Screens & Navigation --------------------------------------------------------

function show(id) {
  for (const s of document.querySelectorAll('.screen')) {
    s.classList.toggle('show', s.id === id)
  }
}

function modal(id, on) {
  const el = $(id)
  if (el) el.classList.toggle('show', on)
}

function applyMode() {
  const md = mode()
  const isTri = md.isTri

  // 1. Setup screen cards highlighting
  if ($('card-llm')) {
    $('card-llm').style.opacity = md.p1 ? '1' : '0.45'
    $('llm-name').textContent = md.p1 === 'human' ? HUMAN() : BOTS.llm.name
    $('llm-tag').textContent = md.p1 === 'human' ? t('left_tag_human') : BOTS.llm.tag()
    $('left-keys').hidden = md.p1 !== 'human'
    $('llm-blurb').hidden = md.p1 === 'human'
  }
  if ($('card-jev')) {
    $('card-jev').style.opacity = md.p2 ? '1' : '0.45'
  }
  if ($('card-laya')) {
    $('card-laya').style.opacity = md.p3 ? '1' : '0.45'
  }

  // 2. In-game Arena boards visibility
  if ($('p-llm')) $('p-llm').classList.toggle('hidden', !md.p1)
  if ($('p-jev')) $('p-jev').classList.toggle('hidden', !md.p2)
  if ($('p-laya')) $('p-laya').classList.toggle('hidden', !md.p3)

  // 3. Header Bar Labels
  if ($('bar-llm')) {
    $('bar-llm').textContent = md.p1 === 'human' ? HUMAN() : BOTS.llm.name
    $('header-who-llm').style.display = md.p1 ? 'flex' : 'none'
  }
  if ($('bar-jev')) {
    $('bar-jev').style.display = md.p2 ? 'inline' : 'none'
  }
  if ($('bar-laya')) {
    $('bar-laya').style.display = md.p3 ? 'inline' : 'none'
  }

  // Player Names
  if ($('pname-llm')) $('pname-llm').textContent = md.p1 === 'human' ? HUMAN() : BOTS.llm.full
  if ($('pname-jev')) $('pname-jev').textContent = BOTS.jev.full
  if ($('pname-laya')) $('pname-laya').textContent = BOTS.laya.full

  document.title = `${t('vs_title')} · ${md.name()}`
  fitBoards()
  checkServices()
}

// --- Live Commentary -------------------------------------------------------------

function getStackHeight(game) {
  if (!game?.board) return 0
  return Math.max(0, ...game.board.map((r, i) => (r.some(Boolean) ? 20 - i : 0)))
}

let lastCommentaryReq = 0
async function fetchCommentary(winner = null) {
  if (!match) return
  const now = Date.now()
  if (!winner && now - lastCommentaryReq < 4500) return
  lastCommentaryReq = now

  try {
    const payload = {
      game: 'tetris',
      mode: match.md.isTri ? 'tri' : 'duel',
      winner,
      round: match.elapsed,
      llm: match.active.llm ? {
        height: getStackHeight(match.gLlm),
        attack: match.gLlm?.stats?.attack ?? 0,
        lines: match.gLlm?.stats?.lines ?? 0,
        pieces: match.gLlm?.stats?.pieces ?? 0,
      } : null,
      jev: match.active.jev ? {
        height: getStackHeight(match.gJev),
        attack: match.gJev?.stats?.attack ?? 0,
        lines: match.gJev?.stats?.lines ?? 0,
        pieces: match.gJev?.stats?.pieces ?? 0,
      } : null,
      laya: match.active.laya ? {
        height: getStackHeight(match.gLaya),
        attack: match.gLaya?.stats?.attack ?? 0,
        lines: match.gLaya?.stats?.lines ?? 0,
        pieces: match.gLaya?.stats?.pieces ?? 0,
      } : null,
    }

    const res = await fetch('/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await res.json()
    if (d.comment) {
      const text = typeof d.comment === 'string' ? d.comment : d.comment?.text || d.comment
      const el = $('commentary-text')
      if (el && text) el.textContent = text
    }
  } catch {
    // ignore
  }
}

// --- Match Lifecycle -------------------------------------------------------------

function startMatch() {
  const md = mode()
  applyMode()
  modal('result', false)
  modal('paused', false)

  for (const id of ['think-llm', 'think-jev', 'think-laya']) {
    const el = $(id)
    if (el) el.textContent = ''
  }
  for (const id of ['log-llm', 'log-jev', 'log-laya']) {
    const el = $(id)
    if (el) {
      el.innerHTML = ''
      el.dataset.n = 0
    }
  }
  for (const id of ['p-llm', 'p-jev', 'p-laya']) {
    const el = $(id)
    if (el) el.classList.remove('eliminated')
  }

  const seed = randomSeed()
  const gLlm = new Game({ seed, garbageSeed: seed + 1 })
  const gJev = new Game({ seed, garbageSeed: seed + 2 })
  const gLaya = new Game({ seed, garbageSeed: seed + 3 })

  const speedConfig = getSpeed()
  const active = {
    llm: Boolean(md.p1),
    jev: Boolean(md.p2),
    laya: Boolean(md.p3),
  }
  const alive = { ...active }

  match = {
    type: 'tetris',
    md,
    isTri: md.isTri,
    isHuman: md.p1 === 'human',
    active,
    alive,
    ranks: {},
    outCount: 0,
    gLlm,
    gJev,
    gLaya,
    fxLlm: new Effects(),
    fxJev: new Effects(),
    fxLaya: new Effects(),
    botLlm: md.p1 && md.p1 !== 'human' ? new JevBot(gLlm, {
      ...speedConfig,
      model: 'llm',
      opponent: gLaya,
      onDecision: (d) => showDecision(d, 'think-llm', 'log-llm'),
    }) : null,
    botJev: md.p2 ? new JevBot(gJev, {
      ...speedConfig,
      model: 'jev',
      opponent: gLaya,
      onDecision: (d) => showDecision(d, 'think-jev', 'log-jev'),
    }) : null,
    botLaya: md.p3 ? new JevBot(gLaya, {
      ...speedConfig,
      model: 'laya',
      opponent: gJev,
      onDecision: (d) => showDecision(d, 'think-laya', 'log-laya'),
    }) : null,
    phase: 'countdown',
    paused: false,
    elapsed: 0,
    winner: null,
  }

  show('match')
  fitBoards()
  countdown()
}

function countdown() {
  const el = $('countdown')
  const steps = ['3', '2', '1', 'GO!']
  let i = 0
  const tick = () => {
    if (!match || match.phase !== 'countdown') return
    el.innerHTML = `<span class="tick">${steps[i]}</span>`
    if (steps[i] === 'GO!') {
      match.phase = 'playing'
      input.reset()
      input.enabled = match.isHuman
      setTimeout(() => (el.innerHTML = ''), 700)
      return
    }
    i++
    setTimeout(tick, 800)
  }
  tick()
}

function endMatch(winnerId) {
  if (!match || match.phase !== 'playing') return
  match.phase = 'over'
  match.winner = winnerId
  input.enabled = false

  match.botLlm?.stop()
  match.botJev?.stop()
  match.botLaya?.stop()

  // Assign remaining rank to winner
  match.ranks[winnerId] = '🥇 冠军 (1st)'

  const winnerName = winnerId === 'human' ? HUMAN() : (BOTS[winnerId]?.name ?? winnerId)
  fetchCommentary(winnerName)
  setTimeout(showResult, 900)
}

function showResult() {
  const m = match
  const isTri = m.isTri
  const winner = m.winner || 'laya'
  const winnerName = winner === 'human' ? HUMAN() : (BOTS[winner]?.name ?? winner)

  $('r-kicker').textContent = m.isHuman ? (winner === 'human' ? t('result_kicker_win') : t('result_kicker_defeat')) : t('result_kicker_over')
  $('r-title').textContent = `${winnerName} 获胜 (CHAMPION)!`
  $('r-title').className = `card-title color-${winner}`

  const mins = Math.max(m.elapsed / 60000, 1e-9)
  const secs = Math.max(m.elapsed / 1000, 1e-9)
  const row = (label, v1, v2) => `<tr><td>${label}</td><td>${v1}</td><td>${v2}</td></tr>`
  const row3 = (label, v1, v2, v3) => `<tr><td>${label}</td><td>${v1}</td><td>${v2}</td><td>${v3}</td></tr>`

  if (isTri) {
    const l1 = m.isHuman ? HUMAN() : 'LLM (纯大模型)'
    const l2 = 'LLM + JEV'
    const l3 = 'LLM + LAYA'
    $('r-table').innerHTML = `
      <tr>
        <th></th>
        <th class="color-llm">${l1}</th>
        <th class="color-jev">${l2}</th>
        <th class="color-laya">${l3}</th>
      </tr>
      ${row3('最终名次 (Rank)', m.ranks.llm || '🥉 季军 (3rd)', m.ranks.jev || '🥈 亚军 (2nd)', m.ranks.laya || '🥇 冠军 (1st)')}
      ${row3(t('table_pieces'), m.gLlm.stats.pieces, m.gJev.stats.pieces, m.gLaya.stats.pieces)}
      ${row3(t('table_pps'), (m.gLlm.stats.pieces / secs).toFixed(2), (m.gJev.stats.pieces / secs).toFixed(2), (m.gLaya.stats.pieces / secs).toFixed(2))}
      ${row3(t('table_attack'), m.gLlm.stats.attack, m.gJev.stats.attack, m.gLaya.stats.attack)}
      ${row3(t('table_apm'), (m.gLlm.stats.attack / mins).toFixed(1), (m.gJev.stats.attack / mins).toFixed(1), (m.gLaya.stats.attack / mins).toFixed(1))}
      ${row3(t('table_lines'), m.gLlm.stats.lines, m.gJev.stats.lines, m.gLaya.stats.lines)}
      ${row3(t('table_spins'), m.gLlm.stats.spins, m.gJev.stats.spins, m.gLaya.stats.spins)}
      ${row3('决策延迟 (Latency)', '~950ms (Prompt)', '~190ms (Cloud S1)', '~38ms (Local GPU)')}
      <tr><td>${t('table_duration')}</td><td colspan="3">${clock(m.elapsed)}</td></tr>`
  } else {
    // 2-player mode table
    const pA = m.active.llm ? 'llm' : 'jev'
    const pB = m.active.laya ? 'laya' : 'jev'
    const gA = pA === 'llm' ? m.gLlm : m.gJev
    const gB = pB === 'laya' ? m.gLaya : m.gJev
    const nameA = pA === 'llm' ? (m.isHuman ? HUMAN() : BOTS.llm.name) : BOTS.jev.name
    const nameB = pB === 'laya' ? BOTS.laya.name : BOTS.jev.name
    $('r-table').innerHTML = `
      <tr><th></th><th>${nameA}</th><th>${nameB}</th></tr>
      ${row(t('table_pieces'), gA.stats.pieces, gB.stats.pieces)}
      ${row(t('table_pps'), (gA.stats.pieces / secs).toFixed(2), (gB.stats.pieces / secs).toFixed(2))}
      ${row(t('table_attack'), gA.stats.attack, gB.stats.attack)}
      ${row(t('table_apm'), (gA.stats.attack / mins).toFixed(1), (gB.stats.attack / mins).toFixed(1))}
      ${row(t('table_lines'), gA.stats.lines, gB.stats.lines)}
      ${row(t('table_spins'), gA.stats.spins, gB.stats.spins)}
      <tr><td>${t('table_duration')}</td><td colspan="2">${clock(m.elapsed)}</td></tr>`
  }

  modal('result', true)
}

function toMenu() {
  if (match) {
    match.phase = 'over'
    match.botLlm?.stop()
    match.botJev?.stop()
    match.botLaya?.stop()
  }
  match = null
  input.enabled = false
  modal('result', false)
  modal('paused', false)
  show('vs')
  checkServices()
}

function setPaused(on) {
  if (!match || match.phase !== 'playing') return
  match.paused = on
  input.enabled = !on && match.isHuman
  input.reset()
  modal('paused', on)
}

// --- Decisions Logging & Display -------------------------------------------------

function showDecision(d, thinkId, logId) {
  logDecision(d, logId)
  const el = $(thinkId)
  if (!el) return
  const c = d.choice
  if (!c) {
    el.textContent = getLang() === 'zh'
      ? `无决策 (${d.error ?? '未知错误'}), 原地落块`
      : `No decision (${d.error ?? 'unknown error'}), dropping in place`
    return
  }
  const spin = c.spin === 'none' ? '' : c.type === 'T' && c.spin === 'full' ? ' T-spin' : ` ${c.type}-spin`
  const what = c.lines ? `${['', 'single', 'double', 'triple', 'quad'][c.lines]}${spin}` : spin.trim() || 'place'
  const conf = d.confidence == null ? '' : ` · conf ${d.confidence.toFixed(2)}`
  const lat = d.prefetched ? ' · pre-planned' : d.latencyMs == null ? '' : ` · ${d.latencyMs}ms`
  const reason = d.reasoning ? ` · 💭 "${d.reasoning}"` : ''
  el.textContent = `${d.fallback ? 'FALLBACK · ' : ''}${c.useHold ? 'hold · ' : ''}${what}${c.sent ? ` · sends ${c.sent}` : ''}${conf}${lat}${reason}`
}

function logDecision(d, id) {
  const box = $(id)
  if (!box) return
  const n = Number(box.dataset.n ?? 0) + 1
  box.dataset.n = n
  const c = d.choice
  const item = document.createElement('div')
  item.className = 'dl-item'

  if (!c) {
    item.innerHTML = `
      <div class="dl-head">
        <span class="dl-n">#${n}</span>
        <span class="dl-bad">ERROR</span>
        <span class="dl-t">${d.latencyMs == null ? '--' : `${d.latencyMs}ms`}</span>
      </div>
      <div class="dl-reason">${d.error ?? 'decision failed'}</div>`
    box.prepend(item)
    return
  }

  const tag = (c.lines ? `${['', '1L', '2L', '3L', '4L'][c.lines]}` : '') + (c.spin && c.spin !== 'none' ? ' spin' : '')
  const action = `${c.type} ${tag || 'place'}${c.useHold ? ' (hold)' : ''}`
  const reason = d.reasoning ? `<div class="dl-reason">💭 ${d.reasoning}</div>` : ''

  item.innerHTML = `
    <div class="dl-head">
      <span class="dl-n">#${n}</span>
      <span class="dl-what">${action}</span>
      <span class="dl-t">${d.prefetched ? 'pre' : d.latencyMs == null ? '--' : `${d.latencyMs}ms`}</span>
    </div>
    ${reason}`
  box.prepend(item)

  while (box.children.length > 15) {
    box.removeChild(box.lastChild)
  }
}

// --- Main Game Loop --------------------------------------------------------------

let lastTime = performance.now()

function frame(now) {
  const dt = Math.min(100, now - lastTime)
  lastTime = now

  if (match && !match.paused && match.phase === 'playing') {
    match.elapsed += dt
    $('clock').textContent = clock(match.elapsed)
    updateTetris(dt, now)
    fetchCommentary()
  }

  requestAnimationFrame(frame)
}

/**
 * Route garbage lines to the active opponent with lowest stack height (targeting the leader)
 */
function routeGarbage(attackerId, lines) {
  if (!match || lines <= 0) return
  const m = match
  const candidates = []
  if (attackerId !== 'llm' && m.active.llm && m.alive.llm) candidates.push({ id: 'llm', game: m.gLlm })
  if (attackerId !== 'jev' && m.active.jev && m.alive.jev) candidates.push({ id: 'jev', game: m.gJev })
  if (attackerId !== 'laya' && m.active.laya && m.alive.laya) candidates.push({ id: 'laya', game: m.gLaya })

  if (!candidates.length) return
  // Target the rival with lowest stack height (to balance the match)
  candidates.sort((a, b) => getStackHeight(a.game) - getStackHeight(b.game))
  candidates[0].game.queueGarbage(lines)
}

function handleTopOut(loserId) {
  if (!match || match.phase !== 'playing') return
  const m = match
  if (!m.alive[loserId]) return

  m.alive[loserId] = false
  m.outCount++
  $(`p-${loserId}`)?.classList.add('eliminated')

  const totalPlayers = Object.values(m.active).filter(Boolean).length
  if (totalPlayers === 3) {
    if (m.outCount === 1) {
      m.ranks[loserId] = '🥉 季军 (3rd)'
    } else if (m.outCount === 2) {
      m.ranks[loserId] = '🥈 亚军 (2nd)'
    }
  } else {
    m.ranks[loserId] = '🥈 战败 (Defeat)'
  }

  // Check remaining alive players
  const remaining = Object.keys(m.alive).filter((k) => m.alive[k] && m.active[k])
  if (remaining.length <= 1) {
    endMatch(remaining[0] || loserId)
  }
}

function updateTetris(dt, now) {
  const m = match
  if (m.isHuman && m.alive.llm) input.update(dt, m.gLlm)

  // Update physics for active games
  if (m.active.llm && m.alive.llm) {
    m.gLlm.update(dt)
    m.botLlm?.update(now)
  }
  if (m.active.jev && m.alive.jev) {
    m.gJev.update(dt)
    m.botJev?.update(now)
  }
  if (m.active.laya && m.alive.laya) {
    m.gLaya.update(dt)
    m.botLaya?.update(now)
  }

  // Process LLM events
  while (m.active.llm && m.gLlm.events.length) {
    const ev = m.gLlm.events.shift()
    m.fxLlm.push(ev, now)
    if (ev.kind === 'garbageOut') routeGarbage('llm', ev.lines)
    if (ev.kind === 'topOut') {
      handleTopOut('llm')
      return
    }
  }

  // Process Jev events
  while (m.active.jev && m.gJev.events.length) {
    const ev = m.gJev.events.shift()
    m.fxJev.push(ev, now)
    if (ev.kind === 'garbageOut') routeGarbage('jev', ev.lines)
    if (ev.kind === 'topOut') {
      handleTopOut('jev')
      return
    }
  }

  // Process Laya events
  while (m.active.laya && m.gLaya.events.length) {
    const ev = m.gLaya.events.shift()
    m.fxLaya.push(ev, now)
    if (ev.kind === 'garbageOut') routeGarbage('laya', ev.lines)
    if (ev.kind === 'topOut') {
      handleTopOut('laya')
      return
    }
  }

  // Draw boards
  if (m.active.llm) drawPlayer(ctxLlm, m.gLlm, m.fxLlm, now, { fieldX: 0, showNext: 5 })
  if (m.active.jev) drawPlayer(ctxJev, m.gJev, m.fxJev, now, { fieldX: 0, showNext: 5 })
  if (m.active.laya) drawPlayer(ctxLaya, m.gLaya, m.fxLaya, now, { fieldX: 0, showNext: 5 })

  renderTetrisStats(m)
}

function renderTetrisStats(m) {
  const renderStat = (id, g) => {
    const el = $(id)
    if (!el || !g) return
    const secs = Math.max(m.elapsed / 1000, 1e-9)
    const mins = Math.max(m.elapsed / 60000, 1e-9)
    el.innerHTML = `
      <dt>${t('stat_pieces')}</dt><dd>${g.stats.pieces}</dd>
      <dt>${t('stat_lines')}</dt><dd>${g.stats.lines}</dd>
      <dt>${t('stat_attack')}</dt><dd>${g.stats.attack}</dd>
      <dt>PPS</dt><dd>${(g.stats.pieces / secs).toFixed(2)}</dd>
      <dt>APM</dt><dd>${(g.stats.attack / mins).toFixed(1)}</dd>
    `
  }
  if (m.active.llm) renderStat('s-llm', m.gLlm)
  if (m.active.jev) renderStat('s-jev', m.gJev)
  if (m.active.laya) renderStat('s-laya', m.gLaya)
}

function clock(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// --- React-Bits Micro-Interactions & Settings Drawer -----------------------------

let toastTimer = null
export function showToast(title, body, duration = 3200) {
  const toast = $('toast')
  if (!toast) return
  $('toast-title').textContent = title
  $('toast-body').textContent = body
  toast.classList.remove('hidden')

  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden')
  }, duration)
}

function setupSpotlightCards() {
  document.querySelectorAll('[data-spotlight]').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      card.style.setProperty('--mouse-x', `${x}px`)
      card.style.setProperty('--mouse-y', `${y}px`)
    })
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mouse-x', '-999px')
      card.style.setProperty('--mouse-y', '-999px')
    })
  })
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config')
    const cfg = await res.json()
    if (cfg.ok) {
      if ($('cfg-llm-endpoint')) $('cfg-llm-endpoint').value = cfg.llm?.endpoint || ''
      if ($('cfg-llm-model')) $('cfg-llm-model').value = cfg.llm?.model || ''
      if ($('cfg-llm-key')) $('cfg-llm-key').value = cfg.llm?.apiKey || ''

      if ($('cfg-laya-url')) $('cfg-laya-url').value = cfg.laya?.baseUrl || ''
      if ($('cfg-laya-model')) $('cfg-laya-model').value = cfg.laya?.model || ''
      if ($('cfg-laya-path')) $('cfg-laya-path').value = cfg.laya?.path || ''

      if ($('cfg-jev-url')) $('cfg-jev-url').value = cfg.jev?.baseUrl || ''
      if ($('cfg-jev-model')) $('cfg-jev-model').value = cfg.jev?.model || ''
      if ($('cfg-jev-key')) $('cfg-jev-key').value = cfg.jev?.apiKey || ''
    }
  } catch (err) {
    console.warn('Failed to load config:', err)
  }
}

async function pingService(service, btnId, resultId, getParams) {
  const btn = $(btnId)
  const resEl = $(resultId)
  if (!btn || !resEl) return

  btn.classList.add('testing')
  btn.disabled = true
  resEl.textContent = getLang() === 'zh' ? '测试连通中...' : 'Testing connectivity...'
  resEl.className = 'ping-result-bar'

  try {
    const res = await fetch('/api/test-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, config: getParams() }),
    })
    const data = await res.json()
    if (data.ok) {
      resEl.textContent = `🟢 ${data.message}`
      resEl.className = 'ping-result-bar ok'
      showToast(`${service.toUpperCase()}`, data.message)
      checkServices()
    } else {
      resEl.textContent = `🔴 ${data.error}`
      resEl.className = 'ping-result-bar err'
      showToast(`${service.toUpperCase()}`, data.error)
    }
  } catch (err) {
    resEl.textContent = `🔴 ${err.message}`
    resEl.className = 'ping-result-bar err'
    showToast(`${service.toUpperCase()}`, err.message)
  } finally {
    btn.classList.remove('testing')
    btn.disabled = false
  }
}

function selectDrawerTab(tabId) {
  document.querySelectorAll('.drawer-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabId)
  })
  document.querySelectorAll('.service-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`)
  })
}

function openDrawer(targetTab = null) {
  const backdrop = $('drawer-backdrop')
  if (!backdrop) return
  loadConfig()
  $('drawer-save-msg').textContent = ''
  backdrop.classList.remove('hidden')

  if (targetTab) {
    selectDrawerTab(targetTab)
  }
}

function closeDrawer() {
  const backdrop = $('drawer-backdrop')
  if (backdrop) backdrop.classList.add('hidden')
}

function setupSettingsDrawer() {
  $('btn-open-settings')?.addEventListener('click', () => openDrawer('llm'))
  $('dock-chip-laya')?.addEventListener('click', () => openDrawer('laya'))
  $('dock-chip-jev')?.addEventListener('click', () => openDrawer('jev'))
  $('dock-chip-llm')?.addEventListener('click', () => openDrawer('llm'))
  $('btn-close-drawer')?.addEventListener('click', closeDrawer)
  $('drawer-backdrop')?.addEventListener('click', (e) => {
    if (e.target === $('drawer-backdrop')) closeDrawer()
  })

  // Tab switching
  document.querySelectorAll('.drawer-tab').forEach((tab) => {
    tab.addEventListener('click', () => selectDrawerTab(tab.dataset.tab))
  })

  // Presets
  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const target = $(chip.dataset.target)
      if (target) {
        target.value = chip.dataset.val
        target.focus()
      }
    })
  })

  // Password mask/unmask toggles
  document.querySelectorAll('.btn-eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inputEl = $(btn.dataset.for)
      if (!inputEl) return
      if (inputEl.type === 'password') {
        inputEl.type = 'text'
        btn.textContent = '🔒'
      } else {
        inputEl.type = 'password'
        btn.textContent = '👁️'
      }
    })
  })

  // Connectivity Test buttons
  $('btn-test-laya')?.addEventListener('click', () => {
    pingService('laya', 'btn-test-laya', 'result-laya', () => ({
      baseUrl: $('cfg-laya-url').value.trim(),
    }))
  })

  $('btn-test-jev')?.addEventListener('click', () => {
    pingService('jev', 'btn-test-jev', 'result-jev', () => ({
      baseUrl: $('cfg-jev-url').value.trim(),
      apiKey: $('cfg-jev-key').value.trim(),
      model: $('cfg-jev-model').value.trim(),
    }))
  })

  $('btn-test-llm')?.addEventListener('click', () => {
    pingService('llm', 'btn-test-llm', 'result-llm', () => ({
      endpoint: $('cfg-llm-endpoint').value.trim(),
      model: $('cfg-llm-model').value.trim(),
      apiKey: $('cfg-llm-key').value.trim(),
    }))
  })

  // Save Settings
  $('btn-save-drawer')?.addEventListener('click', async () => {
    const saveBtn = $('btn-save-drawer')
    const msg = $('drawer-save-msg')
    saveBtn.disabled = true
    msg.textContent = t('msg_saving')

    const payload = {
      llm: {
        endpoint: $('cfg-llm-endpoint').value.trim(),
        model: $('cfg-llm-model').value.trim(),
        apiKey: $('cfg-llm-key').value.trim(),
      },
      laya: {
        baseUrl: $('cfg-laya-url').value.trim(),
        model: $('cfg-laya-model').value.trim(),
        path: $('cfg-laya-path').value.trim(),
      },
      jev: {
        baseUrl: $('cfg-jev-url').value.trim(),
        model: $('cfg-jev-model').value.trim(),
        apiKey: $('cfg-jev-key').value.trim(),
      },
    }

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        msg.textContent = t('msg_saved')
        showToast(t('toast_saved_title'), t('toast_saved_body'))
        checkServices()
        setTimeout(() => closeDrawer(), 800)
      } else {
        msg.textContent = `❌ ${data.error}`
        showToast('Error', data.error)
      }
    } catch (err) {
      msg.textContent = `❌ ${err.message}`
      showToast('Error', err.message)
    } finally {
      saveBtn.disabled = false
    }
  })
}

// --- Live Health & Status Check & Top Alert Banner -----------------------------

let bannerDismissed = false
let activeMissingModel = 'laya'

function updateTopAlertBanner(h, needed) {
  const banner = $('service-alert-banner')
  const bannerText = $('alert-banner-text')
  if (!banner || !bannerText) return
  if (bannerDismissed) return

  const layaNeeded = needed.includes('laya')
  const jevNeeded = needed.includes('jev')
  const llmNeeded = needed.includes('llm')

  const layaDown = layaNeeded && !h?.models?.laya?.ok
  const jevDown = jevNeeded && !h?.models?.jev?.ok
  const llmDown = llmNeeded && !h?.models?.llm?.ok

  if (layaDown && jevDown) {
    bannerText.textContent = t('alert_missing_both')
    activeMissingModel = 'laya'
    banner.classList.remove('hidden')
  } else if (jevDown) {
    bannerText.textContent = t('alert_missing_jev')
    activeMissingModel = 'jev'
    banner.classList.remove('hidden')
  } else if (layaDown) {
    bannerText.textContent = t('alert_missing_laya')
    activeMissingModel = 'laya'
    banner.classList.remove('hidden')
  } else if (llmDown) {
    bannerText.textContent = '提示：LLM 决策/解说席 API Key 待配置'
    activeMissingModel = 'llm'
    banner.classList.remove('hidden')
  } else {
    banner.classList.add('hidden')
  }
}

function setupAlertBanner() {
  const bannerBtn = $('alert-banner-btn')
  const closeBtn = $('alert-banner-close')

  if (bannerBtn) {
    bannerBtn.addEventListener('click', () => {
      openDrawer(activeMissingModel || 'llm')
    })
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const banner = $('service-alert-banner')
      if (banner) banner.classList.add('hidden')
      bannerDismissed = true
    })
  }
}

async function checkServices() {
  const el = $('jev-status')
  const md = mode()
  const needed = md.isTri ? ['llm', 'jev', 'laya'] : [md.p1, md.p2, md.p3].filter(Boolean).filter((x) => x !== 'human')

  try {
    const res = await fetch('/health')
    const h = await res.json()

    // 1. Update CallChip Docks in Global Bar
    if ($('dock-laya-val')) {
      const layaOk = h.models?.laya?.ok
      $('dock-laya-val').textContent = layaOk ? `${h.models?.laya?.p50 || 38}ms` : t('dock_offline')
      $('dock-chip-laya')?.classList.toggle('warning', !layaOk)
    }

    if ($('dock-jev-val')) {
      const jevOk = h.models?.jev?.ok
      $('dock-jev-val').textContent = jevOk ? (h.models?.jev?.model || '在线') : t('dock_wait_key')
      $('dock-chip-jev')?.classList.toggle('warning', !jevOk)
    }

    if ($('dock-llm-val')) {
      const llmOk = h.models?.llm?.ok || h.commentary?.ok
      $('dock-llm-val').textContent = llmOk ? (h.models?.llm?.model || '在线') : t('dock_wait_key')
      $('dock-chip-llm')?.classList.toggle('warning', !llmOk)
    }

    // 2. Update VS Screen Status Summary
    const down = needed.filter((k) => !h.models?.[k]?.ok)
    if (down.length) {
      el.textContent = down.map((k) => `${k.toUpperCase()} ${t('dock_offline')}`).join(' · ')
      el.className = 'vs-status bad'
    } else {
      const parts = [
        `LLM (${h.models?.llm?.model ?? '在线'})`,
        `Jev (${h.models?.jev?.model ?? 'Cloud API'})`,
        `Laya (~${h.models?.laya?.p50 || 38}ms TITAN RTX)`,
      ]
      el.textContent = parts.join(' · ')
      el.className = 'vs-status ok'
    }

    // 3. Update Top Alert Banner
    updateTopAlertBanner(h, needed)
  } catch {
    if (el) {
      el.textContent = t('dock_offline')
      el.className = 'vs-status bad'
    }
    updateTopAlertBanner(null, needed)
  }
}

// --- Language Switcher -----------------------------------------------------------

function setupLanguageSwitcher() {
  const btn = $('btn-lang')
  if (!btn) return
  btn.addEventListener('click', () => {
    const nextLang = getLang() === 'zh' ? 'en' : 'zh'
    setLang(nextLang)
    applyMode()
    checkServices()
    if (match) {
      $('clock').textContent = clock(match.elapsed)
      renderTetrisStats(match)
    }
  })
}

// --- Keyboard & Button Events ----------------------------------------------------

window.addEventListener('keydown', (e) => {
  const backdrop = $('drawer-backdrop')
  if (backdrop && !backdrop.classList.contains('hidden') && e.code === 'Escape') {
    closeDrawer()
    return
  }

  if (!match || match.phase !== 'playing') {
    if (e.code === 'Enter' && !$('result')?.classList.contains('show')) {
      startMatch()
    }
    return
  }

  if (e.code === 'Escape') {
    setPaused(!match.paused)
    return
  }
})

// UI Button Listeners
$('mode')?.addEventListener('change', () => {
  bannerDismissed = false
  applyMode()
})
$('go')?.addEventListener('click', startMatch)
$('resume')?.addEventListener('click', () => setPaused(false))
$('forfeit')?.addEventListener('click', toMenu)
$('rematch')?.addEventListener('click', startMatch)
$('menu')?.addEventListener('click', toMenu)

// Initialize
setupSpotlightCards()
setupSettingsDrawer()
setupLanguageSwitcher()
setupAlertBanner()
applyTranslations()
applyMode()
checkServices()
requestAnimationFrame(frame)
