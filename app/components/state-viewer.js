const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const Transactions = require('./transaction-list')

module.exports = StateViewer

inherits(StateViewer, Component)
function StateViewer () {
  Component.call(this)
}

StateViewer.prototype.render = function () {
  const props = this.props || {}
  const { parsedFile } = props
  const { version } = parsedFile

  return (
    h('.state-viewer', [

      h('section.overview', {
        style: {
          padding: '5px',
          background: '#DDD',
        },
      }, [
        h('p', `MetaMask Version ${version}`),
      ]),

      h(Transactions,  { transactions: parsedFile.metamask.selectedAddressTxList }),
    ])
  )
}
