// Run with npm run test:emulator. This test never connects to a production project.
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase, get, goOffline, ref, set } from 'firebase/database'
import { actInDatabaseRoom, decodeRoom, enterDatabaseRoom } from '../src/multiplayer/database.ts'
import { roomView } from '../src/multiplayer/room.ts'

const clients = []
async function client(index) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-mahjong', databaseURL: 'https://demo-mahjong-default-rtdb.firebaseio.com' }, `test-${index}`)
  const auth = getAuth(app), db = getDatabase(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  const result = { app, db, auth, call: async input => {
    const uid = auth.currentUser?.uid || 'unauthenticated'
    if (input.kind === 'action') { await actInDatabaseRoom(db, uid, input.code, input.action, Date.now()); return { code: input.code } }
    return { code: await enterDatabaseRoom(db, uid, input.kind, input.name, input.code, Date.now()) }
  } }
  clients.push(result)
  return result
}
const view = async (client, code) => roomView(decodeRoom((await get(ref(client.db, `sparkRooms/${code}`))).val()), client.auth.currentUser.uid, Date.now())
try {
  const owner = await client(0)
  await assert.rejects(get(ref(owner.db, 'sparkRooms/123456')), /permission/i)
  await signInAnonymously(owner.auth)
  const { code } = await owner.call({ kind: 'create', name: 'Host' })
  assert.match(code, /^\d{6}$/)
  const guests = await Promise.all([1, 2, 3, 4, 5].map(async index => { const guest = await client(index); await signInAnonymously(guest.auth); return guest }))
  const joins = await Promise.allSettled(guests.map((guest, index) => guest.call({ kind: 'join', code, name: `Guest ${index}` })))
  assert.equal(joins.filter(result => result.status === 'fulfilled').length, 3, `concurrent joins: ${joins.map(r => r.status === 'rejected' ? r.reason.message : 'joined').join('; ')}`)
  const admitted = guests.filter((_, index) => joins[index].status === 'fulfilled')
  const outsider = guests.find((_, index) => joins[index].status === 'rejected')
  const waiting = await view(owner, code)
  assert.equal(waiting.seats.filter(seat => seat.human).length, 4)
  await assert.rejects(get(ref(owner.db, 'sparkRooms')), /permission/i)
  const raw = (await get(ref(owner.db, `sparkRooms/${code}`))).val()
  const otherSeat = Object.keys(raw.seats).find(s => raw.seats[s].uid !== owner.auth.currentUser.uid)
  await assert.rejects(set(ref(owner.db, `sparkRooms/${code}/seats/${otherSeat}`), null), /permission/i)
  await assert.rejects(set(ref(owner.db, `sparkRooms/${code}/seats/${otherSeat}/name`), 'tampered'), /permission/i)
  await assert.rejects(set(ref(admitted[0].db, `sparkRooms/${code}/phase`), 'playing'), /permission/i)
  await assert.rejects(outsider.call({ kind: 'action', code, action: { kind: 'start' } }), /member/)
  await assert.rejects(admitted[0].call({ kind: 'action', code, action: { kind: 'start' } }), /host/)
  await owner.call({ kind: 'action', code, action: { kind: 'start' } })
  await assert.rejects(outsider.call({ kind: 'join', code, name: 'Too late' }), /started|permission/i)
  await assert.rejects(get(ref(outsider.db, `sparkRooms/${code}`)), /permission/i)
  const seated = [owner, ...admitted]
  let opening = await view(owner, code)
  assert.equal(opening.game, null)
  while (opening.opening) {
    const snapshots = await Promise.all(seated.map(c => view(c, code)))
    await Promise.all(seated.map((c, i) => snapshots[i].opening.candidates.includes(0)
      ? c.call({ kind: 'action', code, action: { kind: 'roll', revision: snapshots[i].revision } }) : Promise.resolve()))
    opening = await view(owner, code)
    assert.equal(opening.opening.rolls.length, opening.opening.candidates.length)
    await owner.call({ kind: 'action', code, action: { kind: opening.opening.dealer === null ? 'reroll' : 'deal', revision: opening.revision } })
    opening = await view(owner, code)
  }
  const views = await Promise.all(seated.map(c => view(c, code)))
  for (const snapshot of views) {
    assert.equal(snapshot.game.hands[0].length, snapshot.game.dealer === 0 ? 14 : 13)
    assert.ok(snapshot.game.hands.slice(1).flat().every(tile => tile.id < 0))
    assert.ok(snapshot.game.wall.every(tile => tile.id < 0))
    assert.equal(snapshot.game.discards.length, 4, 'JSON preserves empty seat arrays')
  }
  const turn = views.findIndex(v => v.game.turn === 0)
  const action = { kind: 'discard', value: views[turn].game.hands[0][0].id, revision: views[turn].revision }
  await seated[turn].call({ kind: 'action', code, action })
  await assert.rejects(seated[turn].call({ kind: 'action', code, action }), /changed/)
  const after = await Promise.all(seated.map(c => view(c, code)))
  assert.ok(after.every(v => v.game.pending.tile.id === action.value))
  for (let i = 0; i < after.length; i++) {
    if (after[i].options.length) await seated[i].call({ kind: 'action', code, action: { kind: 'claim', claim: null, revision: after[i].revision } })
  }
  await new Promise(resolve => setTimeout(resolve, 1200))
  await owner.call({ kind: 'action', code, action: { kind: 'tick' } })
  assert.equal((await view(owner, code)).game.pending, null)
  const awaiting = await Promise.all(seated.map(c => view(c, code)))
  const drawing = awaiting.findIndex(v => v.game.turn === 0)
  assert.equal(awaiting[drawing].game.awaitingDraw, true)
  const take = { kind: 'take', revision: awaiting[drawing].revision }
  await seated[drawing].call({ kind: 'action', code, action: take })
  await assert.rejects(seated[drawing].call({ kind: 'action', code, action: take }), /changed/)
  assert.equal((await view(seated[drawing], code)).game.wall.length, awaiting[drawing].game.wall.length - 1)
  await owner.call({ kind: 'action', code, action: { kind: 'leave' } })
  assert.equal((await Promise.all(admitted.map(c => view(c, code)))).filter(v => v.host).length, 1)
  await assert.rejects(get(ref(owner.db, `sparkRooms/${code}`)), /permission/i)
  console.log('PASS: Spark-only auth and database, concurrent joins, membership protection, host start, synchronized discard/pass, stale moves, and host transfer.')
} finally {
  clients.forEach(client => goOffline(client.db))
  await Promise.all(clients.map(client => deleteApp(client.app)))
}
// Firebase Auth may keep token refresh timers alive in a Node process.
process.exit(0)
