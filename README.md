# Rabby Vault Decryptor

Recover the seed phrases and private keys stored by the [Rabby](https://rabby.io)
browser extension, from its local data files and your Rabby password.
MetaMask vaults are supported too.

Everything runs in the page: nothing is uploaded. The build is a single
self-contained `index.html`, so it can be saved and used fully offline.

## Using it

1. **Find Rabby's data folder.** Rabby stores an encrypted vault under the
   `keyringState` key of `chrome.storage.local`, which the browser keeps as a
   LevelDB database in its profile:

   | OS | Chrome |
   | --- | --- |
   | macOS | `~/Library/Application Support/Google/Chrome/Default/Local Extension Settings/acmacodkjbdgmoleebolmdjonilkdbch` |
   | Windows | `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Extension Settings\acmacodkjbdgmoleebolmdjonilkdbch` |
   | Linux | `~/.config/google-chrome/Default/Local Extension Settings/acmacodkjbdgmoleebolmdjonilkdbch` |

   The page shows the path for Brave, Edge and Arc too. With several browser
   profiles, open `chrome://version` and use the **Profile Path** shown there
   instead of `Default`.
2. **Quit the browser**, then drag the whole folder onto the page (or choose it
   with the folder picker). Dropping a parent folder, even the whole profile,
   works: only files inside Rabby's folder are read.
3. **Enter your Rabby password.** The page tries every copy of the vault it
   found, newest first, so an old password still unlocks the copies written
   before a password change.

You can also paste the vault JSON (`{"data":…,"iv":…,"keyMetadata":…,"salt":…}`)
or the whole `keyringState` object.

## How it works

- `src/lib/leveldb.ts` reads LevelDB `.log` and `.ldb` files directly,
  including records split across log blocks and Snappy-compressed tables.
- `src/lib/vault.ts` finds `keyringState.vault` records (with regex and
  MetaMask fallbacks), dedupes them and orders them newest first.
- `src/lib/crypto.ts` decrypts with WebCrypto, compatible with
  `@metamask/browser-passworder` (PBKDF2-SHA256 → AES-GCM-256; 900,000
  iterations for current Rabby vaults, 10,000 for vaults without
  `keyMetadata`).
- `src/ui/` is the React app.

## Development

Requires Node 20+.

```sh
yarn install
yarn dev       # local dev server
yarn test      # unit tests with coverage
yarn build     # dist/index.html, a single self-contained file
```

Deployed on Vercel with `vercel.json` (`yarn build` → `dist`).
