import { type ReactNode, useState } from 'react'
import { isCleartextVault } from '../lib/vault'
import { Icon, Notice } from './components'
import { Decrypt, type DecryptResult } from './Decrypt'
import { Rich, t } from './text'
import { type LoadedData, LoadData } from './LoadData'
import { Results } from './Results'
import { Tutorial } from './Tutorial'

function StepCard ({ number, title, done, children }: { number: number, title: string, done?: boolean, children: ReactNode }) {
  return (
    <section className={`card step${done ? ' done' : ''}`}>
      <header className="step-header">
        <span className="step-badge">{done ? <Icon.check size={16} /> : number}</span>
        <h2>{title}</h2>
      </header>
      <div className="step-body">{children}</div>
    </section>
  )
}

export function App () {
  const [loaded, setLoaded] = useState<LoadedData | null>(null)
  const [result, setResult] = useState<DecryptResult | null>(null)
  // bumping this remounts the inputs, wiping the password and pasted text
  const [session, setSession] = useState(0)

  const onLoaded = (data: LoadedData | null) => {
    setLoaded(data)
    setResult(null)
    // pre-v3 MetaMask vaults are not encrypted at all
    const cleartext = data?.candidates.find((c) => isCleartextVault(c.vault))
    if (cleartext) {
      setResult({ keyrings: [cleartext.vault], index: 0 })
    }
  }

  const clearAll = () => {
    setLoaded(null)
    setResult(null)
    setSession((n) => n + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon.key size={20} /></span>
          <span className="brand-name">{t.title}</span>
        </div>
        <nav className="topbar-actions">
          <a className="btn btn-ghost btn-compact" href="https://github.com/RabbyHub/vault-decryptor" target="_blank" rel="noreferrer">
            <Icon.github size={16} /> <span className="hide-sm">{t.github}</span>
          </a>
        </nav>
      </header>

      <main>
        <div className="hero">
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>

        <Notice tone="info">
          <strong>{t.safetyTitle}</strong> <Rich text={t.safetyBody} />
        </Notice>

        <StepCard number={1} title={t.step1} done={!!loaded}>
          <Tutorial />
        </StepCard>

        <StepCard number={2} title={t.step2} done={!!loaded}>
          <LoadData key={`load-${session}`} loaded={loaded} onLoaded={onLoaded} />
        </StepCard>

        <StepCard number={3} title={result ? t.resultTitle : t.step3} done={!!result}>
          {result
            ? <Results result={result} onClear={clearAll} />
            : <Decrypt key={`decrypt-${session}`} candidates={loaded?.candidates ?? null} onDecrypted={setResult} />}
        </StepCard>
      </main>

      <footer className="footer muted small">
        Rabby Vault Decryptor · <a href="https://github.com/RabbyHub/vault-decryptor" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  )
}
