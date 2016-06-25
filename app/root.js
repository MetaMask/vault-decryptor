const inherits = require('util').inherits
const Component = require('react').Component
const h = require('react-hyperscript')
const connect = require('react-redux').connect

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
}

AppRoot.prototype.render = function () {
  const props = this.props

  return (
    h('.content', [
      h('div', {
        style: {
          background: 'grey',
        },
      }, [
        h('h1', `Welcome ${props.view}`),
        h('h2', `The count is ${props.nonce}`),

        h('button', {
          onClick: () => this.incrementNonce(),
        }, 'COUNT HIGHER!'),

      ])
    ])
  )
}

AppRoot.prototype.incrementNonce = function() {
  this.props.dispatch({
    type: 'INCREMENT_NONCE'
  })
}
