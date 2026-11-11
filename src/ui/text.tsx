/** All user-facing copy. */
export const t = {
  title: 'Rabby Vault Decryptor',
  tagline: 'Recover the seed phrases and private keys stored in the Rabby extension, using its local data files and your Rabby password.',
  github: 'Source code',
  safetyTitle: 'Runs entirely in your browser.',
  safetyBody: 'Nothing is uploaded. For extra safety, save this page (**⌘S** / **Ctrl+S**), disconnect from the internet and open the saved file. Anyone who sees the result can take your funds.',

  step1: 'Find your Rabby data',
  step2: 'Load the data',
  step3: 'Decrypt',

  tutIntro: 'Rabby keeps an encrypted copy of your wallet on the computer where it is installed. Pick your system and browser:',
  tutSystem: 'System',
  tutBrowser: 'Browser',
  tutQuitTitle: (browser: string) => `Quit ${browser}`,
  tutQuitBody: 'The browser keeps writing to these files while it runs. Quit it completely, or copy the folder somewhere else first and use the copy.',
  tutOpenTitle: 'Open Rabby’s data folder',
  tutOpenMac: 'In Finder, press **⇧⌘G**, paste the path and press **Return**.',
  tutOpenWindows: 'Press **Win+R**, paste the path and press **Enter**.',
  tutOpenLinux: 'In your file manager, press **Ctrl+L**, paste the path and press **Enter**.',
  tutDropTitle: 'Drag the whole folder into the box below',
  tutDropBody: 'It usually holds a few `.log` and `.ldb` files. The vault can be in any of them, so load them all. Dropping the parent folder works too.',
  copy: 'Copy',
  copied: 'Copied',

  faqProfileQ: 'I use several browser profiles',
  faqProfileA: (page: string) => `Open \`${page}\` in the browser profile where Rabby is installed and look at **Profile Path**. Use that folder instead of \`Default\`, followed by \`Local Extension Settings/acmacodkjbdgmoleebolmdjonilkdbch\`.`,
  faqMissingQ: 'The folder doesn’t exist',
  faqMissingA: (page: string) => `Rabby may have a different extension ID (for example, installed from another store or as a developer build). Open \`${page.replace('version', 'extensions')}\`, turn on **Developer mode** and copy Rabby’s **ID**, then use it in the path. If Rabby was removed from the browser, the browser deleted this folder: restore it from a backup (Time Machine, File History…) first.`,
  faqPasswordQ: 'Which password do I need?',
  faqPasswordA: 'The password you use to unlock Rabby on that computer. If you changed it, the older copies left in the files are still encrypted with the old password, and this tool tries every copy it finds.',
  faqSecretsQ: 'What can be recovered?',
  faqSecretsA: 'Seed phrases and private keys you created or imported in Rabby. Hardware wallets, watch-only addresses, Safe and WalletConnect accounts don’t store secrets in Rabby, so there is nothing to recover for them.',
  faqMetaMaskQ: 'Does it work for MetaMask?',
  faqMetaMaskA: 'Yes. Load the files from MetaMask’s extension folder (ID `nkbihfbeogaeaoehlefnkodbefgpgknn`) the same way.',

  dropTitle: 'Drop the Rabby folder or its files here',
  dropHint: 'Folders are read recursively. Files never leave this page.',
  dropActive: 'Release to load',
  chooseFolder: 'Choose folder',
  chooseFiles: 'Choose files',
  orPaste: 'Paste vault text instead',
  orFiles: 'Load files instead',
  pastePlaceholder: 'Paste the vault JSON ({"data":"…","iv":"…","salt":"…"}) or the whole keyringState object',
  reading: 'Reading files…',
  loadedFiles: (files: number, vaults: number) => `Read ${files} file${files === 1 ? '' : 's'} · found ${vaults} vault cop${vaults === 1 ? 'y' : 'ies'}`,
  loadedText: 'Found a vault in the pasted text',
  noVaultFiles: 'No Rabby vault found in these files. Make sure you load every file from the folder above.',
  noVaultText: 'No vault found in this text.',
  tooManyFiles: 'That is a lot of files and none of them are in Rabby’s folder. Please load just the folder from step 1.',
  readFailed: 'Could not read these files.',
  fileList: 'Show files',
  vaultsInFile: (n: number) => (n ? `${n} vault${n === 1 ? '' : 's'}` : '—'),
  clear: 'Clear',

  passwordLabel: 'Rabby password',
  passwordPlaceholder: 'The password you unlock Rabby with',
  show: 'Show',
  hide: 'Hide',
  decrypt: 'Decrypt',
  decrypting: 'Decrypting…',
  tryingCopy: (i: number, total: number) => `Trying copy ${i} of ${total}. This takes a moment for each copy.`,
  needData: 'Load Rabby’s data first.',
  incorrectPassword: 'Incorrect password for every copy found. Try other passwords you may have used.',
  decryptFailed: 'The vault could not be decrypted.',

  resultTitle: 'Recovered',
  olderCopy: 'This password unlocked an older copy of the vault (for example from before a password change). Accounts added after that copy may be missing — try your newer password too.',
  nothingFound: 'The vault decrypted, but it holds no seed phrases or private keys.',
  seedPhrase: (i: number, words: number) => `Seed phrase ${i} · ${words} words`,
  privateKeys: 'Imported private keys',
  reveal: 'Click to reveal',
  addresses: 'Addresses',
  passphraseWarning: 'This seed phrase was imported with a BIP39 passphrase. Rabby doesn’t store the passphrase, so you will need it as well to restore these addresses.',
  otherKeyrings: 'Also in this vault, with no secrets to recover:',
  rawData: 'Raw decrypted data',
  startOver: 'Clear everything',
  doneHint: 'Write these down offline, then close this page.',
}

/** Renders `**bold**` and `` `code` `` in translated strings, without HTML injection. */
export function Rich ({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
        return part
      })}
    </>
  )
}
