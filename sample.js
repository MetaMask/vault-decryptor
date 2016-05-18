const render = require('react-dom').render
const h = require('react-hyperscript')

const Sandwich = require('./')

var body = document.querySelector('body')
const container = document.createElement('div')
body.appendChild(container)

let isOpen = false

function reRender() {
  render(
    h(Sandwich, {
      width: 33, // Set width.
      barHeight: 3, // Set height of individual bars.
                    // Should not exceed 1/3 of height.
      isOpen,       // Renders an "X" if true, a sandwich if false.
      color: 'rgb(247,146,30)', // Any CSS color value is acceptable.
      onClick(event) {  // Handle click events yourself,
        isOpen = !isOpen// For example by toggling the `isOpen` property.
        reRender()
      },
    }),
  container)
}

reRender()
