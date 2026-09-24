import { candidatesForSnake, buildSnakeDecision, readSnakeDecision } from '../ai/snake.js'
import { candidatesForSokoban, buildSokobanDecision, readSokobanDecision } from '../ai/sokoban.js'
import { LayaClient } from '../ai/laya.js'
import { JevClient } from '../ai/jev.js'

async function run() {
  const laya = new LayaClient({ baseUrl: 'http://172.24.0.5:8300' })
  const jev = new JevClient()

  console.log('--- Testing Laya on Snake ---')
  const snakePos = {
    snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
    food: { x: 15, y: 10 },
    currentDir: 'RIGHT'
  }
  const { candidates: sCand } = candidatesForSnake(snakePos)
  const { state: sState, questions: sQ } = buildSnakeDecision(snakePos, sCand)

  const layaSnakeRes = await laya.ask(sState, sQ)
  const layaSnakeDec = readSnakeDecision(layaSnakeRes, sCand)
  console.log('Laya Snake decision:', layaSnakeDec.choice, `(latency: ${layaSnakeRes.latencyMs}ms)`)

  console.log('--- Testing Jev on Snake ---')
  const jevSnakeRes = await jev.ask(sState, sQ)
  const jevSnakeDec = readSnakeDecision(jevSnakeRes, sCand)
  console.log('Jev Snake decision:', jevSnakeDec.choice, `(latency: ${jevSnakeRes.latencyMs}ms)`)

  console.log('--- Testing Laya on Sokoban ---')
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
  const { candidates: kCand } = candidatesForSokoban(sokoPos)
  const { state: kState, questions: kQ } = buildSokobanDecision(sokoPos, kCand)

  const layaSokoRes = await laya.ask(kState, kQ)
  const layaSokoDec = readSokobanDecision(layaSokoRes, kCand)
  console.log('Laya Sokoban decision:', layaSokoDec.choice, `(latency: ${layaSokoRes.latencyMs}ms)`)

  console.log('--- Testing Jev on Sokoban ---')
  const jevSokoRes = await jev.ask(kState, kQ)
  const jevSokoDec = readSokobanDecision(jevSokoRes, kCand)
  console.log('Jev Sokoban decision:', jevSokoDec.choice, `(latency: ${jevSokoRes.latencyMs}ms)`)

  console.log('\nAll live model tests passed for both Snake and Sokoban on Jev & Laya!')
}

run().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
