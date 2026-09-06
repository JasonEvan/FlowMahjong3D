import { onValue, ref, runTransaction } from 'firebase/database'
import type { Database } from 'firebase/database'
import { applyAction, createRoom, joinRoom } from './room.ts'
import type { Action, Room } from './room.ts'

export type StoredRoom = {
  host: string; seats: Record<string, { uid: string; name: string; lastSeen: number }>
  createdAt: number; expiresAt: number; revision: number; phase: 'lobby' | 'playing'; payload: string
}
export function encodeRoom(room: Room): StoredRoom {
  return {
    host: room.host,
    seats: Object.fromEntries(Object.entries(room.members).map(([uid, m]) => [m.seat, { uid, name: m.name, lastSeen: m.lastSeen }])),
    createdAt: room.createdAt, expiresAt: room.expiresAt, revision: room.revision,
    phase: room.game || room.opening ? 'playing' : 'lobby',
    payload: JSON.stringify({ game: room.game, opening: room.opening ?? null, decisions: room.decisions, nextAt: room.nextAt }),
  }
}
export function decodeRoom(value: StoredRoom): Room {
  return { opening: null, ...JSON.parse(value.payload), host: value.host, createdAt: value.createdAt, expiresAt: value.expiresAt, revision: value.revision,
    members: Object.fromEntries(Object.entries(value.seats || {}).map(([seat, m]) => [m.uid, { seat: Number(seat), name: m.name, lastSeen: m.lastSeen }])) }
}
export async function mutateRoom(database: Database, code: string, change: (room: Room | null) => Room | null) {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter a six-digit room code.')
  const target = ref(database, `sparkRooms/${code}`)
  // Keep a subscription alive during the transaction. A one-off get does not
  // retain the SDK cache, so its first transaction callback can receive null.
  let stop = () => {}
  await new Promise<void>((resolve, reject) => { stop = onValue(target, () => resolve(), reject) })
  let rejection: Error | undefined
  try {
    const result = await runTransaction(target, value => {
      rejection = undefined
      try { const next = change(value ? decodeRoom(value) : null); return next ? encodeRoom(next) : null }
      catch (error) { rejection = error instanceof Error ? error : new Error('Unable to update the room.'); return undefined }
    }, { applyLocally: false })
    if (!result.committed) throw rejection ?? new Error('Room changed. Please try again.')
  } finally { stop() }
}
export async function enterDatabaseRoom(database: Database, uid: string, kind: 'create' | 'join', rawName: string, code: string | undefined, now: number) {
  const name = rawName.trim().slice(0, 24)
  if (!name) throw new Error('Enter your name.')
  if (kind === 'join') {
    if (!code) throw new Error('Enter a six-digit room code.')
    await mutateRoom(database, code, room => { if (!room) throw new Error('Room not found. Check the code.'); return joinRoom(room, uid, name, now) })
    return code
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0]
    const candidate = String(100000 + random % 900000)
    try {
      await mutateRoom(database, candidate, room => { if (room) throw new Error('Code already in use.'); return createRoom(uid, name, now) })
      return candidate
    } catch (error) {
      if (error instanceof Error && (/Code already in use/.test(error.message) || /permission.denied/i.test(error.message))) continue
      throw error
    }
  }
  throw new Error('Unable to create a room. Check your database rules and try again.')
}
export async function actInDatabaseRoom(database: Database, uid: string, code: string, action: Action, now: number) {
  await mutateRoom(database, code, room => {
    if (!room) throw new Error('Room no longer exists.')
    const next = applyAction(room, uid, action, now)
    return Object.keys(next.members).length ? next : null
  })
}
