// Minimal read-only LevelDB parser for the files Chrome keeps under
// `Local Extension Settings/<extension id>/`.
//
// Supports:
// - write-ahead log files (`*.log`)
// - sorted table files (`*.ldb` / `*.sst`), including Snappy-compressed blocks

export type LevelDbRecord = {
  key: string
  /** UTF-8 decoded value, `null` for deletions. */
  value: string | null
  /** LevelDB sequence number: higher is newer. */
  seq: number
  deleted: boolean
}

type BlockHandle = { offset: number, size: number }

const LOG_BLOCK_SIZE = 32768
const LOG_HEADER_SIZE = 7
const LOG_FULL = 1
const LOG_FIRST = 2
const LOG_MIDDLE = 3
const LOG_LAST = 4

const TABLE_FOOTER_SIZE = 48
const TABLE_MAGIC_LO = 0x8b80fb57
const TABLE_MAGIC_HI = 0xdb477524
const BLOCK_TRAILER_SIZE = 5
const NO_COMPRESSION = 0
const SNAPPY_COMPRESSION = 1

const TYPE_DELETION = 0
const TYPE_VALUE = 1

const utf8 = new TextDecoder('utf-8')

export type BinaryInput = Uint8Array | ArrayBuffer | ArrayBufferView

export function toUint8Array (input: BinaryInput): Uint8Array {
  if (input instanceof Uint8Array) {
    return input
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  throw new TypeError('Expected binary data')
}

function readUint32 (buf: Uint8Array, pos: number): number {
  return (
    buf[pos] |
    (buf[pos + 1] << 8) |
    (buf[pos + 2] << 16) |
    (buf[pos + 3] << 24)
  ) >>> 0
}

// Reads a 64-bit little-endian integer as a Number. Sequence numbers and file
// offsets stay far below 2^53, so this is lossless in practice.
function readUint64 (buf: Uint8Array, pos: number): number {
  return readUint32(buf, pos) + readUint32(buf, pos + 4) * 0x100000000
}

function readVarint (buf: Uint8Array, pos: number): [number, number] {
  let result = 0
  let multiplier = 1
  for (let i = 0; i < 10; i++) {
    if (pos >= buf.length) {
      throw new Error('Truncated varint')
    }
    const byte = buf[pos++]
    result += (byte & 0x7f) * multiplier
    if ((byte & 0x80) === 0) {
      return [result, pos]
    }
    multiplier *= 128
  }
  throw new Error('Invalid varint')
}

export function snappyUncompress (input: Uint8Array): Uint8Array {
  const [length, start] = readVarint(input, 0)
  const out = new Uint8Array(length)
  let pos = start
  let outPos = 0

  while (pos < input.length) {
    const tag = input[pos++]
    const kind = tag & 0x03

    if (kind === 0) {
      // literal
      let len = tag >>> 2
      if (len >= 60) {
        const extraBytes = len - 59
        len = 0
        for (let i = 0; i < extraBytes; i++) {
          len += input[pos++] * 2 ** (8 * i)
        }
      }
      len += 1
      if (pos + len > input.length || outPos + len > length) {
        throw new Error('Invalid snappy literal')
      }
      out.set(input.subarray(pos, pos + len), outPos)
      pos += len
      outPos += len
      continue
    }

    let len: number
    let offset: number
    if (kind === 1) {
      len = ((tag >>> 2) & 0x07) + 4
      offset = ((tag >>> 5) << 8) | input[pos++]
    } else if (kind === 2) {
      len = (tag >>> 2) + 1
      offset = input[pos] | (input[pos + 1] << 8)
      pos += 2
    } else {
      len = (tag >>> 2) + 1
      offset = readUint32(input, pos)
      pos += 4
    }
    if (offset === 0 || offset > outPos || outPos + len > length) {
      throw new Error('Invalid snappy copy')
    }
    // byte by byte: source and destination may overlap
    for (let i = 0; i < len; i++) {
      out[outPos] = out[outPos - offset]
      outPos++
    }
  }

  if (outPos !== length) {
    throw new Error('Snappy length mismatch')
  }
  return out
}

function parseWriteBatch (batch: Uint8Array, records: LevelDbRecord[]): void {
  if (batch.length < 12) {
    return
  }
  let seq = readUint64(batch, 0)
  const count = readUint32(batch, 8)
  let pos = 12
  for (let i = 0; i < count && pos < batch.length; i++) {
    const type = batch[pos++]
    let keyLen: number
    ;[keyLen, pos] = readVarint(batch, pos)
    const key = utf8.decode(batch.subarray(pos, pos + keyLen))
    pos += keyLen
    if (type === TYPE_VALUE) {
      let valueLen: number
      ;[valueLen, pos] = readVarint(batch, pos)
      const value = utf8.decode(batch.subarray(pos, pos + valueLen))
      pos += valueLen
      records.push({ key, value, seq, deleted: false })
    } else if (type === TYPE_DELETION) {
      records.push({ key, value: null, seq, deleted: true })
    } else {
      throw new Error('Unknown write batch record type')
    }
    seq++
  }
}

function concat (chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const joined = new Uint8Array(total)
  let offset = 0
  chunks.forEach((c) => {
    joined.set(c, offset)
    offset += c.length
  })
  return joined
}

export function parseLogFile (input: BinaryInput): LevelDbRecord[] {
  const buf = toUint8Array(input)
  const records: LevelDbRecord[] = []
  let pending: Uint8Array[] | null = null
  let pos = 0

  while (pos + LOG_HEADER_SIZE <= buf.length) {
    const blockRemaining = LOG_BLOCK_SIZE - (pos % LOG_BLOCK_SIZE)
    if (blockRemaining < LOG_HEADER_SIZE) {
      // block trailer padding
      pos += blockRemaining
      continue
    }
    const length = buf[pos + 4] | (buf[pos + 5] << 8)
    const type = buf[pos + 6]
    const start = pos + LOG_HEADER_SIZE
    const end = start + length

    if (type === 0 && length === 0) {
      // zero-filled (preallocated) area: jump to the next block
      pos += blockRemaining
      continue
    }
    if (end > buf.length) {
      break
    }
    pos = end
    const fragment = buf.subarray(start, end)

    try {
      if (type === LOG_FULL) {
        pending = null
        parseWriteBatch(fragment, records)
      } else if (type === LOG_FIRST) {
        pending = [fragment]
      } else if (type === LOG_MIDDLE && pending) {
        pending.push(fragment)
      } else if (type === LOG_LAST && pending) {
        pending.push(fragment)
        const joined = concat(pending)
        pending = null
        parseWriteBatch(joined, records)
      } else {
        pending = null
      }
    } catch (err) {
      // corrupted batch: skip it and keep going
      pending = null
    }
  }
  return records
}

function readBlockHandle (buf: Uint8Array, pos: number): [BlockHandle, number] {
  let offset: number
  let size: number
  ;[offset, pos] = readVarint(buf, pos)
  ;[size, pos] = readVarint(buf, pos)
  return [{ offset, size }, pos]
}

function readTableBlock (buf: Uint8Array, handle: BlockHandle): Uint8Array {
  const end = handle.offset + handle.size
  if (end + BLOCK_TRAILER_SIZE > buf.length) {
    throw new Error('Block out of range')
  }
  const raw = buf.subarray(handle.offset, end)
  const compression = buf[end]
  if (compression === NO_COMPRESSION) {
    return raw
  }
  if (compression === SNAPPY_COMPRESSION) {
    return snappyUncompress(raw)
  }
  throw new Error(`Unsupported block compression ${compression}`)
}

function parseBlockEntries (block: Uint8Array): Array<{ key: Uint8Array, value: Uint8Array }> {
  const entries: Array<{ key: Uint8Array, value: Uint8Array }> = []
  if (block.length < 4) {
    return entries
  }
  const numRestarts = readUint32(block, block.length - 4)
  const limit = block.length - 4 - numRestarts * 4
  let pos = 0
  let lastKey = new Uint8Array(0)

  while (pos < limit) {
    let shared: number
    let nonShared: number
    let valueLen: number
    ;[shared, pos] = readVarint(block, pos)
    ;[nonShared, pos] = readVarint(block, pos)
    ;[valueLen, pos] = readVarint(block, pos)
    const key = new Uint8Array(shared + nonShared)
    key.set(lastKey.subarray(0, shared), 0)
    key.set(block.subarray(pos, pos + nonShared), shared)
    pos += nonShared
    const value = block.subarray(pos, pos + valueLen)
    pos += valueLen
    entries.push({ key, value })
    lastKey = key
  }
  return entries
}

function isTableFile (buf: Uint8Array): boolean {
  if (buf.length < TABLE_FOOTER_SIZE) {
    return false
  }
  const magicPos = buf.length - 8
  return readUint32(buf, magicPos) === TABLE_MAGIC_LO &&
    readUint32(buf, magicPos + 4) === TABLE_MAGIC_HI
}

export function parseTableFile (input: BinaryInput): LevelDbRecord[] {
  const buf = toUint8Array(input)
  if (!isTableFile(buf)) {
    throw new Error('Not a LevelDB table file')
  }
  let pos = buf.length - TABLE_FOOTER_SIZE
  ;[, pos] = readBlockHandle(buf, pos) // metaindex handle, unused
  const [indexHandle] = readBlockHandle(buf, pos)

  const records: LevelDbRecord[] = []
  parseBlockEntries(readTableBlock(buf, indexHandle)).forEach(({ value: handleBytes }) => {
    try {
      const [dataHandle] = readBlockHandle(handleBytes, 0)
      parseBlockEntries(readTableBlock(buf, dataHandle)).forEach(({ key, value }) => {
        if (key.length < 8) {
          return
        }
        // internal key = user key + 8-byte tag, tag = (seq << 8) | type
        const tagPos = key.length - 8
        const type = key[tagPos]
        const seq = Math.floor(readUint64(key, tagPos) / 256)
        const userKey = utf8.decode(key.subarray(0, tagPos))
        if (type === TYPE_VALUE) {
          records.push({ key: userKey, value: utf8.decode(value), seq, deleted: false })
        } else if (type === TYPE_DELETION) {
          records.push({ key: userKey, value: null, seq, deleted: true })
        }
      })
    } catch (err) {
      // unreadable data block: skip it
    }
  })
  return records
}

/**
 * Parses a LevelDB file, auto-detecting log vs table format.
 *
 * @returns The records, or `null` if the file doesn't look like either format.
 */
export function parseLevelDbFile (input: BinaryInput): LevelDbRecord[] | null {
  const buf = toUint8Array(input)
  if (isTableFile(buf)) {
    try {
      return parseTableFile(buf)
    } catch (err) {
      return null
    }
  }
  const records = parseLogFile(buf)
  return records.length ? records : null
}
