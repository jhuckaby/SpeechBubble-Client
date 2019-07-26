// Handle automatic app updates
// This is designed for Electron 1.8, and will require redesign for v3+

var electron = require('electron');
var ipcMain = electron.ipcMain;
var Dialog = electron.dialog;
var autoUpdater = electron.autoUpdater;

var EventEmitter = require('events');
var UpdateManager = new EventEmitter();

// States: dev, checking-for-update, downloading-update, update-not-available, update-downloaded

UpdateManager.init = function(args) {
	// initialize
	var self = this;
	
	for (var key in args) {
		this[key] = args[key];
	}
	
	// http://s3.speech.im/updates/darwin-x64/speechbubble.json
	var package = this.package;
	var plat_arch = process.platform + '-' + process.arch; // darwin-x64
	this.url = 'http://' + package.updateServer + '/updates/' + plat_arch + '/' + package.name + '.json';
	this.state = '';
	
	if (!this.isDev) {
		try {
			autoUpdater.setFeedURL( this.url );
		}
		catch (err) {
			console.log("autoUpdater error: " + err );
			Dialog.showErrorBox("Auto Updater Error", 'An error occured with the update system: ' + err);
		}
		
		autoUpdater.on('error', function(err) {
			console.log("autoUpdater error: " + err );
			Dialog.showErrorBox("Auto Updater Error", 'An error occured with the update system: ' + err);
			self.state = '';
		});
		autoUpdater.on('checking-for-update', function() {
			console.log("autoUpdater checking-for-update");
			self.changeState('checking-for-update');
		});
		autoUpdater.on('update-available', function() {
			console.log("autoUpdater update-available");
			self.changeState('downloading-update');
		});
		autoUpdater.on('update-not-available', function() {
			console.log("autoUpdater update-not-available");
			self.changeState('update-not-available');
		});
		autoUpdater.on('update-downloaded', function(data) {
			console.log("autoUpdater update-downloaded", data);
			self.changeState('update-downloaded');
		});
	} // !isDev
	
	// setup IPC stuff
	ipcMain.on('auto_update_get_state', function(event, data) {
		// someone (prefs) requesting current state
		event.sender.send( 'auto_update_state', { 
			state: self.getState(),
			url: self.url
		} );
	});
	ipcMain.on('auto_update_download', function(event, data) {
		// initiate download
		self.checkForUpdates();
	});
	ipcMain.on('auto_update_install', function(event, data) {
		// initiate install and quit
		self.quitAndInstall();
	});
};

UpdateManager.getState = function() {
	// return current state, or 'dev' if running in non-packaged mode
	return this.isDev ? 'dev' : this.state; 
};

UpdateManager.changeState = function(state) {
	// change state and emit events
	this.state = state;
	this.emit('state', state);
	this.emit( state );
};

UpdateManager.checkForUpdates = function() {
	// download latest update
	if (this.isDev) return; // sanity
	console.log("Downloading latest update");
	autoUpdater.checkForUpdates();
};

UpdateManager.quitAndInstall = function() {
	// install and restart app
	if (this.isDev) return; // sanity
	console.log("Quitting and installing");
	autoUpdater.quitAndInstall();
};

module.exports = UpdateManager;
