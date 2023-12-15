const passworder = require('@metamask/browser-passworder')

// Deduplicates array with rudimentary non-recursive shallow comparison of keys
function dedupe (arr) {
  const result = []
  arr?.forEach(x => {
    if (!result.find(y => Object.keys(x).length === Object.keys(y).length && Object.entries(x).every(([k,ex]) => y[k] === ex ))) {
      result.push(x)
    }
  })
  return result
}

function decodeMnemonic(mnemonic) {
  if (typeof mnemonic === 'string') {
    return mnemonic
  } else {
    return Buffer.from(mnemonic).toString('utf8')
  }
}

function extractVaultFromFile (data) {
  let vaultBody
  try {
    // attempt 1: raw json
    return JSON.parse(data)
  } catch (err) {
    // Not valid JSON: continue
  }
  {
    // attempt 2: pre-v3 cleartext
    // TODO: warn user that their wallet is unencrypted
    const matches = data.match(/{"wallet-seed":"([^"}]*)"/)
    if (matches && matches.length) {
      const mnemonic = matches[1].replace(/\\n*/, '')
      const vaultMatches = data.match(/"wallet":("{[ -~]*\\"version\\":2}")/)
      const vault = vaultMatches
        ? JSON.parse(JSON.parse(vaultMatches[1]))
        : {}
      return {
        data: Object.assign(
          {},
          {
            mnemonic,
          },
          vault,
        )
      }
    }
  }
  {
    // attempt 3: chromium 000003.log file on linux
    const matches = data.match(/"KeyringController":{"vault":"{[^{}]*}"/)
    if (matches && matches.length) {
      vaultBody=matches[0].substring(29)
      return JSON.parse(
        JSON.parse(
          vaultBody
        )
      )
    }
  }
  {
    // attempt 4: chromium 000006.log on MacOS
    // this variant also contains a 'keyMetadata' key in the vault, which should be
    // a nested object.
    const matches = data.match(/KeyringController":(\{"vault":".*?=\\"\}"\})/);
    if (matches && matches.length) {
      try {
        const keyringControllerStateFragment = matches[1];
        const dataRegex = /\\"data\\":\\"([A-Za-z0-9+\/]*=*)/u
        const ivRegex = /,\\"iv\\":\\"([A-Za-z0-9+\/]{10,40}=*)/u
        const saltRegex = /,\\"salt\\":\\"([A-Za-z0-9+\/]{10,100}=*)\\"/
        const keyMetaRegex = /,\\"keyMetadata\\":(.*}})/

        const vaultParts = [dataRegex, ivRegex, saltRegex, keyMetaRegex]
          .map(reg => keyringControllerStateFragment.match(reg))
          .map(match => match[1]);

        return {
          data: vaultParts[0],
          iv: vaultParts[1],
          salt: vaultParts[2],
          keyMetadata: JSON.parse(vaultParts[3].replaceAll('\\', '')),
        };
      } catch (err) {
        // Not valid JSON: continue
      }
    }
  }
  // attempt 5: chromium 000005.ldb on windows
  const matchRegex = /Keyring[0-9][^\}]*(\{[^\{\}]*\\"\})/gu
  const captureRegex  = /Keyring[0-9][^\}]*(\{[^\{\}]*\\"\})/u
  const ivRegex = /\\"iv.{1,4}[^A-Za-z0-9+\/]{1,10}([A-Za-z0-9+\/]{10,40}=*)/u
  const dataRegex = /\\"[^":,is]*\\":\\"([A-Za-z0-9+\/]*=*)/u
  const saltRegex = /,\\"salt.{1,4}[^A-Za-z0-9+\/]{1,10}([A-Za-z0-9+\/]{10,100}=*)/u
  const vaults = dedupe(data.match(matchRegex)?.map(m => m.match(captureRegex)[1])
    .map(s => [dataRegex, ivRegex, saltRegex].map(r => s.match(r)))
    .filter(([d,i,s]) => d&&d.length>1 && i&&i.length>1 && s&&s.length>1)
    .map(([d,i,s]) => ({
      data: d[1],
      iv: i[1],
      salt: s[1],
    })))
  if (!vaults.length) {
    return null
  }
  if (vaults.length > 1) {
    console.log('Found multiple vaults!', vaults)
  }
  return vaults[0]
}


function isVaultValid (vault) {
  return typeof vault === 'object'
    && ['data', 'iv', 'salt'].every(e => typeof vault[e] === 'string')
}

function decryptVault (password, vault) {
  if (vault.data && vault.data.mnemonic) {
    return [vault]
  }
  return passworder.decrypt(password, JSON.stringify(vault))
  .then((keyringsWithEncodedMnemonic) => {
    const keyringsWithDecodedMnemonic = keyringsWithEncodedMnemonic.map(keyring => {
      if ('mnemonic' in keyring.data) {
        return Object.assign(
          {},
          keyring,
          {
            data: Object.assign(
              {},
              keyring.data,
              { mnemonic: decodeMnemonic(keyring.data.mnemonic) }
            )
          }
        )
      } else {
        return keyring
      }
    })
    return keyringsWithDecodedMnemonic;
  })
}
module.exports = {
  decryptVault,
  extractVaultFromFile,
  isVaultValid,
}


