import { isPrivateKeyHex, privateKeyToAddress } from './address'
import {
  createDecryptor,
  type EncryptedVault,
  type KeyMetadata,
} from './crypto'
import { type BinaryInput, parseLevelDbFile, toUint8Array } from './leveldb'

export { IncorrectPasswordError } from './crypto'
export type { EncryptedVault } from './crypto'

/** Rabby's extension ID on the Chrome Web Store. */
export const RABBY_EXTENSION_ID = 'acmacodkjbdgmoleebolmdjonilkdbch'

// chrome.storage.local key under which Rabby persists its keyring service state:
// { booted, vault, unencryptedKeyringData, hasEncryptedKeyringData, ... }
const RABBY_STORAGE_KEY = 'keyringState'

// Matches `"vault":"{\"data\":...,\"salt\":\"...\"}"` inside a JSON-serialized
// keyringState. `booted` has the same shape but only encrypts "true", so we
// anchor on the `vault` key.
const RABBY_VAULT_REGEX = /"vault":"(\{\\"data\\":\\"[A-Za-z0-9+/=]+\\",\\"iv\\":\\"[A-Za-z0-9+/=]+\\"(?:,\\"keyMetadata\\":\{[^{}]*\{[^{}]*\}\})?,\\"salt\\":\\"[A-Za-z0-9+/=]+\\"\})"/g

/** Pre-v3 MetaMask vaults kept the seed phrase in clear text. */
export type CleartextVault = {
  data: { mnemonic: string, [key: string]: unknown }
}

export type Vault = EncryptedVault | CleartextVault

export type Keyring = {
  type?: string
  data?: unknown
}

export type VaultCandidate = {
  vault: Vault
  /** Name of the file the vault was found in. */
  source: string
}

export type InputFile = {
  name: string
  data: BinaryInput
}

export type KeyringSummary = {
  type?: string
  mnemonic?: string
  /** The seed phrase was imported with a BIP39 passphrase, which is not stored. */
  needPassphrase?: boolean
  accounts?: string[]
  privateKeys?: Array<{ privateKey: string, address: string }>
}

type Rec = Record<string, any>

const isObject = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null

export function isVaultValid (vault: unknown): vault is EncryptedVault {
  return isObject(vault) &&
    ['data', 'iv', 'salt'].every((e) => typeof vault[e] === 'string')
}

export function isCleartextVault (vault: unknown): vault is CleartextVault {
  return isObject(vault) && isObject(vault.data) && Boolean(vault.data.mnemonic)
}

function decodeMnemonic (mnemonic: unknown): string {
  if (typeof mnemonic === 'string') {
    return mnemonic
  }
  // newer MetaMask versions store the mnemonic as an array of UTF-8 bytes
  return new TextDecoder().decode(Uint8Array.from(Object.values(mnemonic as Rec)))
}

/**
 * Accepts an encrypted vault in any of the shapes it shows up in:
 * - the vault object itself ({ data, iv, salt, keyMetadata? })
 * - the vault as a JSON string (possibly JSON-encoded twice)
 * - Rabby's whole keyringState object/string ({ vault, booted, ... })
 */
export function normalizeVault (input: unknown, depth = 0): EncryptedVault | null {
  if (depth > 3 || input === null || input === undefined) {
    return null
  }
  if (typeof input === 'string') {
    try {
      return normalizeVault(JSON.parse(input), depth + 1)
    } catch (err) {
      return null
    }
  }
  if (!isObject(input)) {
    return null
  }
  if (isVaultValid(input)) {
    const vault: EncryptedVault = { data: input.data, iv: input.iv, salt: input.salt }
    if (input.keyMetadata) {
      vault.keyMetadata = input.keyMetadata as KeyMetadata
    }
    return vault
  }
  if ('vault' in input) {
    return normalizeVault(input.vault, depth + 1)
  }
  return null
}

// Regex fallback for data we couldn't parse as LevelDB records.
// Later matches are newer in a log file, so they are returned first.
function scanTextForRabbyVaults (text: string): EncryptedVault[] {
  const vaults: EncryptedVault[] = []
  for (const match of text.matchAll(RABBY_VAULT_REGEX)) {
    try {
      const vault = normalizeVault(JSON.parse(`"${match[1]}"`))
      if (vault) {
        vaults.push(vault)
      }
    } catch (err) {
      // broken match: ignore
    }
  }
  return vaults.reverse()
}

// Deduplicates array with rudimentary non-recursive shallow comparison of keys
function dedupe<T extends Rec> (arr: T[] | undefined): T[] {
  const result: T[] = []
  arr?.forEach((x) => {
    if (!result.find((y) => Object.keys(x).length === Object.keys(y).length &&
      Object.entries(x).every(([k, ex]) => y[k] === ex))) {
      result.push(x)
    }
  })
  return result
}

/**
 * Finds a MetaMask vault in the text of a browser storage file. Kept from the
 * original MetaMask vault decryptor to support its historical layouts.
 */
export function extractVaultFromFile (data: string): any {
  try {
    // attempt 1: raw json
    return JSON.parse(data)
  } catch (err) {
    // Not valid JSON: continue
  }
  {
    // attempt 2: pre-v3 cleartext
    const matches = data.match(/{"wallet-seed":"([^"}]*)"/)
    if (matches && matches.length) {
      const mnemonic = matches[1].replace(/\\n*/, '')
      const vaultMatches = data.match(/"wallet":("{[ -~]*\\"version\\":2}")/)
      const vault = vaultMatches
        ? JSON.parse(JSON.parse(vaultMatches[1]))
        : {}
      return { data: Object.assign({}, { mnemonic }, vault) }
    }
  }
  {
    // attempt 3: chromium 000003.log file on linux
    const matches = data.match(/"KeyringController":{"vault":"{[^{}]*}"/)
    if (matches && matches.length) {
      return JSON.parse(JSON.parse(matches[0].substring(29)))
    }
  }
  {
    // attempt 4: chromium 000006.log on MacOS
    // this variant also contains a 'keyMetadata' key in the vault, which should be
    // a nested object.
    const matches = data.match(/KeyringController":(\{"vault":".*?=\\"\}"\})/)
    if (matches && matches.length) {
      try {
        const fragment = matches[1]
        const dataRegex = /\\"data\\":\\"([A-Za-z0-9+/]*=*)/u
        const ivRegex = /,\\"iv\\":\\"([A-Za-z0-9+/]{10,40}=*)/u
        const saltRegex = /,\\"salt\\":\\"([A-Za-z0-9+/]{10,100}=*)\\"/
        const keyMetaRegex = /,\\"keyMetadata\\":(.*}})/

        const parts = [dataRegex, ivRegex, saltRegex, keyMetaRegex]
          .map((reg) => fragment.match(reg))
          .map((match) => match![1])

        return {
          data: parts[0],
          iv: parts[1],
          salt: parts[2],
          keyMetadata: JSON.parse(parts[3].replaceAll('\\', '')),
        }
      } catch (err) {
        // Not valid JSON: continue
      }
    }
  }
  // attempt 5: chromium 000005.ldb on windows
  const matchRegex = /Keyring[0-9][^}]*(\{[^{}]*\\"\})/gu
  const captureRegex = /Keyring[0-9][^}]*(\{[^{}]*\\"\})/u
  const ivRegex = /\\"iv.{1,4}[^A-Za-z0-9+/]{1,10}([A-Za-z0-9+/]{10,40}=*)/u
  const dataRegex = /\\"[^":,is]*\\":\\"([A-Za-z0-9+/]*=*)/u
  const saltRegex = /,\\"salt.{1,4}[^A-Za-z0-9+/]{1,10}([A-Za-z0-9+/]{10,100}=*)/u
  const vaults = dedupe(data.match(matchRegex)?.map((m) => m.match(captureRegex)![1])
    .map((s) => [dataRegex, ivRegex, saltRegex].map((r) => s.match(r)))
    .filter(([d, i, s]) => d && d.length > 1 && i && i.length > 1 && s && s.length > 1)
    .map(([d, i, s]) => ({
      data: d![1],
      iv: i![1],
      salt: s![1],
    })))
  return vaults.length ? vaults[0] : null
}

type FoundVault = { vault: Vault, seq: number }

function findVaultsInFile (bytes: Uint8Array): FoundVault[] {
  const found: FoundVault[] = []
  const records = parseLevelDbFile(bytes)
  if (records) {
    records
      .filter((r) => r.key === RABBY_STORAGE_KEY && !r.deleted)
      .forEach((r) => {
        const vault = normalizeVault(r.value)
        if (vault) {
          found.push({ vault, seq: r.seq })
        }
      })
  }
  if (found.length) {
    return found
  }

  const text = new TextDecoder('utf-8').decode(bytes)
  scanTextForRabbyVaults(text).forEach((vault) => found.push({ vault, seq: -1 }))
  if (found.length) {
    return found
  }

  // MetaMask layouts (and pre-v3 cleartext vaults)
  const legacy = extractVaultFromFile(text)
  if (isVaultValid(legacy) || isCleartextVault(legacy)) {
    found.push({ vault: legacy, seq: -2 })
  }
  return found
}

/**
 * Finds every vault in a set of files, e.g. all files from
 * `Local Extension Settings/acmacodkjbdgmoleebolmdjonilkdbch/`.
 *
 * @returns Unique vaults, newest first.
 */
export function extractVaultsFromFiles (files: InputFile[]): VaultCandidate[] {
  const candidates: Array<FoundVault & { source: string, fileIndex: number, i: number }> = []
  files.forEach((file, fileIndex) => {
    findVaultsInFile(toUint8Array(file.data))
      .forEach((c, i) => candidates.push({ ...c, source: file.name, fileIndex, i }))
  })
  // newest first: higher LevelDB sequence number wins; regex/legacy hits
  // (no sequence number) go last, keeping their in-file order
  candidates.sort((a, b) => (b.seq - a.seq) || (a.fileIndex - b.fileIndex) || (a.i - b.i))
  const seen = new Set<string>()
  return candidates
    .filter(({ vault }) => {
      const id = JSON.stringify(vault)
      if (seen.has(id)) {
        return false
      }
      seen.add(id)
      return true
    })
    .map(({ vault, source }) => ({ vault, source }))
}

/**
 * Parses pasted text: a vault JSON, Rabby's keyringState JSON, or any text
 * containing a serialized keyringState.
 */
export function parseVaultText (text: string | undefined): EncryptedVault | null {
  const trimmed = (text || '').trim()
  return normalizeVault(trimmed) || scanTextForRabbyVaults(trimmed)[0] || null
}

function decodeKeyrings (keyrings: unknown): Keyring[] {
  if (!Array.isArray(keyrings)) {
    throw new Error('Unexpected vault contents')
  }
  return keyrings.map((keyring: Keyring) => {
    if (isObject(keyring?.data) && 'mnemonic' in keyring.data) {
      return { ...keyring, data: { ...keyring.data, mnemonic: decodeMnemonic(keyring.data.mnemonic) } }
    }
    return keyring
  })
}

export async function decryptVault (password: string, vault: Vault): Promise<Keyring[]> {
  if (isCleartextVault(vault)) {
    return [vault]
  }
  return decodeKeyrings(await createDecryptor(password)(vault))
}

/**
 * Tries the password against each vault (newest first) and returns the first
 * one that decrypts.
 */
export async function decryptVaults (
  password: string,
  vaults: Vault[],
  onProgress?: (index: number, total: number) => void,
): Promise<{ keyrings: Keyring[], vault: Vault, index: number }> {
  const decrypt = createDecryptor(password)
  let lastError: unknown = new Error('No vault found')
  for (let index = 0; index < vaults.length; index++) {
    onProgress?.(index, vaults.length)
    const vault = vaults[index]
    try {
      const keyrings = isCleartextVault(vault) ? [vault] : decodeKeyrings(await decrypt(vault))
      return { keyrings, vault, index }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

/** Turns decrypted keyrings into a list of secrets to display. */
export function summarizeKeyrings (keyrings: Array<Keyring | null> | undefined): KeyringSummary[] {
  return (keyrings || []).map((keyring) => {
    const { type, data } = keyring || {}
    const summary: KeyringSummary = { type }
    if (isObject(data) && !Array.isArray(data) && data.mnemonic) {
      summary.mnemonic = decodeMnemonic(data.mnemonic)
      summary.needPassphrase = Boolean(data.needPassphrase)
      summary.accounts = Array.isArray(data.accounts) ? data.accounts : []
    } else if (Array.isArray(data) && data.length && data.every(isPrivateKeyHex)) {
      summary.privateKeys = data.map((pk: string) => ({
        privateKey: pk.startsWith('0x') ? pk : `0x${pk}`,
        address: privateKeyToAddress(pk),
      }))
    }
    return summary
  })
}
