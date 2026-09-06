import test from 'node:test'
import assert from 'node:assert/strict'
import { isWinning, newGame, discard, botDiscard, rollForDealer, seatWind, claimOptions, resolveClaims, concealedKongs, declareConcealedKong, botClaim, takeTile } from '../src/game/engine.ts'

test('all four players roll two dice and the highest total selects dealer', () => {
  const values = [0,0, .99,.99, .5,.5, .2,.2]
  const result = rollForDealer([0,1,2,3], () => values.shift())
  assert.deepEqual(result.rolls.map(r => r.dice), [[1,1],[6,6],[4,4],[2,2]])
  assert.equal(result.dealer, 1)
  assert.deepEqual(result.candidates, [1])
})
test('ties preserve only the highest rollers and can repeat until resolved', () => {
  const values = [.99,.99, 0,0, .99,.99, .5,.5]
  const first = rollForDealer([0,1,2,3], () => values.shift())
  assert.equal(first.dealer, null); assert.deepEqual(first.candidates, [0,2])
  const second = rollForDealer(first.candidates, () => .5)
  assert.equal(second.dealer, null); assert.deepEqual(second.rolls.map(r => r.seat), [0,2])
  const reroll = [0,0,.99,.99]
  const third = rollForDealer(second.candidates, () => reroll.shift())
  assert.equal(third.dealer, 2)
})
test('every possible dealer receives the opening draw and winds rotate correctly', () => {
  for (let dealer = 0; dealer < 4; dealer++) {
    const game = newGame(randomSeed(42), dealer)
    assert.equal(game.dealer, dealer); assert.equal(game.turn, dealer)
    assert.deepEqual(game.hands.map(h => h.length), [0,1,2,3].map(seat => seat === dealer ? 14 : 13))
    assert.ok(game.hands[dealer].some(t => t.id === game.drawn))
    assert.equal(game.wall.length, 83)
    assert.deepEqual([0,1,2,3].map(offset => seatWind((dealer + offset) % 4, dealer)), ['East','South','West','North'])
    const next = resolveClaims(discard(game, dealer, botDiscard(game.hands[dealer])), null)
    if (next.result === 'playing') assert.equal(next.turn, (dealer + 1) % 4)
  }
})

test('standard hands, honors, seven pairs, and invalid hands', () => {
  assert.equal(isWinning([0,1,2,3,4,5,9,10,11,27,27,27,31,31]), true)
  assert.equal(isWinning([0,0,0,1,1,1,2,2,2,3,3,3,4,4]), true)
  assert.equal(isWinning([0,0,8,8,9,9,17,17,27,27,30,30,33,33]), true)
  assert.equal(isWinning([0,1,2,3,4,5,9,10,11,27,28,29,31,31]), false)
  assert.equal(isWinning([7,8,9,3,4,5,18,19,20,27,27,27,31,31]), false)
  assert.equal(isWinning([0,0,0,0,0,0,1,1,1,2,2,2,3,3]), false)
  assert.equal(isWinning([0,1,2]), false)
})
function randomSeed(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 } }
test('deal distributes every physical tile exactly once and sorts hands', () => {
  const game = newGame(randomSeed(42))
  assert.deepEqual(game.hands.map(h => h.length), [14,13,13,13])
  assert.equal(game.wall.length, 83)
  assert.equal(new Set([...game.wall, ...game.hands.flat()].map(t => t.id)).size, 136)
  assert.ok(game.hands[0].some(t => t.id === game.drawn))
})
test('rejects out-of-turn and nonexistent discards without changing state', () => {
  const game = newGame(randomSeed(42))
  assert.equal(discard(game, 1, game.hands[1][0].id), game)
  assert.equal(discard(game, 0, -1), game)
})
test('discard win takes priority over an exhausted wall and transfers tile once', () => {
  const game = newGame(randomSeed(42))
  game.wall = []; game.turn = 0; game.hands[0] = [{ id: 135, type: 31 }]
  game.hands[1] = [0,1,2,3,4,5,9,10,11,27,27,27,31].map((type,id) => ({ id, type }))
  game.hands[2] = []; game.hands[3] = []
  const pending = discard(game, 0, 135)
  assert.ok(pending.pending)
  const won = resolveClaims(pending, null)
  assert.equal(won.winner, 1); assert.equal(won.result, 'win')
  assert.equal(won.discards[0].length, 0); assert.equal(won.hands[1].length, 14)
})
test('self-draw ends round before bot discard', () => {
  const game = newGame(randomSeed(42))
  game.hands = [[{id:100,type:33}], [0,1,2,3,4,5,9,10,11,27,27,27,31].map((type,id) => ({type,id})), [], []]
  game.wall = [{id:101,type:31}]
  const waiting = resolveClaims(discard(game, 0, 100), null)
  const won = takeTile(waiting, 1)
  assert.equal(won.winner, 1); assert.equal(won.result, 'win')
  assert.equal(discard(won, 1, 101), won)
})
test('100 seeded bot rounds terminate and preserve all 136 tiles every turn', () => {
  let wins = 0
  for (let seed = 1; seed <= 100; seed++) {
    let game = newGame(randomSeed(seed), seed % 4), turns = 0
    while (game.result === 'playing') {
      const before = JSON.stringify(game)
      const next = game.pending ? resolveClaims(game, botClaim(game, 0)) : game.awaitingDraw ? takeTile(game, game.turn) : concealedKongs(game, game.turn).length ? declareConcealedKong(game, game.turn, concealedKongs(game, game.turn)[0]) : discard(game, game.turn, botDiscard(game.hands[game.turn]))
      assert.equal(JSON.stringify(game), before, 'engine must not mutate prior state')
      game = next; turns++
      const tiles = [...game.wall, ...game.hands.flat(), ...game.discards.flat(), ...game.melds.flatMap(ms => ms.flatMap(m => m.tiles))]
      assert.equal(tiles.length, 136); assert.equal(new Set(tiles.map(t => t.id)).size, 136)
      assert.ok(turns <= 450)
      if (game.result === 'playing') assert.deepEqual(game.hands.map((h,s) => h.length + 3 * game.melds[s].length), [0,1,2,3].map(s => !game.pending && !game.awaitingDraw && s === game.turn ? 14 : 13))
    }
    if (game.result === 'win') { wins++; assert.equal(isWinning(game.hands[game.winner].map(t => t.type), game.melds[game.winner].length), true) }
    else assert.equal(game.wall.length, 0)
  }
  assert.ok(wins > 0, 'bots should complete winning hands')
})
