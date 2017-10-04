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

  return (
    h('.state-viewer', [
      h(Transactions,  { transactions: parsedFile.metamask.selectedAddressTxList }),
    ])
  )
}
