# Mahjong / 3D

A React + TypeScript + Three.js asset studio for the first building blocks of a Mahjong game.

## Run

```sh
npm install
npm run dev
```

Production checks: `npm run build` and `npm run lint`.

## Play

Open `/game` (or choose **Play Mahjong** in the studio) to play against three bots using the supplied `mahjong-table.glb` and `mahjong-tiles.glb` assets. Select a tile in the 3D scene or the accessible hand bar, then press **Discard tile**. Normal draws and self-draw wins are automatic. Discard claims require your choice whenever you have a legal option. Drag to orbit or switch to top view.

Before every round, choose **Roll dice for all players** to watch each player roll two dice. The highest total selects the dealer; only the highest tied players reroll until one wins. Choose **Deal tiles** to begin. The dealer is East, receives 14 tiles, and takes the first turn; the other players receive 13. Seat winds rotate relative to the dealer while your camera seat stays fixed. Starting another round repeats dealer selection.

After each discard, the game checks claims before drawing the next tile. With two matching tiles, choose **Pong**; with three, choose **Kong**. **Chi (Che)** can claim only the previous player's discard to complete a suited sequence; every possible sequence is shown separately. **Mahjong!** claims a discard win. **Pass** declines your claims. The game waits indefinitely for your decision when any legal option exists; otherwise bots resolve claims automatically. Only the latest discard can be claimed. Priority is Mahjong, then Pong/Kong, then Chi, with ties resolved by turn order. A bot's higher-priority claim can override your choice.

Claimed sets stay exposed in the 3D scene and are removed from the concealed hand. Pong and Chi let the claimant discard without drawing. Kong draws a replacement from the opposite end of the wall; four identical concealed tiles can also be declared as a **Concealed Kong** after a draw. Kong requires a replacement tile to remain available. These basic claim mechanics follow the [Tabletopia Mahjong rules](https://c.tabletopia.com/games/old-hong-kong-mahjong/rules/mahjong-rules/en), with the simplified variant below.

This is a simplified 136-tile ruleset: four sets and a pair, or seven distinct pairs with a closed hand. Existing Pongs cannot yet be upgraded to Kong. No scoring, riichi, furiten, flowers, dead wall, or thirteen-orphans hand are implemented. The game ends on a win or wall exhaustion after outstanding claims resolve. **New round** reshuffles the tiles. Reloading starts a new game; games are not saved.

Bots use only their own hand and the public discard to favor pairs, triples, adjacent suited tiles, and legal claims. `src/game/engine.ts` contains the pure rules engine; `npm test` checks winning hands, turn legality, claim priority, Chi alternatives, passing, Kong replacement draws, exposed sets, and tile conservation through 100 seeded full rounds. Tests require Node 22.6 or newer with experimental type stripping.

If the existing dependency folder or lockfile is owned by root, restore project-local ownership before installation:

```sh
sudo chown -R "$(id -un)":staff node_modules package-lock.json
```

## Assets

`src/assets/mahjong.ts` exposes independent Three.js factories:

- `createMahjongTable(feltColor, woodColor)` creates the named table group, with rounded walnut rails, textured felt, pedestal, four feet, wall slots, and a central dice console.
- `createTileLibrary(backColor)` returns a tile factory accepting a type index from 0–33. Tiles share geometry and materials, with rounded resin bodies, colored backs, and canvas-generated faces.
- `createTileSet(makeTile, display)` produces 136 tiles: four copies of 34 types. The set includes characters, bamboo, circles, four winds, and three dragons; flowers and seasons are excluded.
- `tileTypes` contains face metadata. Each tile group also carries that metadata in `userData`.

Coordinates use Y-up. The table is 3.15 units square, its playing surface is about 2.07 units high, and individual tiles measure 0.105 × 0.065 × 0.145 units. Dimensions are adjustable modeling proportions, not a particular manufacturer's specification.

The preview supports orbit, zoom, top view, automatic rotation, three felt colors, and three wood finishes. The lift control illustrates a wall-lowering and wall-raising cycle; it is not an internal mechanical simulation or game logic.

Use **Export asset** to download a binary glTF (`.glb`) with embedded procedural textures. Table view exports the table and its tile walls; tile view exports only the full tile collection. Export follows the Three.js [GLTFExporter API](https://threejs.org/docs/pages/GLTFExporter.html).

## Structure

- `src/assets/mahjong.ts`: reusable asset geometry, materials, face artwork, and arrangements.
- `src/Scene.tsx`: lighting, renderer, camera, orbit controls, lift preview, export, and resource disposal.
- `src/App.tsx`: responsive asset browser and material controls.

The application requires WebGL. Fonts use Google Fonts with local sans-serif fallbacks. All model textures are generated locally; no external 3D models are required.
