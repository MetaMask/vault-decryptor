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
  {
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

    if (vaults.length > 1) {
      console.log('Found multiple vaults!', vaults)
    }
    if (vaults.length > 0)
      return vaults[0]
  }
  {
    // attempt 6: chrome 158063.ldb on windows - Corrupted LDB file without Keyring but with vault data
    // Looking for the following pattern: :\"data_b64\",\"iv\":\"iv_b64\",\"keyMetadata\":{\"algorithm\":\"PBKDF2\",\"params\":{\"iterations\":10000}},\"salt\":\"salt_b64\"}"} 
    const regex = /":\\"([^"]+)\",\\"iv\\":\\"([^"]+)\",\\"keyMetadata\\":(\{[\s\S]*?\}),\\"salt\\":\\"([^"]+)\\"/;
    const match = data.match(regex);

    if (match) {
      // match[1] => data
      // match[2] => iv
      // match[3] => keyMetadata
      // match[4] => salt

      const dataBase64 = match[1];
      const iv = match[2];
      const keyMetadataRaw = match[3];
      const salt = match[4];

      const cleanedKeyMetadata = keyMetadataRaw.replace(/\\/g, '');
      let keyMetadata;
      try {
        keyMetadata = JSON.parse(cleanedKeyMetadata);
      } catch (err) {
        console.error('Error converting keyMetadata:', err);
        return null;
      }

      const vault = {
        data: dataBase64,
        iv,
        keyMetadata,
        salt,
      };

      return vault
    }
  }
  {
    // attempt 7: chrome 000024.ldb on windows - Corrupted LDB file with corrupted PBKDF2 and vault data
    // Looking for the following pattern: :\"BASE64DATA",\",\"iv\":\"BASE64iv\",CORRUPTED\":{\"CORRUPTED\",\"CORRUPTED...}},\"salt\":"BASE64salt"}
    const regex = /":\\"([^"]+)\",\\"iv\\":\\"([^"]+)\",.*?\\"salt.*?([^"]+)\\"}/;
    const match = data.match(regex);

    if (match) {
        // match[1] => data (may contain corrupted characters)
        // match[2] => iv (may contain corrupted characters)
        // match[3] => salt (may contain corrupted characters)

        const clean = (input) => {
            if (!input) return '';

            // Remove escape characters such as \"
            let cleaned = input.replace(/\\/g, '');

            // Find the last valid Base64 sequence in the string (in order to avoid parsing corrupted data)
            const validMatch = cleaned.match(/[A-Za-z0-9+/=]+$/);

            // If a valid sequence is found, return it, otherwise return an empty string
            return validMatch ? validMatch[0] : '';
        };

        const data = clean(match[1]);
        const iv = clean(match[2]);
        const salt = clean(match[3]);

        const vault = {
            data: data,
            iv,
            keyMetadata: { algorithm: 'PBKDF2', params: { iterations: 600000 } }, // Hardcoded as we cannot parse the corrupted keyMetadata, iterations are set to 600000 but could be any value.
            salt,
        };

        return vault;
    }
    return null;
  }
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
