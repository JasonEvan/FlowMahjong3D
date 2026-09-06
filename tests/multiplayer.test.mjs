import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAction, createRoom, joinRoom, roomView, OFFLINE_AFTER, ROOM_LIFETIME } from '../src/multiplayer/room.ts'
import { claimOptions, newGame } from '../src/game/engine.ts'

function seeded(seed = 12) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 } }
function lobby() { return joinRoom(createRoom('A', 'Alice', 0), 'B', 'Bob', 0) }
function start(room = lobby()) { return applyAction(room, 'A', { kind: 'start' }, 100, seeded()) }

test('four distinct seats, capacity, rejoin, expiry, and host-only start', () => {
  const room = joinRoom(joinRoom(lobby(), 'C', 'Claire', 0), 'D', 'Dan', 0)
  assert.deepEqual(Object.values(room.members).map(m => m.seat), [0, 1, 2, 3])
  assert.throws(() => joinRoom(room, 'E', 'Eve', 0), /full/)
  assert.equal(Object.keys(joinRoom(room, 'A', 'Alice', 1).members).length, 4)
  assert.throws(() => applyAction(room, 'B', { kind: 'start' }, 1), /host/)
  assert.throws(() => joinRoom(room, 'E', 'Eve', ROOM_LIFETIME), /expired/)
  assert.throws(() => applyAction(room, 'outsider', { kind: 'tick' }, 1), /member/)
  const running = start(room)
  assert.throws(() => joinRoom(running, 'E', 'Eve', 500), /started/)
  assert.equal(joinRoom(running, 'A', 'Alice', 500).members.A.seat, 0)
})
test('moves reject other seats and stale revisions, preserving original state', () => {
  let room = start()
  room.game.turn = 0
  const before = JSON.stringify(room), value = room.game.hands[0][0].id
  assert.throws(() => applyAction(room, 'B', { kind: 'discard', value, revision: room.revision }, 500), /not available/)
  assert.throws(() => applyAction(room, 'A', { kind: 'discard', value, revision: -1 }, 500), /changed/)
  assert.equal(JSON.stringify(room), before)
  const action = { kind: 'discard', value, revision: room.revision }
  room = applyAction(room, 'A', action, 500)
  assert.throws(() => applyAction(room, 'A', action, 501), /changed/)
  assert.equal(room.game.pending.tile.id, value)
})
test('CHI waits for PONG from another human, regardless of submission order', () => {
  for (const pongFirst of [false, true]) {
    let room = joinRoom(joinRoom(lobby(), 'C', 'Claire', 0), 'D', 'Dan', 0)
    room.game = newGame(seeded()); room.game.turn = 0; room.game.result = 'playing'
    room.game.hands = [[{ id: 16, type: 4 }], [{ id: 12, type: 3 }, { id: 20, type: 5 }], [], [{ id: 17, type: 4 }, { id: 18, type: 4 }]]
    room = applyAction(room, 'A', { kind: 'discard', value: 16, revision: room.revision }, 100)
    const chi = claimOptions(room.game, 1).find(c => c.kind === 'chi'), pong = claimOptions(room.game, 3).find(c => c.kind === 'pong')
    const first = pongFirst ? ['D', pong] : ['B', chi], second = pongFirst ? ['B', chi] : ['D', pong]
    room = applyAction(room, first[0], { kind: 'claim', claim: first[1], revision: room.revision }, 1500)
    assert.ok(room.game.pending, 'must wait for the other human')
    assert.equal(roomView(room, first[0], 1500).submitted, true)
    assert.throws(() => applyAction(room, first[0], { kind: 'claim', claim: null, revision: room.revision }, 1501), /No claim/)
    room = applyAction(room, second[0], { kind: 'claim', claim: second[1], revision: room.revision }, 1502)
    assert.equal(room.game.pending, null); assert.equal(room.game.turn, 3)
    assert.equal(room.game.melds[3][0].kind, 'pong'); assert.equal(room.game.melds[1].length, 0)
  }
})
test('pass allows human CHI, while a disconnected claimant is covered by a bot', () => {
  for (const disconnect of [false, true]) {
    let room = joinRoom(joinRoom(lobby(), 'C', 'Claire', 0), 'D', 'Dan', 0)
    room.game = newGame(seeded()); room.game.turn = 0; room.game.result = 'playing'
    room.game.hands = [[{ id: 16, type: 4 }], [{ id: 12, type: 3 }, { id: 20, type: 5 }], [], [{ id: 17, type: 4 }, { id: 18, type: 4 }]]
    room = applyAction(room, 'A', { kind: 'discard', value: 16, revision: room.revision }, 100)
    room = applyAction(room, 'B', { kind: 'claim', claim: claimOptions(room.game, 1)[0], revision: room.revision }, 1500)
    room = disconnect ? applyAction(room, 'B', { kind: 'tick' }, OFFLINE_AFTER + 100) : applyAction(room, 'D', { kind: 'claim', claim: null, revision: room.revision }, 1501)
    assert.equal(room.game.turn, disconnect ? 3 : 1)
  }
})
test('display views rotate seats and mask wall and opponent concealed hand tiles', () => {
  const room = start(), game = room.game
  const view = roomView(room, 'B', 100)
  assert.deepEqual(view.game.hands[0], game.hands[1])
  assert.equal(view.game.dealer, (game.dealer + 3) % 4)
  assert.equal(view.game.turn, (game.turn + 3) % 4)
  assert.ok(view.game.hands.slice(1).flat().every(t => t.type === 0 && t.id < 0))
  assert.ok(view.game.wall.every(t => t.type === 0 && t.id < 0))
  assert.equal(view.seats[0].name, 'Bob'); assert.equal(view.seats[3].name, 'Alice')
  game.result = 'win'; game.winner = 0
  assert.deepEqual(roomView(room, 'B', 100).game.hands[3], game.hands[0])
})
test('host departure transfers ownership; disconnected host is replaced; leaving frees lobby seat', () => {
  const left = applyAction(lobby(), 'A', { kind: 'leave' }, 10)
  assert.equal(left.host, 'B')
  assert.equal(joinRoom(left, 'C', 'Claire', 11).members.C.seat, 0)
  const away = applyAction(lobby(), 'B', { kind: 'tick' }, OFFLINE_AFTER)
  assert.equal(away.host, 'B')
  assert.equal(roomView(away, 'B', OFFLINE_AFTER).seats[3].online, false)
})
test('empty seats play as bots, including seat zero after host leaves', () => {
  let room = start()
  room = applyAction(room, 'A', { kind: 'leave' }, 500)
  room.game.turn = 0; room.game.pending = null
  const before = room.game.moves
  room = applyAction(room, 'B', { kind: 'tick' }, 2000)
  assert.equal(room.game.moves, before + 1)
  assert.equal(room.game.pending.seat, 0)
})
test('a seeded online round with one human and three bots conserves all tiles and finishes', () => {
  let room = start(createRoom('A', 'Alice', 0)), now = 1500
  for (let step = 0; step < 1500 && room.game.result === 'playing'; step++) {
    const game = room.game, revision = room.revision
    if (game.pending && claimOptions(game, 0).length) room = applyAction(room, 'A', { kind: 'claim', claim: null, revision }, now)
    else if (!game.pending && game.turn === 0) room = applyAction(room, 'A', { kind: 'discard', value: game.hands[0][0].id, revision }, now)
    else room = applyAction(room, 'A', { kind: 'tick' }, now)
    const all = [...room.game.wall, ...room.game.hands.flat(), ...room.game.discards.flat(), ...room.game.melds.flatMap(m => m.flatMap(set => set.tiles))]
    assert.equal(all.length, 136); assert.equal(new Set(all.map(t => t.id)).size, 136)
    now += 1500
  }
  assert.notEqual(room.game.result, 'playing')
})
