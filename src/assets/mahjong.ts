import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export type TileSpec = { suit: 'characters' | 'bamboo' | 'circles' | 'winds' | 'dragons'; value: number; label: string }
export const tileTypes: TileSpec[] = [
  ...(['characters', 'bamboo', 'circles'] as const).flatMap(suit => Array.from({ length: 9 }, (_, i) => ({ suit, value: i + 1, label: `${i + 1} ${suit}` }))),
  ...['East', 'South', 'West', 'North'].map((label, i) => ({ suit: 'winds' as const, value: i + 1, label })),
  ...['Red dragon', 'Green dragon', 'White dragon'].map((label, i) => ({ suit: 'dragons' as const, value: i + 1, label })),
]

export function tileFace(spec: TileSpec) {
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 256
  const c = canvas.getContext('2d')!
  c.fillStyle = '#f5f0df'; c.fillRect(0, 0, 192, 256)
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const red = '#a8322b', green = '#1b5946', blue = '#273f63'
  if (spec.suit === 'characters') {
    c.fillStyle = blue; c.font = 'bold 92px serif'; c.fillText('一二三四五六七八九'[spec.value - 1], 96, 79)
    c.fillStyle = red; c.font = 'bold 100px serif'; c.fillText('萬', 96, 176)
  } else if (spec.suit === 'winds' || spec.suit === 'dragons') {
    c.fillStyle = spec.suit === 'winds' ? blue : spec.value === 1 ? red : green
    c.font = 'bold 130px serif'
    if (spec.suit === 'dragons' && spec.value === 3) { c.strokeStyle = blue; c.lineWidth = 9; c.strokeRect(39, 37, 114, 180); c.lineWidth = 2; c.strokeRect(49, 47, 94, 160) }
    else c.fillText(spec.suit === 'winds' ? '東南西北'[spec.value - 1] : '中發'[spec.value - 1], 96, 130)
  } else if (spec.suit === 'bamboo' && spec.value === 1) {
    // The one-bamboo tile traditionally depicts a bird.
    c.fillStyle = green; c.beginPath(); c.ellipse(94, 135, 34, 54, -.3, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(102, 68, 21, 0, Math.PI * 2); c.fill()
    c.fillStyle = red; c.beginPath(); c.moveTo(120, 63); c.lineTo(146, 73); c.lineTo(120, 80); c.fill()
    c.fillStyle = '#f5f0df'; c.beginPath(); c.arc(108, 64, 4, 0, Math.PI * 2); c.fill()
    c.strokeStyle = blue; c.lineWidth = 8
    for (const x of [64, 82, 100]) { c.beginPath(); c.moveTo(92, 152); c.lineTo(x, 216); c.stroke() }
    c.strokeStyle = '#c99f4c'; c.lineWidth = 4; c.beginPath(); c.moveTo(76, 111); c.quadraticCurveTo(111, 120, 96, 168); c.stroke()
  } else {
    const n = spec.value, cols = n <= 3 ? 1 : n <= 6 ? 2 : 3, rows = Math.ceil(n / cols)
    for (let i = 0; i < n; i++) {
      const x = 96 + ((i % cols) - (cols - 1) / 2) * 49, y = 128 + (Math.floor(i / cols) - (rows - 1) / 2) * 62
      c.strokeStyle = [green, blue, red][i % 3]; c.fillStyle = c.strokeStyle; c.lineWidth = 6
      if (spec.suit === 'circles') {
        c.beginPath(); c.arc(x, y, n === 1 ? 50 : 17, 0, Math.PI * 2); c.stroke()
        c.beginPath(); c.arc(x, y, n === 1 ? 32 : 8, 0, Math.PI * 2); c.stroke()
        c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill()
      } else {
        c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x, y + 18); c.stroke()
        c.lineWidth = 3; for (const offset of [-13, 0, 13]) { c.beginPath(); c.moveTo(x - 8, y + offset); c.lineTo(x + 8, y + offset); c.stroke() }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], material: THREE.Material, radius = .025) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, radius), material)
  mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh
}

export function createTileLibrary(backColor = '#1f6054') {
  const body = new THREE.MeshPhysicalMaterial({ color: '#f3efdf', roughness: .26, clearcoat: .38 })
  const back = new THREE.MeshPhysicalMaterial({ color: backColor, roughness: .3, clearcoat: .5 })
  const faces = tileTypes.map(spec => new THREE.MeshStandardMaterial({ map: tileFace(spec), roughness: .38 }))
  const geometry = new RoundedBoxGeometry(.105, .065, .145, 3, .009)
  const backGeometry = new RoundedBoxGeometry(.105, .022, .145, 3, .007)
  const faceGeometry = new THREE.PlaneGeometry(.088, .125)
  return (index: number) => {
    const tile = new THREE.Group(); tile.name = tileTypes[index].label
    const base = new THREE.Mesh(geometry, body); base.castShadow = true; base.receiveShadow = true; tile.add(base)
    const rear = new THREE.Mesh(backGeometry, back); rear.position.y = -.023; rear.castShadow = true; tile.add(rear)
    const face = new THREE.Mesh(faceGeometry, faces[index]); face.rotation.x = -Math.PI / 2; face.position.y = .0326; tile.add(face)
    tile.userData = { ...tileTypes[index], typeIndex: index }; return tile
  }
}

function surfaceTexture(wood: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const c = canvas.getContext('2d')!
  c.fillStyle = wood ? '#956b49' : '#ffffff'; c.fillRect(0, 0, 256, 256)
  let seed = 42
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  for (let i = 0; i < (wood ? 1300 : 18000); i++) {
    c.fillStyle = wood ? `rgba(35,15,5,${random() * .16})` : `rgba(0,0,0,${random() * .14})`
    c.fillRect(random() * 256, random() * 256, wood ? random() * 110 + 20 : 1, 1)
  }
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(wood ? 2 : 8, wood ? 2 : 8); t.colorSpace = THREE.SRGBColorSpace; return t
}

export function createMahjongTable(feltColor: string, woodColor: string) {
  const table = new THREE.Group(); table.name = 'Automatic Mahjong Table'
  const wood = new THREE.MeshStandardMaterial({ color: woodColor, map: surfaceTexture(true), roughness: .4 })
  const dark = new THREE.MeshStandardMaterial({ color: '#252b29', roughness: .33, metalness: .35 })
  const trim = new THREE.MeshStandardMaterial({ color: '#9f8f66', metalness: .7, roughness: .28 })
  const felt = new THREE.MeshStandardMaterial({ color: feltColor, map: surfaceTexture(false), roughness: 1 })
  box(table, [3.15, .29, 3.15], [0, 1.83, 0], wood, .12)
  box(table, [2.92, .035, 2.92], [0, 1.988, 0], trim, .09)
  box(table, [2.87, .06, 2.87], [0, 2.01, 0], dark, .08)
  box(table, [2.62, .045, 2.62], [0, 2.044, 0], felt, .055)
  box(table, [2.78, .12, 2.78], [0, 1.65, 0], dark, .08)
  box(table, [.68, 1.4, .68], [0, .91, 0], dark, .08)
  box(table, [.73, .11, .73], [0, .37, 0], wood, .04)
  for (let side = 0; side < 4; side++) {
    const group = new THREE.Group(); group.rotation.y = side * Math.PI / 2; table.add(group)
    box(group, [.32, .16, 1.22], [0, .16, .57], dark, .065)
    box(group, [.26, .07, .28], [0, .055, 1.02], dark, .025)
    box(group, [1.91, .012, .175], [-.08, 2.069, .94], dark, .018)
    box(group, [1.87, .014, .15], [-.08, 2.077, .94], felt, .012)
    box(group, [.57, .018, .12], [0, 2.022, 1.425], dark, .02)
    for (let i = 0; i < 3; i++) box(group, [.06, .006, .045], [-.14 + i * .14, 2.034, 1.425], i === 1 ? trim : dark, .006)
  }
  const center = new THREE.Group(); center.name = 'Central lift and dice console'; table.add(center)
  box(center, [.48, .055, .48], [0, 2.095, 0], trim, .055)
  box(center, [.445, .058, .445], [0, 2.11, 0], dark, .045)
  const glass = new THREE.MeshPhysicalMaterial({ color: '#74978e', metalness: .3, roughness: .15, transparent: true, opacity: .65 })
  box(center, [.22, .015, .22], [0, 2.146, 0], glass, .025)
  const ivory = new THREE.MeshStandardMaterial({ color: '#f8efd6' })
  for (const x of [-.053, .053]) {
    const dice = new THREE.Group(); dice.position.set(x, 2.17, 0); dice.rotation.y = x * 4; center.add(dice)
    box(dice, [.064, .052, .064], [0, 0, 0], ivory, .009)
    const dots = x < 0 ? [[0, 0], [-.016, -.016], [.016, .016]] : [[-.016, -.016], [.016, .016], [-.016, .016], [.016, -.016]]
    for (const [dx, dz] of dots) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(.005, 12), dark); dot.rotation.x = -Math.PI / 2; dot.position.set(dx, .0261, dz); dice.add(dot)
    }
  }
  const led = new THREE.MeshStandardMaterial({ color: '#addec5', emissive: '#78e7bb', emissiveIntensity: .8 })
  for (const x of [-.155, .155]) box(center, [.022, .008, .045], [x, 2.145, 0], led, .005)
  return table
}

export function createTileSet(makeTile: ReturnType<typeof createTileLibrary>, display: 'table' | 'tiles') {
  const set = new THREE.Group(); set.name = '136 Mahjong Tiles'
  for (let i = 0; i < 136; i++) {
    const tile = makeTile(Math.floor(i / 4))
    if (display === 'table') {
      const side = Math.floor(i / 34), pair = Math.floor((i % 34) / 2), layer = i % 2
      const position = new THREE.Vector3((pair - 8) * .109 - .08, 2.115 + layer * .069, .94).applyAxisAngle(new THREE.Vector3(0, 1, 0), side * Math.PI / 2)
      tile.position.copy(position); tile.rotation.set(Math.PI, side * Math.PI / 2, 0)
    } else {
      const type = Math.floor(i / 4), copy = i % 4
      tile.position.set((type % 9 - 4) * .19, .10 + copy * .071, (Math.floor(type / 9) - 1.5) * .29)
    }
    set.add(tile)
  }
  return set
}
