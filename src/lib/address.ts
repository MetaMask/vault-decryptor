import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

export function isPrivateKeyHex (value: unknown): value is string {
  return typeof value === 'string' && /^(0x)?[0-9a-fA-F]{64}$/u.test(value)
}

/** EIP-55 mixed-case checksum encoding. */
export function toChecksumAddress (address: string): string {
  const lower = address.toLowerCase().replace(/^0x/u, '')
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)))
  let out = '0x'
  for (let i = 0; i < lower.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i]
  }
  return out
}

export function privateKeyToAddress (privateKey: string): string {
  const publicKey = secp256k1.getPublicKey(hexToBytes(privateKey.replace(/^0x/u, '')), false)
  const hash = keccak_256(publicKey.subarray(1))
  return toChecksumAddress(bytesToHex(hash.subarray(-20)))
}
