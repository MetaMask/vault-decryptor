const inherits = require('util').inherits
const Component = require('react').Component
const h = require('react-hyperscript')
const connect = require('react-redux').connect
const StateViewer = require('./components/state-viewer')

import Dropzone from 'react-dropzone'

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
  const state = this.state || {}
  const { parsedFile } = state

  return (
    h('.content', [
      h('div', {
        style: {
        },
      }, [
        h('h1', `State Log Explorer`),

        h('a', {
          href: 'https://support.metamask.io/kb/article/15-copying-state-logs',
        }, 'How to Copy MetaMask State Logs'),
        h('br'),

        h('a', {
          href: 'https://github.com/MetaMask/state-log-explorer',
        }, 'Fork on Github'),

        h(Dropzone, {
          onDrop: this.onDrop.bind(this),
        }, [
          h('p', 'Drop a state log file here.')
        ]),

        parsedFile ? h(StateViewer, { parsedFile }) : null,

      ])
    ])
  )
}

AppRoot.prototype.onDrop = function(acceptedFiles, rejectedFiles) {
  if (acceptedFiles && acceptedFiles.length > 0) {
    console.log('FILES DROPPED!')
    console.dir(acceptedFiles)
    const file = acceptedFiles[0]

    const reader = new FileReader();
    reader.onload = () => {
      const fileAsBinaryString = reader.result;
      console.log('RESULT!')
      const parsedFile = JSON.parse(fileAsBinaryString)
      console.dir(parsedFile)
      this.setState({ parsedFile })
    };
    reader.onabort = () => console.log('file reading was aborted');
    reader.onerror = () => console.log('file reading has failed');

    reader.readAsBinaryString(file);
  }
}

