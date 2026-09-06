import test from 'node:test'
import assert from 'node:assert/strict'
import { newGame, discard, claimOptions, resolveClaims, resolvePlayerClaims, isWinning, concealedKongs, declareConcealedKong, takeTile } from '../src/game/engine.ts'

function fixture(types, turn = 3) {
  const game = newGame(() => .5)
  const pool = Array.from({length:136}, (_,id) => ({id,type:Math.floor(id/4)}))
  game.hands = types.map(hand => hand.map(type => {
    const i = pool.findIndex(t => t.type === type); assert.ok(i >= 0, 'fixture cannot have a fifth copy'); return pool.splice(i,1)[0]
  }))
  game.wall = pool; game.turn = turn; game.result = 'playing'; game.winner = null; game.pending = null; game.melds = [[],[],[],[]]; game.discards = [[],[],[],[]]
  game.drawn = game.hands[turn][0]?.id ?? null
  return game
}
function pending(types, from = 3) { const game = fixture(types, from); return discard(game, from, game.hands[from][0].id) }
const option = (game, kind) => claimOptions(game, 0).find(o => o.kind === kind)
const allIds = game => [...game.wall,...game.hands.flat(),...game.discards.flat(),...game.melds.flatMap(ms=>ms.flatMap(m=>m.tiles))].map(t=>t.id).sort((a,b)=>a-b)

function exposeThreeSets(game, seat) {
  game.melds[seat] = [[0,1,2], [9,10,11], [27,27,27]].map((types, i) => ({
    kind: i === 2 ? 'pong' : 'chi', from: (seat + 3) % 4,
    tiles: types.map(type => game.wall.splice(game.wall.findIndex(t => t.type === type), 1)[0]),
  }))
  return game
}

test('two Chi, one Pong and two pairs win when a matching discard is claimed as Pong', () => {
  for (const seat of [0,1,2,3]) {
    const from = (seat + 3) % 4
    const hands = [[],[],[],[]]; hands[seat] = [4,4,31,31]; hands[from] = [4]
    const game = exposeThreeSets(pending(hands, from), seat)
    const before = JSON.stringify(game)
    const pong = claimOptions(game, seat).find(c => c.kind === 'pong')
    assert.ok(claimOptions(game, seat).some(c => c.kind === 'win'))
    const next = resolvePlayerClaims(game, { [seat]: pong })
    assert.equal(next.result, 'win'); assert.equal(next.winner, seat)
    assert.equal(next.pending, null); assert.equal(next.drawn, null)
    assert.equal(next.wall.length, game.wall.length)
    assert.equal(isWinning(next.hands[seat].map(t => t.type), next.melds[seat].length), true)
    assert.deepEqual(allIds(next), allIds(game))
    assert.equal(discard(next, seat, next.hands[seat][0].id), next)
    assert.equal(JSON.stringify(game), before)
  }
})

test('winning Chi has Mahjong priority over another player’s Pong', () => {
  const game = exposeThreeSets(pending([[3,5,31,31],[4,4],[],[4]]), 0)
  const next = resolveClaims(game, option(game, 'chi'))
  assert.equal(next.result, 'win'); assert.equal(next.winner, 0)
  assert.equal(next.melds[1].length, 0)
  assert.deepEqual(allIds(next), allIds(game))
})

test('Pong with an unmatched remainder still requires a discard; passing a win remains allowed', () => {
  const game = exposeThreeSets(pending([[4,4,30,31],[],[],[4]]), 0)
  const next = resolveClaims(game, option(game, 'pong'))
  assert.equal(next.result, 'playing'); assert.equal(next.winner, null)
  assert.match(next.message, /discard/)
  const winning = exposeThreeSets(pending([[4,4,31,31],[],[],[4]]), 0)
  const drawIndex = winning.wall.findIndex(t => t.type === 32)
  const lastIndex = winning.wall.length - 1
  ;[winning.wall[drawIndex], winning.wall[lastIndex]] = [winning.wall[lastIndex], winning.wall[drawIndex]]
  const passed = resolveClaims(winning, null)
  assert.equal(passed.result, 'playing'); assert.equal(passed.winner, null)
})

test('discard pauses before drawing; pass advances exactly once; stale actions are rejected', () => {
  const game = pending([[4,4],[],[],[4]])
  assert.equal(game.pending.tile.type, 4); assert.equal(game.drawn, null)
  const before = JSON.stringify(game), size = game.wall.length
  assert.equal(discard(game,0,game.hands[0][0].id), game)
  assert.equal(resolveClaims(game,{kind:'chi',tileIds:[]}), game)
  const next = resolveClaims(game,null)
  assert.equal(next.turn,0); assert.equal(next.pending,null); assert.equal(next.wall.length,size)
  assert.equal(next.awaitingDraw, true)
  assert.equal(takeTile(next, 1), next)
  assert.equal(discard(next, 0, next.hands[0][0].id), next)
  const drawn = takeTile(next, 0)
  assert.equal(drawn.wall.length, size-1)
  assert.equal(takeTile(drawn, 0), drawn)
  assert.deepEqual(allIds(drawn), allIds(next))
  assert.equal(resolveClaims(next,null), next); assert.equal(JSON.stringify(game), before)
})
test('Pong consumes two matching hand tiles and latest discard with no draw', () => {
  const game = pending([[4,4,7],[],[],[4]])
  const next = resolveClaims(game,option(game,'pong'))
  assert.equal(next.melds[0][0].kind,'pong'); assert.deepEqual(next.melds[0][0].tiles.map(t=>t.type),[4,4,4])
  assert.equal(next.turn,0); assert.equal(next.hands[0].length,1); assert.equal(next.wall.length,game.wall.length)
  assert.equal(next.discards[3].length,0); assert.equal(next.drawn,null); assert.deepEqual(allIds(next),allIds(game))
})
test('Chi enumerates all three possible sequences only for the next player', () => {
  const game = pending([[2,3,5,6],[2,3],[],[4]])
  const choices = claimOptions(game,0).filter(o=>o.kind==='chi')
  assert.equal(choices.length,3)
  assert.equal(claimOptions(game,1).some(o=>o.kind==='chi'),false)
  const next = resolveClaims(game,choices[2])
  assert.deepEqual(next.melds[0][0].tiles.map(t=>t.type),[4,5,6])
  assert.deepEqual(next.hands[0].map(t=>t.type),[2,3])
  assert.equal(next.wall.length,game.wall.length)
})
test('Chi cannot cross suits, use honors, or claim your own discard', () => {
  for (const [hand,tile] of [[[7,9],8],[[26,28],27],[[28,29],27]]) {
    const game = pending([hand,[],[],[tile]])
    assert.equal(claimOptions(game,0).some(o=>o.kind==='chi'),false)
    assert.deepEqual(claimOptions(game,3),[])
  }
})
test('Pong outranks human Chi; Mahjong outranks bot Pong', () => {
  const game = pending([[3,5],[4,4],[],[4]])
  const next = resolveClaims(game,option(game,'chi'))
  assert.equal(next.turn,1); assert.equal(next.melds[1][0].kind,'pong'); assert.equal(next.melds[0].length,0)
  const win = pending([[0,1,2,3,5,9,10,11,27,27,27,31,31],[4,4],[],[4]])
  assert.equal(win.result,'playing')
  const won = resolveClaims(win,option(win,'win'))
  assert.equal(won.result,'win'); assert.equal(won.winner,0)
})
test('discard Kong consumes three tiles and draws a replacement from the far end', () => {
  const game = pending([[4,4,4,7],[],[],[4]])
  const replacement = game.wall[0]
  const next = resolveClaims(game,option(game,'kong'))
  assert.equal(next.melds[0][0].tiles.length,4); assert.equal(next.drawn,replacement.id)
  assert.equal(next.turn,0); assert.equal(next.wall.length,game.wall.length-1)
  assert.deepEqual(allIds(next),allIds(game))
  game.wall=[]; assert.equal(option(game,'kong'),undefined)
})
test('concealed Kong is optional, draws a replacement, and is illegal in a claim window', () => {
  const game = fixture([[4,4,4,4,7],[],[],[]],0)
  assert.deepEqual(concealedKongs(game,0),[4])
  const next = declareConcealedKong(game,0,4)
  assert.equal(next.melds[0][0].from,null); assert.equal(next.wall.length,game.wall.length-1)
  assert.deepEqual(allIds(next),allIds(game))
  const waiting = pending([[4,4,4,4],[],[],[7]])
  assert.deepEqual(concealedKongs(waiting,0),[])
  assert.equal(declareConcealedKong(waiting,0,4),waiting)
})
test('winning hands account for exposed sets; seven pairs must be closed', () => {
  assert.equal(isWinning([0,1,2,9,10,11,27,27,27,31,31],1),true)
  assert.equal(isWinning([31,31],4),true)
  assert.equal(isWinning([0,0,1,1,2,2,3,3,4,4,5,5,6,6],1),false)
  const game = pending([[0,1,2,9,10,11,27,27,27,31],[],[],[31]])
  game.melds[0] = [{kind:'pong',tiles:[],from:1}]
  const next = resolveClaims(game,option(game,'win'))
  assert.equal(next.winner,0); assert.equal(next.result,'win')
})
