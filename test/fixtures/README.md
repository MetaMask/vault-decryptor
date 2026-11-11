# Fixtures

The MetaMask fixtures are real browser profile files.

`rabby-log/000003.log` and `rabby-ldb/000005.ldb` are synthetic Rabby
`chrome.storage.local` databases, written with a real LevelDB implementation
(`classic-level`) and encrypted with `@metamask/browser-passworder@6.0.0` (the
version Rabby uses, PBKDF2 900k iterations). Each one holds two `keyringState`
writes:

| write | password | keyrings |
| --- | --- | --- |
| older | `old-password-123` | HD: `abandon ×11 about` |
| newer | `Rabby-Test-Pass!` | HD: `test ×11 junk`, private key `0xac09…ff80` |

In the `.log` file the newer record straddles a 32KB log block boundary; in the
`.ldb` file the blocks are Snappy-compressed. Neither can be read by plain regex
scanning.
