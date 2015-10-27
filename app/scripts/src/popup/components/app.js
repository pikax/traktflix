'use strict';

var React = require('react');
var LoginButton = require('./login-button.js');
var Header = require('./header.js');
var Watching = require('./watching.js');
var Info = require('./info.js');
var Button = require('./button.js');
var History = require('./history.js');
var Oauth = require('../../oauth.js');
var ChromeStorage = require('../../chrome-storage.js');

module.exports = React.createClass({
  getInitialState: function() {
    this.addErrorListener();
    return { logged: false, currentPage: 'watch', loading: false };
  },
  checkUserLogin: function() {
    Oauth.getUserInfo(this.userIsLogged, this.userIsNotLogged);
  },
  userIsLogged: function(response) {
    ChromeStorage.get(null, function(data) {
      this.setState({
        logged: !!data.access_token,
        autoSync: data.auto_sync
      });
      this.getCurrentItem();
    }.bind(this));
  },
  userIsNotLogged: function(status, response) {
    this.onTokenFailed(status, response);
  },
  getTabId: function(callback) {
    chrome.tabs.query({ url: '*://*.netflix.com/*' }, function(tabs) {
      if (tabs.length > 0) {
        callback.call(this, tabs[0].id);
      } else {
        callback.call(this, null);
      }
    });
  },
  sendToContentScript: function(type, callback) {
    this.getTabId(function(id) {
      if (id) {
        chrome.tabs.sendMessage(id, { type: type }, callback);
      }
    });
  },
  getCurrentItem: function() {
    this.sendToContentScript('getCurrentItem', this.onItemReceived);
  },
  onItemReceived: function(response) {
    if (response) {
      this.setState({ item: response.item });
    }
  },
  componentDidMount: function() {
    this.checkUserLogin();
  },
  aboutClicked: function(e) {
    this.setState({ currentPage: 'about' });
  },
  logoutClicked: function(e) {
    chrome.runtime.sendMessage({ type: 'sendEvent', name: 'Logout', value: false });
    ChromeStorage.clear(function() {
      this.setState({ logged: false, currentPage: 'watch' });
    }.bind(this));
  },
  historyClicked: function(e) {
    this.setState({ currentPage: 'history' });
  },
  onLoginClicked: function(e) {
    this.setState({ loading: true });
  },
  onItemClicked: function(e) {
    if (e.target.classList.contains('item-About')) {
      this.aboutClicked(e);
    } else if (e.target.classList.contains('item-History')) {
      this.historyClicked(e);
    } else {
      this.logoutClicked(e);
    }
  },
  onTokenSuccess: function(response) {
    var options = JSON.parse(response);
    this.setState({ loading: false, logged: !!options.access_token });
    chrome.runtime.sendMessage({ type: 'sendEvent', name: 'TokenSuccess', value:  true });
    this.setInactiveIcon();
  },
  onTokenFailed: function(status, response) {
    this.setState({ loading: false });
    chrome.runtime.sendMessage({ type: 'sendEvent', name: 'TokenFailed', value: false });
    if (status === 0 || status > 401) {
      this.onError(response);
    }
    console.error('traktflix: Get Token failed', status, response);
  },
  onAutoSyncChanged: function(e) {
    this.setState({ autoSync: e.target.checked });
  },
  onSyncNowClicked: function(e) {
    this.setState({ loading: true });
    this.startSync();
  },
  startSync: function() {
    this.sendToContentScript('startSync', this.onSyncCompleted);
  },
  onSyncCompleted: function(success) {
    console.log('sync finished- --------------------------------------', success);
    this.setState({ loading: false });
  },
  setInactiveIcon: function() {
    this.getTabId(function(id) {
      if (id) {
        chrome.runtime.sendMessage({ type: 'setInactiveIcon', tabId: id });
      }
    }.bind(this));
  },
  addErrorListener: function() {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.type == 'setError') {
        this.onError(request.error);
      }
    }.bind(this));
  },
  onError: function(error) {
    this.getTabId(function(id) {
      if (id) {
        chrome.runtime.sendMessage({ type: 'setErrorIcon', tabId: id });
      }

      this.setState({ error: error || true });
    }.bind(this));
  },
  render: function() {
    var content;
    if (this.state.currentPage === 'about') {
      content =
        <Info messages={this.props.aboutMessages}>
          <Button url={'https://github.com/tegon/traktflix'} text={'Read more'} />
        </Info>
    } else if (this.state.error) {
      content =
        <Info messages={this.props.errorMessages} />
    } else {
      if (this.state.logged) {
        if (this.state.item) {
          content = <Watching item={this.state.item} />
        } else if (this.state.currentPage === 'history') {
          content =
            <History
              autoSync={this.state.autoSync}
              showSyncButton={this.state.showSyncButton}
              onAutoSyncChanged={this.onAutoSyncChanged}
              onSyncNowClicked={this.onSyncNowClicked}
              componentHandler={componentHandler}
              loading={this.state.loading} />
        } else {
          content = <Info messages={this.props.notWatchingMessages} />
        }
      } else {
        content =
          <LoginButton
            loading={this.state.loading} onClick={this.onLoginClicked}
            onTokenSuccess={this.onTokenSuccess} onTokenFailed={this.onTokenFailed} />
      }
    }

    return(
      <div className='mdl-layout mdl-layout--fixed-header'>
        <Header
          items={[{ name: 'About', show: true }, { name: 'History', show: this.state.logged }, { name: 'Logout', show: this.state.logged }]}
          onItemClicked={this.onItemClicked} />
        <main className='mdl-layout__content'>
          <div className='overlay'></div>
          <div className='content'>
            {content}
          </div>
        </main>
      </div>
    );
  }
});