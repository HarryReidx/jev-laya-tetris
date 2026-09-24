// Snake Decision Engine for Jev and Laya.
// Generates valid moves, evaluates safety via flood-fill and food distance,
// formats choices for Jev and Laya, and handles decision parsing.

export const BOARD_SIZE = 20

const DIRS = {
  UP: { x: 0, y: -1, name: 'UP', label: '向上 (UP)' },
  DOWN: { x: 0, y: 1, name: 'DOWN', label: '向下 (DOWN)' },
  LEFT: { x: -1, y: 0, name: 'LEFT', label: '向左 (LEFT)' },
  RIGHT: { x: 1, y: 0, name: 'RIGHT', label: '向右 (RIGHT)' },
}

const OPPOSITES = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

/**
 * Perform BFS flood-fill from (startX, startY) to count reachable free cells.
 */
function countReachable(startX, startY, obstacles, maxCount = 150) {
  const visited = new Set(obstacles)
  const key = `${startX},${startY}`
  if (visited.has(key)) return 0

  const queue = [{ x: startX, y: startY }]
  visited.add(key)
  let count = 0

  while (queue.length > 0 && count < maxCount) {
    const { x, y } = queue.shift()
    count++

    for (const d of Object.values(DIRS)) {
      const nx = x + d.x
      const ny = y + d.y
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
        const nKey = `${nx},${ny}`
        if (!visited.has(nKey)) {
          visited.add(nKey)
          queue.push({ x: nx, y: ny })
        }
      }
    }
  }

  return count
}

/**
 * Generate candidate moves for the snake.
 */
export function candidatesForSnake(pos) {
  const { snake, food, currentDir } = pos
  const head = snake[0]
  const obstacles = new Set(snake.map((s) => `${s.x},${s.y}`))

  // Tail will move, so last segment is technically free unless snake just ate
  if (snake.length > 1) {
    const tail = snake[snake.length - 1]
    obstacles.delete(`${tail.x},${tail.y}`)
  }

  const candidates = []

  for (const [dirKey, dir] of Object.entries(DIRS)) {
    // Cannot 180-turn into self
    if (currentDir && OPPOSITES[currentDir] === dirKey) continue

    const nx = head.x + dir.x
    const ny = head.y + dir.y

    // Wall collision
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue

    // Body collision
    if (obstacles.has(`${nx},${ny}`)) continue

    // Calculate metrics
    const distManhattan = Math.abs(nx - food.x) + Math.abs(ny - food.y)
    const distEuclid = Math.hypot(nx - food.x, ny - food.y)
    const reachable = countReachable(nx, ny, obstacles)
    const isTrap = reachable < snake.length

    // Heuristic score: high reachable space + lower distance to food
    let score = reachable * 2 - distManhattan * 5
    if (nx === food.x && ny === food.y) score += 200
    if (isTrap) score -= 300

    candidates.push({
      id: dirKey,
      name: dir.name,
      label: dir.label,
      dx: dir.x,
      dy: dir.y,
      nextPos: { x: nx, y: ny },
      distManhattan,
      distEuclid: Number(distEuclid.toFixed(2)),
      reachable,
      isTrap,
      score,
      fact: `dist to food: ${distManhattan}, reachable space: ${reachable} cells${isTrap ? ' (TRAP HAZARD)' : ''}`,
    })
  }

  // Sort candidates by heuristic score descending
  candidates.sort((a, b) => b.score - a.score)

  // Default fallback is highest heuristic score
  const heuristic = candidates[0] ?? null

  return { candidates, heuristic, total: candidates.length }
}

/**
 * Build question & state for Jev / Laya
 */
export function buildSnakeDecision(pos, candidates) {
  const head = pos.snake[0]
  const criteria = {}
  for (const c of candidates) {
    criteria[c.id] = `${c.label}: ${c.fact}`
  }

  const state = {
    game: 'snake',
    board_size: `${BOARD_SIZE}x${BOARD_SIZE}`,
    head: `${head.x},${head.y}`,
    snake_length: pos.snake.length,
    food: `${pos.food.x},${pos.food.y}`,
    current_direction: pos.currentDir ?? 'UNKNOWN',
    surrounding: candidates.map((c) => `${c.id}=${c.fact}`).join('; '),
  }

  const questions = {
    move: {
      type: 'choice',
      instructions:
        'In Snake game, pick the best direction to move safely toward food without trapping yourself or hitting walls.',
      criteria,
    },
  }

  return { state, questions, candidates }
}

/**
 * Parse decision answer from Jev or Laya
 */
export function readSnakeDecision(response, candidates) {
  const ans = response?.answers?.move
  const choiceId = ans?.choice ?? (typeof ans === 'string' ? ans : null)
  const chosen = candidates.find((c) => c.id === choiceId) ?? null

  return {
    chosen,
    choice: choiceId,
    confidence: ans?.confidence ?? 0.8,
    probabilities: ans?.probabilities ?? null,
    latencyMs: response?.latencyMs ?? 0,
    modelChoice: ans?.layaChoice ?? choiceId,
  }
}
