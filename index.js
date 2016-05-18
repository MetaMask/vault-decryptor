const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
var Raphael = require('raphael')

module.exports = SandwichExpandoComponent


inherits(SandwichExpandoComponent, Component)
function SandwichExpandoComponent() {
  Component.call(this)
}

SandwichExpandoComponent.prototype.render = function() {
  const isOpen = this.props.isOpen
  const onClick = this.props.onClick

  const topRot = `rotate(${isOpen ? 45 : 0}deg)`
  const botRot = `rotate(${isOpen ? -45 : 0}deg)`

  const padding = this.props.padding || 5
  const barHeight = this.props.barHeight || 5

  const width = this.props.width || 44
  const innerWidth = width - barHeight
  const innerHeight = Math.sqrt(Math.pow(innerWidth, 2) / 2)
  const height = innerHeight + barHeight

  const padBetween = (height - (barHeight * 3)) / 2

  const transformOrigin = `${barHeight/2}px ${barHeight/2}px`

  return (
    h('.sandwich-expando', {
      onClick,
      style: {
        padding: this.props.padding || 5,
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
    }, [

      h('div', {
        style: {
          height: `${barHeight}px`,
          width: '100%',
          borderRadius: '100px',
          background: this.props.color || 'grey',
          transition: 'transform 300ms ease-in-out',
          transformOrigin: `${barHeight/2}px ${barHeight/2}px`,
          transform: topRot,
        },
      }),

      h('div', {
        style: {
          height: `${barHeight}px`,
          opacity: isOpen ? '0.0' : '1.0',
          width: '100%',
          borderRadius: '100px',
          background: this.props.color || 'grey',
          transition: 'opacity 300ms ease-in-out',
        },
      }),

      h('div', {
        style: {
          height: `${barHeight}px`,
          width: '100%',
          borderRadius: '100px',
          background: this.props.color || 'grey',
          transition: 'transform 300ms ease-in-out',
          transformOrigin: `${barHeight/2}px ${barHeight/2}px`,
          transform: botRot,
        },
      }),

    ])
  )
}

