// SpeechBubble Client App

app = {
	
	debug: true,
	debug_cats: { 
		all: 1, 
		ipc: false, 
		comm: false,
		echo: !!(process.env.IS_DEV === "1")
	},
	
	base_url: '',
	base_api_url: '',
	cacheBust: 0,
	scrollTimers: {},
	
	users: {},
	channels: {},
	current_channel_id: '',
	typing: false,
	mainFocus: true,
	searchMode: '',
	
	textEntryHistory: [],
	tehIdx: 0,
	
	max_recent_channel_history: 0,
	max_embed_offscreen_distance: 0,
	
	default_config: {
		sidebar_width: 150,
		sidebar_color: '#1f4ea5',
		highlight_color: '#5890db',
		edit_color: '#c0c000',
		theme: 'light',
		body_font: 'muli',
		mono_font: 'inconsolata',
		emoji_style: 'apple',
		recent_emoji: {
			"face_with_rolling_eyes": 0,
			"thinking_face": 0.08,
			"sleeping": 0.16,
			"open_mouth": 0.25,
			"neutral_face": 0.33,
			"rage": 0.41,
			"confused": 0.5,
			"disappointed": 0.58,
			"stuck_out_tongue_winking_eye": 0.66,
			"joy": 0.75,
			"wink": 0.83,
			"slightly_smiling_face": 0.91
		},
		recent_statuses: {
			"iphone": 0.9375,
			"sleeping": 0.875,
			"tada": 0.8125,
			"taco": 0.75,
			"poultry_leg": 0.6875,
			"beer": 0.625,
			"cocktail": 0.5625,
			"video_game": 0.5,
			"soccer": 0.4375,
			"basketball": 0.375,
			"baseball": 0.3125,
			"runner": 0.25,
			"bike": 0.1875,
			"car": 0.125,
			"airplane": 0.0625,
			"earth_americas": 0
		},
		status_hints: {},
		channel_order: ["lobby"],
		channel_settings: {},
		last_channel: "lobby",
		dictionary: {},
		remember: true,
		ssl: true,
		
		show_notifications: true,
		notification_type: 'all',
		bounce_icon: true,
		bounce_type: 'highlights_pms',
		highlight_words: '',
		ignore_users: '',
		hide_users: '',
		auto_away: true,
		auto_back: true,
		auto_back_exclude: 'no_entry_sign',
		
		sound_pack: 'pack1',
		sound_volume: 0.7,
		sound_muted: false,
		autoplay_media: true,
		autoplay_sounds: true,
		emoji_sounds: true,
		mute_chat_sounds_in_focus: false,
		mute_users: '',
		mute_emoji: {},
		sounds: {},
		
		shortcuts: {},
		user_avatars: {},
		autoscroll_speed: 0.25,
		embed_max_width: 0.6,
		embed_max_height: 0.6,
		max_recent_channel_history: 500,
		max_embed_offscreen_distance: 2.0,
		click_to_expand_height: 115,
		single_character_append: false,
		spelling_enabled: true,
		react_sound_max_age: 3600,
		
		auto_update_enabled: false,
		auto_update_notify: false,
		
		hot_keys: {
			"Cmd+Shift+M": "/mute",
			"Cmd+1": "/channel 1",
			"Cmd+2": "/channel 2",
			"Cmd+3": "/channel 3",
			"Cmd+4": "/channel 4",
			"Cmd+5": "/channel 5",
			"Cmd+6": "/channel 6",
			"Cmd+7": "/channel 7",
			"Cmd+8": "/channel 8",
			"Cmd+9": "/channel 9",
			"Cmd+Slash": "/channel search",
			"Cmd+T": "/channel timeline",
			"Cmd+F": "/channel favorites",
			"Cmd+U": "/upload",
			"Cmd+Shift+S": "/status",
			"Cmd+Shift+D": "/status dnd",
			"Cmd+Shift+A": "/status away",
			"Cmd+Shift+B": "/status brb",
			"Cmd+K": "/clear",
			"Cmd+Shift+ArrowUp": "/upvote",
			"Cmd+Shift+ArrowDown": "/downvote",
			"Cmd+Shift+L": "/leave"
		}
	},
	
	default_channel_settings: {
		show_notifications: true,
		show_unread: true,
		show_general: true,
		show_highlights: true,
		autoplay_media: true,
		autoplay_sounds: true,
		emoji_sounds: true,
		chat_sounds: true
	},
	
	emoji_shortcuts: {
		":) :-) :=) :> :-> :=>": ":blush:",
		":( :-( :=( :< :-< :=<": ":disappointed:",
		":/ :-/ :=/ :\\ :-\\ :=\\": ":confused:",
		";( ;-( ;=(": ":cry:",
		";) ;-) ;=)": ":wink:",
		":| :-| :=|": ":neutral_face:",
		":* :-* :=*": ":kissing_heart:",
		":D :-D :=D": ":smiley:",
		":@ :-@ :=@ X( X-( X=(": ":angry:",
		":$ :-$ :=$ :'>": ":relaxed:",
		":X :-X :=X :-# :=#": ":zipper_mouth_face:",
		"|) |-) |=) I) I-) I=) (z) (zz) (zzz)": ":sleeping:",
		"8) 8-) 8=) B) B-) B=)": ":sunglasses:",
		"8| 8-| 8=| B| B-| B=|": ":nerd_face:",
		":O :-O :=O": ":open_mouth:",
		":? :-? :=?": ":thinking_face:",
		";P ;-P ;=P": ":stuck_out_tongue_winking_eye:",
		":P :-P :=P": ":stuck_out_tongue_closed_eyes:",
		":S :-S :=S": ":confounded:",
		"(y)": ":+1:",
		"(n)": ":-1:",
		"<3": ":heart:"
	},
	
	tff: false, // text entry focused
	eff: false, // editing previous chat
	sff: false, // search field focused
	diaf: false, // dialog focused
	
	extend: function(obj) {
		// extend with contents of specified object
		for (var key in obj) this[key] = obj[key];
	},
	
	init: function() {
		// initialize application
		var self = this;
		
		if (this.debug) {
			Debug.enable( this.debug_cats );
			Debug.trace('system', "SpeechBubble Client Starting Up");
		}
		
		this.config = new Config({
			name: (process.env.IS_DEV === "1") ? 'dev' : 'config',
			defaults: this.default_config
		});
		
		this.current_channel_id = this.config.get('last_channel');
		
		// track local idle time
		this.last_event_time = timeNow();
		this.last_detect_screen_sleep = timeNow();
		
		// apply theme (loads CSS)
		this.updateTheme();
		
		// show or hide usernames under avatars
		this.updateShowUsernames();
		
		// custom colors
		this.updateHighlightColor();
		this.updateEditColor();
		
		// setup text field
		this.setupEntryField();
		
		// precalc regexps, etc.
		this.cachePrefs();
		
		// setup sidebar
		this.sidebar.init();
		
		// setup API
		this.api.init();
		
		// setup socket.io
		this.comm.init();
		
		// setup sound system
		this.sound.init();
		
		// setup camera
		this.camera.init();
		
		// setup spell checker
		this.spell.init();
		
		// setup embed system
		this.embed.init();
		
		// setup upload system
		this.upload.init();
		
		// setup search system
		this.search.init();
		
		// setup timeline
		this.timeline.init();
		
		// setup favorites
		this.favorites.init();
		
		// setup emoji picker
		this.emoji.init( function() {
			// tell Electron we are ready (but give CSS a few ms to finish loading)
			// (no easy way to hook the CSS and google font loads)
			setTimeout( function() {
				app.sendAppCommand('appReady', {
					show_prefs: self.config.get('session_id') ? 0 : 1
				});
				
				// init auto-update system last
				app.update.init();
			}, 50 );
		} );
		
		// start tickers
		setInterval( this.tick.bind(this), 1000 );
		setInterval( this.typingIndicatorMaint.bind(this), 250 );
	},
	
	reset: function() {
		// reset for new login
		app.comm.disconnect();
		app.comm.firstConnect = true;
		app.sidebar.clearTypingIndicator();
		app.dialog.hide();
		app.search.reset();
		app.timeline.reset();
		
		$('#sg_who > .sidebar_user').remove();
		$('#sg_channels > div.sidebar_tab').remove();
		$('#sg_chats > div.sidebar_tab').remove();
		/*$('#d_main > div.scrollarea').remove();*/
		$('body').removeClass('loaded');
		
		$('#d_main > div.scrollarea').each( function() {
			if ($(this).data('channel')) $(this).remove();
		} );
		
		delete app.comm.progress;
		
		this.users = {};
		this.channels = {};
		this.user = null;
		this.username = '';
		
		this.last_event_time = timeNow();
		this.last_detect_screen_sleep = timeNow();
		
		$('#d_footer_textfield').html('');
		$('#i_code_toggle').removeClass('selected');
		$('#d_footer_textfield').removeClass('codelike').removeAttr('spellcheck');
		
		this.ssl_cert_warning = null;
		$('#i_ssl').hide();
	},
	
	prefsChanged: function(changed) {
		// prefs have changed, update everything
		if (typeof(changed) == 'string') {
			var obj = {};
			obj[changed] = 1;
			changed = obj;
		}
		
		if (changed.theme) {
			this.updateTheme();
		}
		if (changed.sidebar) {
			this.sidebar.updateColor();
		}
		if (changed.emoji_style) {
			this.updateTheme();
			this.emoji.img = new Image();
			this.emoji.img.src = 'images/emoji/sheet_' + this.config.get('emoji_style') + '_64.png';
		}
		if (changed.show_usernames) {
			this.updateShowUsernames();
		}
		if (changed.highlight_color) {
			this.updateHighlightColor();
		}
		if (changed.edit_color) {
			this.updateEditColor();
		}
		if (changed.sound) {
			this.sound.tracks = {};
		}
		if (changed.volume) {
			this.sound.notifyVolumeChanged();
		}
		
		this.cachePrefs();
	},
	
	cachePrefs: function() {
		// cache some prefs so we don't hit disk all the time
		var prefs = app.config.store;
		this.prefCache = prefs;
		
		this.auto_away = prefs.auto_away;
		this.auto_back = prefs.auto_back;
		this.auto_back_exclude = buildRegExpFromCSV(prefs.auto_back_exclude);
		
		this.max_recent_channel_history = prefs.max_recent_channel_history;
		this.max_embed_offscreen_distance = prefs.max_embed_offscreen_distance;
		this.single_character_append = prefs.single_character_append;
		
		// cache CSV lists for speed
		this.ignoreUsersRegExp = buildRegExpFromCSV(prefs.ignore_users, 'i');
		this.hideUsersRegExp = buildRegExpFromCSV(prefs.hide_users, 'i');
		this.highlightRegExp = buildRegExpFromCSV(prefs.highlight_words, 'i');
		
		// apply some css variables
		setDocumentVariable('click-to-expand-height', '' + prefs.click_to_expand_height + 'px');
		
		// copy applicable keys into channel defaults
		for (var key in this.default_channel_settings) {
			if (key in prefs) this.default_channel_settings[key] = prefs[key];
		}
	},
	
	getChannelPref: function(chan, key) {
		// get channel-specific pref
		var prefs = this.prefCache;
		if (!chan) chan = app.current_channel_id;
		
		if (prefs.channel_settings[chan]) {
			return prefs.channel_settings[chan][key];
		}
		else {
			return this.default_channel_settings[key];
		}
	},
	
	doNotDisturb: function() {
		// returns true if currently in DND mode, false if not
		if (!app.user) return false;
		return( app.user.status == 'no_entry_sign' );
	},
	
	updateShowUsernames: function() {
		// show or hide usernames under avatars
		var should_scroll = this.shouldAutoScroll();
		
		if (this.config.get('show_usernames')) $('body').addClass('show_usernames');
		else $('body').removeClass('show_usernames');
		
		if (should_scroll) this.scrollToBottom(null, true);
	},
	
	updateHighlightColor: function() {
		// update user highlight color
		var color = app.config.get('highlight_color');
		setDocumentVariable('highlight-color', color);
	},
	
	updateEditColor: function() {
		// update user edited color
		var color = app.config.get('edit_color');
		setDocumentVariable('bubble-edited-color', color);
	},
	
	updateTheme: function() {
		// change or set user theme or font
		var self = this;
		var prefs = this.config.store;
		var $head = $('head');
		
		// try to prevent startup white flash with dark theme
		$('html, body').css('background-color', (prefs.theme == 'dark') ? 'rgb(32, 32, 32)' : 'rgb(248, 248, 248)');
		
		var should_scroll = this.shouldAutoScroll();
		
		// $head.find('link[sb="1"]').remove();
		$head.find('link[sb="1"]').attr('sb', 'remove');
		$head.append(
			'<link sb="1" rel="stylesheet" href="css/theme-' + prefs['theme'] + '.css">' + 
			'<link sb="1" rel="stylesheet" href="css/syntax-' + prefs['theme'] + '.css">' + 
			'<link sb="1" rel="stylesheet" href="css/font-' + prefs['body_font'] + '.css">' + 
			'<link sb="1" rel="stylesheet" href="css/mfont-' + prefs['mono_font'] + '.css">' + 
			'<link sb="1" rel="stylesheet" href="css/emoji-' + prefs['emoji_style'] + '.css">'
		);
		
		// prevent flash of unstyled content
		setTimeout( function() {
			$head.find('link[sb="remove"]').remove();
			if (should_scroll) self.scrollToBottom(null, true);
		}, 50 );
		
		// notify all embeds (webviews) as well
		if (this.embed) this.embed.changeAllWebviewThemes();
	},
	
	sendAppCommand: function(cmd, args) {
		// send command to main electron node.js process
		if (!args) args = {};
		ipcRenderer.send(cmd, args);
	},
	
	tick: function() {
		// fired every second (heartbeat for maint)
		this.displayMaint();
		this.idleMaint();
		this.comm.tick();
	},
	
	idleMaint: function() {
		// automatically set user status based on idle time
		var now = timeNow();
		
		if (now - this.last_event_time >= 60) {
			// in-app idle is over a minute
			if (now - this.last_detect_screen_sleep >= 60) {
				// check for screen saver / sleep / lock every min
				this.last_detect_screen_sleep = now;
				this.sendAppCommand('detect_screen_sleep');
			}
		}
		
		// feature detect
		if (!this.auto_away) return;
		
		// only check if connected to server
		if (!this.comm.socket || !this.comm.socket.connected) return;
		
		if (this.user.status == 'desktop_computer') {
			// user is in 'Screensaver' mode
			if (now - this.last_event_time < 60) {
				// user is back!
				app.sidebar.setUserStatus('', '', true);
			}
		}
	},
	
	receiveScreenStatus: function(message) {
		// receive screen_status from node.js
		var status = message.status;
		app.lastScreenStatus = status;
		Debug.trace('ipc', "Received screen sleep status", message);
		
		// feature detect
		if (!this.auto_away) return;
		
		// only check if connected to server
		if (!this.comm.socket || !this.comm.socket.connected) return;
		
		if (status) {
			// screen is saving, sleeping or locked
			if (!this.user.status) {
				app.sidebar.setUserStatus('desktop_computer', 'Screensaver', true);
			}
		}
		else {
			// screen is awake again
			if (this.user.status == 'desktop_computer') {
				app.sidebar.setUserStatus('', '', true);
				this.last_event_time = timeNow();
			}
		}
	},
	
	findUser: function(text) {
		// find user from partial username, nickname or full name match
		var username = text.replace(/\W+/g, '').toLowerCase();
		var user = app.users[username] || null;
		
		if (!user) {
			// try to fuzzy match on nickname, full name
			var regex = new RegExp(username);
			
			for (var id in app.users) {
				var friend = app.users[id];
				if (friend.nickname.replace(/\W+/g, '').toLowerCase().match(regex)) {
					username = id;
					user = friend;
					break;
				}
				else if (friend.full_name.replace(/\W+/g, '').toLowerCase().match(regex)) {
					username = id;
					user = friend;
					break;
				}
			}
			
			// still no match?  try first names only
			for (var id in app.users) {
				var friend = app.users[id];
				if (friend.full_name.replace(/\s+.+$/, '').replace(/\W+/g, '').toLowerCase().match(regex)) {
					username = id;
					user = friend;
					break;
				}
			}
		}
		
		return user;
	},
	
	findChannel: function(text) {
		// find channel from partial name or title match
		var chan = text.replace(/\W+/g, '').toLowerCase();
		var channel = app.channels[chan] || null;
		
		if (!channel) {
			// try to fuzzy match on title
			var regex = new RegExp(chan);
			
			for (var id in app.channels) {
				var ch = app.channels[id];
				if (ch.title.replace(/\W+/g, '').toLowerCase().match(regex)) {
					chan = id;
					channel = ch;
					break;
				}
			}
		}
		
		return channel;
	},
	
	userMatchesRegExp: function(user, regexp) {
		// check if username, nickname or full name match regexp
		if (user.username && user.username.match(regexp)) return true;
		if (user.nickname && user.nickname.match(regexp)) return true;
		if (user.full_name && user.full_name.match(regexp)) return true;
		if (user.title && user.title.match(regexp)) return true; // API Key Title
		return false;
	},
	
	getUserAvatarURL: function(user, size) {
		if (typeof(user) == 'string') user = app.users[user];
		if (!user) return '';
		if (!size) size = 64;
		
		var avatar_url = app.base_api_url + '/app/avatar/' + user.username + '.png?size=' + size;
		if (user.custom_avatar) avatar_url += '&mod=' + user.custom_avatar;
		if (app.prefCache.user_avatars[user.username]) {
			// local override
			avatar_url = app.base_url + app.prefCache.user_avatars[user.username];
		}
		
		return avatar_url;
	},
	
	doError: function(msg) {
		// show error message
		Debug.trace('error', msg);
		// console.error("Error: " + msg);
		
		var myNotification = new Notification('Error', {
			body: msg,
			silent: true
		});
		
		this.sound.play('error');
		return false;
	},
	
	doInlineError: function(msg) {
		// show error inline as a local notice
		this.newLocalNotice( msg, { label: "Error" } );
		
		this.sound.play('error');
		return false;
	},
	
	doSystemErrorDialog: function(title, msg) {
		// show electron dialog for error
		Debug.trace('error', msg);
		
		// this.sound.play('error'); // the electron dialog messes with the sound, sigh
		electron.remote.dialog.showErrorBox(title, msg);
		
		app.sendAppCommand('hide_main_window');
		
		return false;
	},
	
	badField: function(id, msg) {
		// mark field as bad
		if (id.match(/^\w+$/)) id = '#' + id;
		// $(id).removeClass('invalid').width(); // trigger reflow to reset css animation
		$(id).addClass('invalid');
		try { $(id).focus(); } catch (e) {;}
		if (msg) return this.doError(msg);
		else return false;
	},
	
	clearError: function(animate) {
		// clear last error
		// app.hideMessage(animate);
		$('.invalid').removeClass('invalid');
	},
	
	handleResize: function(event) {
		// user has resized window
		this.last_event_time = timeNow();
		this.sidebar.handleWindowResize(event);
	},
	
	handleMouseDown: function(event) {
		// user has pressed a mouse button
		this.last_event_time = timeNow();
	},
	
	handleMouseMove: function(event) {
		// user has moved the mouse
		this.last_event_time = timeNow();
		if (this.sidebar.dragging) this.sidebar.mouseMove(event);
	},
	
	handleMouseUp: function(event) {
		// user has released a mouse button
		this.last_event_time = timeNow();
		if (this.sidebar.dragging) this.sidebar.endDrag(event);
	},
	
	getHotKeyID: function(event) {
		// get unique hot key ID from event, also suitable for display, e.g. Cmd+Shift+2
		// a hot key must include at least one modifier
		if (event.key.match(/^(Shift|Control|Alt|Meta)$/)) return ''; // just a modifier key by itself
		var parts = [];
		if (event.metaKey) parts.push('Cmd'); // FUTURE: cross-platform
		if (event.altKey) parts.push('Opt'); // FUTURE: cross-platform
		if (event.ctrlKey) parts.push('Ctrl');
		if (event.shiftKey) parts.push('Shift');
		if (!parts.length) return ''; // must include at least one modifier
		if ((parts.length == 1) && (parts[0] == 'Shift')) return ''; // shift can't be solo modifier
		parts.push( event.code.replace(/^(Key|Digit)/, '') );
		return parts.join('+');
	},
	
	executeHotKey: function(key_id) {
		// execute hot key, either post message or run command
		var text = this.prefCache.hot_keys[key_id];
		Debug.trace('system', "Executing hot key: " + key_id + ": " + text);
		
		if (text.match(/^\/(\w+)(.*)$/)) {
			// is command
			var cmd = RegExp.$1.toLowerCase();
			text = RegExp.$2.trim();
			
			if (app.commands[cmd]) {
				app.commands[cmd]( text );
				return;
			}
		}
		else if (!this.searchMode) {
			// post standard message
			app.newChatMessage( 'standard', text );
		}
	},
	
	evalSpeechURL: function(url) {
		// evaluate special speech URL as message to say or command to run
		if (url.match(/^speech\:(\/\/)?(.+)$/i)) {
			var text = RegExp.$2;
			text = decodeURIComponent( text.replace(/\+/g, '%20') );
			Debug.trace('url', "Evaluating speech URL: " + url + " --> " + text);
			
			if (text.match(/^\/(\w+)(.*)$/)) {
				// is command
				var cmd = RegExp.$1.toLowerCase();
				text = RegExp.$2.trim();
				
				if (app.commands[cmd]) {
					app.commands[cmd]( text );
					return;
				}
			}
			else if (!this.searchMode) {
				// post standard message
				app.newChatMessage( 'standard', text );
			}
		}
	},
	
	handleKeyDown: function(event) {
		// user has hit a key
		this.last_event_time = timeNow();
		
		// check for hot key
		var key_id = this.getHotKeyID(event);
		if (key_id && this.prefCache && this.prefCache.hot_keys && this.prefCache.hot_keys[key_id] && !app.dialog.active) {
			event.preventDefault();
			this.executeHotKey(key_id);
			return;
		}
		
		// special hack for Cmd-Enter but also preserving weird 'Meta' bug fix
		if (event.metaKey && (event.keyCode == 13) && !app.sff && !app.tff && !app.dialog.active && !app.searchMode && !window.getSelection().toString().length) {
			$('#d_footer_textfield').focus().trigger( jQuery.Event(event) );
			return;
		}
		
		// don't do anything if metaKey is down
		if (event.metaKey || (event.key == 'Meta')) {
			if (app.tff && !app.eff) $('#d_footer_textfield').blur();
			return;
		}
		
		if (app.dialog.active) {
			switch (event.keyCode) {
				case 27: // escape
					// escape in dialog == cancel
					event.preventDefault();
					app.dialog.hide();
					return;
				break;
				
				default:
					if (app.dialog.onKeyDown) {
						app.dialog.onKeyDown(event);
						return;
					}
				break;
			} // switch keyCode
		} // dialog active
		
		// Don't do this if search field is focused, OR dialog is active
		if (!app.sff && !app.tff && !app.dialog.active && !app.searchMode.match(/(timeline|favorites)/) && !window.getSelection().toString().length) {
			$('#d_footer_textfield').focus();
		}
	},
	
	handleFocus: function(event) {
		// our window has received focus
		this.last_event_time = timeNow();
		this.last_focus_time = timeNow();
		this.idleMaint();
		
		// Don't do this if search field is focused, OR dialog is active
		if (!app.sff && !app.dialog.active) {
			placeCaretAtEnd( $('#d_footer_textfield')[0] );
		}
	}
	
};
