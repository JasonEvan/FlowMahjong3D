import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import tableUrl from '../assets/mahjong-table.glb?url'
import tilesUrl from '../assets/mahjong-tiles.glb?url'
import type { Game } from './engine'

type Props = { game: Game; selected: number | null; onSelect: (id: number) => void; onReady: () => void; onError: (message: string) => void; camera: number }
export default function GameScene(props: Props) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props)
  useEffect(() => { latest.current = props })
  useEffect(() => {
    const container = host.current!
    let disposed = false, frame = 0
    const resources: THREE.Object3D[] = []
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true }) } catch { latest.current.onError('WebGL could not start. Enable hardware acceleration and reload.'); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.6
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#172c27'); scene.fog = new THREE.Fog('#172c27', 9, 22)
    const camera = new THREE.PerspectiveCamera(40, 1, .05, 50)
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 1.5; controls.maxDistance = 8; controls.minPolarAngle = .12; controls.maxPolarAngle = 1.35
    const reset = (top: boolean) => { camera.position.set(0, top ? 7.5 : 5.0, top ? .01 : 4.4); controls.target.set(0, 2, 0); controls.update() }; reset(false)
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), env = pmrem.fromScene(room); scene.environment = env.texture; room.dispose(); pmrem.dispose()
    scene.add(new THREE.HemisphereLight('#fff8ec', '#637b6b', 2))
    const light = new THREE.DirectionalLight('#fff1d5', 3); light.position.set(-3, 8, 4); light.castShadow = true; light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); light.shadow.normalBias = .02; scene.add(light)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#203b32', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor); resources.push(floor)
    const pieces = new THREE.Group(); scene.add(pieces)
    const prototypes = new Map<number, THREE.Object3D>()
    let renderedGame: Game | undefined, renderedSelection: number | null | undefined, cameraId = latest.current.camera
    const disposeObjects = (objects: THREE.Object3D[]) => {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
      objects.forEach(root => root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { materials.add(m); Object.values(m).forEach(v => { if (v instanceof THREE.Texture) textures.add(v) }) }) } }))
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => { if (t.image instanceof ImageBitmap) t.image.close(); t.dispose() })
    }
    const loader = new GLTFLoader()
    Promise.allSettled([loader.loadAsync(tableUrl), loader.loadAsync(tilesUrl)]).then(results => {
      const loaded = results.flatMap(r => r.status === 'fulfilled' ? [r.value.scene] : [])
      if (disposed) { disposeObjects(loaded); return }
      resources.push(...loaded)
      if (results.some(r => r.status === 'rejected')) { latest.current.onError('The table or tile asset could not be loaded. Reload to try again.'); return }
      const table = loaded[0].getObjectByName('AutomaticMahjongTable') || loaded[0].getObjectByName('Automatic Mahjong Table')
      // GLTFLoader sanitizes names. Tile metadata survives in userData.
      let tableRoot = table
      if (!tableRoot) loaded[0].traverse(o => { if (o.name.replaceAll('_', '').replaceAll(' ', '') === 'AutomaticMahjongTable') tableRoot = o })
      if (!tableRoot) { latest.current.onError('The table asset is missing its table group.'); return }
      scene.add(tableRoot); resources.push(tableRoot)
      loaded[1].traverse(o => { const type = o.userData.typeIndex; if (Number.isInteger(type) && !prototypes.has(type)) { const tile = o.clone(true); tile.position.set(0, 0, 0); tile.rotation.set(0, 0, 0); tile.scale.set(1, 1, 1); tile.updateMatrix(); prototypes.set(type, tile) } })
      if (prototypes.size !== 34) { latest.current.onError('The tile asset must contain all 34 tile types.'); return }
      tableRoot.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return
        o.castShadow = true; o.receiveShadow = true
        // The table asset's textured, fully rough material is its green felt.
        // Brighten that surface independently of the exposure on white tiles.
        const materials = Array.isArray(o.material) ? o.material : [o.material]
        materials.forEach(material => {
          if (material instanceof THREE.MeshStandardMaterial && material.map && material.roughness === 1 && material.metalness === 0) {
            material.color.set('#398562')
          }
        })
      })
      latest.current.onReady()
    }).catch(() => { if (!disposed) latest.current.onError('Unable to prepare the 3D assets.') })
    const addTile = (type: number, x: number, y: number, z: number, angle: number, faceDown: boolean, id?: number, standing = false) => {
      const tile = prototypes.get(type)!.clone(true)
      const pivot = new THREE.Group(); pivot.rotation.y = angle; pivot.add(tile); tile.position.set(x, y, z); tile.rotation.x = faceDown ? Math.PI : standing ? Math.PI / 2 : 0
      if (id !== undefined) tile.userData.handId = id
      if (id === latest.current.selected) tile.position.y += .065
      tile.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } }); pieces.add(pivot)
    }
    const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = { x: 0, y: 0 }
    const pointerDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      const bounds = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1); raycaster.setFromCamera(mouse, camera)
      for (const hit of raycaster.intersectObjects(pieces.children, true)) { let o: THREE.Object3D | null = hit.object; while (o && o !== pieces) { if (typeof o.userData.handId === 'number') { latest.current.onSelect(o.userData.handId); return } o = o.parent } }
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp)
    const resize = new ResizeObserver(() => { renderer.setSize(container.clientWidth, container.clientHeight); camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix() }); resize.observe(container)
    const animate = () => {
      if (disposed) return
      const state = latest.current
      if (state.camera !== cameraId) { cameraId = state.camera; reset(cameraId % 2 === 1) }
      if (prototypes.size === 34 && (renderedGame !== state.game || renderedSelection !== state.selected)) {
        pieces.clear(); renderedGame = state.game; renderedSelection = state.selected
        const game = state.game
        game.hands.forEach((hand, seat) => hand.forEach((tile, i) => addTile(tile.type, (i - (hand.length - 1) / 2) * .117, seat === 0 || game.result !== 'playing' ? 2.15 : 2.12, 1.16, seat * Math.PI / 2, seat !== 0 && game.result === 'playing', seat === 0 ? tile.id : undefined, seat === 0 && game.result === 'playing')))
        game.melds.forEach((melds, seat) => melds.forEach((meld, group) => meld.tiles.forEach((tile, i) => addTile(tile.type, -.87 + group * .45 + i * .107, 2.075, 1.41, seat * Math.PI / 2, meld.from === null && (i === 0 || i === 3) && game.result === 'playing'))))
        game.discards.forEach((river, seat) => river.forEach((tile, i) => addTile(tile.type, (i % 6 - 2.5) * .11 - .04, 2.105 + Math.floor(i / 24) * .069, .405 + Math.floor((i % 24) / 6) * .145, seat * Math.PI / 2, false)))
        game.wall.forEach((_, i) => { const side = Math.floor(i / 22), index = i % 22; addTile(0, (Math.floor(index / 2) - 5) * .11 - .04, 2.12 + index % 2 * .069, .99, side * Math.PI / 2, true) })
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate)
    }; animate()
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); disposeObjects(resources); env.dispose(); renderer.dispose(); renderer.domElement.remove() }
  }, [])
  return <div className="game-scene" ref={host} aria-label="3D Mahjong table. Drag to orbit and scroll to zoom."/>
}
