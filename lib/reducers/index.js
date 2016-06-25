const extend = require('xtend')

module.exports = function(state, action) {

  if (action.type === 'INCREMENT_NONCE') {
    return extend(state, {
      nonce: state.nonce + 1,
    })
  }

  return extend(state)
}
