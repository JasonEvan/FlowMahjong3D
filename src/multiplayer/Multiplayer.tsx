import { useEffect, useState } from 'react'
import { enterRoom, firebaseConfigured, sendAction, watchRoom } from './firebase'
import type { Action, RoomView } from './room'
import OnlineTable from './OnlineTable'
import OnlineOpening from './OnlineOpening'
import './multiplayer.css'

export default function Multiplayer({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState(() => sessionStorage.getItem('mahjong-room') || '')
  const [input, setInput] = useState(''), [name, setName] = useState(() => localStorage.getItem('mahjong-name') || '')
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [view, setView] = useState<RoomView | null>(null), [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!code) return
    let disposed = false, unsubscribe: (() => void) | undefined, ticking = false
    watchRoom(code, value => { if (!disposed) { setView(value); if (!value) setError('This room is no longer available.') } }, value => { if (!disposed) setConnected(value) }, failure => { if (!disposed) setError(failure.message) })
      .then(stop => { if (disposed) stop(); else unsubscribe = stop }).catch(failure => { if (!disposed) setError(failure.message) })
    const tick = async () => {
      if (ticking || !navigator.onLine) return
      ticking = true
      try { await sendAction(code, { kind: 'tick' }) } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : 'Connection interrupted.') }
      finally { ticking = false }
    }
    const interval = setInterval(tick, 3000)
    window.addEventListener('online', tick)
    return () => { disposed = true; unsubscribe?.(); clearInterval(interval); window.removeEventListener('online', tick) }
  }, [code])
  const enter = async () => {
    setBusy(true); setError('')
    try {
      const roomCode = await enterRoom(mode, name, input)
      localStorage.setItem('mahjong-name', name.trim()); sessionStorage.setItem('mahjong-room', roomCode)
      setCode(roomCode)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to enter this room.') }
    finally { setBusy(false) }
  }
  const act = async (action: Action) => {
    setBusy(true); setError('')
    try { await sendAction(code, action) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to make that move.') }
    finally { setBusy(false) }
  }
  const leave = async () => {
    setBusy(true); setError('')
    try {
      await sendAction(code, { kind: 'leave' })
      sessionStorage.removeItem('mahjong-room'); setCode(''); setView(null); setConnected(false)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to leave. Try again when connected.') }
    finally { setBusy(false) }
  }
  const forget = () => { sessionStorage.removeItem('mahjong-room'); setCode(''); setView(null); setError(''); onBack() }
  if (view?.opening) return <OnlineOpening code={code} view={view} busy={busy} connected={connected} error={error} act={act} leave={leave}/>
  if (view?.game) return <OnlineTable code={code} view={view} busy={busy} connected={connected} error={error} act={act} leave={leave} onBack={forget}/>
  return <div className="mode-page multiplayer-page">
    <header className="mode-header"><a className="mode-brand" href="/"><span>東</span> mahjong / 3D</a><button className="room-secondary" disabled={busy} onClick={code ? leave : onBack}>{code ? 'Leave room' : '← Game modes'}</button></header>
    <main className="room-main">
      <p className="mode-eyebrow">A TABLE FOR FRIENDS</p>
      <h1>{code ? 'Your table is waiting.' : 'Meet at the table.'}</h1>
      {error && <p className="room-error" role="alert">{error}</p>}
      {!firebaseConfigured && <p className="room-notice">Online tables are awaiting Firebase setup. Follow the multiplayer setup guide in the project README.</p>}
      {!code ? <>
        <p>Create a room and share its code, or join a friend’s table.</p>
        <div className="room-tabs" aria-label="Room options"><button aria-pressed={mode === 'create'} onClick={() => setMode('create')}>Create a room</button><button aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Join a room</button></div>
        <form className="room-form" onSubmit={event => { event.preventDefault(); void enter() }}>
          <label>Your name<input autoComplete="nickname" required maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="What should we call you?"/></label>
          {mode === 'join' && <label>Six-digit room code<input className="room-code-input" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={input} onChange={event => setInput(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"/></label>}
          <button className="mode-play" disabled={busy || !firebaseConfigured || !name.trim() || (mode === 'join' && input.length !== 6)}>{busy ? 'Connecting…' : mode === 'create' ? 'Create room →' : 'Join room →'}</button>
        </form>
        <p className="room-hint">1–4 friends · Empty seats become bots when the host starts.</p>
      </> : <>
        <p>Share this code with your friends. Rooms stay available for 24 hours.</p>
        <div className="room-code"><strong aria-label={`Room code ${code.split('').join(' ')}`}>{code}</strong><button className="room-secondary" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true) } catch { setError('Copy the six-digit code shown above.') } }}>{copied ? 'Copied!' : 'Copy code'}</button></div>
        <p role="status">{connected ? 'Connected · Waiting for the host to start' : 'Connecting to the room…'}</p>
        <div className="room-seats">{view?.seats.map((seat, index) => <div key={index}><span className="room-seat-number">0{index + 1}</span><strong>{seat.human ? `${seat.name}${index === 0 ? ' (you)' : ''}` : 'Open seat'}</strong><small>{seat.human ? seat.online ? 'Ready' : 'Away · bot will cover' : 'Bot if empty at start'}</small></div>)}</div>
        {view?.host && <button className="mode-play" disabled={busy || !connected} onClick={() => act({ kind: 'start' })}>{busy ? 'Starting…' : `Start round · ${view.seats.filter(s => !s.human || !s.online).length} bots →`}</button>}
        {!view?.host && view && <p className="room-hint">The host can start with any number of players.</p>}
        {error && <button className="room-secondary" onClick={forget}>Return to game modes</button>}
      </>}
    </main>
  </div>
}
