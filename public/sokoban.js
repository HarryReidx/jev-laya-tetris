// Client-side Sokoban Duel Engine
// Runs synchronized Sokoban puzzle solving for Jev, Laya, or Human.

import { SOKOBAN_LEVELS } from '/engine/sokoban_data.js'

export class SokobanGame {
  constructor({ levelIndex = 0, id = 'left' } = {}) {
    this.id = id
    this.levelIndex = levelIndex
    this.loadLevel(levelIndex)
  }

  loadLevel(index) {
    this.levelIndex = Math.max(0, Math.min(index, SOKOBAN_LEVELS.length - 1))
    const raw = SOKOBAN_LEVELS[this.levelIndex].map

    this.rows = raw.length
    this.cols = Math.max(...raw.map((r) => r.length))

    this.walls = []
    this.targets = []
    this.boxes = []
    this.player = { x: 0, y: 0, dir: 'DOWN' }
    this.steps = 0
    this.pushes = 0
    this.completed = false
    this.lastDecision = null

    for (let r = 0; r < this.rows; r++) {
      const line = raw[r] || ''
      for (let c = 0; c < this.cols; c++) {
        const ch = line[c] || ' '
        if (ch === '#') {
          this.walls.push({ x: c, y: r })
        } else {
          if (ch === '.' || ch === '+' || ch === '*') {
            this.targets.push({ x: c, y: r })
          }
          if (ch === '$' || ch === '*') {
            this.boxes.push({ x: c, y: r })
          }
          if (ch === '@' || ch === '+') {
            this.player = { x: c, y: r, dir: 'DOWN' }
          }
        }
      }
    }
  }

  tryMove(dirName) {
    if (this.completed) return false

    const map = {
      UP: { x: 0, y: -1 },
      DOWN: { x: 0, y: 1 },
      LEFT: { x: -1, y: 0 },
      RIGHT: { x: 1, y: 0 },
    }
    const d = map[dirName]
    if (!d) return false

    this.player.dir = dirName
    const nx = this.player.x + d.x
    const ny = this.player.y + d.y

    // Wall collision
    if (this.walls.some((w) => w.x === nx && w.y === ny)) return false

    // Box collision
    const boxIdx = this.boxes.findIndex((b) => b.x === nx && b.y === ny)
    if (boxIdx !== -1) {
      const bnx = nx + d.x
      const bny = ny + d.y
      // Blocked if wall or another box behind it
      if (this.walls.some((w) => w.x === bnx && w.y === bny)) return false
      if (this.boxes.some((b) => b.x === bnx && b.y === bny)) return false

      this.boxes[boxIdx].x = bnx
      this.boxes[boxIdx].y = bny
      this.pushes++
      this.player.x = nx
      this.player.y = ny
      this.steps++
    } else {
      this.player.x = nx
      this.player.y = ny
      this.steps++
    }

    this.checkCompletion()
    return true
  }

  checkCompletion() {
    const solved = this.boxes.every((b) => this.targets.some((t) => t.x === b.x && t.y === b.y))
    if (solved && this.boxes.length > 0) {
      this.completed = true
    }
  }

  getSnapshot() {
    return {
      player: { ...this.player },
      boxes: this.boxes.map((b) => ({ x: b.x, y: b.y })),
      walls: this.walls.map((w) => ({ x: w.x, y: w.y })),
      targets: this.targets.map((t) => ({ x: t.x, y: t.y })),
      rows: this.rows,
      cols: this.cols,
      steps: this.steps,
      pushes: this.pushes,
      completed: this.completed,
    }
  }
}

/**
 * SokobanBotRunner
 * Solves Sokoban puzzles step-by-step using Jev or Laya.
 */
export class SokobanBotRunner {
  constructor({ game, model = 'jev', onDecision = null }) {
    this.game = game
    this.model = model
    this.onDecision = onDecision
    this.isRequesting = false
    this.latencies = []
    this.decisionsCount = 0
  }

  async requestNextMove() {
    if (this.isRequesting || this.game.completed) return
    this.isRequesting = true

    const pos = this.game.getSnapshot()
    try {
      const res = await fetch(`/decide-sokoban?model=${this.model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pos),
      })
      const decision = await res.json()
      if (decision && decision.choice) {
        this.game.tryMove(decision.choice)
        this.game.lastDecision = decision
        if (Number.isFinite(decision.latencyMs)) {
          this.latencies.push(decision.latencyMs)
        }
        this.decisionsCount++
        if (this.onDecision) this.onDecision(decision)
      }
    } catch (err) {
      console.warn(`SokobanBot (${this.model}) request failed:`, err.message)
    } finally {
      this.isRequesting = false
    }
  }

  stats() {
    if (!this.latencies.length) return { p50: 0, count: 0 }
    const s = [...this.latencies].sort((a, b) => a - b)
    const p50 = s[Math.floor(s.length * 0.5)]
    return { p50, count: this.decisionsCount }
  }
}
