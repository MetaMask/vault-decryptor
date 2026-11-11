import { type ReactNode, useState } from 'react'
import { type KeyringSummary, summarizeKeyrings } from '../lib/vault'
import { CopyButton, Icon, Notice } from './components'
import type { DecryptResult } from './Decrypt'
import { t } from './text'

function Secret ({ children, revealed, onReveal }: { children: ReactNode, revealed: boolean, onReveal: () => void }) {
  return (
    <div className={`secret${revealed ? ' revealed' : ''}`}>
      <div className="secret-content" aria-hidden={!revealed}>{children}</div>
      {!revealed && (
        <button type="button" className="secret-cover" onClick={onReveal}>
          <Icon.eye size={18} /> {t.reveal}
        </button>
      )}
    </div>
  )
}

function RevealToggle ({ revealed, onToggle }: { revealed: boolean, onToggle: () => void }) {
  return (
    <button type="button" className="btn btn-ghost btn-compact" onClick={onToggle}>
      {revealed ? <Icon.eyeOff size={16} /> : <Icon.eye size={16} />}
      <span>{revealed ? t.hide : t.show}</span>
    </button>
  )
}

function SeedPhraseCard ({ summary, number }: { summary: KeyringSummary, number: number }) {
  const [revealed, setRevealed] = useState(false)
  const mnemonic = summary.mnemonic!
  // SLIP-39 shares are separated by newlines; show each share on its own
  const isSlip39 = mnemonic.includes('\n')
  const words = mnemonic.trim().split(/\s+/u)

  return (
    <section className="secret-card">
      <header>
        <h4>{t.seedPhrase(number, words.length)}</h4>
        <div className="secret-actions">
          <RevealToggle revealed={revealed} onToggle={() => setRevealed(!revealed)} />
          <CopyButton text={mnemonic} compact />
        </div>
      </header>
      <Secret revealed={revealed} onReveal={() => setRevealed(true)}>
        {isSlip39
          ? <pre className="mono slip39">{mnemonic}</pre>
          : (
            <ol className="words">
              {words.map((word, i) => <li key={i}><span className="word-index">{i + 1}</span>{word}</li>)}
            </ol>
            )}
      </Secret>
      {summary.needPassphrase && <Notice tone="warn">{t.passphraseWarning}</Notice>}
      {!!summary.accounts?.length && (
        <div className="accounts">
          <span className="muted small">{t.addresses}</span>
          {summary.accounts.map((a) => <code key={a} className="mono">{a}</code>)}
        </div>
      )}
    </section>
  )
}

function PrivateKeyRow ({ address, privateKey }: { address: string, privateKey: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="pk-row">
      <div className="pk-head">
        <code className="mono address">{address}</code>
        <div className="secret-actions">
          <RevealToggle revealed={revealed} onToggle={() => setRevealed(!revealed)} />
          <CopyButton text={privateKey} compact />
        </div>
      </div>
      <Secret revealed={revealed} onReveal={() => setRevealed(true)}>
        <code className="mono pk">{privateKey}</code>
      </Secret>
    </div>
  )
}

export function Results ({ result, onClear }: { result: DecryptResult, onClear: () => void }) {
  const summaries = summarizeKeyrings(result.keyrings)
  const seeds = summaries.filter((s) => s.mnemonic)
  const keys = summaries.flatMap((s) => s.privateKeys ?? [])
  const others = summaries.filter((s) => !s.mnemonic && !s.privateKeys)
  const otherTypes = Array.from(new Set(others.map((s) => s.type).filter(Boolean)))

  return (
    <div className="results">
      {result.index > 0 && <Notice tone="warn">{t.olderCopy}</Notice>}
      {!seeds.length && !keys.length && <Notice tone="info">{t.nothingFound}</Notice>}

      {seeds.map((s, i) => <SeedPhraseCard key={i} summary={s} number={i + 1} />)}

      {!!keys.length && (
        <section className="secret-card">
          <header><h4>{t.privateKeys}</h4></header>
          {keys.map((k) => <PrivateKeyRow key={k.address} {...k} />)}
        </section>
      )}

      {!!otherTypes.length && <p className="muted small">{t.otherKeyrings} {otherTypes.join(', ')}</p>}

      <details className="raw">
        <summary>{t.rawData}</summary>
        <pre className="mono">{JSON.stringify(result.keyrings, null, 2)}</pre>
      </details>

      <div className="results-footer">
        <span className="muted small">{t.doneHint}</span>
        <button type="button" className="btn btn-danger" onClick={onClear}><Icon.x size={16} /> {t.startOver}</button>
      </div>
    </div>
  )
}
