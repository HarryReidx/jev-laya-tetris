// Pure Tetris AI Duel Platform: JEV vs LAYA
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
  jev: {
    name: 'JEV',
    tag: () => t('left_tag_cloud'),
    blurb: () => t('left_blurb_jev'),
  },
  laya: {
    name: 'LAYA',
    tag: () => t('right_tag_laya'),
    blurb: () => t('right_blurb_laya'),
  },
}

const MODES = {
  'jev-laya': { left: 'jev', right: 'laya' },
  'human-laya': { left: null, right: 'laya' },
  'human-jev': { left: null, right: 'jev' },
}

const mode = () => MODES[$('mode').value] ?? MODES['jev-laya']
const leftName = (md) => (md.left ? BOTS[md.left].name : HUMAN())

// Unified single speed setting for both AI agents
function getSpeed() {
  const el = $('battle-speed')
  const v = el ? el.value : '1.8'
  return v === 'max' ? { pps: 0, superhuman: true } : { pps: Number(v), superhuman: false }
}

let ctxHuman, ctxJev
const CHROME_H = 210
const ARENA_GAP = 32

function fitBoards() {
  const byH = (window.innerHeight - CHROME_H) / CANVAS_H
  const byW = (window.innerWidth - ARENA_GAP - 24) / 2 / CANVAS_W
  const scale = Math.max(0.6, Math.min(byH, byW))
  ctxHuman = setupCanvas($('c-human'), CANVAS_W, CANVAS_H, scale)
  ctxJev = setupCanvas($('c-jev'), CANVAS_W, CANVAS_H, scale)
  for (const id of ['log-left', 'log-right']) {
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
  const L = md.left && BOTS[md.left]
  const R = BOTS[md.right]

  $('left-tag').textContent = L ? L.tag() : t('left_tag_human')
  $('left-name').textContent = leftName(md)
  $('left-blurb').hidden = !L
  $('left-blurb').textContent = L ? L.blurb() : ''
  $('left-keys').hidden = Boolean(L)

  $('right-tag').textContent = R.tag()
  $('right-name').textContent = R.name
  $('right-blurb').textContent = R.blurb()

  $('bar-left').textContent = leftName(md)
  $('bar-left-role').textContent = L ? 'bot' : 'you'
  $('bar-right').textContent = R.name
  $('pname-left').textContent = leftName(md)
  $('pname-right').textContent = R.name

  document.title = `${L ? L.name : 'Human'} vs ${R.name} · ${t('vs_title')}`
  checkServices()
}

// --- Live Commentary -------------------------------------------------------------

let lastCommentaryReq = 0
async function fetchCommentary(winner = null) {
  if (!match) return
  const now = Date.now()
  if (!winner && now - lastCommentaryReq < 4500) return
  lastCommentaryReq = now

  try {
    const payload = {
      game: 'tetris',
      winner,
      round: match.elapsed,
      jev: {
        height: match.jev?.board ? Math.max(0, ...match.jev.board.map((r, i) => (r.some(Boolean) ? 20 - i : 0))) : 0,
        attack: match.jev?.stats?.attack ?? 0,
        lines: match.jev?.stats?.lines ?? 0,
      },
      laya: {
        height: match.human?.board ? Math.max(0, ...match.human.board.map((r, i) => (r.some(Boolean) ? 20 - i : 0))) : 0,
        attack: match.human?.stats?.attack ?? 0,
        lines: match.human?.stats?.lines ?? 0,
      }
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
  $('think').textContent = ''
  $('think-left').textContent = ''
  for (const id of ['log-left', 'log-right']) {
    const el = $(id)
    if (el) {
      el.innerHTML = ''
      el.dataset.n = 0
    }
  }

  const seed = randomSeed()
  const human = new Game({ seed, garbageSeed: seed + 1 })
  const jev = new Game({ seed, garbageSeed: seed + 2 })

  const speedConfig = getSpeed()

  match = {
    type: 'tetris',
    md,
    human,
    jev,
    fxH: new Effects(),
    fxJ: new Effects(),
    bot: new JevBot(jev, {
      ...speedConfig,
      model: md.right,
      opponent: human,
      onDecision: (d) => showDecision(d, 'think'),
    }),
    leftBot: md.left
      ? new JevBot(human, {
          ...speedConfig,
          model: md.left,
          opponent: jev,
          onDecision: (d) => showDecision(d, 'think-left'),
        })
      : null,
    phase: 'countdown',
    paused: false,
    elapsed: 0,
    winner: null,
  }

  show('match')
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
      input.enabled = !match.leftBot
      setTimeout(() => (el.innerHTML = ''), 700)
      return
    }
    i++
    setTimeout(tick, 800)
  }
  tick()
}

function endMatch(loser) {
  if (match.phase !== 'playing') return
  match.phase = 'over'
  match.winner = loser === 'human' ? 'jev' : 'human'
  input.enabled = false

  match.human.softDropG = 0
  match.bot.stop()
  match.leftBot?.stop()

  const won = match.winner === 'human'
  const winnerName = won ? leftName(match.md) : BOTS[match.md.right].name
  fetchCommentary(winnerName)
  setTimeout(showResult, 900)
}

function showResult() {
  const m = match
  const won = m.winner === 'human'
  const L = leftName(m.md)
  const R = BOTS[m.md.right].name
  $('r-kicker').textContent = m.leftBot ? t('result_kicker_over') : won ? t('result_kicker_win') : t('result_kicker_defeat')
  $('r-title').textContent = `${won ? L : R} WINS`
  $('r-title').className = `card-title ${m.winner}`

  const mins = Math.max(m.elapsed / 60000, 1e-9)
  const secs = Math.max(m.elapsed / 1000, 1e-9)
  const row = (label, v1, v2) => `<tr><td>${label}</td><td>${v1}</td><td>${v2}</td></tr>`

  $('r-table').innerHTML = `
    <tr><th></th><th>${L}</th><th>${R}</th></tr>
    ${row(t('table_pieces'), m.human.stats.pieces, m.jev.stats.pieces)}
    ${row(t('table_pps'), (m.human.stats.pieces / secs).toFixed(2), (m.jev.stats.pieces / secs).toFixed(2))}
    ${row(t('table_attack'), m.human.stats.attack, m.jev.stats.attack)}
    ${row(t('table_apm'), (m.human.stats.attack / mins).toFixed(1), (m.jev.stats.attack / mins).toFixed(1))}
    ${row(t('table_lines'), m.human.stats.lines, m.jev.stats.lines)}
    ${row(t('table_spins'), m.human.stats.spins, m.jev.stats.spins)}
    <tr><td>${t('table_duration')}</td><td colspan="2">${clock(m.elapsed)}</td></tr>`

  modal('result', true)
}

function toMenu() {
  if (match) {
    match.phase = 'over'
    match.bot?.stop()
    match.leftBot?.stop()
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
  input.enabled = !on && !match.leftBot
  input.reset()
  modal('paused', on)
}

// --- Decisions Logging & Display -------------------------------------------------

function showDecision(d, el = 'think') {
  logDecision(d, el === 'think' ? 'log-right' : 'log-left')
  const c = d.choice
  if (!c) {
    $(el).textContent = getLang() === 'zh'
      ? `无决策 (${d.error ?? '未知错误'}), 原地落块`
      : `No decision (${d.error ?? 'unknown error'}), dropping in place`
    return
  }
  const spin = c.spin === 'none' ? '' : c.type === 'T' && c.spin === 'full' ? ' T-spin' : ` ${c.type}-spin`
  const what = c.lines ? `${['', 'single', 'double', 'triple', 'quad'][c.lines]}${spin}` : spin.trim() || 'place'
  const conf = d.confidence == null ? '' : ` · conf ${d.confidence.toFixed(2)}`
  const lat = d.prefetched ? ' · pre-planned' : d.latencyMs == null ? '' : ` · ${d.latencyMs}ms`
  $(el).textContent = `${d.fallback ? 'FALLBACK · ' : ''}${c.useHold ? 'hold · ' : ''}${what}${c.sent ? ` · sends ${c.sent}` : ''}${conf}${lat} · ${d.options}/${d.total} options`
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
    item.innerHTML = `<div class="dl-head"><span class="dl-n">#${n}</span><span class="dl-bad">no decision</span></div>`
  } else {
    const spin = c.spin === 'none' ? '' : c.type === 'T' && c.spin === 'full' ? 'T-spin ' : `${c.type}-spin `
    const what = c.lines ? `${spin}${['', 'single', 'double', 'triple', 'quad'][c.lines]}` : spin ? spin.trim() : 'place'
    const bits = [c.useHold ? 'hold' : '', what, c.sent ? `sends ${c.sent}` : ''].filter(Boolean).join(' · ')
    const tag = d.fallback ? 'fallback' : d.prefetched ? 'pre' : d.latencyMs != null ? `${d.latencyMs}ms` : ''
    item.innerHTML = `
      <div class="dl-head">
        <span class="dl-n">#${n}</span>
        <span class="dl-choice">${bits || 'place'}</span>
        ${tag ? `<span class="dl-tag ${d.fallback ? 'bad' : ''}">${tag}</span>` : ''}
      </div>`
  }
  box.prepend(item)
  while (box.children.length > 14) box.lastElementChild.remove()
}

// --- Main Animation Frame Loop ---------------------------------------------------

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

function updateTetris(dt, now) {
  const m = match
  if (!m.leftBot) input.update(dt, m.human)
  m.human.update(dt)
  m.jev.update(dt)
  m.bot.update(now)
  m.leftBot?.update(now)

  while (m.human.events.length) {
    const ev = m.human.events.shift()
    m.fxH.push(ev, now)
    if (ev.kind === 'garbageOut') m.jev.queueGarbage(ev.lines)
    if (ev.kind === 'topOut') {
      endMatch('human')
      return
    }
  }
  while (m.jev.events.length) {
    const ev = m.jev.events.shift()
    m.fxJ.push(ev, now)
    if (ev.kind === 'garbageOut') m.human.queueGarbage(ev.lines)
    if (ev.kind === 'topOut') {
      endMatch('jev')
      return
    }
  }

  drawPlayer(ctxHuman, m.human, m.fxH, now, { fieldX: 0, showNext: 5 })
  drawPlayer(ctxJev, m.jev, m.fxJ, now, { fieldX: 0, showNext: 5 })
  renderTetrisStats(m)
}

function renderTetrisStats(m) {
  const renderStat = (id, g) => {
    $(id).innerHTML = `
      <dt>${t('stat_pieces')}</dt><dd>${g.stats.pieces}</dd>
      <dt>${t('stat_lines')}</dt><dd>${g.stats.lines}</dd>
      <dt>${t('stat_attack')}</dt><dd>${g.stats.attack}</dd>
      <dt>${t('stat_spins')}</dt><dd>${g.stats.spins}</dd>
      <dt>${t('stat_combo')}</dt><dd>${Math.max(0, g.combo)}</dd>
    `
  }
  renderStat('s-human', m.human)
  renderStat('s-jev', m.jev)
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
  // Open / Close events
  $('btn-open-settings').addEventListener('click', () => openDrawer())
  $('btn-close-drawer').addEventListener('click', closeDrawer)
  $('btn-cancel-drawer').addEventListener('click', closeDrawer)

  // Backdrop click to close
  $('drawer-backdrop').addEventListener('click', (e) => {
    if (e.target === $('drawer-backdrop')) {
      closeDrawer()
    }
  })

  // Tab switching in drawer
  document.querySelectorAll('.drawer-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      selectDrawerTab(tab.dataset.tab)
    })
  })

  // Status Chips in top dock open specific tab directly
  $('dock-laya').addEventListener('click', () => openDrawer('laya'))
  $('dock-jev').addEventListener('click', () => openDrawer('jev'))
  $('dock-llm').addEventListener('click', () => openDrawer('llm'))

  // Preset Chips quick-fill
  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const targetId = chip.dataset.target
      const val = chip.dataset.val
      if (targetId && $(targetId)) {
        $(targetId).value = val
        showToast(t('toast_preset_title'), `${t('toast_preset_body')}: ${val}`)
      }
    })
  })

  // Password mask/unmask toggles
  document.querySelectorAll('.btn-toggle-mask').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target
      const inputEl = $(targetId)
      if (inputEl) {
        if (inputEl.type === 'password') {
          inputEl.type = 'text'
          btn.textContent = '🔒'
        } else {
          inputEl.type = 'password'
          btn.textContent = '👁'
        }
      }
    })
  })

  // Test Ping buttons
  $('btn-ping-laya').addEventListener('click', () => {
    pingService('laya', 'btn-ping-laya', 'result-laya', () => ({
      baseUrl: $('cfg-laya-url').value.trim(),
      model: $('cfg-laya-model').value.trim(),
      path: $('cfg-laya-path').value.trim(),
    }))
  })

  $('btn-ping-jev').addEventListener('click', () => {
    pingService('jev', 'btn-ping-jev', 'result-jev', () => ({
      baseUrl: $('cfg-jev-url').value.trim(),
      model: $('cfg-jev-model').value.trim(),
      apiKey: $('cfg-jev-key').value.trim(),
    }))
  })

  $('btn-ping-llm').addEventListener('click', () => {
    pingService('llm', 'btn-ping-llm', 'result-llm', () => ({
      endpoint: $('cfg-llm-endpoint').value.trim(),
      model: $('cfg-llm-model').value.trim(),
      apiKey: $('cfg-llm-key').value.trim(),
    }))
  })

  // Save Settings
  $('btn-save-drawer').addEventListener('click', async () => {
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

  const layaDown = layaNeeded && !h?.models?.laya?.ok
  const jevDown = jevNeeded && !h?.models?.jev?.ok

  // Visual cues on CallChip docks
  $('dock-laya')?.classList.toggle('warning', Boolean(layaDown))
  $('dock-jev')?.classList.toggle('warning', Boolean(jevDown))

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
  } else if (!h || !h.ok) {
    bannerText.textContent = t('alert_offline')
    activeMissingModel = 'laya'
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
      openDrawer(activeMissingModel || 'laya')
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
  const needed = [md.left, md.right].filter(Boolean)
  const label = (k) => BOTS[k].name

  try {
    const res = await fetch('/health')
    const h = await res.json()

    // 1. Update CallChip Docks in Global Bar
    if ($('dock-laya-badge')) {
      const layaOk = h.models?.laya?.ok
      const dotLaya = $('dock-laya').querySelector('.status-dot')
      if (dotLaya) dotLaya.className = `status-dot ${layaOk ? 'green' : 'amber'}`
      $('dock-laya-badge').textContent = layaOk
        ? `${h.models?.laya?.gpu_name || 'TITAN RTX'} · ${h.models?.laya?.p50 || 36}ms`
        : t('dock_offline')
    }

    if ($('dock-jev-badge')) {
      const jevOk = h.models?.jev?.ok
      const dotJev = $('dock-jev').querySelector('.status-dot')
      if (dotJev) dotJev.className = `status-dot ${jevOk ? 'blue' : 'amber'}`
      $('dock-jev-badge').textContent = jevOk
        ? (h.models?.jev?.model || 'Cloud API')
        : t('dock_wait_key')
    }

    if ($('dock-llm-badge')) {
      const llmOk = h.commentary?.ok
      const dotLlm = $('dock-llm').querySelector('.status-dot')
      if (dotLlm) dotLlm.className = `status-dot ${llmOk ? 'amber' : 'amber'}`
      $('dock-llm-badge').textContent = llmOk
        ? (h.commentary?.model || 'Gemini Flash')
        : t('dock_offline')
    }

    // 2. Update VS Screen Status Summary
    const down = needed.filter((k) => !h.models?.[k]?.ok)
    if (down.length) {
      el.textContent = down.map((k) => `${label(k)} ${t('dock_offline')}: ${h.models?.[k]?.error ?? 'unknown'}`).join(' · ')
      el.className = 'vs-status bad'
    } else {
      const parts = []
      if (needed.includes('laya')) {
        parts.push(`Laya (${h.models?.laya?.gpu_name ?? 'TITAN RTX'}, ~${h.models?.laya?.p50 || 36}ms)`)
      }
      if (needed.includes('jev')) {
        parts.push(`Jev (${h.models?.jev?.model ?? 'Cloud API'})`)
      }
      if (h.commentary?.ok) {
        parts.push(`Gemini AI (${h.commentary.model})`)
      }
      el.textContent = parts.join(' · ')
      el.className = 'vs-status ok'
    }

    // 3. Update Top Alert Banner
    updateTopAlertBanner(h, needed)
  } catch {
    el.textContent = t('dock_offline')
    el.className = 'vs-status bad'
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
  // If drawer is open and user hits Escape, close drawer
  const backdrop = $('drawer-backdrop')
  if (backdrop && !backdrop.classList.contains('hidden') && e.code === 'Escape') {
    closeDrawer()
    return
  }

  if (!match || match.phase !== 'playing') {
    if (e.code === 'Enter' && !$('result').classList.contains('show')) {
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
$('mode').addEventListener('change', () => {
  bannerDismissed = false
  applyMode()
})
$('go').addEventListener('click', startMatch)
$('resume').addEventListener('click', () => setPaused(false))
$('forfeit').addEventListener('click', toMenu)
$('rematch').addEventListener('click', startMatch)
$('menu').addEventListener('click', toMenu)

// Initialize
setupSpotlightCards()
setupSettingsDrawer()
setupLanguageSwitcher()
setupAlertBanner()
applyTranslations()
applyMode()
checkServices()
requestAnimationFrame(frame)
