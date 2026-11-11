import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type LevelDbRecord,
  parseLevelDbFile,
  parseLogFile,
  parseTableFile,
  snappyUncompress,
} from './leveldb'

const fixture = (p: string) => fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'fixtures', p))
const varint = (n: number) => {
  const out = []
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80)
    n = Math.floor(n / 128)
  }
  out.push(n)
  return Buffer.from(out)
}
const u32 = (n: number) => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n)
  return b
}
const logRecord = (type: number, payload: Buffer) => Buffer.concat([Buffer.from([0, 0, 0, 0, payload.length & 0xff, payload.length >> 8, type]), payload])
const putBatch = (seq: number, key: string, value: string) => Buffer.concat([
  u32(seq), u32(0), u32(1), Buffer.from([1]), varint(key.length), Buffer.from(key), varint(value.length), Buffer.from(value),
])
// single data block table; entries are [userKey, seq, type, value]
const buildTable = (entries: Array<[string, number, number, string]>, compression = 0, rawKeys = false) => {
  const block = Buffer.concat([
    ...entries.map(([key, seq, type, value]) => {
      const tag = Buffer.alloc(8)
      tag.writeBigUInt64LE((BigInt(seq) << 8n) | BigInt(type))
      const k = rawKeys ? Buffer.from(key) : Buffer.concat([Buffer.from(key), tag])
      return Buffer.concat([varint(0), varint(k.length), varint(value.length), k, Buffer.from(value)])
    }),
    u32(0), u32(1),
  ])
  const data = Buffer.concat([block, Buffer.from([compression, 0, 0, 0, 0])])
  const indexBlock = Buffer.concat([varint(0), varint(1), varint(2), Buffer.from('z'), varint(0), varint(block.length), u32(0), u32(1)])
  const index = Buffer.concat([indexBlock, Buffer.from([0, 0, 0, 0, 0])])
  const handles = Buffer.concat([varint(0), varint(0), varint(data.length), varint(indexBlock.length)])
  const footer = Buffer.concat([handles, Buffer.alloc(40 - handles.length), Buffer.from([0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb])])
  return Buffer.concat([data, index, footer])
}
const keysOf = (records: LevelDbRecord[] | null) => records!.map((r) => `${r.key}@${r.seq}`).sort()
const EXPECTED_KEYS = ['contactBook@5', 'keyringState@2', 'keyringState@4', 'preference@1', 'txHistory@3']

describe('leveldb', () => {
  it('reads a log file, including records split across blocks', () => {
    const records = parseLevelDbFile(fixture('rabby-log/000003.log'))
    expect(keysOf(records)).toStrictEqual(EXPECTED_KEYS)
    records!.filter((r) => r.key !== 'txHistory').forEach((r) => expect(() => JSON.parse(r.value!)).not.toThrow())
  })

  it('reads a snappy-compressed table file', () => {
    const records = parseLevelDbFile(fixture('rabby-ldb/000005.ldb'))
    expect(keysOf(records)).toStrictEqual(EXPECTED_KEYS)
    records!.filter((r) => r.key !== 'txHistory').forEach((r) => expect(() => JSON.parse(r.value!)).not.toThrow())
  })

  it('reads deletions from a log file', () => {
    // one batch: seq 7, two records: put("a" -> "1"), delete("a")
    const batch = Buffer.from([7, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 1, 0x61, 1, 0x31, 0, 1, 0x61])
    const header = Buffer.from([0, 0, 0, 0, batch.length, 0, 1])
    expect(parseLogFile(Buffer.concat([header, batch]))).toStrictEqual([
      { key: 'a', value: '1', seq: 7, deleted: false },
      { key: 'a', value: null, seq: 8, deleted: true },
    ])
  })

  it('skips corrupted or truncated log data', () => {
    const badType = Buffer.from([0, 0, 0, 0, 14, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 9, 0])
    expect(parseLogFile(badType)).toStrictEqual([])
    const truncated = Buffer.from([0, 0, 0, 0, 0xff, 0, 1, 1, 2, 3])
    expect(parseLogFile(truncated)).toStrictEqual([])
    const orphanLast = Buffer.from([0, 0, 0, 0, 1, 0, 4, 0])
    expect(parseLogFile(orphanLast)).toStrictEqual([])
    expect(parseLevelDbFile(Buffer.from('foobarblob'))).toBe(null)
    expect(parseLevelDbFile(new Uint8Array(100))).toBe(null)
  })

  it('reads tables with deletions and skips odd entries', () => {
    const table = buildTable([['a', 3, 1, 'x'], ['b', 4, 0, ''], ['c', 5, 7, 'y']])
    expect(parseTableFile(table)).toStrictEqual([
      { key: 'a', value: 'x', seq: 3, deleted: false },
      { key: 'b', value: null, seq: 4, deleted: true },
    ])
    expect(parseTableFile(buildTable([['short', 0, 0, 'v']], 0, true))).toStrictEqual([])
    expect(parseTableFile(buildTable([['a', 3, 1, 'x']], 2))).toStrictEqual([])
    expect(parseTableFile(buildTable([]))).toStrictEqual([])
    const empty = buildTable([])
    expect(parseTableFile(new Uint8Array(empty).buffer)).toStrictEqual([])
  })

  it('reassembles first/middle/last log fragments and skips block padding', () => {
    const batch = putBatch(9, 'key', 'value')
    const split = Buffer.concat([
      logRecord(2, batch.subarray(0, 5)),
      logRecord(3, batch.subarray(5, 15)),
      logRecord(4, batch.subarray(15)),
    ])
    expect(parseLogFile(split)).toStrictEqual([{ key: 'key', value: 'value', seq: 9, deleted: false }])

    // first record ends 3 bytes before the block boundary: those are padding
    const big = logRecord(1, putBatch(1, 'a', 'v'.repeat(32740)))
    expect(big.length).toBe(32768 - 3)
    const log = Buffer.concat([big, Buffer.alloc(3), logRecord(1, putBatch(2, 'b', 'w'))])
    expect(parseLogFile(log).map((r) => `${r.key}@${r.seq}`)).toStrictEqual(['a@1', 'b@2'])
    expect(parseLogFile(new Uint8Array(log).buffer)).toHaveLength(2)

    expect(parseLogFile(logRecord(1, Buffer.alloc(5)))).toStrictEqual([])
  })

  it('rejects non-table files and broken tables', () => {
    expect(() => parseTableFile(Buffer.from('nope'))).toThrow('Not a LevelDB table file')
    const table = Buffer.from(fixture('rabby-ldb/000005.ldb'))
    const broken = Buffer.concat([Buffer.alloc(10), table.subarray(table.length - 48)])
    expect(parseLevelDbFile(broken)).toBe(null)
    expect(() => parseTableFile(new DataView(new ArrayBuffer(4)))).toThrow()
    expect(() => parseTableFile('string' as unknown as Uint8Array)).toThrow('Expected binary data')
  })

  describe('snappy', () => {
    it('decodes literals and copies', () => {
      // "abcabcabcabc": literal "abc" + copy(len 9, offset 3)
      const input = Buffer.from([12, 2 << 2, 0x61, 0x62, 0x63, ((9 - 4) << 2) | 1, 3])
      expect(Buffer.from(snappyUncompress(input)).toString()).toBe('abcabcabcabc')
    })

    it('decodes long literals and 2/4-byte offset copies', () => {
      const lit = Buffer.alloc(70, 0x78)
      const input = Buffer.concat([
        Buffer.from([70 + 4 + 4]),
        Buffer.from([60 << 2, 69]), lit, // literal with 1 extra length byte
        Buffer.from([(3 << 2) | 2, 70, 0]), // copy len 4, 2-byte offset
        Buffer.from([(3 << 2) | 3, 70, 0, 0, 0]), // copy len 4, 4-byte offset
      ])
      expect(Buffer.from(snappyUncompress(input)).toString()).toBe('x'.repeat(78))
    })

    it('rejects invalid input', () => {
      expect(() => snappyUncompress(Buffer.from([5, 0]))).toThrow('Invalid snappy literal')
      expect(() => snappyUncompress(Buffer.from([5, 1, 3]))).toThrow('Invalid snappy copy')
      expect(() => snappyUncompress(Buffer.from([5, 0, 0x61]))).toThrow('Snappy length mismatch')
      expect(() => snappyUncompress(Buffer.from([0x80]))).toThrow('Truncated varint')
      expect(() => snappyUncompress(Buffer.alloc(11, 0x80))).toThrow('Invalid varint')
    })
  })
})
