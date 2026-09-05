import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createMahjongTable, createTileLibrary, createTileSet } from './assets/mahjong'

export type SceneProps = { view: 'table' | 'tiles'; felt: string; wood: string; rotate: boolean; cameraView: number; cycle: number; exportId: number; onCycleEnd: () => void; onExport: (message: string) => void }

export default function Scene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  useEffect(() => { latest.current = props })
  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch {
      const fallback = document.createElement('p'); fallback.className = 'scene-error'; fallback.setAttribute('role', 'alert')
      fallback.textContent = 'WebGL is unavailable. Enable hardware acceleration to explore the 3D assets.'; container.appendChild(fallback)
      return () => fallback.remove()
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3
    container.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D Mahjong asset. Drag to orbit, scroll to zoom.')
    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room)
    scene.environment = environment.texture; room.dispose(); pmrem.dispose()
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 100)
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - .025; controls.minDistance = props.view === 'table' ? 3 : 1; controls.maxDistance = 12
    const target = props.view === 'table' ? 1.25 : .12
    const resetCamera = (top = false) => { camera.position.set(top ? .01 : props.view === 'table' ? 4.6 : 2, top ? 7.8 : props.view === 'table' ? 5.2 : 2.7, top ? .01 : props.view === 'table' ? 5.3 : 2.8); controls.target.set(0, target, 0); controls.update() }
    resetCamera()
    scene.add(new THREE.HemisphereLight('#ffffff', '#8c8070', 2))
    const key = new THREE.DirectionalLight('#fff4df', 4.5); key.position.set(-3, 7, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.normalBias = .025; scene.add(key)
    const assets = new THREE.Group(); scene.add(assets)
    if (props.view === 'table') assets.add(createMahjongTable(props.felt, props.wood))
    const tiles = createTileSet(createTileLibrary(), props.view); assets.add(tiles)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .16 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
    const resize = new ResizeObserver(() => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }); resize.observe(container)
    let frame = 0, prevCamera = latest.current.cameraView, prevCycle = latest.current.cycle, prevExport = latest.current.exportId, start = 0, active = false, disposed = false
    const animate = (time: number) => {
      const state = latest.current
      controls.autoRotate = state.rotate; controls.autoRotateSpeed = .55
      if (prevCamera !== state.cameraView) { resetCamera(state.cameraView % 2 === 1); prevCamera = state.cameraView }
      if (prevCycle !== state.cycle) { start = time; active = true; prevCycle = state.cycle }
      if (active) {
        const t = Math.min((time - start) / 3600, 1)
        const lift = t < .35 ? -Math.sin(t / .35 * Math.PI / 2) * .5 : t < .6 ? -.5 : -Math.cos((t - .6) / .4 * Math.PI / 2) * .5
        tiles.position.y = lift
        // Hide the wall while it is inside the table cabinet.
        tiles.visible = lift > -.12
        if (t === 1) { active = false; tiles.visible = true; state.onCycleEnd() }
      }
      if (prevExport !== state.exportId) {
        prevExport = state.exportId
        const exported = assets.clone(true); exported.children.forEach(child => { child.visible = true; if (child.name === '136 Mahjong Tiles') child.position.y = 0 })
        import('three/addons/exporters/GLTFExporter.js').then(({ GLTFExporter }) => new GLTFExporter().parseAsync(exported, { binary: true })).then(result => {
          if (disposed) return
          const url = URL.createObjectURL(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }))
          const a = document.createElement('a'); a.href = url; a.download = `mahjong-${state.view}.glb`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); state.onExport('Asset exported successfully')
        }).catch(() => { if (!disposed) state.onExport('Export failed. Please try again.') })
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose()
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) { geometries.add(obj.geometry); for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) { materials.add(mat); for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value) } } })
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [props.view, props.felt, props.wood])
  return <div className="scene" ref={host}/>
}
