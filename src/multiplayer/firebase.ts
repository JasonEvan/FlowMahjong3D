import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase, onValue, ref } from 'firebase/database'
import { actInDatabaseRoom, decodeRoom, enterDatabaseRoom } from './database'
import { roomView } from './room'
import type { Action, RoomView } from './room'

const env = import.meta.env
const config = { apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, databaseURL: env.VITE_FIREBASE_DATABASE_URL, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID }
export const firebaseConfigured = [config.apiKey, config.projectId, config.databaseURL, config.appId].every(value => value && !value.startsWith('your-'))
function initialize() {
  const app = initializeApp(config), auth = getAuth(app), database = getDatabase(app)
  let offset = 0
  if (env.VITE_FIREBASE_USE_EMULATORS === 'true') {
    const host = location.hostname
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
    connectDatabaseEmulator(database, host, 9000)
  }
  onValue(ref(database, '.info/serverTimeOffset'), snapshot => { offset = snapshot.val() || 0 })
  return { auth, database, now: () => Date.now() + offset }
}
let client: ReturnType<typeof initialize> | undefined
async function connect() {
  if (!firebaseConfigured) throw new Error('Multiplayer is not configured yet. Fill in .env.local using .env.example.')
  client ??= initialize()
  await client.auth.authStateReady()
  if (!client.auth.currentUser) await signInAnonymously(client.auth)
  return client
}
export async function enterRoom(kind: 'create' | 'join', name: string, code?: string) {
  const connection = await connect()
  return enterDatabaseRoom(connection.database, connection.auth.currentUser!.uid, kind, name, code, connection.now())
}
export async function sendAction(code: string, action: Action) {
  const connection = await connect()
  await actInDatabaseRoom(connection.database, connection.auth.currentUser!.uid, code, action, connection.now())
}
export async function watchRoom(code: string, receive: (view: RoomView | null) => void, connectionChanged: (online: boolean) => void, fail: (error: Error) => void) {
  const connection = await connect()
  const uid = connection.auth.currentUser!.uid
  const stopRoom = onValue(ref(connection.database, `sparkRooms/${code}`), snapshot => {
    const room = snapshot.exists() ? decodeRoom(snapshot.val()) : null
    receive(room?.members[uid] ? roomView(room, uid, connection.now()) : null)
  }, fail)
  const stopConnection = onValue(ref(connection.database, '.info/connected'), snapshot => connectionChanged(snapshot.val() === true))
  return () => { stopRoom(); stopConnection() }
}
