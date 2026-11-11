import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { toChecksumAddress } from './address'
import { base64ToBytes, getIterations, LEGACY_ITERATIONS } from './crypto'
import {
  decryptVault,
  decryptVaults,
  type EncryptedVault,
  extractVaultFromFile,
  extractVaultsFromFiles,
  isCleartextVault,
  isVaultValid,
  type Keyring,
  normalizeVault,
  parseVaultText,
  summarizeKeyrings,
  type Vault,
} from './vault'

const fixture = (p: string) => fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'fixtures', p))
const file = (p: string) => ({ name: p, data: fixture(p) })
const vaultsIn = (...paths: string[]) => extractVaultsFromFiles(paths.map(file)).map((c) => c.vault)
const mnemonicOf = (keyrings: Keyring[]) => (keyrings[0].data as { mnemonic: string }).mnemonic

describe('MetaMask', () => {
  const FIXTURES = [
    {
      path: 'chrome-windows-1/000005.ldb',
      mnemonic: 'dolphin peanut amateur party differ tomorrow clean coconut when spatial hard trigger',
      passphrase: 't0b1m4ru',
    },
    {
      path: 'chromium-108.0_5359.98_4.10.24.2/000003.log',
      mnemonic: 'harvest afraid useful nose electric swift various man boil diagram confirm ahead',
      passphrase: 'JooXegoodowu8mohf2ietah5kohgah5',
    },
    {
      path: 'chromium-94.0.4606.81_4.17/000003.log',
      mnemonic: 'very follow angry proof column rail smile intact broom chicken lens earth',
      passphrase: 'aePaf7aequukoo6lahraitheemu6pein',
    },
    // this variety contains the SRP in cleartext so the passphrase is not used
    {
      path: 'chromium-90-0.4430.72_2.14.1/Local Storage/leveldb/000003.log',
      mnemonic: 'speed accuse odor ordinary exercise truly outer mask arrest life sibling height',
      passphrase: 'unused',
    },
    {
      path: 'chrome-119.0.6045.199-macos-arm64/000006.log',
      mnemonic: 'position ship hill notice replace truth science angle merit reunion direct steak',
      passphrase: 'r!chSloth14',
    },
    {
      path: 'chromium-120.0.6099.71-macos-arm64/000003.log',
      mnemonic: 'because carpet thought flame ride regular wink weather lazy spice unveil device',
      passphrase: 'correct horse battery staple',
    },
  ]

  const VAULTS = [
    {
      variant: 'vault with no key metadata',
      vaultData: '{"data":"s6TpYjlUNsn7ifhEFTkuDGBUM1GyOlPrim7JSjtfIxgTt8/6MiXgiR/CtFfR4dWW2xhq85/NGIBYEeWrZThGdKGarBzeIqBfLFhw9n509jprzJ0zc2Rf+9HVFGLw+xxC4xPxgCS0IIWeAJQ+XtGcHmn0UZXriXm8Ja4kdlow6SWinB7sr/WM3R0+frYs4WgllkwggDf2/Tv6VHygvLnhtzp6hIJFyTjh+l/KnyJTyZW1TkZhDaNDzX3SCOHT","iv":"FbeHDAW5afeWNORfNJBR0Q==","salt":"TxZ+WbCW6891C9LK/hbMAoUsSEW1E8pyGLVBU6x5KR8="}',
    },
    {
      variant: 'vault with key metadata and 600_000 iterations',
      vaultData: '{"data":"WHaP1FrrtV4zUonudIppDifsLHF39g6oPkVksAIdWAHBRzax1uy1asfAJprR7u72t4/HuYz5yPIFQrnNnv+hwQu9GRuty88VKMnvMy+sq8MNtoXI+C54bZpWa8r4iUQfa0Mj/cfJbpFpzOdF1ZYXahTfTcU5WsrHwvJew842CiJR4B2jmCHHXfm/DxLK3WazsVQwXJGx/U71UelGoOOrT8NI28EKrAwgPn+7Xmv0j92gmhau30N7Bo2fr6Zv","iv":"LfD8/tY1EjXzxuemSmDVdA==","keyMetadata":{"algorithm":"PBKDF2","params":{"iterations":600000}},"salt":"nk4xdpmMR+1s5BYe4Vnk++XAQwrISI2bCtbMg7V1wUA="}',
    },
  ]

  for (const f of FIXTURES) {
    it(`decrypts ${f.path}`, async () => {
      const vault = extractVaultFromFile(fixture(f.path).toString())
      expect(mnemonicOf(await decryptVault(f.passphrase, vault))).toBe(f.mnemonic)
      // and through the multi-file entry point
      const { keyrings } = await decryptVaults(f.passphrase, vaultsIn(f.path))
      expect(mnemonicOf(keyrings)).toBe(f.mnemonic)
    })
  }

  it('returns null when vault not found', () => {
    expect(extractVaultFromFile('foobarblob')).toBe(null)
  })

  for (const v of VAULTS) {
    it(`decrypts ${v.variant}`, async () => {
      const keyrings = await decryptVault('correct horse battery staple', JSON.parse(v.vaultData))
      expect(mnemonicOf(keyrings)).toBe('spread raise short crane omit tent fringe mandate neglect detail suspect cradle')
    })
  }

  it('identifies cleartext vaults', () => {
    const [cleartext] = vaultsIn('chromium-90-0.4430.72_2.14.1/Local Storage/leveldb/000003.log')
    expect(isCleartextVault(cleartext)).toBe(true)
  })

  describe('isVaultValid', () => {
    it('returns true if fields are string', () => {
      expect(isVaultValid({ data: 'a', iv: 'b', salt: 'c' })).toBe(true)
    })
    it('returns false otherwise', () => {
      expect(isVaultValid({ data: 1, iv: 'b', salt: 'c' })).toBe(false)
      expect(isVaultValid(null)).toBe(false)
      expect(isVaultValid('x')).toBe(false)
    })
  })
})

describe('Rabby', () => {
  const NEW_PASSWORD = 'Rabby-Test-Pass!'
  const OLD_PASSWORD = 'old-password-123'
  const NEW_MNEMONIC = 'test test test test test test test test test test test junk'
  const OLD_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  const RABBY_FIXTURES = ['rabby-log/000003.log', 'rabby-ldb/000005.ldb']

  for (const p of RABBY_FIXTURES) {
    it(`finds both keyringState vaults in ${p}, newest first`, () => {
      const candidates = extractVaultsFromFiles([file(p)])
      expect(candidates).toHaveLength(2)
      candidates.forEach((c) => {
        expect(c.source).toBe(p)
        expect(getIterations(c.vault as EncryptedVault)).toBe(900000)
      })
    })

    it(`decrypts the newest vault in ${p}`, async () => {
      const vaults = vaultsIn(p)
      const progress: number[] = []
      const { keyrings, vault, index } = await decryptVaults(NEW_PASSWORD, vaults, (i) => progress.push(i))
      expect(vault).toBe(vaults[0])
      expect(index).toBe(0)
      expect(progress).toStrictEqual([0])
      expect(summarizeKeyrings(keyrings)).toStrictEqual([
        { type: 'HD Key Tree', mnemonic: NEW_MNEMONIC, needPassphrase: false, accounts: [ADDRESS] },
        { type: 'Simple Key Pair', privateKeys: [{ privateKey: PRIVATE_KEY, address: ADDRESS }] },
      ])
    })

    it(`falls back to an older vault in ${p} for an old password`, async () => {
      const { keyrings, index } = await decryptVaults(OLD_PASSWORD, vaultsIn(p))
      expect(index).toBe(1)
      expect(mnemonicOf(keyrings)).toBe(OLD_MNEMONIC)
    })
  }

  it('rejects a wrong password', async () => {
    await expect(decryptVaults('wrong', vaultsIn('rabby-ldb/000005.ldb'))).rejects.toThrow('Incorrect password')
    await expect(decryptVault('wrong', vaultsIn('rabby-ldb/000005.ldb')[0])).rejects.toThrow('Incorrect password')
  })

  it('reuses the derived key for vaults sharing a salt', async () => {
    const [vault] = vaultsIn('rabby-ldb/000005.ldb') as EncryptedVault[]
    const corrupt = { ...vault, data: vault.data.replace(/^.{4}/u, 'AAAA') }
    const started = Date.now()
    await expect(decryptVaults('wrong', [corrupt, corrupt, corrupt, vault])).rejects.toThrow('Incorrect password')
    // 4 vaults but one PBKDF2 derivation (~0.3-1s); without the cache this takes 4x
    expect(Date.now() - started).toBeLessThan(4000)
  })

  it('merges vaults across files and dedupes repeats', () => {
    // the two fixtures were encrypted separately, so all 4 vaults differ
    const candidates = extractVaultsFromFiles(RABBY_FIXTURES.map(file))
    expect(candidates).toHaveLength(4)
    expect(candidates.map((c) => c.source)).toStrictEqual([...RABBY_FIXTURES, ...RABBY_FIXTURES])
    const same = file('rabby-ldb/000005.ldb')
    expect(extractVaultsFromFiles([same, same])).toHaveLength(2)
  })

  it('accepts ArrayBuffer input', () => {
    const buf = fixture('rabby-ldb/000005.ldb')
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    expect(extractVaultsFromFiles([{ name: 'x.ldb', data: ab }])).toHaveLength(2)
  })

  it('returns nothing for unrelated files', async () => {
    expect(extractVaultsFromFiles([{ name: 'x', data: Buffer.from('foobarblob') }])).toStrictEqual([])
    await expect(decryptVaults('x', [])).rejects.toThrow('No vault found')
  })

  it('rejects unexpected vault contents and key settings', async () => {
    const [vault] = vaultsIn('rabby-ldb/000005.ldb') as EncryptedVault[]
    await expect(decryptVaults(NEW_PASSWORD, [{ ...vault, keyMetadata: { algorithm: 'scrypt', params: { iterations: 1 } } } as unknown as Vault]))
      .rejects.toThrow('Unsupported key derivation settings')
    expect(getIterations({ data: '', iv: '', salt: '' })).toBe(LEGACY_ITERATIONS)
  })

  describe('parseVaultText', () => {
    const vault = { data: 'ZGF0YQ==', iv: 'aXZpdml2aXZpdml2aXY=', keyMetadata: { algorithm: 'PBKDF2', params: { iterations: 900000 } }, salt: 'c2FsdHNhbHRzYWx0c2FsdA==' }
    const keyringState = { booted: JSON.stringify({ data: 'Ym9vdA==', iv: 'aXZpdml2aXZpdml2aXY=', salt: 'c2FsdHNhbHRzYWx0c2FsdA==' }), vault: JSON.stringify(vault), hasEncryptedKeyringData: true }

    it('parses a vault JSON', () => {
      expect(parseVaultText(JSON.stringify(vault))).toStrictEqual(vault)
    })
    it('parses a double-encoded vault JSON', () => {
      expect(parseVaultText(JSON.stringify(JSON.stringify(vault)))).toStrictEqual(vault)
    })
    it('takes `vault` (not `booted`) from a keyringState JSON', () => {
      expect(parseVaultText(JSON.stringify(keyringState))).toStrictEqual(vault)
    })
    it('finds a serialized keyringState inside other text', () => {
      expect(parseVaultText(`garbage ${JSON.stringify(keyringState)} more`)).toStrictEqual(vault)
    })
    it('finds a vault in a plain text file', () => {
      const data = Buffer.from(`xx${JSON.stringify(keyringState)}xx`)
      expect(extractVaultsFromFiles([{ name: 'state.txt', data }])).toStrictEqual([{ vault, source: 'state.txt' }])
    })
    it('drops unknown fields from a vault without key metadata', () => {
      expect(parseVaultText(JSON.stringify({ data: 'a', iv: 'b', salt: 'c', extra: 1 }))).toStrictEqual({ data: 'a', iv: 'b', salt: 'c' })
    })
    it('returns null for anything else', () => {
      expect(parseVaultText('')).toBe(null)
      expect(parseVaultText(undefined)).toBe(null)
      expect(parseVaultText('42')).toBe(null)
      expect(parseVaultText('{"foo":1}')).toBe(null)
      expect(parseVaultText('{"vault":"not json"}')).toBe(null)
      expect(normalizeVault({ vault: { vault: { vault: { vault: vault } } } })).toBe(null)
    })
  })

  describe('summarizeKeyrings', () => {
    it('handles keyrings without secrets', () => {
      expect(summarizeKeyrings([
        { type: 'Watch Address', data: { accounts: [ADDRESS] } },
        { type: 'Simple Key Pair', data: [] },
        { type: 'HD Key Tree', data: { mnemonic: [116, 101, 115, 116], needPassphrase: true } },
        null,
      ])).toStrictEqual([
        { type: 'Watch Address' },
        { type: 'Simple Key Pair' },
        { type: 'HD Key Tree', mnemonic: 'test', needPassphrase: true, accounts: [] },
        { type: undefined },
      ])
      expect(summarizeKeyrings(undefined)).toStrictEqual([])
    })
    it('accepts 0x-prefixed private keys', () => {
      expect(summarizeKeyrings([{ type: 'Simple Key Pair', data: [PRIVATE_KEY] }])[0].privateKeys)
        .toStrictEqual([{ privateKey: PRIVATE_KEY, address: ADDRESS }])
    })
  })
})

describe('helpers', () => {
  it('computes EIP-55 checksums', () => {
    expect(toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
  })
  it('decodes base64', () => {
    expect(Array.from(base64ToBytes('AQID'))).toStrictEqual([1, 2, 3])
  })
})
