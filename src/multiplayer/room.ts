import { botDiscard, claimKey, claimOptions, concealedKongs, declareConcealedKong, discard, newGame, resolvePlayerClaims, rollForDealer } from '../game/engine.ts'
import type { Claim, DealerRoll, Game } from '../game/engine.ts'

export const ROOM_LIFETIME = 24 * 60 * 60 * 1000
export const OFFLINE_AFTER = 35_000
export type Member = { seat: number; name: string; lastSeen: number }
export type Opening = { attempt: number; candidates: number[]; rolls: DealerRoll[]; dealer: number | null }
export type Room = {
  host: string; members: Record<string, Member>; createdAt: number; expiresAt: number
  revision: number; game: Game | null; opening: Opening | null; decisions: Record<number, Claim | null>; nextAt: number
}
export type Action = { kind: 'start' } | { kind: 'leave' } | { kind: 'tick' } | { kind: 'roll' | 'reroll' | 'deal'; revision: number } | { kind: 'discard' | 'kong'; value: number; revision: number } | { kind: 'claim'; claim: Claim | null; revision: number }
export type RoomView = {
  host: boolean; revision: number; expiresAt: number; game: Game | null; opening: Opening | null
  seats: { name: string; human: boolean; online: boolean }[]
  options: Claim[]; kongs: number[]; submitted: boolean
}
export function createRoom(uid: string, name: string, now: number): Room {
  return { host: uid, members: { [uid]: { seat: 0, name, lastSeen: now } }, createdAt: now, expiresAt: now + ROOM_LIFETIME, revision: 0, game: null, opening: null, decisions: {}, nextAt: 0 }
}
export function joinRoom(room: Room, uid: string, name: string, now: number): Room {
  if (now >= room.expiresAt) throw new Error('This room has expired. Create a new room.')
  const next = structuredClone(room)
  if (next.members[uid]) { next.members[uid].lastSeen = now; return next }
  if (room.game || room.opening) throw new Error('This round has already started.')
  const seat = [0, 1, 2, 3].find(s => !Object.values(room.members).some(m => m.seat === s))
  if (seat === undefined) throw new Error('This room is full.')
  next.members[uid] = { seat, name, lastSeen: now }
  next.revision++
  return next
}
const online = (member: Member, now: number) => now - member.lastSeen < OFFLINE_AFTER
function advance(room: Room, now: number, random = Math.random) {
  if (room.opening) {
    const opening = room.opening
    for (const seat of opening.candidates) {
      if (!opening.rolls.some(r => r.seat === seat) && !Object.values(room.members).some(m => m.seat === seat && online(m, now))) {
        opening.rolls.push(rollForDealer([seat], random).rolls[0])
      }
    }
    if (opening.rolls.length === opening.candidates.length) {
      const high = Math.max(...opening.rolls.map(r => r.total))
      const tied = opening.rolls.filter(r => r.total === high)
      opening.dealer = tied.length === 1 ? tied[0].seat : null
    }
    return
  }
  const game = room.game
  if (!game || game.result !== 'playing' || now < room.nextAt) return
  const humans = Object.values(room.members).filter(m => online(m, now))
  let next = game
  if (game.pending) {
    const decisions: Record<number, Claim | null> = {}
    for (const member of humans) {
      if (claimOptions(game, member.seat).length && !Object.hasOwn(room.decisions, member.seat)) return
      decisions[member.seat] = room.decisions[member.seat] ?? null
    }
    next = resolvePlayerClaims(game, decisions)
  } else if (!humans.some(m => m.seat === game.turn)) {
    const kong = concealedKongs(game, game.turn)[0]
    next = kong === undefined ? discard(game, game.turn, botDiscard(game.hands[game.turn])) : declareConcealedKong(game, game.turn, kong)
  }
  if (next !== game) { room.game = next; room.decisions = {}; room.revision++; room.nextAt = now + 1100 }
}
export function applyAction(room: Room, uid: string, action: Action, now: number, random = Math.random): Room {
  if (!room.members[uid]) throw new Error('You are not a member of this room.')
  if (now >= room.expiresAt) throw new Error('This room has expired. Create a new room.')
  const next = structuredClone(room), member = next.members[uid]
  member.lastSeen = now
  if (action.kind === 'leave') {
    delete next.members[uid]
    delete next.decisions[member.seat]
    if (next.host === uid) next.host = Object.keys(next.members)[0] ?? ''
    next.revision++
    advance(next, now, random)
    return next
  }
  // A remaining online player can take over when the host disconnects.
  if (!next.members[next.host] || !online(next.members[next.host], now)) next.host = uid
  if (action.kind === 'start') {
    if (next.host !== uid) throw new Error('Only the host can start a round.')
    if (next.opening || next.game?.result === 'playing') throw new Error('A round is already in progress.')
    next.opening = { attempt: 1, candidates: [0, 1, 2, 3], rolls: [], dealer: null }
    next.game = null; next.decisions = {}; next.revision++
  } else if (action.kind === 'roll' || action.kind === 'reroll' || action.kind === 'deal') {
    const opening = next.opening
    if (!opening || action.revision !== next.revision) throw new Error('The table has changed. Please try again.')
    if (action.kind === 'roll') {
      if (!opening.candidates.includes(member.seat) || opening.rolls.some(r => r.seat === member.seat)) throw new Error('You cannot roll again in this attempt.')
      opening.rolls.push(rollForDealer([member.seat], random).rolls[0])
      // Keep the revision stable so concurrent players can submit their rolls.
    } else {
      if (next.host !== uid) throw new Error('Only the host can continue the opening.')
      if (opening.rolls.length !== opening.candidates.length) throw new Error('Wait for every player to roll.')
      if (action.kind === 'deal') {
        if (opening.dealer === null) throw new Error('Tied players must roll again.')
        next.game = newGame(random, opening.dealer); next.opening = null; next.nextAt = now + 1100
      } else {
        if (opening.dealer !== null) throw new Error('The dealer has already been chosen.')
        const high = Math.max(...opening.rolls.map(r => r.total))
        next.opening = { attempt: opening.attempt + 1, candidates: opening.rolls.filter(r => r.total === high).map(r => r.seat), rolls: [], dealer: null }
      }
      next.revision++
    }
  } else if (action.kind !== 'tick') {
    const game = next.game
    if (!game || action.revision !== next.revision) throw new Error('The table has changed. Please try again.')
    if (action.kind === 'claim') {
      if (!game.pending || !claimOptions(game, member.seat).length || Object.hasOwn(next.decisions, member.seat)) throw new Error('No claim is waiting for your decision.')
      if (action.claim && !claimOptions(game, member.seat).some(c => claimKey(c) === claimKey(action.claim!))) throw new Error('Invalid claim.')
      next.decisions[member.seat] = action.claim
      // Claim submissions share the same revision until all decisions resolve.
    } else if (action.kind === 'discard' || action.kind === 'kong') {
      const updated = action.kind === 'discard' ? discard(game, member.seat, action.value) : declareConcealedKong(game, member.seat, action.value)
      if (updated === game) throw new Error('That move is not available.')
      next.game = updated; next.decisions = {}; next.revision++; next.nextAt = now + 1100
    }
  }
  advance(next, now, random)
  return next
}
// Rotate the local display so the recipient is seat zero and mask other hands.
// Spark clients share full state; this is display privacy, not anti-cheat security.
export function roomView(room: Room, uid: string, now: number): RoomView {
  const own = room.members[uid].seat, relative = (seat: number) => (seat - own + 4) % 4
  const absolute = (seat: number) => (seat + own) % 4
  const names = [0, 1, 2, 3].map(seat => Object.values(room.members).find(m => m.seat === seat)?.name ?? `Bot ${seat + 1}`)
  const seats = [0, 1, 2, 3].map(seat => {
    const member = Object.values(room.members).find(m => m.seat === absolute(seat))
    return { name: names[absolute(seat)], human: !!member, online: !!member && online(member, now) }
  })
  const original = room.game
  let game: Game | null = null
  if (original) {
    const reveal = original.result !== 'playing'
    game = {
      ...original, dealer: relative(original.dealer), turn: relative(original.turn), winner: original.winner === null ? null : relative(original.winner),
      drawn: original.turn === own ? original.drawn : null,
      message: original.message.replace(/You|Mei|Jun|Lin/g, name => names[['You', 'Mei', 'Jun', 'Lin'].indexOf(name)]),
      pending: original.pending ? { ...original.pending, seat: relative(original.pending.seat) } : null,
      wall: original.wall.map((_, i) => ({ id: -1000 - i, type: 0 })),
      hands: [0, 1, 2, 3].map(s => original.hands[absolute(s)].map((tile, i) => s === 0 || reveal ? tile : { id: -100 - s * 20 - i, type: 0 })),
      discards: [0, 1, 2, 3].map(s => original.discards[absolute(s)]),
      melds: [0, 1, 2, 3].map(s => original.melds[absolute(s)].map(meld => ({ ...meld, from: meld.from === null ? null : relative(meld.from), tiles: meld.tiles.map((t, i) => !reveal && s !== 0 && meld.from === null && (i === 0 || i === 3) ? { id: -500 - s * 20 - i, type: 0 } : t) }))),
    }
  }
  const opening = room.opening ? { ...room.opening, candidates: room.opening.candidates.map(relative), rolls: room.opening.rolls.map(r => ({ ...r, seat: relative(r.seat) })), dealer: room.opening.dealer === null ? null : relative(room.opening.dealer) } : null
  return { host: room.host === uid, revision: room.revision, expiresAt: room.expiresAt, game, opening, seats, options: original ? claimOptions(original, own) : [], kongs: original ? concealedKongs(original, own) : [], submitted: Object.hasOwn(room.decisions, own) }
}
