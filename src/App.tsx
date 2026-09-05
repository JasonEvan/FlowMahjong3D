import { useState } from 'react'
import Scene from './Scene'
import './App.css'

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    cube: <><path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/></>,
    table: <><path d="M3 5h18v9H3zM6 14v6m12-6v6M3 9h18"/></>,
    tiles: <><rect x="4" y="3" width="11" height="16" rx="2"/><path d="M18 6h2v15H9v-2M8 8h3m-3 4h3"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    rotate: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6a8 8 0 0 1 13 3M4.9 15a8 8 0 0 0 13 3"/></>,
    camera: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.cube}</svg>
}

const felts = [{ name: 'Forest', color: '#245b48' }, { name: 'Ocean', color: '#31546b' }, { name: 'Burgundy', color: '#713b45' }]
const woods = [{ name: 'Walnut', color: '#86624b' }, { name: 'Oak', color: '#e0bb89' }, { name: 'Charcoal', color: '#3b3a37' }]

export default function App() {
  const [view, setView] = useState<'table' | 'tiles'>('table')
  const [felt, setFelt] = useState(0), [wood, setWood] = useState(0)
  const [rotate, setRotate] = useState(false), [cameraView, setCameraView] = useState(0)
  const [cycle, setCycle] = useState(0), [cycling, setCycling] = useState(false)
  const [exportId, setExportId] = useState(0), [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const switchView = (next: 'table' | 'tiles') => { setView(next); setCycling(false); setCameraView(0); setMessage('') }
  return <div className="app">
    <header className="header">
      <a className="brand" href="./"><span className="brand-mark">東</span><span>mahjong<span className="brand-light"> / </span>3D</span></a>
      <nav aria-label="Main navigation"><span className="nav-active">Asset studio</span><span className="nav-muted">Collection 001</span></nav>
      <div className="header-right"><span className="status-dot"/> A new perspective on tradition <span className="version">v.01</span></div>
    </header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">THE FOUNDATION OF THE GAME</div><h1>Made for the table.</h1><p>Traditional craft. A new dimension. Explore your Mahjong assets.</p></div><div className="collection-label"><span>麻将</span><small>THE ASSET COLLECTION</small></div></div>
      <div className="workspace">
        <section className="viewer" aria-label="3D asset preview">
          <div className="viewer-top"><div className="view-tabs"><button className={view === 'table' ? 'active' : ''} onClick={() => switchView('table')}><Icon name="table" size={17}/> Automatic table</button><button className={view === 'tiles' ? 'active' : ''} onClick={() => switchView('tiles')}><Icon name="tiles" size={17}/> Tile set <span>136</span></button></div><span className="live-label"><i/> LIVE 3D</span></div>
          <Scene view={view} felt={felts[felt].color} wood={woods[wood].color} rotate={rotate} cameraView={cameraView} cycle={cycle} exportId={exportId} onCycleEnd={() => setCycling(false)} onExport={text => { setExporting(false); setMessage(text) }}/>
          <div className="model-label"><span className="eyebrow">{view === 'table' ? '01 / AUTOMATIC SERIES' : '02 / CLASSIC SERIES'}</span><h2>{view === 'table' ? 'The gathering place.' : 'Every tile, a tradition.'}</h2><p>{view === 'table' ? 'Walnut form. Precision in every detail.' : 'Three suits. Four winds. Three dragons.'}</p></div>
          <div className="scene-tools"><button aria-label="Toggle top view" title="Toggle top view" onClick={() => setCameraView(v => v + 1)}><Icon name="camera"/></button><button aria-label="Auto rotate" title="Auto rotate" aria-pressed={rotate} className={rotate ? 'selected' : ''} onClick={() => setRotate(!rotate)}><Icon name="rotate"/></button></div>
          <div className="viewer-bottom"><span><span className="drag-symbol">⌘</span> Drag to orbit <b>·</b> Scroll to zoom</span><span><Icon name="sun" size={14}/> Studio lighting</span></div>
        </section>
        <aside className="inspector"><div className="inspector-title"><span className="eyebrow">ASSET DETAILS</span><Icon name="cube" size={18}/></div><h2>{view === 'table' ? 'Automatic table' : 'Classic tile set'}</h2><p className="description">{view === 'table' ? 'A familiar centerpiece, carefully reimagined in three dimensions.' : 'Ivory faces and jade backs. A complete set, ready for your next game.'}</p><div className="tags"><span>GAME ASSET</span><span>3D MODEL</span></div>
          <div className="divider"/>
          <div className="section-label">{view === 'table' ? 'Make it your own' : 'The complete collection'}<span>01</span></div>
          {view === 'table' ? <><div className="option-heading">Playing surface <span>{felts[felt].name}</span></div><div className="swatches">{felts.map((f, i) => <button key={f.name} aria-label={`${f.name} playing surface`} aria-pressed={felt === i} disabled={cycling} className={felt === i ? 'chosen' : ''} style={{ '--swatch': f.color } as React.CSSProperties} onClick={() => setFelt(i)}>{felt === i ? '✓' : ''}</button>)}</div><div className="option-heading">Table finish <span>{woods[wood].name}</span></div><div className="finish-options">{woods.map((w, i) => <button key={w.name} aria-pressed={wood === i} disabled={cycling} className={wood === i ? 'chosen' : ''} onClick={() => setWood(i)}><i style={{ backgroundColor: w.color }}/>{w.name}</button>)}</div></> : <div className="tile-breakdown"><div><span>Characters · Bamboo · Circles</span><strong>108</strong></div><div><span>Winds</span><strong>16</strong></div><div><span>Dragons</span><strong>12</strong></div></div>}
          <div className="divider"/><div className="section-label">Built with intention<span>02</span></div><dl><div><dt>{view === 'table' ? 'Mechanism' : 'Tile types'}</dt><dd>{view === 'table' ? 'Automatic lift' : '34 unique faces'}</dd></div><div><dt>{view === 'table' ? 'Seating' : 'Construction'}</dt><dd>{view === 'table' ? '4 players' : 'Rounded resin'}</dd></div><div><dt>Tile set</dt><dd>136 pieces</dd></div><div><dt>Export format</dt><dd>glTF binary <span>.glb</span></dd></div></dl>
          <div className="inspector-actions">{view === 'table' && <button className="secondary-button" disabled={cycling || exporting} onClick={() => { setCycling(true); setCycle(c => c + 1) }}><Icon name="rotate" size={17}/>{cycling ? 'Lifting the tile walls…' : 'Preview automatic lift'}<span>↗</span></button>}<button className="primary-button" disabled={exporting || cycling} onClick={() => { setExporting(true); setMessage(''); setExportId(i => i + 1) }}><Icon name="download" size={18}/>{exporting ? 'Preparing asset…' : 'Export asset'}<span>GLB</span></button><p className="export-note" role="status">{message || 'Ready to bring into your game.'}</p></div>
        </aside>
      </div>
      <section className="feature-strip"><div><span className="feature-number">01</span><div><h3>Crafted in three dimensions</h3><p>Soft edges. Tactile surfaces. Considered details.</p></div></div><div><Icon name="tiles" size={25}/><div><h3>A complete classic set</h3><p>136 tiles, from the first draw to the last wind.</p></div></div><div><Icon name="cube" size={25}/><div><h3>Built for what comes next</h3><p>Reusable assets. Your game starts here.</p></div></div></section>
    </main><footer><span>MAHJONG / 3D <b>—</b> A little tradition. A new dimension.</span><span>DESIGNED TO BRING PEOPLE TOGETHER <span className="footer-star">✳</span></span></footer>
  </div>
}
