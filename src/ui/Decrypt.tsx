import { type FormEvent, useState } from 'react'
import { decryptVaults, IncorrectPasswordError, type Keyring, type VaultCandidate } from '../lib/vault'
import { Icon, Notice, Spinner } from './components'
import { t } from './text'

export type DecryptResult = { keyrings: Keyring[], index: number }

export function Decrypt ({ candidates, onDecrypted }: {
  candidates: VaultCandidate[] | null
  onDecrypted: (result: DecryptResult) => void
}) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState<{ index: number, total: number } | null>(null)
  const [error, setError] = useState<'incorrectPassword' | 'decryptFailed' | null>(null)
  const busy = progress !== null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!candidates?.length || !password || busy) return
    setError(null)
    setProgress({ index: 0, total: candidates.length })
    try {
      const { keyrings, index } = await decryptVaults(
        password,
        candidates.map((c) => c.vault),
        (i, total) => setProgress({ index: i, total }),
      )
      onDecrypted({ keyrings, index })
    } catch (err) {
      if (err instanceof IncorrectPasswordError) {
        setError('incorrectPassword')
      } else {
        console.error(err)
        setError('decryptFailed')
      }
    } finally {
      setProgress(null)
    }
  }

  return (
    <form className="decrypt" onSubmit={submit}>
      <label htmlFor="password">{t.passwordLabel}</label>
      <div className="password-row">
        <div className="password-field">
          <input
            id="password"
            type={visible ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={visible ? t.hide : t.show}
            title={visible ? t.hide : t.show}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <Icon.eyeOff size={18} /> : <Icon.eye size={18} />}
          </button>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!candidates?.length || !password || busy}>
          {busy ? <Spinner /> : <Icon.key size={16} />}
          {busy ? t.decrypting : t.decrypt}
        </button>
      </div>
      {!candidates?.length && <p className="muted small">{t.needData}</p>}
      {busy && <p className="muted small">{t.tryingCopy(progress.index + 1, progress.total)}</p>}
      {error && <Notice tone="error">{t[error]}</Notice>}
    </form>
  )
}
