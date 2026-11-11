import { type DragEvent, useRef, useState } from 'react'
import { extractVaultsFromFiles, parseVaultText, type VaultCandidate } from '../lib/vault'
import { Icon, Notice, Spinner } from './components'
import {
  filesFromDataTransfer,
  filesFromInput,
  formatBytes,
  type PickedFile,
  selectRelevantFiles,
  TooManyFilesError,
} from './files'
import { t } from './text'

export type LoadedData =
  | { kind: 'files', files: Array<{ path: string, size: number, vaults: number }>, candidates: VaultCandidate[] }
  | { kind: 'text', candidates: VaultCandidate[] }

type LoadError = 'noVaultFiles' | 'noVaultText' | 'tooManyFiles' | 'readFailed'

export function LoadData ({ loaded, onLoaded }: {
  loaded: LoadedData | null
  onLoaded: (data: LoadedData | null) => void
}) {
  const [mode, setMode] = useState<'files' | 'text'>('files')
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<LoadError | null>(null)
  const [text, setText] = useState('')
  const dragDepth = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  const loadFiles = async (getFiles: () => Promise<PickedFile[]> | PickedFile[]) => {
    setReading(true)
    setError(null)
    onLoaded(null)
    try {
      const picked = selectRelevantFiles(await getFiles())
      if (!picked.length) {
        setError('noVaultFiles')
        return
      }
      const inputs = await Promise.all(picked.map(async (p) => ({ name: p.path, data: await p.file.arrayBuffer() })))
      const candidates = extractVaultsFromFiles(inputs)
      if (!candidates.length) {
        setError('noVaultFiles')
        return
      }
      onLoaded({
        kind: 'files',
        candidates,
        files: picked.map((p) => ({
          path: p.path,
          size: p.file.size,
          vaults: candidates.filter((c) => c.source === p.path).length,
        })),
      })
    } catch (err) {
      setError(err instanceof TooManyFilesError ? 'tooManyFiles' : 'readFailed')
      if (!(err instanceof TooManyFilesError)) console.error(err)
    } finally {
      setReading(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const dt = event.dataTransfer
    // must start reading synchronously, while the DataTransfer is still valid
    const promise = filesFromDataTransfer(dt)
    loadFiles(() => promise)
  }

  const onText = (value: string) => {
    setText(value)
    setError(null)
    if (!value.trim()) {
      onLoaded(null)
      return
    }
    const vault = parseVaultText(value)
    if (vault) {
      onLoaded({ kind: 'text', candidates: [{ vault, source: 'text' }] })
    } else {
      onLoaded(null)
      setError('noVaultText')
    }
  }

  const reset = () => {
    setError(null)
    setText('')
    onLoaded(null)
    if (fileInput.current) fileInput.current.value = ''
    if (folderInput.current) folderInput.current.value = ''
  }

  return (
    <div className="load">
      {mode === 'files'
        ? (
          <div
            className={`dropzone${dragging ? ' dragging' : ''}${loaded ? ' loaded' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault()
              dragDepth.current++
              setDragging(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }}
            onDragLeave={() => {
              if (--dragDepth.current <= 0) setDragging(false)
            }}
            onDrop={onDrop}
          >
            <div className="dropzone-icon">{reading ? <Spinner /> : <Icon.upload size={28} />}</div>
            <div className="dropzone-title">{reading ? t.reading : dragging ? t.dropActive : t.dropTitle}</div>
            <div className="dropzone-hint">{t.dropHint}</div>
            <div className="dropzone-actions">
              <button type="button" className="btn btn-secondary" disabled={reading} onClick={() => folderInput.current?.click()}>
                <Icon.folder size={16} /> {t.chooseFolder}
              </button>
              <button type="button" className="btn btn-secondary" disabled={reading} onClick={() => fileInput.current?.click()}>
                <Icon.upload size={16} /> {t.chooseFiles}
              </button>
            </div>
            <input
              ref={folderInput}
              type="file"
              hidden
              {...{ webkitdirectory: '', directory: '' }}
              onChange={(e) => {
                const files = filesFromInput(e.target.files)
                if (files.length) loadFiles(() => files)
              }}
            />
            <input
              ref={fileInput}
              type="file"
              hidden
              multiple
              onChange={(e) => {
                const files = filesFromInput(e.target.files)
                if (files.length) loadFiles(() => files)
              }}
            />
          </div>
          )
        : (
          <textarea
            className="paste"
            value={text}
            spellCheck={false}
            placeholder={t.pastePlaceholder}
            onChange={(e) => onText(e.target.value)}
          />
          )}

      <button type="button" className="link-button" onClick={() => { reset(); setMode(mode === 'files' ? 'text' : 'files') }}>
        {mode === 'files' ? t.orPaste : t.orFiles}
      </button>

      {error && <Notice tone="error">{t[error]}</Notice>}

      {loaded && (
        <Notice tone="success">
          <div className="loaded-row">
            <span>{loaded.kind === 'files' ? t.loadedFiles(loaded.files.length, loaded.candidates.length) : t.loadedText}</span>
            <button type="button" className="btn btn-ghost btn-compact" onClick={reset}><Icon.x size={14} /> {t.clear}</button>
          </div>
          {loaded.kind === 'files' && (
            <details className="file-list">
              <summary>{t.fileList}</summary>
              <table>
                <tbody>
                  {loaded.files.map((f) => (
                    <tr key={f.path}>
                      <td className="mono">{f.path}</td>
                      <td className="num">{formatBytes(f.size)}</td>
                      <td className="num">{t.vaultsInFile(f.vaults)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </Notice>
      )}
    </div>
  )
}
