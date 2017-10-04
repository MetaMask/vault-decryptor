const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const GWEI_FACTOR = new BN('1000000000', 10)

module.exports = NewComponent

inherits(NewComponent, Component)
function NewComponent () {
  Component.call(this)
}

NewComponent.prototype.render = function () {
  const props = this.props
  const { transaction } = props
  const { id, time, status,
   metamaskNetworkId, txParams,
    gasLimitSpecified, estimatedGas,
    history, hash, retryCount, err } = transaction

  // Date stuff
  const date = new Date(time)
  const dateString = date.toGMTString()

  const { gasPrice } = txParams
  const gasPriceHex = ethUtil.stripHexPrefix(gasPrice)
  const gasPriceBN = new BN(gasPriceHex, 16)
  const gasPriceString = gasPriceBN.div(GWEI_FACTOR).toString(10)

  let statusColor = 'white'
  switch (status) {
    case 'failed':
      statusColor = 'red'
      break
    case  'submitted':
      statusColor = 'yellow'
      break
    case 'rejected':
      statusColor = 'orange'
      break
    case 'unapproved':
      statusColor = 'grey'
      break
    case 'confirmed':
      statusColor = 'green'
      break
  }

  return (
    h('.transaction', {
      style: {
        border: '1px solid black',
        backgroundColor: statusColor,
      },
    }, [
      h('p', `Time: ${dateString}`),
      h('p', `From: ${txParams.from}`),
      h('p', `To: ${txParams.to}`),
      h('p', `Nonce: ${parseInt(txParams.nonce)}`),
      h('p', `Gas Price: ${gasPriceString}`),
      h('p', `Status: ${status}`),
      status === 'failed' ?
        h('p', `Reason: ${JSON.stringify(err.message)}`) : null,
      h('p', `Hash: ${hash}`),
    ])
  )
}
