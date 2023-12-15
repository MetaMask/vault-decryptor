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
  {
    path: 'chrome-119.0.6045.199-macos-arm64/000006.log',
    mnemonic: 'position ship hill notice replace truth science angle merit reunion direct steak',
    passphrase: 'r!chSloth14',
  },
  {
    path: 'chromium-120.0.6099.71-macos-arm64/000003.log',
    mnemonic: 'because carpet thought flame ride regular wink weather lazy spice unveil device',
    passphrase: 'correct horse battery staple',
  }
]

const VAULTS = [
  {
    variant: 'vault with no key metadata',
    vaultData: '{"data":"s6TpYjlUNsn7ifhEFTkuDGBUM1GyOlPrim7JSjtfIxgTt8/6MiXgiR/CtFfR4dWW2xhq85/NGIBYEeWrZThGdKGarBzeIqBfLFhw9n509jprzJ0zc2Rf+9HVFGLw+xxC4xPxgCS0IIWeAJQ+XtGcHmn0UZXriXm8Ja4kdlow6SWinB7sr/WM3R0+frYs4WgllkwggDf2/Tv6VHygvLnhtzp6hIJFyTjh+l/KnyJTyZW1TkZhDaNDzX3SCOHT","iv":"FbeHDAW5afeWNORfNJBR0Q==","salt":"TxZ+WbCW6891C9LK/hbMAoUsSEW1E8pyGLVBU6x5KR8="}',
    mnemonic: 'spread raise short crane omit tent fringe mandate neglect detail suspect cradle',
    passphrase: 'correct horse battery staple', 
  },
  {
    variant: 'vault with key metadata and 600_000 iterations',
    vaultData: '{"data":"WHaP1FrrtV4zUonudIppDifsLHF39g6oPkVksAIdWAHBRzax1uy1asfAJprR7u72t4/HuYz5yPIFQrnNnv+hwQu9GRuty88VKMnvMy+sq8MNtoXI+C54bZpWa8r4iUQfa0Mj/cfJbpFpzOdF1ZYXahTfTcU5WsrHwvJew842CiJR4B2jmCHHXfm/DxLK3WazsVQwXJGx/U71UelGoOOrT8NI28EKrAwgPn+7Xmv0j92gmhau30N7Bo2fr6Zv","iv":"LfD8/tY1EjXzxuemSmDVdA==","keyMetadata":{"algorithm":"PBKDF2","params":{"iterations":600000}},"salt":"nk4xdpmMR+1s5BYe4Vnk++XAQwrISI2bCtbMg7V1wUA="}',
    mnemonic: 'spread raise short crane omit tent fringe mandate neglect detail suspect cradle',
    passphrase: 'correct horse battery staple', 
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

describe('decryptVault', () => {
  VAULTS.forEach((vault) => {
    it(`decrypts ${vault.variant}`, async () => {
      const decrypted = await decryptVault(
        vault.passphrase, 
        JSON.parse(vault.vaultData)
      );

      expect(decrypted[0].data.mnemonic).toBe(vault.mnemonic)
    })
  })
});

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

