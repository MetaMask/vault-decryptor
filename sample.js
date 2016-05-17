const render = require('react-dom').render
const h = require('react-hyperscript')

const Sandwich = require('./')

var body = document.querySelector('body')
const container = document.createElement('div')
body.appendChild(container)

let isOpen = true
let color = 'blue'

function reRender() {
  render(
    h(Sandwich, {
      width: 44,
      barHeight: 8,
      isOpen,
      color,
      onClick(event) {
        isOpen = !isOpen
        console.log(isOpen)
        reRender()
      },
    }),
  container)
}

reRender()
