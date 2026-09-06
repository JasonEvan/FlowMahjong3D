import type { Action, RoomView } from './room'
import '../game/game.css'
import '../game/dealer.css'

export default function OnlineOpening({ code, view, busy, connected, error, act, leave }: {
  code: string; view: RoomView; busy: boolean; connected: boolean; error: string
  act: (action: Action) => Promise<void>; leave: () => Promise<void>
}) {
  const opening = view.opening!
  const complete = opening.rolls.length === opening.candidates.length
  const canRoll = opening.candidates.includes(0) && !opening.rolls.some(r => r.seat === 0)
  const enabled = connected && !busy
  return <div className="game-page">
    <header className="game-header"><a className="game-brand" href="/"><span>東</span> mahjong / 3D</a><span>ROOM {code} · {connected ? 'ONLINE' : 'RECONNECTING…'}</span><button disabled={!enabled} onClick={leave}>Leave table</button></header>
    <main className="room-main"><section className="game-modal dealer-modal" aria-labelledby="online-dealer-title">
      <p className="game-kicker">BEFORE THE FIRST DRAW · ROLL {opening.attempt}</p>
      <h2 id="online-dealer-title">Who takes East?</h2>
      <p>Each player rolls two dice. The highest total becomes dealer and plays first. Only players tied for the highest total roll again.</p>
      <div className="dealer-rolls">{view.seats.map((player, seat) => {
        const result = opening.rolls.find(r => r.seat === seat)
        const candidate = opening.candidates.includes(seat)
        return <div key={seat} className={`dealer-player ${opening.dealer === seat ? 'dealer-winner' : ''} ${!candidate ? 'dealer-out' : ''}`}>
          <strong>{player.name}{seat === 0 ? ' (you)' : ''}</strong><small>{!player.human ? 'BOT' : !player.online ? 'BOT COVERING' : 'PLAYER'}</small>
          <div className={`dice-pair ${seat === 0 && canRoll && busy ? 'dice-tumbling' : ''}`} aria-label={result ? `${result.dice[0]} and ${result.dice[1]}` : 'Waiting to roll'}>{[0, 1].map(i => <span key={i} aria-hidden="true">{result ? '⚀⚁⚂⚃⚄⚅'[result.dice[i] - 1] : '□'}</span>)}</div>
          <p>{result ? `${opening.dealer === seat ? 'Dealer · ' : 'Total '}${result.total}` : candidate ? 'Waiting to roll' : 'Out of the tie'}</p>
        </div>
      })}</div>
      <p className="dealer-announcement" role="status">{!connected ? 'Reconnecting to the table…' : opening.dealer !== null ? `${view.seats[opening.dealer].name} takes East and receives 14 tiles. Everyone else receives 13.` : complete ? 'The highest total is tied. The host can start another roll for the tied players.' : canRoll ? 'Your turn to roll your dice.' : 'Waiting for the other players to roll…'}</p>
      {canRoll && <button autoFocus className="discard-button" disabled={!enabled} onClick={() => act({ kind: 'roll', revision: view.revision })}>{busy ? 'Rolling…' : 'Roll my dice'}</button>}
      {complete && (view.host ? <button className="discard-button" disabled={!enabled} onClick={() => act({ kind: opening.dealer === null ? 'reroll' : 'deal', revision: view.revision })}>{opening.dealer === null ? 'Roll tied players again' : 'Deal tiles →'}</button> : <p>Waiting for the host to {opening.dealer === null ? 'start the next roll' : 'deal the tiles'}.</p>)}
      <p>Empty seats and players away for 35 seconds roll automatically.</p>
      {error && <p className="room-error" role="alert">{error}</p>}
    </section></main>
  </div>
}
