// Client-side Snake Duel Engine
// Runs synchronized Snake games for Jev, Laya, or Human.

export const SNAKE_BOARD_SIZE = 20

export class SnakeGame {
  constructor({ seed = 1234, id = 'left' } = {}) {
    this.seed = seed
    this.id = id
    this.reset()
  }

  // Simple deterministic LCG for identical food placements across both bots
  nextRandom() {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  reset() {
    const mid = Math.floor(SNAKE_BOARD_SIZE / 2)
    this.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ]
    this.dir = { x: 1, y: 0, name: 'RIGHT' }
    this.nextDir = { x: 1, y: 0, name: 'RIGHT' }
    this.food = null
    this.score = 0
    this.applesEaten = 0
    this.steps = 0
    this.alive = true
    this.lastDecision = null
    this.spawnFood()
  }

  spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`))
    const free = []
    for (let y = 0; y < SNAKE_BOARD_SIZE; y++) {
      for (let x = 0; x < SNAKE_BOARD_SIZE; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y })
      }
    }
    if (free.length === 0) {
      this.alive = false
      return
    }
    const idx = Math.floor(this.nextRandom() * free.length)
    this.food = free[idx]
  }

  setDirection(dirName) {
    const opposites = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
    if (opposites[this.dir.name] === dirName) return // prevent 180-deg reversal

    const map = {
      UP: { x: 0, y: -1, name: 'UP' },
      DOWN: { x: 0, y: 1, name: 'DOWN' },
      LEFT: { x: -1, y: 0, name: 'LEFT' },
      RIGHT: { x: 1, y: 0, name: 'RIGHT' },
    }
    if (map[dirName]) {
      this.nextDir = map[dirName]
    }
  }

  step() {
    if (!this.alive) return false

    this.dir = this.nextDir
    const head = this.snake[0]
    const nextHead = { x: head.x + this.dir.x, y: head.y + this.dir.y }

    // Wall collision
    if (
      nextHead.x < 0 ||
      nextHead.x >= SNAKE_BOARD_SIZE ||
      nextHead.y < 0 ||
      nextHead.y >= SNAKE_BOARD_SIZE
    ) {
      this.alive = false
      return false
    }

    // Body collision (ignoring tail that moves forward)
    for (let i = 0; i < this.snake.length - 1; i++) {
      if (this.snake[i].x === nextHead.x && this.snake[i].y === nextHead.y) {
        this.alive = false
        return false
      }
    }

    this.snake.unshift(nextHead)
    this.steps++

    // Food check
    if (this.food && nextHead.x === this.food.x && nextHead.y === this.food.y) {
      this.score += 10
      this.applesEaten++
      this.spawnFood()
    } else {
      this.snake.pop()
    }

    return true
  }

  getSnapshot() {
    return {
      snake: this.snake.map((s) => ({ x: s.x, y: s.y })),
      food: { ...this.food },
      currentDir: this.dir.name,
      score: this.score,
      steps: this.steps,
      length: this.snake.length,
      alive: this.alive,
    }
  }
}

/**
 * SnakeBotRunner
 * Periodically requests moves from /decide-snake?model=jev|laya and applies them.
 */
export class SnakeBotRunner {
  constructor({ game, model = 'jev', onDecision = null }) {
    this.game = game
    this.model = model
    this.onDecision = onDecision
    this.isRequesting = false
    this.latencies = []
    this.decisionsCount = 0
  }

  async requestNextMove() {
    if (this.isRequesting || !this.game.alive) return
    this.isRequesting = true

    const pos = this.game.getSnapshot()
    try {
      const res = await fetch(`/decide-snake?model=${this.model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pos),
      })
      const decision = await res.json()
      if (decision && decision.choice) {
        this.game.setDirection(decision.choice)
        this.game.lastDecision = decision
        if (Number.isFinite(decision.latencyMs)) {
          this.latencies.push(decision.latencyMs)
        }
        this.decisionsCount++
        if (this.onDecision) this.onDecision(decision)
      }
    } catch (err) {
      console.warn(`SnakeBot (${this.model}) request failed:`, err.message)
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
