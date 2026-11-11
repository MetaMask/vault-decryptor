import { useState } from 'react'
import { CopyButton, Segmented } from './components'
import { Rich, t } from './text'
import {
  type Browser,
  BROWSER_NAMES,
  browsersFor,
  detectOS,
  type OS,
  rabbyDataPath,
  VERSION_PAGES,
} from './paths'

const OS_NAMES: Record<OS, string> = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }

export function Tutorial () {
  const [os, setOS] = useState<OS>(detectOS)
  const [browser, setBrowser] = useState<Browser>('chrome')
  const browsers = browsersFor(os)
  const activeBrowser = browsers.includes(browser) ? browser : 'chrome'
  const path = rabbyDataPath(os, activeBrowser)
  const versionPage = VERSION_PAGES[activeBrowser]
  const openHow = { mac: t.tutOpenMac, windows: t.tutOpenWindows, linux: t.tutOpenLinux }[os]

  return (
    <div className="tutorial">
      <p className="muted">{t.tutIntro}</p>
      <div className="pickers">
        <Segmented
          label={t.tutSystem}
          value={os}
          onChange={setOS}
          options={(Object.keys(OS_NAMES) as OS[]).map((v) => ({ value: v, label: OS_NAMES[v] }))}
        />
        <Segmented
          label={t.tutBrowser}
          value={activeBrowser}
          onChange={setBrowser}
          options={browsers.map((v) => ({ value: v, label: BROWSER_NAMES[v] }))}
        />
      </div>

      <ol className="steps-list">
        <li>
          <h4>{t.tutQuitTitle(BROWSER_NAMES[activeBrowser])}</h4>
          <p className="muted">{t.tutQuitBody}</p>
        </li>
        <li>
          <h4>{t.tutOpenTitle}</h4>
          <p className="muted"><Rich text={openHow} /></p>
          <div className="path-box">
            <code>{path}</code>
            <CopyButton text={path} compact />
          </div>
        </li>
        <li>
          <h4>{t.tutDropTitle}</h4>
          <p className="muted"><Rich text={t.tutDropBody} /></p>
        </li>
      </ol>

      <div className="faq">
        {[
          [t.faqProfileQ, t.faqProfileA(versionPage)],
          [t.faqMissingQ, t.faqMissingA(versionPage)],
          [t.faqPasswordQ, t.faqPasswordA],
          [t.faqSecretsQ, t.faqSecretsA],
          [t.faqMetaMaskQ, t.faqMetaMaskA],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p><Rich text={a} /></p>
          </details>
        ))}
      </div>
    </div>
  )
}
