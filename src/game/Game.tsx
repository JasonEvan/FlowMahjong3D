import { useEffect, useMemo, useState } from 'react'
import { botDiscard, discard, newGame, players, tileLabel, seatWind } from './engine'
import { tileFace, tileTypes } from '../assets/mahjong'
import GameScene from './GameScene'
import DealerRoll from './DealerRoll'
import './game.css'

export default function GamePage() {
  const [game, setGame] = useState(newGame), [selected, setSelected] = useState<number | null>(null)
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [rules, setRules] = useState(false), [restart, setRestart] = useState(false), [camera, setCamera] = useState(0)
  const [opening, setOpening] = useState(true)
  const faces = useMemo(() => tileTypes.map(spec => { const texture = tileFace(spec); const url = (texture.image as HTMLCanvasElement).toDataURL(); texture.dispose(); return url }), [])
  const playing = !opening && game.result === 'playing', yourTurn = playing && game.turn === 0 && ready && !error
  useEffect(() => {
    if (!ready || error || rules || restart || !playing || game.turn === 0) return
    const timer = setTimeout(() => setGame(current => discard(current, current.turn, botDiscard(current.hands[current.turn]))), 1100)
    return () => clearTimeout(timer)
  }, [game, ready, error, rules, restart, playing])
  const select = (id: number) => { if (yourTurn) setSelected(id) }
  const play = () => { if (yourTurn && selected !== null) { setGame(current => discard(current, 0, selected)); setSelected(null) } }
  const startRound = () => { setOpening(true); setSelected(null); setRestart(false) }
  const deal = (dealer: number) => { setGame(newGame(Math.random, dealer)); setSelected(null); setOpening(false) }
  return <div className="game-page">
    <header className="game-header"><a href="/" className="game-brand"><span>東</span> mahjong / 3D</a><div className="game-mode"><i/> SOLO TABLE <span>YOU + 3 BOTS</span></div><a href="/">Asset studio ↗</a></header>
    <main className="game-main" inert={opening || rules || restart || !playing}>
      <div className="game-topline"><div><p className="game-kicker">TAKE YOUR SEAT</p><h1>A round of Mahjong.</h1></div><div className="game-buttons"><button onClick={() => setRules(true)}>How to play</button><button onClick={() => setRestart(true)}>New round</button></div></div>
      <section className="game-table-area">
        <GameScene game={game} selected={selected} onSelect={select} onReady={() => setReady(true)} onError={setError} camera={camera}/>
        <div className="wall-counter"><span>LIVE WALL</span><strong>{game.wall.length}</strong><small>tiles remaining</small></div>
        {[1, 2, 3].map(seat => <div key={seat} className={`seat seat-${seat} ${playing && game.turn === seat ? 'seat-active' : ''}`}><span className="seat-avatar">{'東南西北'[(seat - game.dealer + 4) % 4]}</span><div><strong>{players[seat]} <small>BOT</small></strong><p>{seatWind(seat, game.dealer)}{game.dealer === seat ? ' · Dealer' : ''} · {game.hands[seat].length} tiles</p>{playing && game.turn === seat && <em>Thinking…</em>}</div></div>)}
        <div className="table-controls"><span>Drag to orbit · Scroll to zoom</span><button onClick={() => setCamera(c => c + 1)}>{camera % 2 ? 'Player view' : 'Top view'} ⤢</button></div>
        {!ready && !error && <div className="game-cover"><div className="loading-ring"/><h2>Setting your table…</h2><p>Loading the table and tile collection.</p></div>}
        {error && <div className="game-cover"><h2>Unable to open the table</h2><p>{error}</p><button onClick={() => window.location.reload()}>Reload</button></div>}
      </section>
      <section className="player-area"><div className="turn-line"><div><span className={`turn-dot ${yourTurn ? 'is-you' : ''}`}/><strong>{!playing ? 'Round complete' : yourTurn ? 'Your turn' : `${players[game.turn]}'s turn`}</strong><span className="your-seat">YOU · {seatWind(0, game.dealer).toUpperCase()}{game.dealer === 0 ? ' · DEALER' : ''}</span></div><p aria-live="polite">{game.message}</p></div>
        <div className="hand" aria-label="Your Mahjong tiles">{game.hands[0].map(tile => <button key={tile.id} disabled={!yourTurn} aria-pressed={selected === tile.id} aria-label={`Select ${tileLabel(tile.type)}${tile.id === game.drawn ? ', newly drawn' : ''}`} title={tileLabel(tile.type)} className={`hand-tile ${selected === tile.id ? 'tile-selected' : ''} ${tile.id === game.drawn ? 'tile-drawn' : ''}`} onClick={() => select(tile.id)}><img src={faces[tile.type]} alt={tileLabel(tile.type)}/>{tile.id === game.drawn && <span>NEW</span>}</button>)}</div>
        <div className="hand-actions"><p>{selected !== null && yourTurn ? `Selected: ${tileLabel(game.hands[0].find(t => t.id === selected)!.type)}` : 'Select a tile from your hand or the 3D table.'}<small>Build four sets and a pair, or seven distinct pairs.</small></p><button className="discard-button" disabled={!yourTurn || selected === null} onClick={play}>Discard tile <span>→</span></button></div>
      </section>
      <div className="game-footnote"><span>136 TILES · SIMPLIFIED MAHJONG</span><span>Draw. Consider. Discard.</span></div>
    </main>
    {opening && <DealerRoll onDeal={deal}/>}
    {!opening && (rules || restart || !playing) && <div className="modal-backdrop"><section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={event => {
      if (event.key === 'Escape') { setRules(false); setRestart(false) }
      if (event.key === 'Tab') {
        const elements = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')
        const first = elements[0], last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      {rules ? <><p className="game-kicker">THE HOUSE RULES</p><h2 id="dialog-title">Your first round.</h2><p>You play against Mei, Jun, and Lin. Before every round, all four players roll two dice. The highest total becomes dealer (East); ties reroll among the tied players. The dealer starts with 14 tiles and takes the first turn; everyone else receives 13. Seat winds follow the dealer. Draws happen automatically. Select one tile and press <strong>Discard tile</strong> to end your turn.</p><p>Win with <strong>four sets and a pair</strong>. A set is three identical tiles, or three consecutive numbers in the same suit. Winds and dragons can only form identical sets. Seven distinct pairs also wins.</p><p>Winning hands are claimed automatically, including another player’s discard. If multiple players can win, the next player in turn order wins.</p><p>This first version has no chow/pong/kong calls, flowers, scoring, riichi, furiten, or thirteen-orphans hand. There is no dead wall. An empty wall ends the round in a draw. Bots are paused while this dialog is open.</p><button autoFocus className="discard-button" onClick={() => setRules(false)}>Back to the table</button></> : restart ? <><h2 id="dialog-title">Start a fresh round?</h2><p>You will roll dice again to choose a dealer, then receive a new shuffled hand.</p><div className="modal-buttons"><button autoFocus onClick={() => setRestart(false)}>Keep playing</button><button className="discard-button" onClick={startRound}>Choose dealer</button></div></> : <><p className="game-kicker">ROUND COMPLETE</p><h2 id="dialog-title">{game.result === 'draw' ? 'A well-played draw.' : game.winner === 0 ? 'Mahjong. You win!' : `${players[game.winner!]} wins.`}</h2><p>{game.message}</p>{game.winner !== null && <div className="winning-hand">{game.hands[game.winner].map(t => <img key={t.id} src={faces[t.type]} alt={tileLabel(t.type)} title={tileLabel(t.type)}/>)}</div>}<p>{game.moves} discards · {game.wall.length} tiles left in the wall</p><button autoFocus className="discard-button" onClick={startRound}>Play another round →</button><a className="back-to-studio" href="/">Back to asset studio</a></>}
    </section></div>}
  </div>
}
