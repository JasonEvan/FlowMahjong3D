import { useMemo, useState } from 'react'
import GameScene from '../game/GameScene'
import { claimKey, seatWind, tileLabel } from '../game/engine'
import { tileFace, tileTypes } from '../assets/mahjong'
import type { Action, RoomView } from './room'
import '../game/game.css'
import '../game/claims.css'

type Props = { code: string; view: RoomView; busy: boolean; connected: boolean; error: string; act: (action: Action) => Promise<void>; leave: () => Promise<void>; onBack: () => void }
export default function OnlineTable({ code, view, busy, connected, error, act, leave, onBack }: Props) {
  const game = view.game!
  const [selected, setSelected] = useState<number | null>(null), [ready, setReady] = useState(false), [sceneError, setSceneError] = useState(''), [camera, setCamera] = useState(0), [confirmLeave, setConfirmLeave] = useState(false)
  const faces = useMemo(() => tileTypes.map(spec => { const texture = tileFace(spec); const url = (texture.image as HTMLCanvasElement).toDataURL(); texture.dispose(); return url }), [])
  const enabled = connected && !busy && ready && !sceneError, playing = game.result === 'playing'
  const yourTurn = playing && !game.pending && game.turn === 0
  const move = async (action: Action) => { await act(action); setSelected(null) }
  return <div className="game-page">
    <header className="game-header"><a className="game-brand" href="/"><span>東</span> mahjong / 3D</a><span>ROOM {code} · {connected ? 'ONLINE' : 'RECONNECTING…'}</span><button onClick={() => setConfirmLeave(true)}>Leave table</button></header>
    <main className="game-main">
      <div className="game-topline"><div><p className="game-kicker">YOUR SHARED TABLE</p><h1>{playing ? 'A round of Mahjong.' : game.result === 'draw' ? 'The round is a draw.' : `${view.seats[game.winner!].name} wins!`}</h1></div><span>{seatWind(0, game.dealer).toUpperCase()} · YOU</span></div>
      {error && <p className="room-error" role="alert">{error}</p>}
      {!connected && <p className="room-notice" role="status">Reconnecting… Moves are paused on this device. A bot covers disconnected players after 35 seconds.</p>}
      {(error || !connected) && <button onClick={onBack}>Return to game modes</button>}
      <section className="game-table-area">
        <GameScene game={game} selected={selected} onSelect={id => { if (yourTurn && enabled) setSelected(id) }} onReady={() => setReady(true)} onError={setSceneError} camera={camera}/>
        <div className="wall-counter"><span>LIVE WALL</span><strong>{game.wall.length}</strong><small>tiles remaining</small></div>
        {[1, 2, 3].map(seat => <div key={seat} className={`seat seat-${seat} ${playing && !game.pending && game.turn === seat ? 'seat-active' : ''}`}><div><strong>{view.seats[seat].name}</strong><p>{seatWind(seat, game.dealer)} · {game.hands[seat].length} tiles</p><small>{view.seats[seat].human ? view.seats[seat].online ? 'PLAYER' : 'AWAY · BOT COVERING' : 'BOT'}</small></div></div>)}
        <div className="table-controls"><span>Drag to orbit · Scroll to zoom</span><button onClick={() => setCamera(value => value + 1)}>{camera % 2 ? 'Player view' : 'Top view'}</button></div>
        {(!ready || sceneError) && <div className="game-cover"><h2>{sceneError || 'Setting your table…'}</h2>{sceneError && <button onClick={() => location.reload()}>Reload</button>}</div>}
      </section>
      <section className="player-area">
        <div className="turn-line"><strong>{!playing ? 'Round complete' : game.pending ? 'Claim window' : yourTurn ? 'Your turn' : `${view.seats[game.turn].name}’s turn`}</strong><p aria-live="polite">{game.message}</p></div>
        {game.pending && playing && <div className="claim-panel"><img className="claim-discard" src={faces[game.pending.tile.type]} alt={tileLabel(game.pending.tile.type)}/><div className="claim-details"><strong>{view.seats[game.pending.seat].name} discarded {tileLabel(game.pending.tile.type)}</strong><p>{view.submitted ? 'Decision sent. Waiting for the other players…' : view.options.length ? 'Choose a claim or pass. Pong / Kong outranks Chi; Mahjong outranks both.' : 'Waiting for the other players’ claims…'}</p><div className="claim-actions">
          {!view.submitted && view.options.map(option => <button key={claimKey(option)} disabled={!enabled} onClick={() => move({ kind: 'claim', claim: option, revision: view.revision })}><strong>{option.kind === 'win' ? 'Mahjong!' : option.kind === 'chi' ? 'Chi' : option.kind === 'pong' ? 'Pong' : 'Kong'}</strong>{option.kind !== 'win' && <span className="claim-preview">{[...option.tileIds.map(id => game.hands[0].find(t => t.id === id)!.type), game.pending!.tile.type].sort((a, b) => a - b).map((type, i) => <img key={i} src={faces[type]} alt={tileLabel(type)}/>)}</span>}</button>)}
          {!view.submitted && view.options.length > 0 && <button className="pass-claim" disabled={!enabled} onClick={() => move({ kind: 'claim', claim: null, revision: view.revision })}>Pass →</button>}
        </div></div></div>}
        {!!game.melds[0].length && <div className="exposed-melds">{game.melds[0].map((meld, i) => <div key={i}><span>{meld.from === null ? 'Concealed Kong' : meld.kind}</span><div>{meld.tiles.map(tile => <img key={tile.id} src={faces[tile.type]} alt={tileLabel(tile.type)}/>)}</div></div>)}</div>}
        <div className="hand" aria-label="Your Mahjong tiles">{game.hands[0].map(tile => <button key={tile.id} className={`hand-tile ${selected === tile.id ? 'tile-selected' : ''} ${game.drawn === tile.id ? 'tile-drawn' : ''}`} disabled={!enabled || !yourTurn} aria-label={`Select ${tileLabel(tile.type)}`} aria-pressed={selected === tile.id} onClick={() => setSelected(tile.id)}><img src={faces[tile.type]} alt={tileLabel(tile.type)}/></button>)}</div>
        {yourTurn && view.kongs.map(type => <button key={type} disabled={!enabled} onClick={() => move({ kind: 'kong', value: type, revision: view.revision })}>Concealed Kong · {tileLabel(type)}</button>)}
        {playing ? <div className="hand-actions"><p>{yourTurn ? 'Select a tile, then discard.' : 'The table waits for every eligible player’s claim.'}<small>Empty seats and disconnected players are covered by bots.</small></p><button className="discard-button" disabled={!enabled || !yourTurn || selected === null || !game.hands[0].some(t => t.id === selected)} onClick={() => move({ kind: 'discard', value: selected!, revision: view.revision })}>Discard tile →</button></div> : view.host ? <button className="discard-button" disabled={!connected || busy} onClick={() => move({ kind: 'start' })}>Play another round →</button> : <p>Waiting for the host to start another round.</p>}
      </section>
      <p className="game-footnote">Mahjong → Pong / Kong → Chi · Equal claims follow turn order.</p>
    </main>
    {confirmLeave && <div className="modal-backdrop"><section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">Leave this table?</h2><p>A bot will take your seat. You cannot rejoin this round after leaving.</p><div className="modal-buttons"><button autoFocus onClick={() => setConfirmLeave(false)}>Keep playing</button><button disabled={busy || !connected} onClick={leave}>Leave table</button></div>{error && <p role="alert">{error}</p>}</section></div>}
  </div>
}
