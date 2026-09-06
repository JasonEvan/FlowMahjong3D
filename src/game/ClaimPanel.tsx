import { claimKey, tileLabel } from './engine'
import type { Claim, Game } from './engine'

export default function ClaimPanel({ game, names, faces, options, enabled, submitted = false, onClaim, onTake }: {
  game: Game; names: string[]; faces: string[]; options: Claim[]; enabled: boolean; submitted?: boolean
  onClaim: (claim: Claim | null) => void; onTake: () => void
}) {
  const pending = game.pending
  const deciding = game.result === 'playing' && !!pending && pending.seat !== 0 && options.length > 0 && !submitted
  const taking = game.result === 'playing' && !pending && game.turn === 0 && game.awaitingDraw
  const labels = { chi: 'Chi (Che)', pong: 'Pong', kong: 'Kong', win: 'Mahjong!' }
  return <div className="claim-panel" aria-label="Discard claim choices">
    {pending && <img className="claim-discard" src={faces[pending.tile.type]} alt={tileLabel(pending.tile.type)}/>}
    <div className="claim-details"><strong>{pending ? `${names[pending.seat]} discarded ${tileLabel(pending.tile.type)}` : taking ? 'Take a tile from the wall' : 'Claim controls'}</strong>
      <p>{submitted && pending ? 'Decision sent. Waiting for the other players…' : deciding ? 'Choose an available claim or Pass. The table waits for your decision.' : taking ? 'Press Take to draw your next tile.' : 'Unavailable actions are disabled.'}</p>
      <div className="claim-actions">{(['chi', 'pong', 'kong', 'win'] as const).flatMap(kind => {
        const choices = options.filter(option => option.kind === kind)
        return choices.length ? choices.map(option => <button key={claimKey(option)} disabled={!enabled || !deciding} onClick={() => onClaim(option)}>
          <strong>{labels[kind]}</strong>
          {kind !== 'win' && pending && <span className="claim-preview">{[...option.tileIds.map(id => game.hands[0].find(t => t.id === id)!.type), pending.tile.type].sort((a,b) => a-b).map((type,i) => <img key={i} src={faces[type]} alt={tileLabel(type)}/>)}</span>}
        </button>) : [<button key={kind} disabled><strong>{labels[kind]}</strong></button>]
      })}
        {deciding && <button className="pass-claim" disabled={!enabled} onClick={() => onClaim(null)}>Pass →</button>}
        <button disabled={!enabled || !taking} onClick={onTake}>Take</button>
      </div>
    </div>
  </div>
}
