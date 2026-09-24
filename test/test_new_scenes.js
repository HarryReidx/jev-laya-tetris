import { candidatesForSnake, buildSnakeDecision, readSnakeDecision } from '../ai/snake.js'
import { candidatesForSokoban, buildSokobanDecision, readSokobanDecision } from '../ai/sokoban.js'
import { LayaClient } from '../ai/laya.js'
import { JevClient } from '../ai/jev.js'

console.log('--- Testing Snake candidates ---')
const snakePos = {
  snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
  food: { x: 15, y: 10 },
  currentDir: 'RIGHT'
}
const snakeCandidates = candidatesForSnake(snakePos)
console.log('Snake candidates count:', snakeCandidates.candidates.length)
console.log('Top candidate:', snakeCandidates.heuristic.id, snakeCandidates.heuristic.fact)
if (snakeCandidates.candidates.length !== 3) {
  throw new Error(`Expected 3 valid directions (cannot reverse into LEFT), got ${snakeCandidates.candidates.length}`)
}

console.log('--- Testing Sokoban candidates ---')
const sokoPos = {
  player: { x: 1, y: 1 },
  boxes: [{ x: 3, y: 1 }],
  walls: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
    { x: 0, y: 1 }, { x: 5, y: 1 },
    { x: 0, y: 2 }, { x: 5, y: 2 },
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }
  ],
  targets: [{ x: 3, y: 2 }],
  rows: 4,
  cols: 6
}
const sokoCandidates = candidatesForSokoban(sokoPos)
console.log('Sokoban candidates count:', sokoCandidates.candidates.length)
console.log('Top candidate:', sokoCandidates.heuristic.id, sokoCandidates.heuristic.fact)

console.log('All local candidate generation tests passed!')
