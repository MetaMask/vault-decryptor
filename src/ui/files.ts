import { RABBY_EXTENSION_ID } from '../lib/vault'

export type PickedFile = { file: File, path: string }

const MAX_ENTRIES = 20_000
const MAX_UNSCOPED_FILES = 300
const MAX_UNSCOPED_BYTES = 300 * 1024 * 1024

export class TooManyFilesError extends Error {}

function readFile (entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

function readEntries (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walk (entry: FileSystemEntry, prefix: string, out: PickedFile[], counter: { n: number }): Promise<void> {
  if (++counter.n > MAX_ENTRIES) {
    throw new TooManyFilesError()
  }
  if (entry.isFile) {
    out.push({ file: await readFile(entry as FileSystemFileEntry), path: prefix + entry.name })
    return
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns results in batches until it returns an empty array
    for (let batch = await readEntries(reader); batch.length; batch = await readEntries(reader)) {
      for (const child of batch) {
        await walk(child, `${prefix}${entry.name}/`, out, counter)
      }
    }
  }
}

/** Collects dropped files, reading dropped folders recursively. */
export async function filesFromDataTransfer (dt: DataTransfer): Promise<PickedFile[]> {
  // entries must be taken synchronously, before the drop event finishes
  const entries = Array.from(dt.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry))
  if (!entries.length) {
    return Array.from(dt.files).map((file) => ({ file, path: file.name }))
  }
  const out: PickedFile[] = []
  const counter = { n: 0 }
  for (const entry of entries) {
    await walk(entry, '', out, counter)
  }
  return out
}

export function filesFromInput (list: FileList | null): PickedFile[] {
  return Array.from(list || []).map((file) => ({ file, path: file.webkitRelativePath || file.name }))
}

/**
 * If the selection contains Rabby's extension folder (e.g. a whole browser
 * profile was dropped), keep only the files inside it. Refuse huge unrelated
 * selections instead of reading them all into memory.
 */
export function selectRelevantFiles (files: PickedFile[]): PickedFile[] {
  const inRabby = files.filter((f) => f.path.split('/').includes(RABBY_EXTENSION_ID))
  const pool = inRabby.length ? inRabby : files
  const relevant = pool.filter((f) => f.file.name !== 'LOCK')
  if (!inRabby.length) {
    const bytes = relevant.reduce((n, f) => n + f.file.size, 0)
    if (relevant.length > MAX_UNSCOPED_FILES || bytes > MAX_UNSCOPED_BYTES) {
      throw new TooManyFilesError()
    }
  }
  return relevant
}

export function formatBytes (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
