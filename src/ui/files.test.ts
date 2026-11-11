import { describe, expect, it } from 'vitest'
import { RABBY_EXTENSION_ID } from '../lib/vault'
import {
  filesFromDataTransfer,
  filesFromInput,
  formatBytes,
  type PickedFile,
  selectRelevantFiles,
  TooManyFilesError,
} from './files'

const fileEntry = (name: string, content = 'x') => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (resolve: (f: File) => void) => resolve(new File([content], name)),
})

// readEntries hands out children in batches of 2, then an empty batch
const dirEntry = (name: string, children: unknown[]) => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => {
    let pos = 0
    return {
      readEntries: (resolve: (entries: unknown[]) => void) => {
        const batch = children.slice(pos, pos + 2)
        pos += batch.length
        resolve(batch)
      },
    }
  },
})

const dataTransfer = (entries: unknown[], files: File[] = []) => ({
  items: entries.map((entry) => ({ kind: 'file', webkitGetAsEntry: () => entry })),
  files,
}) as unknown as DataTransfer

const picked = (path: string, size = 1): PickedFile => ({ path, file: new File(['x'.repeat(size)], path.split('/').pop()!) })

describe('filesFromDataTransfer', () => {
  it('walks dropped folders recursively, across readEntries batches', async () => {
    const dt = dataTransfer([
      dirEntry('Default', [
        dirEntry('Local Extension Settings', [
          dirEntry(RABBY_EXTENSION_ID, [fileEntry('000003.log'), fileEntry('000005.ldb'), fileEntry('LOCK'), fileEntry('CURRENT')]),
        ]),
        fileEntry('Preferences'),
      ]),
      fileEntry('loose.ldb'),
    ])
    const files = await filesFromDataTransfer(dt)
    expect(files.map((f) => f.path)).toStrictEqual([
      `Default/Local Extension Settings/${RABBY_EXTENSION_ID}/000003.log`,
      `Default/Local Extension Settings/${RABBY_EXTENSION_ID}/000005.ldb`,
      `Default/Local Extension Settings/${RABBY_EXTENSION_ID}/LOCK`,
      `Default/Local Extension Settings/${RABBY_EXTENSION_ID}/CURRENT`,
      'Default/Preferences',
      'loose.ldb',
    ])
    // a whole profile was dropped: keep only Rabby's folder, minus the lock file
    expect(selectRelevantFiles(files).map((f) => f.file.name)).toStrictEqual(['000003.log', '000005.ldb', 'CURRENT'])
  })

  it('falls back to plain files when entries are unavailable', async () => {
    const file = new File(['x'], 'a.log')
    expect(await filesFromDataTransfer(dataTransfer([], [file]))).toStrictEqual([{ file, path: 'a.log' }])
  })

  it('stops walking huge trees', async () => {
    const many = Array.from({ length: 20_001 }, (_, i) => fileEntry(`f${i}`))
    await expect(filesFromDataTransfer(dataTransfer([dirEntry('root', many)]))).rejects.toBeInstanceOf(TooManyFilesError)
  })
})

describe('selectRelevantFiles', () => {
  it('keeps everything when no Rabby folder is involved', () => {
    expect(selectRelevantFiles([picked('a.log'), picked('b.ldb')])).toHaveLength(2)
  })

  it('refuses large unrelated selections', () => {
    expect(() => selectRelevantFiles(Array.from({ length: 301 }, (_, i) => picked(`p/${i}`)))).toThrow(TooManyFilesError)
  })

  it('keeps large selections inside the Rabby folder', () => {
    const files = Array.from({ length: 400 }, (_, i) => picked(`x/${RABBY_EXTENSION_ID}/${i}.ldb`))
    expect(selectRelevantFiles(files)).toHaveLength(400)
  })
})

describe('helpers', () => {
  it('reads file inputs with relative paths', () => {
    const file = new File(['x'], 'a.log')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'dir/a.log' })
    expect(filesFromInput([file] as unknown as FileList)).toStrictEqual([{ file, path: 'dir/a.log' }])
    expect(filesFromInput(null)).toStrictEqual([])
  })

  it('formats sizes', () => {
    expect([formatBytes(10), formatBytes(2048), formatBytes(3 * 1024 * 1024)]).toStrictEqual(['10 B', '2.0 KB', '3.0 MB'])
  })
})
