const inherits = require('util').inherits
const Component = require('react').Component
const h = require('react-hyperscript')
const connect = require('react-redux').connect
const passworder = require('@metamask/browser-passworder')

module.exports = connect(mapStateToProps)(AppRoot)

function decodeMnemonic(mnemonic) {
  if (typeof mnemonic === 'string') {
    return mnemonic
  } else {
    return Buffer.from(mnemonic).toString('utf8')
  }
}

function mapStateToProps (state) {
  return {
    view: state.currentView,
    nonce: state.nonce,
  }
}

inherits(AppRoot, Component)
function AppRoot () {
  Component.call(this)
  this.state = {
    vaultData: '',
    password: '',
    error: null,
    decrypted: null,
  }
}

AppRoot.prototype.render = function () {
  const props = this.props
  const state = this.state || {}
  const { error, decrypted } = state

  return (
    h('.content', [
      h('div', {
        style: {
        },
      }, [
        h('h1', `MetaMask Vault Decryptor`),

        h('a', {
          href: 'https://metamask.zendesk.com/hc/en-us/articles/360018766351-How-to-use-the-Vault-Decryptor-with-the-MetaMask-Vault-Data',
          target: '_blank'
        }, 'How to use the Vault Decryptor with the MetaMask Vault Data'),
        h('br'),

        h('a', {
          href: 'https://github.com/MetaMask/vault-decryptor',
        }, 'Fork on Github'),
        h('br'),

        h('textarea.vault-data', {
          style: {
            width: '600px',
            height: '300px'
          },
          placeholder: 'Paste your vault data here.',
          onChange: (event) => {
            const vaultData = event.target.value
            this.setState({ vaultData })
          },
        }),
        h('br'),

        h('input.password', {
          type: 'password',
          placeholder: 'Password',
          onChange: (event) => {
            const password = event.target.value
            this.setState({ password })
          },
        }),
        h('br'),

        h('button.decrypt', {
          onClick: this.decrypt.bind(this),
        }, 'Decrypt'),

        error ? h('.error', {
          style: { color: 'red' },
        }, error) : null,

        decrypted ? h('div', decrypted) : null,

      ])
    ])
  )
}

AppRoot.prototype.decrypt = function(event) {
  const { password, vaultData: vault } = this.state

  passworder.decrypt(password, vault)
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
      });
      const serializedKeyrings = JSON.stringify(keyringsWithDecodedMnemonic)
      console.log('Decrypted!', serializedKeyrings)
      this.setState({ decrypted: serializedKeyrings })
    })
    .catch((reason) => {
      console.error(reason)
      this.setState({ error: 'Problem decoding vault.' })
    })
}

