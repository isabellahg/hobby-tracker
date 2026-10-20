/** Exposed by `electron/preload.cjs`; undefined in a plain browser or the Android app. */
interface DesktopBridge {
  /** Starts the local sync server, accepting only `code`, and returns how phones can reach it. */
  lanStart(code: string): Promise<{ hosts: string[]; port: number; code: string }>
  lanStop(): void
  /** Sends a JSON message to the connected phone. */
  lanSend(data: string): void
  /** Each returns an unsubscribe function. */
  onLanConnected(handler: () => void): () => void
  onLanMessage(handler: (data: string) => void): () => void
  onLanError(handler: (message: string) => void): () => void
  onLanClosed(handler: () => void): () => void
}

interface Window {
  desktop?: DesktopBridge
}
