import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAction, createRoom, joinRoom, roomView, OFFLINE_AFTER, ROOM_LIFETIME } from '../src/multiplayer/room.ts'
import { claimOptions, newGame } from '../src/game/engine.ts'
import { encodeRoom, decodeRoom } from '../src/multiplayer/database.ts'

function seeded(seed = 12) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 } }
function lobby() { return joinRoom(createRoom('A', 'Alice', 0), 'B', 'Bob', 0) }
function start(room = lobby()) {
  const random = seeded()
  room = applyAction(room, 'A', { kind: 'start' }, 100, random)
  while (room.opening) {
    for (const [uid, member] of Object.entries(room.members)) {
      if (room.opening.candidates.includes(member.seat)) room = applyAction(room, uid, { kind: 'roll', revision: room.revision }, 100, random)
    }
    room = applyAction(room, 'A', { kind: room.opening.dealer === null ? 'reroll' : 'deal', revision: room.revision }, 100, random)
  }
  return room
}

test('opening persists shared dice, waits for humans, rejects skips and duplicate rolls', () => {
  let room = applyAction(lobby(), 'A', { kind: 'start' }, 100, () => 0)
  const revision = room.revision
  assert.equal(room.game, null)
  assert.deepEqual(room.opening.rolls.map(r => r.seat), [2, 3])
  assert.equal(encodeRoom(room).phase, 'playing')
  assert.deepEqual(decodeRoom(encodeRoom(room)), room)
  assert.throws(() => joinRoom(room, 'C', 'Claire', 100), /started/)
  assert.throws(() => applyAction(room, 'A', { kind: 'start' }, 100), /progress/)
  assert.throws(() => applyAction(room, 'A', { kind: 'deal', revision }, 100), /every player/)
  room = applyAction(room, 'A', { kind: 'roll', revision }, 100, () => .99)
  assert.throws(() => applyAction(room, 'A', { kind: 'roll', revision }, 100), /again/)
  room = applyAction(room, 'B', { kind: 'roll', revision }, 100, () => .5)
  assert.equal(room.game, null)
  const guest = roomView(room, 'B', 100)
  assert.equal(guest.opening.dealer, 3)
  assert.deepEqual(guest.opening.rolls.find(r => r.seat === 3).dice, [6, 6])
  assert.throws(() => applyAction(room, 'B', { kind: 'deal', revision }, 100), /host/)
  room = applyAction(room, 'A', { kind: 'deal', revision }, 100, seeded())
  assert.equal(room.opening, null)
  assert.equal(room.game.dealer, 0)
  assert.equal(room.game.turn, 0)
  assert.deepEqual(room.game.hands.map(h => h.length), [14, 13, 13, 13])
  room.game.result = 'draw'
  room = applyAction(room, 'A', { kind: 'start' }, 101, () => 0)
  assert.equal(room.game, null)
  assert.equal(room.opening.attempt, 1)
})

test('ties reroll only highest players, including repeated ties and stale requests', () => {
  let room = applyAction(lobby(), 'A', { kind: 'start' }, 100, () => 0)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const revision = room.revision
    room = applyAction(room, 'A', { kind: 'roll', revision }, 100, () => .99)
    room = applyAction(room, 'B', { kind: 'roll', revision }, 100, () => .99)
    assert.equal(room.opening.dealer, null)
    assert.throws(() => applyAction(room, 'A', { kind: 'deal', revision }, 100), /Tied/)
    room = applyAction(room, 'A', { kind: 'reroll', revision }, 100)
    assert.deepEqual(room.opening.candidates, [0, 1])
    assert.equal(room.opening.attempt, attempt + 1)
    assert.throws(() => applyAction(room, 'A', { kind: 'roll', revision }, 100), /changed/)
  }
})

test('disconnected and departed players roll through bot coverage during opening', () => {
  for (const leave of [false, true]) {
    let room = applyAction(lobby(), 'A', { kind: 'start' }, 100, () => 0)
    room = applyAction(room, 'B', { kind: 'roll', revision: room.revision }, 100, () => .99)
    room = leave ? applyAction(room, 'A', { kind: 'leave' }, 101, () => 0) : applyAction(room, 'B', { kind: 'tick' }, OFFLINE_AFTER + 100, () => 0)
    assert.equal(room.host, 'B')
    assert.equal(room.opening.rolls.length, 4)
    assert.equal(room.opening.dealer, 1)
    assert.equal(room.game, null)
  }
})

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
test('online Pong completing four sets and a pair ends the round for every player', () => {
  let room = lobby()
  room.game = newGame(seeded()); room.game.turn = 0; room.game.result = 'playing'
  room.game.hands = [[{ id: 18, type: 4 }], [{ id: 16, type: 4 }, { id: 17, type: 4 }, { id: 124, type: 31 }, { id: 125, type: 31 }], [], []]
  room.game.melds[1] = [
    { kind: 'chi', from: 0, tiles: [{ id: 0, type: 0 }, { id: 4, type: 1 }, { id: 8, type: 2 }] },
    { kind: 'chi', from: 0, tiles: [{ id: 36, type: 9 }, { id: 40, type: 10 }, { id: 44, type: 11 }] },
    { kind: 'pong', from: 2, tiles: [{ id: 108, type: 27 }, { id: 109, type: 27 }, { id: 110, type: 27 }] },
  ]
  const used = new Set([...room.game.hands.flat(), ...room.game.melds[1].flatMap(m => m.tiles)].map(t => t.id))
  room.game.wall = Array.from({ length: 136 }, (_, id) => ({ id, type: Math.floor(id / 4) })).filter(t => !used.has(t.id))
  room = applyAction(room, 'A', { kind: 'discard', value: 18, revision: room.revision }, 100)
  const claim = roomView(room, 'B', 100).options.find(c => c.kind === 'pong')
  room = applyAction(room, 'B', { kind: 'claim', claim, revision: room.revision }, 1500)
  assert.equal(room.game.result, 'win'); assert.equal(room.game.winner, 1)
  assert.equal(roomView(room, 'B', 1500).game.winner, 0)
  assert.equal(roomView(room, 'A', 1500).game.winner, 1)
  assert.throws(() => applyAction(room, 'B', { kind: 'discard', value: 124, revision: room.revision }, 1600), /not available/)
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
test('players without claims pass automatically, then human Take draws exactly once', () => {
  let room = lobby()
  room.game = newGame(seeded()); room.game.turn = 0; room.game.result = 'playing'
  room.game.hands = [[{ id: 0, type: 0 }], [{ id: 124, type: 31 }], [], []]
  room = applyAction(room, 'A', { kind: 'discard', value: 0, revision: room.revision }, 100)
  const size = room.game.wall.length
  assert.deepEqual(roomView(room, 'B', 100).options, [])
  assert.throws(() => applyAction(room, 'B', { kind: 'take', revision: room.revision }, 101), /not available/)
  assert.throws(() => applyAction(room, 'B', { kind: 'claim', claim: null, revision: room.revision }, 101), /No claim/)
  for (const now of [1500, 10000, 20000]) {
    room = applyAction(room, 'B', { kind: 'tick' }, now)
    assert.equal(room.game.pending, null)
    assert.equal(room.game.wall.length, size)
  }
  assert.equal(room.game.pending, null); assert.equal(room.game.awaitingDraw, true)
  room = applyAction(room, 'B', { kind: 'tick' }, 22000)
  assert.equal(room.game.wall.length, size)
  assert.throws(() => applyAction(room, 'A', { kind: 'take', revision: room.revision }, 22000), /not available/)
  const action = { kind: 'take', revision: room.revision }
  room = applyAction(room, 'B', action, 22001)
  assert.equal(room.game.wall.length, size - 1)
  assert.equal(room.game.awaitingDraw, false)
  assert.throws(() => applyAction(room, 'B', action, 22002), /changed/)
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
    else if (!game.pending && game.turn === 0 && game.awaitingDraw) room = applyAction(room, 'A', { kind: 'take', revision }, now)
    else if (!game.pending && game.turn === 0) room = applyAction(room, 'A', { kind: 'discard', value: game.hands[0][0].id, revision }, now)
    else room = applyAction(room, 'A', { kind: 'tick' }, now)
    const all = [...room.game.wall, ...room.game.hands.flat(), ...room.game.discards.flat(), ...room.game.melds.flatMap(m => m.flatMap(set => set.tiles))]
    assert.equal(all.length, 136); assert.equal(new Set(all.map(t => t.id)).size, 136)
    now += 1500
  }
  assert.notEqual(room.game.result, 'playing')
})
