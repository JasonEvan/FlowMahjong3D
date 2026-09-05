import { useEffect, useState } from 'react'
import { players, rollForDealer } from './engine'
import './dealer.css'

export default function DealerRoll({ onDeal }: { onDeal: (dealer: number) => void }) {
  const [candidates, setCandidates] = useState([0, 1, 2, 3])
  const [round, setRound] = useState<ReturnType<typeof rollForDealer> | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [attempt, setAttempt] = useState(1)
  const rolling = round !== null && revealed < round.rolls.length
  useEffect(() => {
    if (!rolling) return
    const timer = setTimeout(() => setRevealed(n => n + 1), 800)
    return () => clearTimeout(timer)
  }, [rolling, revealed])
  const roll = () => {
    const next = round ? round.candidates : candidates
    if (round) setAttempt(n => n + 1)
    setCandidates(next); setRevealed(0); setRound(rollForDealer(next))
  }
  const complete = round !== null && !rolling
  return <div className="modal-backdrop dealer-backdrop"><section className="game-modal dealer-modal" role="dialog" aria-modal="true" aria-labelledby="dealer-title" onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); if (buttons.length === 1) { event.preventDefault(); buttons[0].focus() } } }}>
    <p className="game-kicker">BEFORE THE FIRST DRAW · ROLL {attempt}</p><h2 id="dealer-title">Who takes East?</h2>
    <p>Everyone rolls two dice. The highest total becomes dealer and plays first. Only players tied for the highest total roll again.</p>
    <div className="dealer-rolls">{players.map((name, seat) => {
      const index = round?.rolls.findIndex(r => r.seat === seat) ?? -1
      const result = index >= 0 && index < revealed ? round!.rolls[index] : null
      const active = rolling && index === revealed
      const winner = complete && round.dealer === seat
      return <div key={seat} className={`dealer-player ${active ? 'dealer-rolling' : ''} ${winner ? 'dealer-winner' : ''} ${!candidates.includes(seat) ? 'dealer-out' : ''}`}>
        <strong>{name} <small>{seat === 0 ? 'YOU' : 'BOT'}</small></strong>
        <div className={`dice-pair ${active ? 'dice-tumbling' : ''}`} aria-label={result ? `${result.dice[0]} and ${result.dice[1]}` : active ? 'Rolling' : 'Waiting'}>{[0, 1].map(i => <span key={i} aria-hidden="true">{result ? '⚀⚁⚂⚃⚄⚅'[result.dice[i] - 1] : active ? '⚄⚂'[i] : '□'}</span>)}</div>
        <p>{winner ? `Dealer · ${result!.total}` : result ? `Total ${result.total}` : active ? 'Rolling…' : candidates.includes(seat) ? 'Ready to roll' : 'Out of the tie'}</p>
      </div>
    })}</div>
    <p className="dealer-announcement" role="status" aria-live="polite">{rolling ? `${players[round.rolls[revealed].seat]} is rolling…` : complete ? round.dealer !== null ? `${players[round.dealer]} ${round.dealer === 0 ? 'are' : 'is'} the dealer (East). The dealer receives 14 tiles; everyone else receives 13.` : `${round.candidates.map(s => players[s]).join(' and ')} tied at ${Math.max(...round.rolls.map(r => r.total))}. Roll again to decide.` : 'Roll to choose the starting player.'}</p>
    <button autoFocus className="discard-button" disabled={rolling} onClick={() => complete && round.dealer !== null ? onDeal(round.dealer) : roll()}>{rolling ? 'Rolling dice…' : complete && round.dealer !== null ? 'Deal tiles →' : round ? 'Roll tied players again' : 'Roll dice for all players'}</button>
  </section></div>
}
