import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import QRCode from 'qrcode'
import { useAppStore } from '../../state/store'
import { EnterForm } from '../../components/EnterForm'
import { lanLink, parseLanTarget, parsePairCode } from '../../sync/protocol'
import { SyncSession, type SyncPhase } from '../../sync/session'
import { QrScanner } from './QrScanner'

function ago(iso: string | null): string {
  return iso ? `${formatDistanceToNow(parseISO(iso))} ago` : 'never'
}

const QR_OPTIONS = { margin: 1, width: 220, color: { dark: '#1e1e1e', light: '#ececec' } }

/** True when typed or scanned text points at a device we can join. */
function joinable(text: string): boolean {
  return parseLanTarget(text) !== null || parsePairCode(text) !== null
}

/** The link a phone camera can open straight into joining this code. */
function joinLink(code: string): string {
  return `${location.origin}${location.pathname}#/sync?join=${code}`
}

/**
 * Pair two devices with a QR code (or a typed code) and copy everything from
 * whichever one changed last onto the other. No merging.
 */
export function SyncScreen() {
  const load = useAppStore((s) => s.load)
  const [params, setParams] = useSearchParams()
  const [phase, setPhase] = useState<SyncPhase>({ phase: 'idle' })
  const [qr, setQr] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [typed, setTyped] = useState('')
  const sessionRef = useRef<SyncSession | null>(null)

  function session(): SyncSession {
    sessionRef.current ??= new SyncSession(setPhase, load)
    return sessionRef.current
  }

  useEffect(() => () => sessionRef.current?.close(), [])

  // Opened from a scanned join link: connect right away.
  useEffect(() => {
    const code = parsePairCode(params.get('join') ?? '')
    if (!code) return
    setParams({}, { replace: true })
    session().joinPeer(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const content =
      phase.phase === 'waiting' ? joinLink(phase.code) : phase.phase === 'waitingLan' ? lanLink(phase.target) : null
    if (!content) return
    QRCode.toDataURL(content, QR_OPTIONS)
      .then(setQr)
      .catch(() => setQr(null))
  }, [phase])

  /** A desktop's local address (no internet needed), or an online pair code. */
  function join(text: string) {
    const lan = parseLanTarget(text)
    const code = lan ? null : parsePairCode(text)
    if (!lan && !code) return
    setScanning(false)
    setTyped('')
    if (lan) session().joinLan(lan)
    else session().joinPeer(code!)
  }

  function show() {
    if (window.desktop) session().hostLan(window.desktop)
    else session().hostPeer()
  }

  function restart() {
    sessionRef.current?.close()
    sessionRef.current = null
    setQr(null)
    setPhase({ phase: 'idle' })
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Sync</h2>
      </div>
      <p className="desc m0">
        Copy everything between two devices. No merging: whichever device changed something last wins and replaces
        the other — you're asked before anything is overwritten. The data goes straight from device to device; a
        public server only helps them find each other — and with the desktop app, not even that: the phone talks to it
        straight over your wifi.
      </p>

      {phase.phase === 'idle' && (
        <div className="sync-grid">
          <div className="card stack stack-sm">
            <h3 className="m0">Show a code</h3>
            <p className="desc m0">
              {window.desktop
                ? 'On this computer. Then scan it with the phone app — both on the same wifi.'
                : 'On this device. Then scan it with the other one.'}
            </p>
            <div>
              <button type="button" className="btn btn-primary" onClick={show}>
                Show code
              </button>
            </div>
          </div>
          <div className="card stack stack-sm">
            <h3 className="m0">Join a code</h3>
            <p className="desc m0">Scan the QR on the other device, or type what it shows.</p>
            {scanning ? (
              <>
                <QrScanner onScan={join} />
                <div>
                  <button type="button" className="btn" onClick={() => setScanning(false)}>
                    Stop camera
                  </button>
                </div>
              </>
            ) : (
              <div>
                <button type="button" className="btn btn-primary" onClick={() => setScanning(true)}>
                  Scan QR
                </button>
              </div>
            )}
            <EnterForm className="row" onSubmit={() => join(typed)}>
              <input
                type="text"
                aria-label="Pair code or computer address"
                placeholder="ABC234 or 192.168.1.5:47321 ABC234"
                autoCapitalize="characters"
                autoComplete="off"
                className="sync-code-input grow"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <button type="submit" className="btn" disabled={!joinable(typed)}>
                Join
              </button>
            </EnterForm>
          </div>
        </div>
      )}

      {phase.phase === 'waiting' && (
        <div className="card stack stack-sm sync-show">
          {qr && <img src={qr} alt={`QR code for pair code ${phase.code}`} className="sync-qr" />}
          <p className="sync-code" aria-label="Pair code">
            {phase.code}
          </p>
          <p className="desc m0">Scan this with the other device (Sync → Scan QR), or type the code there.</p>
          <div>
            <button type="button" className="btn" onClick={restart}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase.phase === 'waitingLan' && (
        <div className="card stack stack-sm sync-show">
          {qr && <img src={qr} alt={`QR code for pair code ${phase.target.code}`} className="sync-qr" />}
          <p className="sync-code" aria-label="Pair code">
            {phase.target.code}
          </p>
          <p className="desc m0">
            Scan this with the phone app (Sync → Scan QR) on the same wifi, or type{' '}
            <span className="strong">
              {phase.target.hosts[0]}:{phase.target.port} {phase.target.code}
            </span>
            .
          </p>
          <div>
            <button type="button" className="btn" onClick={restart}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase.phase === 'connecting' && <div className="card">Connecting…</div>}

      {phase.phase === 'decide' && (
        <div className="card stack stack-sm">
          <p className="m0">
            Connected to a {phase.device}. This device changed {ago(phase.mine)}; the {phase.device} changed{' '}
            {ago(phase.theirs)}.
          </p>
          {phase.direction === 'equal' && <p className="strong m0">Already in sync — nothing to do.</p>}
          {phase.direction === 'send' && (
            <p className="m0">This device is newer. Waiting for the {phase.device} to accept…</p>
          )}
          {phase.direction === 'receive' && (
            <>
              <p className="strong m0">
                The {phase.device} is newer. Replace everything on this device with its data?
              </p>
              <div className="row">
                <button type="button" className="btn btn-danger" onClick={() => session().accept()}>
                  Replace this device's data
                </button>
                <button type="button" className="btn" onClick={restart}>
                  Cancel
                </button>
              </div>
            </>
          )}
          {phase.direction !== 'receive' && (
            <div>
              <button type="button" className="btn" onClick={restart}>
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {phase.phase === 'transferring' && <div className="card">Copying…</div>}

      {phase.phase === 'done' && (
        <div className="card stack stack-sm">
          <p className="strong m0">
            {phase.received ? 'Done — this device now has the other one’s data.' : 'Done — the other device is up to date.'}
          </p>
          <div>
            <button type="button" className="btn" onClick={restart}>
              Close
            </button>
          </div>
        </div>
      )}

      {phase.phase === 'error' && (
        <div className="card stack stack-sm">
          <p className="error m0">{phase.message}</p>
          <div>
            <button type="button" className="btn" onClick={restart}>
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
