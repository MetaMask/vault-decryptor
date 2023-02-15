const fs = require('fs')
const path = require('path')
const {
  decryptVault,
  extractVaultFromFile,
  isVaultValid,
} = require('./lib.js')

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
  // note: this variety contains the SRP in cleartext so the passphrase is not actually used
  {
    path: 'chromium-90-0.4430.72_2.14.1/Local Storage/leveldb/000003.log',
    mnemonic: 'speed accuse odor ordinary exercise truly outer mask arrest life sibling height',
    //passphrase: 'bG82kXdp3rNwJ3MCT3kLmLKFN',
  },
]

describe('extractVaultFromFile', () => {
  for (const f of FIXTURES) {
    it(`decrypts ${f.path}`, async () => {
      const p = path.join(__dirname, '..', 'test', 'fixtures', f.path)
      const encrypted = fs.readFileSync(p).toString()
      const vaultData = extractVaultFromFile(encrypted)
      const decrypted = await decryptVault(f.passphrase, vaultData)
      expect(decrypted[0].data.mnemonic).toBe(f.mnemonic)
    })
    it(`returns null when vault not found`, async () => {
      const encrypted = 'foobarblob';
      const vaultData = extractVaultFromFile(encrypted)
      expect(vaultData).toBe(null)
    })
  }
})

describe('isVaultValid', () => {
  const validVault = {
    data: 'foo',
    iv: 'bar',
    salt: 'baz',
  };
  it(`returns true if fields are string`, async () => {
    expect(isVaultValid(validVault));
  })
  it(`returns false if keys are not string`, async () => {
    for (const k of ['data', 'iv', 'salt']) {
      for (const v of [null, undefined, 123]) {
        expect(isVaultValid({
          ...validVault,
          [k]: v
        })).toBe(false)
      }
    }
  })
})

