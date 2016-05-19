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

  const padding = ('padding' in this.props) ? this.props.padding : 5
  const barHeight = ('barHeight' in this.props) ? this.props.barHeight : 5

  const width = ('width' in this.props) ? this.props.width : 44
  const innerWidth = width - barHeight
  const innerHeight = Math.sqrt(Math.pow(innerWidth, 2) / 2)
  const height = innerHeight + barHeight

  const padBetween = (height - (barHeight * 3)) / 2

  const transformOrigin = `${barHeight/2}px ${barHeight/2}px`

  let style = ('style' in this.props) ? this.props.style : {}
  style.padding = `${padding}px`
  style.width = `${width}px`
  style.height = `${height}px`
  style.display = 'flex'
  style.flexDirection = 'column'
  style.justifyContent = 'space-between'
  style.cursor = 'pointer'

  return (
    h('.sandwich-expando', {
      onClick,
      style,
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

