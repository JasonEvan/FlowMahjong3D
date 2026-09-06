# Mahjong / 3D

A React + TypeScript + Three.js asset studio for the first building blocks of a Mahjong game.

## Run

```sh
npm install
npm run dev
```

Production checks: `npm run build` and `npm run lint`.

## Play

Choose **Single Player** for the local bot game described below, or **Multiplayer** for online rooms. Multiplayer setup is described in the next section.

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

## Multiplayer: Firebase Spark setup

Multiplayer runs entirely on the **Spark plan** using **Anonymous Authentication + Realtime Database**. It does not use Cloud Functions or require billing to be enabled.

The flow is **Multiplayer → Create a room / Join a room → Lobby → Start round**. The creator shares a six-digit code. The host starts when ready, with 1–4 humans; empty seats become bots. New joins close when the round starts. Dealer dice are rolled automatically by the starting player's browser.

### 1. Configure Firebase

1. Create a Firebase project on **Spark** and register a **Web app** under **Project settings → Your apps**.
2. Enable **Build → Authentication → Sign-in method → Anonymous**. See [anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth).
3. Create **Build → Realtime Database** in **locked mode**. Choose your preferred region and copy the exact database URL. This implementation does not use Firestore. See [Database setup](https://firebase.google.com/docs/database/web/start).
4. Copy `.env.example` to `.env.local` and fill in your web app configuration, including the database URL. Keep `VITE_FIREBASE_USE_EMULATORS=false`.
5. Publish the rules in `database.rules.json` using the console's Realtime Database **Rules** tab, or the CLI command below.

`VITE_` values are public browser configuration. Do not add service-account keys. Cloud Storage and Messaging do not need to be enabled; their optional config fields can be left blank. No Functions region variable is needed.

### 2. Deploy database rules and run

From this repository's root, using Node 22.6 or newer:

```sh
npm install
npx firebase login
npx firebase deploy --project YOUR_PROJECT_ID --only database
npm run dev
```

Use the project ID from `VITE_FIREBASE_PROJECT_ID`. Restart Vite after changing environment variables. You do not need `firebase init`, a functions directory, or any backend deployment.

Open `/game`, create a room, and join from another browser profile/incognito session or device. Normal tabs in the same profile share the same anonymous identity. The host clicks **Start round**; two humans will play with two bots.

### 3. Optional website hosting

Set the same Firebase environment variables in your build environment. Firebase Hosting SPA configuration is included:

```sh
npm run build
npx firebase deploy --project YOUR_PROJECT_ID --only hosting
```

Other static hosts work too; route `/game` to `index.html`.

### Local testing without a Firebase project

Install Java 21+ for the Database emulator. See [Emulator Suite setup](https://firebase.google.com/docs/emulator-suite/install_and_configure).

```sh
npm run test:emulator
```

This starts only Auth and Database emulators with the non-production ID `demo-mahjong`. The integration test checks concurrent joins, seat limits, membership rules, host start, synchronized moves, stale actions, and host transfer.

For interactive emulator play, use:

```dotenv
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-mahjong.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-mahjong
VITE_FIREBASE_DATABASE_URL=https://demo-mahjong-default-rtdb.firebaseio.com
VITE_FIREBASE_APP_ID=demo-app
VITE_FIREBASE_USE_EMULATORS=true
```

Run `npm run emulators` and `npm run dev` in separate terminals. Ports: 9099 (Auth), 9000 (Database). Switch emulator mode off and restore your real configuration before deploying.

### Synchronization, privacy, and limits

- Browsers apply the shared rules engine inside Realtime Database transactions. Conflicting writes retry against the latest state. Eligible humans each submit a claim or pass before resolution: **Mahjong > Pong/Kong > Chi**, then turn order for ties.
- Each player's display rotates their own hand to the bottom and masks opponents' hands. **Room members can inspect the full underlying game state through developer tools.** Moves are checked by the normal client, but a modified client can cheat. This is suitable for trusted friends, not competitive play requiring a trusted server.
- Database rules require authentication, prevent listing all rooms, restrict running-room access to members, protect other members' seat records, limit rooms to four distinct seats, and restrict the initial start to the host. An authenticated user who knows a code can read its waiting lobby and join an empty seat. Keep room codes within your group.
- Clients send a transaction every three seconds while a room is open. These update presence and advance bots. After 35 seconds without a heartbeat, bots cover disconnected seats. Reconnecting with the same anonymous identity restores control. The room is remembered in the current tab.
- When the host leaves or disconnects, an active member becomes host. Explicitly leaving releases the seat, preventing rejoining that running round. If all browsers close, play pauses until someone returns.
- Rooms expire after 24 hours. The final member's explicit departure deletes an unexpired room. Abandoned rooms need administrative cleanup in the Database console; there is no scheduled backend. New rooms use the `sparkRooms` path; old Cloud Functions rooms are not migrated.
- Spark has usage limits, including **100 simultaneous database connections**. Room updates download shared state, so watch Database usage as play increases. No billing upgrade is required; see [Realtime Database limits](https://firebase.google.com/docs/database/usage/limits) and [Spark billing behavior](https://firebase.google.com/docs/database/usage/billing).
- If you followed the earlier Cloud Functions instructions, replace the database rules and rebuild the frontend. Remove any unused deployed function manually if one exists. Existing `VITE_FIREBASE_FUNCTIONS_REGION` values are ignored and can be removed.

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
