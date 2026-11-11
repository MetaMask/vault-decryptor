// Decryption compatible with @metamask/browser-passworder, which both Rabby
// and MetaMask use to encrypt their vaults:
//   key  = PBKDF2-SHA256(password, salt, iterations) -> AES-GCM-256
//   data = AES-GCM(key, iv, JSON.stringify(keyrings))
// Vaults without `keyMetadata` predate configurable iterations and use 10,000.

export type KeyMetadata = {
  algorithm: 'PBKDF2'
  params: { iterations: number }
}

export type EncryptedVault = {
  data: string
  iv: string
  salt: string
  keyMetadata?: KeyMetadata
}

export const LEGACY_ITERATIONS = 10_000

export class IncorrectPasswordError extends Error {
  constructor () {
    super('Incorrect password')
    this.name = 'IncorrectPasswordError'
  }
}

export function base64ToBytes (value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function getIterations (vault: EncryptedVault): number {
  if (!vault.keyMetadata) {
    return LEGACY_ITERATIONS
  }
  const { algorithm, params } = vault.keyMetadata
  const iterations = params?.iterations
  if (algorithm !== 'PBKDF2' || !Number.isSafeInteger(iterations) || iterations <= 0) {
    throw new Error('Unsupported key derivation settings')
  }
  return iterations
}

export async function deriveKey (password: string, salt: string, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
}

export async function decryptWithKey (key: CryptoKey, vault: EncryptedVault): Promise<unknown> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(vault.iv) },
      key,
      base64ToBytes(vault.data),
    )
    return JSON.parse(new TextDecoder().decode(plain))
  } catch (err) {
    throw new IncorrectPasswordError()
  }
}

/**
 * Decrypts with a per-call key cache: Rabby re-encrypts with the same salt
 * while unlocked, so many vault copies share one (slow) PBKDF2 derivation.
 */
export function createDecryptor (password: string) {
  const keys = new Map<string, Promise<CryptoKey>>()
  return async (vault: EncryptedVault): Promise<unknown> => {
    const iterations = getIterations(vault)
    const cacheKey = `${iterations}:${vault.salt}`
    let key = keys.get(cacheKey)
    if (!key) {
      key = deriveKey(password, vault.salt, iterations)
      keys.set(cacheKey, key)
    }
    return decryptWithKey(await key, vault)
  }
}
