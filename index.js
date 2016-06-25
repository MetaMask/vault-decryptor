const render = require('react-dom').render
const h = require('react-hyperscript')
const configureStore = require('./lib/store')
const Root = require('./app/root.js')

var body = document.querySelector('body')
const container = document.createElement('div')
body.appendChild(container)

const store = configureStore({
  currentView: 'home',
  nonce: 1,
})

render(
  h(Root, {
    store,
  }),
container)

