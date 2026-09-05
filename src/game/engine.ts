export type Tile = { id: number; type: number }
export type Game = {
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
export function isWinning(types: number[]): boolean {
  if (types.length !== 14 || types.some(t => !Number.isInteger(t) || t < 0 || t > 33)) return false
  const counts = Array<number>(34).fill(0); types.forEach(t => counts[t]++)
  if (counts.some(n => n > 4)) return false
  if (counts.filter(n => n === 2).length === 7) return true
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
  return { dealer, wall, hands, discards: [[], [], [], []], turn: dealer, moves: 0, winner: win ? dealer : null, result: win ? 'win' : 'playing', drawn: drawn.id, message: win ? `${players[dealer]} win${dealer ? 's' : ''} on the opening draw!` : dealer === 0 ? 'You are the dealer. Choose a tile to discard.' : `${players[dealer]} is the dealer and plays first.` }
}
export function discard(game: Game, seat: number, id: number): Game {
  if (game.result !== 'playing' || seat !== game.turn || !game.hands[seat].some(t => t.id === id)) return game
  const next: Game = { ...game, wall: [...game.wall], hands: game.hands.map(h => [...h]), discards: game.discards.map(h => [...h]), moves: game.moves + 1 }
  const index = next.hands[seat].findIndex(t => t.id === id), tile = next.hands[seat].splice(index, 1)[0]
  next.discards[seat].push(tile)
  for (let offset = 1; offset < 4; offset++) {
    const claimant = (seat + offset) % 4
    if (isWinning([...next.hands[claimant].map(t => t.type), tile.type])) {
      next.discards[seat].pop(); next.hands[claimant].push(tile); sort(next.hands[claimant])
      return { ...next, winner: claimant, result: 'win', drawn: tile.id, message: `${players[claimant]} win${claimant ? 's' : ''} on ${players[seat]}'s ${tileLabel(tile.type)} discard.` }
    }
  }
  if (!next.wall.length) return { ...next, result: 'draw', drawn: null, message: 'The wall is empty. This round is a draw.' }
  next.turn = (seat + 1) % 4
  const drawn = next.wall.pop()!; next.hands[next.turn].push(drawn); sort(next.hands[next.turn]); next.drawn = drawn.id
  if (isWinning(next.hands[next.turn].map(t => t.type))) return { ...next, winner: next.turn, result: 'win', message: `${players[next.turn]} win${next.turn ? 's' : ''} by self-draw!` }
  next.message = `${players[seat]} discarded ${tileLabel(tile.type)}. ${next.turn === 0 ? 'Your turn.' : `${players[next.turn]} is thinking…`}`
  return next
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
