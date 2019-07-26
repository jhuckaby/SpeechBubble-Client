// SpeechBubble Main Entry Point

// "use strict";
var fs = require('fs');
var cp = require('child_process');
var electron = require('electron');
var windowStateKeeper = require('electron-window-state');

var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var Menu = electron.Menu;
var MenuItem = electron.MenuItem;
var Tray = electron.Tray;
var ipcMain = electron.ipcMain;
var Dialog = electron.dialog;

var package = require('./package.json');

// when app is running locally in dev mode, this is true
var isDev = !!process.defaultApp;
process.env.IS_DEV = isDev ? "1" : "0";

// disable pinch zoom
// app.commandLine.appendSwitch('disable-pinch');

var Config = require('electron-store');
var config = new Config({
	name: isDev ? 'dev' : 'config'
});

// optionally disable GPU acceleration
if (config.get('disable_hardware_acceleration')) app.disableHardwareAcceleration();

var SoundSetup = require('./lib/sound-setup.js');
var ScreenSleep = require('./lib/screen-sleep.js');
var UpdateManager = require('./lib/update-manager.js');

// adds debug features like hotkeys for triggering dev tools and reload
if (isDev) require('electron-debug')();

// Google Geocoding API Key
process.env.GOOGLE_API_KEY = package.geoAPIKey;

// make sure app is single instance (windows)
var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
	// Someone tried to run a second instance
	app.focus();
});
if (shouldQuit) {
	app.quit();
	return;
}

var requestQuit = false;
app.on('before-quit', function() {
	requestQuit = true; 
	if (!config.get('remember')) {
		config.delete('session_id');
		config.delete('password');
	}
});
app.on('will-quit', function() { requestQuit = true; });
app.on('quit', function() { requestQuit = true; });

// prevent window being garbage collected
var mainWindow = null;
var aboutWindow = null;
var prefsWindow = null;
var menu = null;
var mainFocus = true;

var dockMenu = new Menu();

dockMenu.append(new MenuItem({
	label: 'Available', 
	type: 'checkbox', 
	checked: false,
	click: function() { 
		dockMenu.items[0].checked = true;
		mainWindow.webContents.send('cmd', { cmd: 'status', text: '' }); 
	}
}));
dockMenu.append(new MenuItem({
	label: 'Away', 
	type: 'checkbox', 
	checked: false,
	click: function() { 
		dockMenu.items[1].checked = true;
		mainWindow.webContents.send('cmd', { cmd: 'status', text: 'away' }); 
	}
}));
dockMenu.append(new MenuItem({
	label: 'Be Right Back', 
	type: 'checkbox', 
	checked: false,
	click: function() { 
		dockMenu.items[2].checked = true;
		mainWindow.webContents.send('cmd', { cmd: 'status', text: 'brb' }); 
	}
}));
dockMenu.append(new MenuItem({
	label: 'Do Not Disturb', 
	type: 'checkbox', 
	checked: false,
	click: function() { 
		dockMenu.items[3].checked = true;
		mainWindow.webContents.send('cmd', { cmd: 'status', text: 'dnd' }); 
	}
}));

// handle invalid SSL certs
app.on( 'certificate-error', function(event, webContents, url, error, certificate, callback) {
	if (url.match(/^wss\:/i)) {
		console.log("WebSocket SSL certificate-error: ", url, error, certificate);
		
		// allow connection but warn client via header icon
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send('ssl_cert_warning', { url: url, err: '' + error, cert: certificate });
		}
	}
	event.preventDefault();
	callback(true);
} );

function showPrefs() {
	// show prefs window, create if necessary
	if (prefsWindow) {
		prefsWindow.show();
		prefsWindow.focus();
	}
	else {
		prefsWindow = new BrowserWindow({
			title: "Preferences",
			titleBarStyle: 'hidden',
			width: 600, 
			height: 350,
			center: true,
			resizable: false,
			show: false,
			maximizable: false
		});
		prefsWindow.webContents.on( 'did-finish-load', function() {
			prefsWindow.show();
		} );
		prefsWindow.on('close', function(event) {
			// don't actually close the window, just hide it, and send message so prefs can be saved
			// unless user is trying to quit, then allow the close
			if (!requestQuit) {
				event.preventDefault();
				prefsWindow.webContents.send('save_prefs', {});
				prefsWindow.hide();
			}
		});
		prefsWindow.on('closed', function() {
			prefsWindow = null;
		});
		prefsWindow.loadURL('file://' + __dirname + '/htdocs/prefs.html');
		
		/*prefsWindow.webContents.on( 'certificate-error', function(event, url, error, certificate, callback) {
			console.log("SSL certificate-error: ", url, error, certificate);
			if (url.match(/^https\:\/\/local\.speechbubble\.com/)) {
				// allow local SSL errors, for debugging only
				event.preventDefault();
				callback(true);
			}
			else callback(false);
		} );*/
		
		// send sound lists to prefs on every focus (user sounds may have changed)
		prefsWindow.on('focus', function() {
			prefsWindow.webContents.send( 'sound_setup', SoundSetup.getAll() );
		});
		
		var webContents = prefsWindow.webContents;
		
		// redirect all clicks to external browser
		var handleRedirect = function(e, url) {
			if(url != webContents.getURL()) {
				e.preventDefault();
				electron.shell.openExternal(url);
			}
		};
		
		webContents.on('will-navigate', handleRedirect);
		webContents.on('new-window', handleRedirect);
	}
}; // showPrefs

app.on('ready', function () {

	var mainWindowState = windowStateKeeper({
		defaultWidth: 800,
		defaultHeight: 500
	});
	
	// Activate menu bar
	Menu.setApplicationMenu(menu);
	app.dock.setMenu(dockMenu);
	
	// Create main window
	mainWindow = new BrowserWindow({
		titleBarStyle: 'hidden',
		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,
		minWidth: 400,
		minHeight: 300,
		show: false,
		
		// attempt to workaround FOUC on startup
		backgroundColor: (config.get('theme') == 'light') ? '#F8F8F8' : '#202020'
	});
	
	mainWindowState.manage(mainWindow);
	
	mainWindow.loadURL('file://' + __dirname + '/htdocs/index.html');
	
	mainWindow.on('focus', function() { 
		mainFocus = true;
		mainWindow.webContents.send('focus', {});
		app.setBadgeCount(0);
	});
	mainWindow.on('blur', function() { 
		mainFocus = false;
		mainWindow.webContents.send('blur', {});
	});
	
	mainWindow.on('close', function () {
		mainWindow = null;
		requestQuit = true;
		app.quit();
	});
	
	var webContents = mainWindow.webContents;
	
	// redirect all clicks to external browser
	var handleRedirect = function(e, url) {
		if(url != webContents.getURL()) {
			e.preventDefault();
			if (url.match(/^speech\:/i)) webContents.send('speech_url', { url: url });
			else electron.shell.openExternal(url);
		}
	};
	
	webContents.on('will-navigate', handleRedirect);
	webContents.on('new-window', handleRedirect);
	
	/*webContents.on( 'did-finish-load', function() {
		mainWindow.show();
	} );*/
	
	UpdateManager.init({
		isDev: isDev,
		package: package,
		config: config
	});
}); // app ready

app.on('window-all-closed', function () {
	app.quit();
});

// listen for commands sent by window

var appReadyQuiet = false;

ipcMain.on('appReady', function(event, args) {
	// main window is ready, but do we have login creds?
	if (appReadyQuiet) appReadyQuiet = false;
	else if (args.show_prefs) showPrefs();
	else mainWindow.show();
	
	// take this opportunity to send along some template files
	mainWindow.webContents.send('embed_templates', {
		oembed: fs.readFileSync( __dirname + '/htdocs/templates/oembed.html', 'utf8'),
		audio: fs.readFileSync( __dirname + '/htdocs/templates/audio.html', 'utf8'),
		video: fs.readFileSync( __dirname + '/htdocs/templates/video.html', 'utf8'),
		image: fs.readFileSync( __dirname + '/htdocs/templates/image.html', 'utf8')
	});
});

ipcMain.on('login', function(event, args) {
	// prefs window letting us know user has logged in
	appReadyQuiet = true;
	mainWindow.webContents.send('login', {});
	mainWindow.show();
	prefsWindow.focus();
});
ipcMain.on('logout', function(event, args) {
	// prefs window letting us know user has logged out
	mainWindow.webContents.send('logout', {});
	mainWindow.hide();
});
ipcMain.on('prefs_changed', function(event, changes) {
	// prefs window letting us know user has changed prefs (theme, etc.).
	mainWindow.webContents.send('prefs_changed', changes);
	if (aboutWindow && aboutWindow.webContents) aboutWindow.webContents.send('prefs_changed', changes);
});
ipcMain.on('get_sound_setup', function(event, data) {
	// window is requesting user's sound setup
	event.sender.send( 'sound_setup', SoundSetup.getAll() );
});
ipcMain.on('open_user_sounds', function(event, data) {
	// window is requesting user's sound folder
	SoundSetup.openUserSounds();
});
ipcMain.on('detect_screen_sleep', function(event, data) {
	// detect if screen is asleep
	ScreenSleep.detect( function(result) {
		event.sender.send( 'screen_status', { status: result } );
	} );
});
ipcMain.on('auth_failure', function(event, data) {
	// main window letting us know the auth failed, must return to prefs login
	if (prefsWindow && prefsWindow.webContents) {
		prefsWindow.webContents.send( 'auth_failure', {} );
	}
	showPrefs();
	mainWindow.hide();
});
ipcMain.on('hide_main_window', function(event, data) {
	// request to hide main window
	mainWindow.hide();
});

ipcMain.on('debug_log', function(event, data) {
	// request to proxy debug message to console
	var cols = [ data.filename, data.cat, data.msg, data.data || '' ];
	console.log( "[" + cols.join("][") + "]" );
});

ipcMain.on('bounce', function(event, data) {
	var count = app.getBadgeCount() || 0;
	app.setBadgeCount( count + 1 );
	app.dock.bounce();
});

ipcMain.on('user_status', function(event, data) {
	var status = data.status;
	console.log("user_status: " + status);
	
	for (var idx = 0, len = dockMenu.items.length; idx < len; idx++) {
		dockMenu.items[idx].checked = false;
	}
	
	if (!status || (status == 'large_blue_circle')) dockMenu.items[0].checked = true; // Available
	else if (status == 'red_circle') dockMenu.items[1].checked = true; // Away
	else if (status == 'clock4') dockMenu.items[2].checked = true; // BRB
	else if (status == 'no_entry_sign') dockMenu.items[3].checked = true; // DND
});

var ssl_cert_cache = {};

ipcMain.on('get_ssl_cert', function(event, data) {
	// fetch URL on SpeechBubble server to get SSL cert info (can't do this in renderer)
	if (ssl_cert_cache[data.url]) {
		event.sender.send( 'ssl_cert_info', ssl_cert_cache[data.url] );
		return;
	}
	console.log("Fetching SSL Cert Info: " + data.url);
	var parts = require('url').parse( data.url );
	var options = {
		host: parts.hostname,
		port: parts.port || ((parts.protocol == 'https:') ? 443 : 80),
		path: parts.path,
		method: 'GET'
	};
	var req = require('https').request(options, function(res) {
		var cert = res.connection.getPeerCertificate();
		console.log("SSL Cert: ", cert);
		if (cert && cert.subject && cert.issuer) {
			ssl_cert_cache[data.url] = {
				subject: cert.subject.CN,
				issuer: cert.issuer.CN,
				valid_to: cert.valid_to,
				fingerprint: cert.fingerprint,
				serialNumber: cert.serialNumber
			};
			event.sender.send( 'ssl_cert_info', ssl_cert_cache[data.url] );
		}
	});
	req.on('error', function() {}); // prevent throw
	req.end();
});

/*ipcMain.on('wvwheel', function(event, data) {
	// mouse wheel from webview (sigh)
	data.type = 'mouseWheel';
	data.modifiers = [];
	mainWindow.webContents.sendInputEvent(data);
});*/

// listen for UpdateManager events and delegate to appropriate windows
UpdateManager.on('state', function(state) {
	// prefs window gets sent all state changes
	if (prefsWindow && prefsWindow.webContents) {
		prefsWindow.webContents.send( 'auto_update_state', { state: state } );
	}
});
UpdateManager.on('update-downloaded', function() {
	// main window may want to send a notification
	if (mainWindow && mainWindow.webContents) {
		mainWindow.webContents.send( 'update_downloaded', {} );
	}
});

// setup menu bar

var template = [
	{
		label: package.productName,
		submenu: [
			{
				label: 'About ' + package.productName + '...',
				click: function() {
					if (aboutWindow) aboutWindow.focus();
					else {
						aboutWindow = new BrowserWindow({
							titleBarStyle: 'hidden',
							title: "About " + package.productName,
							width: 400, 
							height: 270,
							center: true,
							resizable: false,
							maximizable: false,
							show: false
						});
						aboutWindow.webContents.on( 'did-finish-load', function() {
							aboutWindow.show();
						} );
						aboutWindow.on('closed', function() {
							aboutWindow = null;
						});
						aboutWindow.loadURL('file://' + __dirname + '/htdocs/about.html');
						
						var webContents = aboutWindow.webContents;
						
						// redirect all clicks to external browser
						var handleRedirect = function(e, url) {
							if(url != webContents.getURL()) {
								e.preventDefault();
								electron.shell.openExternal(url);
							}
						};
						
						webContents.on('will-navigate', handleRedirect);
						webContents.on('new-window', handleRedirect);
					}
				}
				// selector: 'orderFrontStandardAboutPanel:'
			},
			{
				type: 'separator'
			},
			{
				label: 'Preferences...',
				accelerator: 'Command+,',
				click: function() {
					showPrefs();
				}
			},
			{
				type: 'separator'
			},
			{
				label: 'Hide ' + package.productName,
				accelerator: 'Command+H',
				role: 'hide'
				// selector: 'hide:'
			},
			{
				label: 'Hide Others',
				accelerator: 'Command+Shift+H',
				role: 'hideothers'
				// selector: 'hideOtherApplications:'
				
			},
			{
				label: 'Show All',
				role: 'unhide'
				// selector: 'unhideAllApplications:'
			},
			{
				type: 'separator'
			},
			{
				label: 'Quit',
				accelerator: 'Command+Q',
				click: function() { app.quit(); }
			},
		]
	},
	{
		label: 'Edit',
		submenu: [
			{
				label: 'Undo',
				accelerator: 'Command+Z',
				selector: 'undo:'
			},
			{
				label: 'Redo',
				accelerator: 'Shift+Command+Z',
				selector: 'redo:'
			},
			{
				type: 'separator'
			},
			{
				label: 'Cut',
				accelerator: 'Command+X',
				selector: 'cut:'
			},
			{
				label: 'Copy',
				accelerator: 'Command+C',
				selector: 'copy:'
			},
			{
				label: 'Paste',
				accelerator: 'Command+V',
				selector: 'paste:'
			},
			{
				role: 'pasteandmatchstyle'
			},
			{
				role: 'delete'
			},
			{
				label: 'Select All',
				accelerator: 'Command+A',
				selector: 'selectAll:'
			},
			{
				type: 'separator'
			},
			{
				label: 'Speech',
				submenu: [
					{
						role: 'startspeaking'
					},
					{
						role: 'stopspeaking'
					}
				]
			}
		]
	},
	{
		label: 'View',
		submenu: [
			{
				label: 'Reload',
				accelerator: 'Command+R',
				click: function() { 
					// BrowserWindow.getFocusedWindow().reloadIgnoringCache(); 
					mainWindow.webContents.send('login', {}); // this calls location.reload()
				}
			},
			{
				label: 'Clear',
				accelerator: 'Command+K',
				click: function() { mainWindow.webContents.send('cmd', { cmd: 'clear', text: '' }); }
			},
			{
				label: 'Open DevTools',
				accelerator: 'Alt+Command+I',
				click: function() {
					// BrowserWindow.getFocusedWindow().toggleDevTools(); 
					BrowserWindow.getFocusedWindow().openDevTools({
						detach: true
					});
				}
			},
			{
				type: 'separator'
			},
			{
				role: 'resetzoom'
			},
			{
				role: 'zoomin'
			},
			{
				role: 'zoomout'
			},
			{
				type: 'separator'
			},
			{
				role: 'togglefullscreen'
			}
		]
	},
	{
		label: 'Window',
		submenu: [
			{
				label: 'Minimize',
				accelerator: 'Command+M',
				role: 'minimize'
				// selector: 'performMiniaturize:'
			},
			{
				label: 'Close',
				accelerator: 'Command+W',
				role: 'close'
				// selector: 'performClose:'
			},
			{
				label: 'Zoom',
				role: 'zoom'
			},
			{
				type: 'separator'
			},
			{
				label: 'Bring All to Front',
				role: 'front'
				// selector: 'arrangeInFront:'
			},
		]
	},
	{
		role: 'help',
		submenu: [
			{
				label: 'Github Repo...',
				click () { electron.shell.openExternal('https://github.com/jhuckaby/SpeechBubble-Client'); }
			},
			{
				label: 'Tech Support...',
				click () { electron.shell.openExternal('https://github.com/jhuckaby/SpeechBubble-Client/issues'); }
			}
		]
	}
];

menu = Menu.buildFromTemplate(template);
