const inherits = require('util').inherits
const Component = require('react').Component
const h = require('react-hyperscript')
const connect = require('react-redux').connect
const {
  decryptVault,
  extractVaultFromFile,
  isVaultValid,
} = require('./lib.js')

module.exports = connect(mapStateToProps)(AppRoot)

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

        h('hr'),

        h('table', {}, [
          h('tbody', {}, [
            h('tr', {}, [
              h('td', {}, [
                h('input', {
                  id: 'radio-fileinput',
                  name: 'vault-source',
                  type: 'radio',
                  onChange: (event) => {
                    if (event.target.checked) {
                      this.setState({vaultSource: 'file', vaultData: null})
                    }
                  }
                }),
                h('label', {
                  htmlFor: 'radio-fileinput',
                }, 'Database backup'),
              ]),
              h('td', {}, [
                h('input.file', {
                  disabled: this.state.vaultSource !== 'file',
                  id: 'fileinput',
                  type: 'file',
                  placeholder: 'file',
                  onChange: async (event) => {
                    try {
                      if (!event.target.files.length) {
                        this.setState({ fileValidation: null })
                        return
                      }
                      const f = event.target.files[0]
                      const data = await f.text()
                      let vaultData = extractVaultFromFile(data)
                      if (!vaultData || !isVaultValid(vaultData)) {
                        this.setState({ fileValidation: 'fail' })
                        this.setState({ vaultData: null })
                        return
                      }
                      this.setState({ fileValidation: 'pass' })
                      if (vaultData.data && vaultData.data.mnemonic) {
                        this.setState({ decrypted: vaultData })
                        return
                      }
                      this.setState({ vaultData })
                    } catch (err) {
                      this.setState({ fileValidation: 'fail' })
                      this.setState({ vaultData: null })
                      if (err.name === 'SyntaxError') {
                        // Invalid JSON
                      } else {
                        console.error(err)
                      }
                    }
                  },
                }),
                this.state.fileValidation ? h('span', {
                    style: { color: this.state.fileValidation === 'pass' ? 'green' : 'red'
                  }
                }, this.state.fileValidation === 'pass' ? '\u2705' : '\u274c Can not read vault from file') : null,
              ]),
            ]),
            h('tr', {}, [
              h('td', {}, [
                h('input', {
                  id: 'radio-textinput',
                  name: 'vault-source',
                  type: 'radio',
                  onChange: (event) => {
                    if (event.target.checked) {
                      this.setState({vaultSource: 'text', vaultData: null, fileValidation: null})
                    }
                  }
                }),
                h('label', {
                  htmlFor: 'radio-textinput',
                }, 'Paste text'),
              ]),
              h('td', {}, [
                h('textarea.vault-data', {
                  disabled: this.state.vaultSource !== 'text',
                  id: 'textinput',
                  style: {
                    width: '50em',
                    height: '15em'
                  },
                  placeholder: 'Paste your vault data here.',
                  onChange: (event) => {
                    try {
                      const vaultData = JSON.parse(event.target.value)
                      if (!isVaultValid(vaultData)) {
                        // console.error('Invalid input data')
                        return
                      }
                      this.setState({ vaultData })
                    } catch (err) {
                      if (err.name === 'SyntaxError') {
                        // Invalid JSON
                      } else {
                        console.error(err)
                      }
                    }
                  },
                }),
              ]),
            ]),
            h('tr', {}, [
              h('td', {}, [
                h('label', {
                  htmlFor: 'passwordinput',
                }, 'Password'),
              ]),
              h('td', {}, [
                h('input.password', {
                  id: 'passwordinput',
                  type: 'password',
                  placeholder: 'Password',
                  onChange: (event) => {
                    const password = event.target.value
                    this.setState({ password })
                  },
                }),
              ]),
            ]),
          ]),
        ]),


        h('button.decrypt', {
          onClick: this.decrypt.bind(this),
          disabled: !this.state.vaultData || !this.state.password,
        }, 'Decrypt'),

        error ? h('.error', {
          style: { color: 'red' },
        }, error) : null,

        decrypted ? h('div', {}, h('div', {
                style: {
                  backgroundColor: 'black',
                  color: 'white',
                  display: 'inline-block',
                  fontFamily: 'monospace',
                  margin: '1em',
                  padding: '1em',
                }
              }, decrypted)) : null,
      ])
    ])
  )
}

AppRoot.prototype.decrypt = function(event) {
  const { password, vaultData: vault } = this.state

  if (!vault || !password) {
    return
  }

  this.setState({ error: null })
  return decryptVault(password, vault)
    .then((keyrings) => {
      const serializedKeyrings = JSON.stringify(keyrings);
      console.log('Decrypted!', serializedKeyrings)
      this.setState({ decrypted: serializedKeyrings })
    })
    .catch((reason) => {
      if (reason.message === 'Incorrect password') {
        this.setState({ error: reason.message })
        return
      }
      console.error(reason)
      this.setState({ error: 'Problem decoding vault.' })
    })
}

