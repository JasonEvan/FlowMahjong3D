export type Tile = { id: number; type: number }
export type Meld = { kind: 'chi' | 'pong' | 'kong'; tiles: Tile[]; from: number | null }
export type Claim = { kind: 'win' | 'chi' | 'pong' | 'kong'; tileIds: number[] }
export type Game = {
  melds: Meld[][]; pending: { seat: number; tile: Tile } | null;
  dealer: number;
  wall: Tile[]; hands: Tile[][]; discards: Tile[][]; turn: number; moves: number;
  winner: number | null; result: 'playing' | 'win' | 'draw'; message: string; drawn: number | null;
}
export const players = ['You', 'Mei', 'Jun', 'Lin']
export const winds = ['East', 'South', 'West', 'North']
export const seatWind = (seat: number, dealer: number) => winds[(seat - dealer + 4) % 4]
export type DealerRoll = { seat: number; dice: [number, number]; total: number }
export function rollForDealer(candidates: number[], random = Math.random) {
  if (!candidates.length || new Set(candidates).size !== candidates.length || candidates.some(s => !Number.isInteger(s) || s < 0 || s > 3)) throw new Error('Invalid dealer candidates')
  const rolls: DealerRoll[] = candidates.map(seat => {
    const dice: [number, number] = [Math.floor(random() * 6) + 1, Math.floor(random() * 6) + 1]
    return { seat, dice, total: dice[0] + dice[1] }
  })
  const high = Math.max(...rolls.map(r => r.total))
  const tied = rolls.filter(r => r.total === high).map(r => r.seat)
  return { rolls, candidates: tied, dealer: tied.length === 1 ? tied[0] : null }
}
export function tileLabel(type: number) {
  return type < 27 ? `${type % 9 + 1} ${['characters', 'bamboo', 'circles'][Math.floor(type / 9)]}` : ['East wind', 'South wind', 'West wind', 'North wind', 'Red dragon', 'Green dragon', 'White dragon'][type - 27]
}
export function isWinning(types: number[], meldCount = 0): boolean {
  if (!Number.isInteger(meldCount) || meldCount < 0 || meldCount > 4 || types.length !== 14 - 3 * meldCount || types.some(t => !Number.isInteger(t) || t < 0 || t > 33)) return false
  const counts = Array<number>(34).fill(0); types.forEach(t => counts[t]++)
  if (counts.some(n => n > 4)) return false
  if (meldCount === 0 && counts.filter(n => n === 2).length === 7) return true
  function melds(): boolean {
    const i = counts.findIndex(n => n > 0)
    if (i === -1) return true
    if (counts[i] >= 3) { counts[i] -= 3; const ok = melds(); counts[i] += 3; if (ok) return true }
    if (i < 27 && i % 9 < 7 && counts[i + 1] && counts[i + 2]) {
      counts[i]--; counts[i + 1]--; counts[i + 2]--
      const ok = melds(); counts[i]++; counts[i + 1]++; counts[i + 2]++; if (ok) return true
    }
    return false
  }
  for (let i = 0; i < 34; i++) if (counts[i] >= 2) { counts[i] -= 2; const ok = melds(); counts[i] += 2; if (ok) return true }
  return false
}
const sort = (hand: Tile[]) => hand.sort((a, b) => a.type - b.type || a.id - b.id)
export function newGame(random = Math.random, dealer = 0): Game {
  if (!Number.isInteger(dealer) || dealer < 0 || dealer > 3) throw new Error('Invalid dealer')
  const wall = Array.from({ length: 136 }, (_, id) => ({ id, type: Math.floor(id / 4) }))
  for (let i = wall.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [wall[i], wall[j]] = [wall[j], wall[i]] }
  const hands = Array.from({ length: 4 }, () => sort(wall.splice(0, 13)))
  const drawn = wall.pop()!; hands[dealer].push(drawn); sort(hands[dealer])
  const win = isWinning(hands[dealer].map(t => t.type))
  return { dealer, wall, hands, melds: [[], [], [], []], pending: null, discards: [[], [], [], []], turn: dealer, moves: 0, winner: win ? dealer : null, result: win ? 'win' : 'playing', drawn: drawn.id, message: win ? `${players[dealer]} win${dealer ? 's' : ''} on the opening draw!` : dealer === 0 ? 'You are the dealer. Choose a tile to discard.' : `${players[dealer]} is the dealer and plays first.` }
}
function copyGame(game: Game): Game {
  return { ...game, wall: [...game.wall], hands: game.hands.map(h => [...h]), discards: game.discards.map(h => [...h]), melds: game.melds.map(m => [...m]) }
}
function drawTile(game: Game, seat: number, replacement = false): Game {
  if (!game.wall.length) return { ...game, pending: null, result: 'draw', drawn: null, message: 'The wall is empty. This round is a draw.' }
  game.turn = seat; game.pending = null
  const tile = (replacement ? game.wall.shift() : game.wall.pop())!
  game.hands[seat].push(tile); sort(game.hands[seat]); game.drawn = tile.id
  if (isWinning(game.hands[seat].map(t => t.type), game.melds[seat].length)) {
    game.winner = seat; game.result = 'win'
    game.message = `${players[seat]} win${seat ? 's' : ''} by ${replacement ? 'Kong replacement draw' : 'self-draw'}!`
  } else game.message = `${replacement ? 'Kong replacement drawn. ' : ''}${seat === 0 ? 'Your turn. Choose a tile to discard.' : players[seat] + ' is thinking…'}`
  return game
}
export function discard(game: Game, seat: number, id: number): Game {
  if (game.result !== 'playing' || game.pending || seat !== game.turn || !game.hands[seat].some(t => t.id === id)) return game
  const next = copyGame(game)
  const index = next.hands[seat].findIndex(t => t.id === id), tile = next.hands[seat].splice(index, 1)[0]
  next.discards[seat].push(tile); next.moves++; next.drawn = null
  next.pending = { seat, tile }
  next.message = `${players[seat]} discarded ${tileLabel(tile.type)}. Waiting for claims.`
  return next
}
export function claimOptions(game: Game, seat: number): Claim[] {
  if (!game.pending || game.result !== 'playing' || seat === game.pending.seat || !game.hands[seat]) return []
  const { tile, seat: from } = game.pending, hand = game.hands[seat], result: Claim[] = []
  if (isWinning([...hand.map(t => t.type), tile.type], game.melds[seat].length)) result.push({ kind: 'win', tileIds: [] })
  if (game.melds[seat].length >= 4) return result
  const matching = hand.filter(t => t.type === tile.type)
  if (matching.length >= 2) result.push({ kind: 'pong', tileIds: matching.slice(0, 2).map(t => t.id) })
  if (matching.length >= 3 && game.wall.length) result.push({ kind: 'kong', tileIds: matching.slice(0, 3).map(t => t.id) })
  if (seat === (from + 1) % 4 && tile.type < 27) {
    for (let start = tile.type - 2; start <= tile.type; start++) {
      if (start < 0 || start % 9 > 6 || Math.floor(start / 9) !== Math.floor(tile.type / 9)) continue
      const needed = [start, start + 1, start + 2].filter(t => t !== tile.type).map(type => hand.find(t => t.type === type))
      if (needed.every(t => t !== undefined)) result.push({ kind: 'chi', tileIds: needed.map(t => t!.id) })
    }
  }
  return result
}
export const claimKey = (claim: Claim) => claim.kind + ':' + claim.tileIds.join(',')
export function botClaim(game: Game, seat: number): Claim | null {
  const options = claimOptions(game, seat)
  return ['win', 'kong', 'pong', 'chi'].map(kind => options.find(o => o.kind === kind)).find(o => o !== undefined) ?? null
}
// Collect all decisions before resolving priorities. A human can pass without a timer.
export function resolveClaims(game: Game, human: Claim | null): Game {
  if (!game.pending || game.result !== 'playing') return game
  if (human && !claimOptions(game, 0).some(o => claimKey(o) === claimKey(human))) return game
  const from = game.pending.seat
  const decisions: { seat: number; claim: Claim }[] = []
  for (let seat = 0; seat < 4; seat++) {
    const claim = seat === 0 ? human : botClaim(game, seat)
    if (claim) decisions.push({ seat, claim })
  }
  const priority = { win: 3, kong: 2, pong: 2, chi: 1 }
  decisions.sort((a, b) => priority[b.claim.kind] - priority[a.claim.kind] || (a.seat - from + 4) % 4 - (b.seat - from + 4) % 4)
  const next = copyGame(game), choice = decisions[0]
  if (!choice) return drawTile(next, (from + 1) % 4)
  const { seat, claim } = choice, tile = next.discards[from].pop()!
  next.pending = null; next.turn = seat; next.drawn = null
  if (claim.kind === 'win') {
    next.hands[seat].push(tile); sort(next.hands[seat]); next.winner = seat; next.result = 'win'
    next.message = `${players[seat]} win${seat ? 's' : ''} on ${players[from]}'s ${tileLabel(tile.type)} discard.`
    return next
  }
  const consumed = next.hands[seat].filter(t => claim.tileIds.includes(t.id))
  next.hands[seat] = next.hands[seat].filter(t => !claim.tileIds.includes(t.id))
  next.melds[seat].push({ kind: claim.kind, tiles: sort([...consumed, tile]), from })
  if (claim.kind === 'kong') return drawTile(next, seat, true)
  next.message = `${players[seat]} claimed ${claim.kind === 'chi' ? 'Chi (Che)' : 'Pong'}. ${seat === 0 ? 'Choose a tile to discard; no wall draw is needed.' : 'They discard next.'}`
  return next
}
export function concealedKongs(game: Game, seat: number): number[] {
  if (game.result !== 'playing' || game.pending || game.turn !== seat || game.drawn === null || !game.wall.length || game.melds[seat].length >= 4) return []
  return [...new Set(game.hands[seat].map(t => t.type))].filter(type => game.hands[seat].filter(t => t.type === type).length === 4)
}
export function declareConcealedKong(game: Game, seat: number, type: number): Game {
  if (!concealedKongs(game, seat).includes(type)) return game
  const next = copyGame(game)
  const tiles = next.hands[seat].filter(t => t.type === type)
  next.hands[seat] = next.hands[seat].filter(t => t.type !== type)
  next.melds[seat].push({ kind: 'kong', tiles, from: null })
  return drawTile(next, seat, true)
}
export function botTurn(game: Game): Game {
  if (game.pending || game.result !== 'playing' || game.turn === 0) return game
  const kong = concealedKongs(game, game.turn)[0]
  return kong !== undefined ? declareConcealedKong(game, game.turn, kong) : discard(game, game.turn, botDiscard(game.hands[game.turn]))
}
// Only the bot's own hand is scored: it cannot see the wall or other hands.
export function botDiscard(hand: Tile[]): number {
  const counts = Array<number>(34).fill(0); hand.forEach(t => counts[t.type]++)
  let lowest = Infinity, choice = hand[0].id
  for (const tile of hand) {
    const t = tile.type
    let score = counts[t] >= 3 ? 12 : counts[t] === 2 ? 6 : 0
    if (t < 27) {
      for (const d of [-2, -1, 1, 2]) if (t + d >= 0 && Math.floor((t + d) / 9) === Math.floor(t / 9) && counts[t + d]) score += Math.abs(d) === 1 ? 2.5 : 1
      if (t % 9 > 0 && t % 9 < 8) score += .25
    }
    if (score < lowest) { lowest = score; choice = tile.id }
  }
  return choice
}
