// Sokoban Decision Engine for Jev and Laya.
// Analyzes puzzle states, evaluates push moves, prevents deadlocks,
// formats choice questions for Jev and Laya, and parses decisions.

export const SOKOBAN_LEVELS = [
  {
    name: '第 1 关 · 初试身手 (Tutorial)',
    map: [
      '######',
      '#@ $ #',
      '#  . #',
      '######'
    ]
  },
  {
    name: '第 2 关 · 双重目标 (Dual Targets)',
    map: [
      '#######',
      '#@ $  #',
      '# .#$ #',
      '#  .  #',
      '#######'
    ]
  },
  {
    name: '第 3 关 · 十字回路 (Crossroads)',
    map: [
      '  ##### ',
      '###   ##',
      '# $ # .#',
      '# @ $ .#',
      '###   ##',
      '  ##### '
    ]
  },
  {
    name: '第 4 关 · 对称走廊 (Symmetric)',
    map: [
      '########',
      '#  . . #',
      '# $$@$$#',
      '#  . . #',
      '########'
    ]
  },
  {
    name: '第 5 关 · 仓库死斗 (Warehouse)',
    map: [
      '######',
      '# .  #',
      '# $$ #',
      '# .# #',
      '# @  #',
      '######'
    ]
  },
  {
    name: '第 6 关 · 旋转回廊 (Spinning)',
    map: [
      '  ##### ',
      '###   # ',
      '# . #$##',
      '# #@$  #',
      '# . #$ #',
      '### .  #',
      '  ######'
    ]
  }
]

const DIRS = {
  UP: { x: 0, y: -1, name: 'UP', label: '向上 (UP)' },
  DOWN: { x: 0, y: 1, name: 'DOWN', label: '向下 (DOWN)' },
  LEFT: { x: -1, y: 0, name: 'LEFT', label: '向左 (LEFT)' },
  RIGHT: { x: 1, y: 0, name: 'RIGHT', label: '向右 (RIGHT)' },
}

/**
 * Check if a cell is an unrecoverable corner deadlock for a box.
 */
function isCornerDeadlock(x, y, walls, targets) {
  const isTarget = targets.has(`${x},${y}`)
  if (isTarget) return false

  const upWall = walls.has(`${x},${y - 1}`)
  const downWall = walls.has(`${x},${y + 1}`)
  const leftWall = walls.has(`${x - 1},${y}`)
  const rightWall = walls.has(`${x + 1},${y}`)

  if ((upWall && leftWall) || (upWall && rightWall) || (downWall && leftWall) || (downWall && rightWall)) {
    return true
  }
  return false
}

/**
 * Generate candidate moves for Sokoban position.
 */
export function candidatesForSokoban(pos) {
  const { player, boxes, walls, targets, rows, cols } = pos
  const boxSet = new Set(boxes.map((b) => `${b.x},${b.y}`))
  const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`))
  const targetSet = new Set(targets.map((t) => `${t.x},${t.y}`))

  const candidates = []

  for (const [dirKey, dir] of Object.entries(DIRS)) {
    const nx = player.x + dir.x
    const ny = player.y + dir.y

    // Wall collision
    if (wallSet.has(`${nx},${ny}`) || nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
      continue
    }

    const isPushing = boxSet.has(`${nx},${ny}`)

    if (isPushing) {
      const bnx = nx + dir.x
      const bny = ny + dir.y

      // Box blocked by wall or another box
      if (wallSet.has(`${bnx},${bny}`) || boxSet.has(`${bnx},${bny}`)) {
        continue
      }
      if (bnx < 0 || bnx >= cols || bny < 0 || bny >= rows) {
        continue
      }

      const isDeadlock = isCornerDeadlock(bnx, bny, wallSet, targetSet)
      const landsOnTarget = targetSet.has(`${bnx},${bny}`)

      // Score: heavy penalty for deadlock, huge bonus for placing on target
      let score = 50
      if (landsOnTarget) score += 300
      if (isDeadlock) score -= 600

      // Distance to nearest unfilled target
      let minTargetDist = 999
      for (const t of targets) {
        if (!boxSet.has(`${t.x},${t.y}`) || `${t.x},${t.y}` === `${nx},${ny}`) {
          const d = Math.abs(bnx - t.x) + Math.abs(bny - t.y)
          if (d < minTargetDist) minTargetDist = d
        }
      }
      score -= minTargetDist * 10

      candidates.push({
        id: dirKey,
        name: dir.name,
        label: dir.label,
        dx: dir.x,
        dy: dir.y,
        isPush: true,
        landsOnTarget,
        isDeadlock,
        score,
        fact: `PUSH BOX -> (${bnx},${bny})${landsOnTarget ? ' [TARGET HIT!]' : ''}${isDeadlock ? ' [DEADLOCK FATAL!]' : ''}, dist to target: ${minTargetDist}`,
      })
    } else {
      // Normal walk
      // Prefer walking towards boxes
      let minBoxDist = 999
      for (const b of boxes) {
        const d = Math.abs(nx - b.x) + Math.abs(ny - b.y)
        if (d < minBoxDist) minBoxDist = d
      }

      const score = 20 - minBoxDist * 2

      candidates.push({
        id: dirKey,
        name: dir.name,
        label: dir.label,
        dx: dir.x,
        dy: dir.y,
        isPush: false,
        landsOnTarget: false,
        isDeadlock: false,
        score,
        fact: `WALK STEP -> (${nx},${ny}), dist to nearest box: ${minBoxDist}`,
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const heuristic = candidates[0] ?? null

  return { candidates, heuristic, total: candidates.length }
}

/**
 * Build question & state for Jev / Laya
 */
export function buildSokobanDecision(pos, candidates) {
  const criteria = {}
  for (const c of candidates) {
    criteria[c.id] = `${c.label}: ${c.fact}`
  }

  const solvedBoxes = pos.boxes.filter((b) => pos.targets.some((t) => t.x === b.x && t.y === b.y)).length

  const state = {
    game: 'sokoban',
    player: `${pos.player.x},${pos.player.y}`,
    total_boxes: pos.boxes.length,
    solved_boxes: `${solvedBoxes}/${pos.boxes.length}`,
    options: candidates.map((c) => `${c.id}=${c.fact}`).join('; '),
  }

  const questions = {
    move: {
      type: 'choice',
      instructions:
        'In Sokoban puzzle, pick the best move to push boxes toward targets while strictly avoiding unrecoverable deadlocks.',
      criteria,
    },
  }

  return { state, questions, candidates }
}

/**
 * Parse decision answer from Jev or Laya
 */
export function readSokobanDecision(response, candidates) {
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
