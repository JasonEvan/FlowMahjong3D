import { lazy, Suspense, useState } from 'react'
import './entry.css'

const SinglePlayerGame = lazy(() => import('./Game'))

export default function GameEntry() {
  const [singlePlayer, setSinglePlayer] = useState(false)

  if (singlePlayer) {
    return <Suspense fallback={<div className="mode-loading" role="status">Preparing your table…</div>}>
      <SinglePlayerGame />
    </Suspense>
  }

  return <div className="mode-page">
    <header className="mode-header">
      <a className="mode-brand" href="/"><span aria-hidden="true">東</span> mahjong / 3D</a>
      <a className="mode-back" href="/">Asset studio ↗</a>
    </header>
    <main className="mode-main">
      <div className="mode-intro">
        <p className="mode-eyebrow">A SEAT AT THE TABLE</p>
        <h1>How would you like to play?</h1>
        <p>Find your rhythm. Build your hand. Make your next move.</p>
      </div>

      <div className="mode-cards">
        <section className="mode-card mode-solo" aria-labelledby="solo-title">
          <div className="mode-card-top"><span className="mode-number">01</span><span className="mode-badge">READY TO PLAY</span></div>
          <div className="mode-art" aria-hidden="true"><span className="mode-tile mode-tile-back">發</span><span className="mode-tile mode-tile-front">東</span></div>
          <h2 id="solo-title">Single Player</h2>
          <p>Take on three bots at your own pace. A full Mahjong table, just for you.</p>
          <div className="mode-features"><span>1 player + 3 bots</span><span>3D gameplay</span></div>
          <button className="mode-play" onClick={() => setSinglePlayer(true)}>Play Single Player <span aria-hidden="true">→</span></button>
        </section>

        <section className="mode-card mode-multiplayer" aria-labelledby="multiplayer-title">
          <div className="mode-card-top"><span className="mode-number">02</span><span className="mode-badge">COMING SOON</span></div>
          <div className="mode-art mode-people" aria-hidden="true">
            <svg width="116" height="90" viewBox="0 0 116 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="58" cy="28" r="13"/><path d="M33 74v-8a25 25 0 0 1 50 0v8"/><path d="M27 16a12 12 0 0 0 0 24M18 48A22 22 0 0 0 7 67v7M89 16a12 12 0 0 1 0 24M98 48a22 22 0 0 1 11 19v7"/></svg>
          </div>
          <h2 id="multiplayer-title">Multiplayer</h2>
          <p>A shared table for friends and fellow players. More company is on the way.</p>
          <div className="mode-features"><span>Play together</span><span>Online tables</span></div>
          <button className="mode-play" disabled aria-describedby="multiplayer-note">Multiplayer <span aria-hidden="true">⌁</span></button>
          <p className="mode-unavailable" id="multiplayer-note">Multiplayer is not available yet.</p>
        </section>
      </div>
      <p className="mode-footer">A LITTLE TRADITION. A NEW DIMENSION.</p>
    </main>
  </div>
}
