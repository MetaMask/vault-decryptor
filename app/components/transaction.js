const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits

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
    history, hash, retryCount } = transaction

  const date = new Date(time)
  const dateString = date.toGMTString()

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
      h('p', `Status: ${status}`),
      h('p', `Hash: ${hash}`),
    ])
  )
}
