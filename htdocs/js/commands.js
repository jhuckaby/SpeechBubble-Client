// Chat Commands (Slash Commands)
// Return 'true' if handled, 'false' if not

app.commands = {
	
	config: function(text) {
		// get or set any local config value (user prefs)
		if (text.match(/^get\s+(\S+)$/i)) {
			var key = RegExp.$1;
			key = key.replace(/^\//, '').replace(/\//g, '.');
			
			var value = app.config.get(key);
			app.newLocalNotice( '<b>Config Key:</b> <code>' + key + ' = ' + JSON.stringify(value) + '</code>', { label: 'Config' } );
			return true;
		}
		else if (text.match(/^(set|add)\s+(\S+)\s+(.+)$/)) {
			var cmd = RegExp.$1;
			var key = RegExp.$2;
			var value = RegExp.$3;
			
			key = key.replace(/^\//, '').replace(/\//g, '.');
			if (value.match(/^\-?\d+\.\d+$/)) value = parseFloat(value);
			else if (value.match(/^\-?\d+$/)) value = parseInt(value);
			else if (value.match(/^true/i)) value = true;
			else if (value.match(/^false/i)) value = false;
			
			if ((cmd == 'set') && !app.config.has(key)) {
				return app.doInlineError("Config Key Not Found: " + key);
			}
			
			app.config.set(key, value);
			app.newLocalNotice( '<b>Config Key Saved:</b> <code>' + key + ' = ' + JSON.stringify(value) + '</code>', { label: 'Config' } );
			
			// notify app that config changed
			app.prefsChanged(key);
			
			return true;
		}
		else if (text.match(/^delete\s+(\S+)$/i)) {
			var key = RegExp.$1;
			key = key.replace(/^\//, '').replace(/\//g, '.');
			
			app.config.delete(key);
			app.newLocalNotice( '<b>Config Key Deleted:</b> <code>' + key + '</code>', { label: 'Config' } );
			
			// notify app that config changed
			app.prefsChanged(key);
			
			return true;
		}
		else {
			app.doInlineError( "Malformed config command: " + text );
		}
		
		return true;
	},
	
	/*eval: function(code) {
		// eval local javascript code
		var result = '';
		try { result = eval(code); }
		catch (e) { result = '' + e; }
		app.newChatMessage( 'code', code + ' == ' + JSON.stringify(result) );
		return true;
	},*/
	
	code: function(code, elem) {
		// shortcut for ```code```
		var text = elem.innerText.replace(/^\s*\/code\s+/, '');
		var overrides = {};
		var content = stripIndent( text ).trim();
		
		// detect [log][syntax] vs JSON and set plain flag for better formatting
		if (text.match(/^\[.+\]\[.+\]/)) overrides.plain = true;
		
		app.newChatMessage( 'code', content, overrides );
		return true;
	},
	
	me: function(text) {
		// /me likes JavaScript (i.e. pose command)
		if (app.searchMode) return;
		if (!text) return;
		app.newChatMessage( 'pose', text );
		return true;
	},
	
	whisper: function(text) {
		// /whisper fish hello (i.e. whisper command)
		if (app.searchMode) return;
		if (text.match(/^(\S+)\s+(.+)$/)) {
			var to = RegExp.$1;
			var msg = RegExp.$2;
			
			// default to ear emoji, but allow whisper message to override
			var pose = 'ear';
			if (msg.match(/^\:([\w\-\+]+)\:\s+/)) {
				pose = RegExp.$1;
				msg = msg.replace(/\:([\w\-\+]+)\:\s+/, '');
			}
			
			var whisper_user = app.findUser(to);
			if (!whisper_user) return app.doInlineError("User not found: " + to);
			var whisper_username = whisper_user.username;
			if (whisper_username == app.username) return app.doInlineError("You cannot whisper to yourself.");
			
			var chan = app.current_channel_id;
			var channel = app.channels[ chan ];
			if (!channel.live_users || !channel.live_users[whisper_username]) {
				return app.doInlineError("User is not in channel: " + to);
			}
			
			app.newChatMessage( 'whisper', msg, {
				to: whisper_username,
				pose: pose
			} );
		}
		return true;
	},
	
	invite: function(text) {
		// invite people to join a channel (automated whispers)
		// /invite joe and aaron to meeting 1
		if (app.searchMode) return;
		if (text.match(/^(.+)\s+to\s+(.+)$/)) {
			var peeps_raw = RegExp.$1;
			var chan_raw = RegExp.$2;
			
			var channel = app.findChannel(chan_raw);
			if (!channel) return app.doInlineError("Channel not found: " + chan_raw);
			var chan = channel.id;
			
			var peeps = peeps_raw.split(/\s+/);
			var usernames = [];
			peeps.forEach( function(peep) {
				if (peep.match(/\S/)) {
					var user = app.findUser(peep);
					if (user) usernames.push( user.username );
				}
			} );
			
			if (!usernames.length) return app.doInlineError("Users not found: " + peeps_raw);
			
			var msg = ":incoming_envelope: Please join me in channel #" + chan;
			
			usernames.forEach( function(username) {
				app.commands.whisper( username + " " + msg );
			} );
		}
		return true;
	},
	
	join: function(text) {
		// join channel
		if (!text) {
			$('#i_join_channel').trigger('mousedown');
			return;
		}
		var channel = app.findChannel(text);
		if (!channel) return app.doInlineError("Channel not found: " + text);
		var chan = channel.id;
		
		// already joined?  switch to tab
		if (channel.ui) {
			app.sidebar.selectChannel( chan );
			return true;	
		}
		
		// since user initiated join, switch to channel
		app.current_channel_id = chan;
		
		// okay join
		app.comm.sendCommand('join', { channel_id: chan });
		
		return true;
	},
	
	leave: function(text) {
		// leave channel
		if (!text) text = app.current_channel_id;
		var channel = app.findChannel(text);
		if (!channel) return app.doInlineError("Channel not found: " + text);
		var chan = channel.id;
		
		if (!channel.ui) {
			// cannot leave
			return app.doInlineError("Cannot leave a channel we're not in: " + text);
		}
		
		// okay leave
		app.comm.sendCommand('leave', { channel_id: chan });
		
		return true;
	},
	
	pm: function(text) {
		// start private message with user
		var user = app.findUser(text);
		if (!user) return app.doInlineError("User not found: " + text);
		var username = user.username;
		
		// show intent for auto-joining when pm channel appears
		app.pm_auto_join = username;
		
		// okay pm
		app.comm.sendCommand('pm', { username: username });
		
		return true;
	},
	
	kick: function(text) {
		// kick user from current channel
		if (app.searchMode) return;
		var user = app.findUser(text);
		if (!user) return app.doInlineError("User not found: " + text);
		var username = user.username;
		
		var chan = app.current_channel_id;
		var channel = app.channels[ chan ];
		if (!channel.live_users || !channel.live_users[username]) {
			return app.doInlineError("User is not in channel: " + text);
		}
		
		// okay kick
		app.comm.sendCommand('kick', { username: username, channel_id: chan });
		
		return true;
	},
	
	ban: function(text) {
		// ban user from entire server
		var user = app.findUser(text);
		if (!user) return app.doInlineError("User not found: " + text);
		var username = user.username;
		
		// okay ban
		app.comm.sendCommand('ban', { username: username });
		
		return true;
	},
	
	unban: function(text) {
		// unban user
		var user = app.findUser(text);
		if (!user) return app.doInlineError("User not found: " + text);
		var username = user.username;
		
		// okay unban
		app.comm.sendCommand('unban', { username: username });
		
		return true;
	},
	
	hide: function(text) {
		// add user to hide list (local prefs change)
		var user = app.findUser(text);
		if (!user) return app.doInlineError("User not found: " + text);
		var username = user.username;
		
		if (!username.match(app.hideUsersRegExp)) {
			var hide_users = app.config.get('hide_users') || '';
			if (hide_users) hide_users += ', ';
			hide_users =+ username;
			return this.config("set hide_users " + hide_users);
		}
		else {
			return app.doInlineError("User is already in your hide list: " + text);
		}
	},
	
	replace: function(text) {
		// regular expression replace
		if (app.searchMode) return;
		text = text.replace(/\\\//g, '__SB_ESC_SLASH__');
		
		if (text.match(/^s\/([^\/]+)\/([^\/]*)\/?$/i)) {
			var re_match = RegExp.$1;
			var re_replace = RegExp.$2.replace(/\/$/, '');
			
			re_match = re_match.replace(/__SB_ESC_SLASH__/g, "/");
			re_replace = re_replace.replace(/__SB_ESC_SLASH__/g, "/");
			
			var regex = new RegExp(re_match, "i");
			
			// only consider our last 10 messages
			var chan = app.current_channel_id;
			var $scrollarea = $('#sa_' + chan);
			var $mine = $scrollarea.find('div.sb_chat_row_container.editable');
			
			if ($mine.length) {
				var $last = $mine.slice(-10);
				var $foundBubble = null;
				var foundNode = null;
				
				for (var idx = $last.length - 1; idx >= 0; idx--) {
					var $elem = $last.slice(idx, idx + 1);
					
					var bubble_class = ($elem.data('type') == 'pose') ? 'sb_chat_pose' : 'sb_chat_bubble';
					var $bubble = $elem.find('> div.' + bubble_class);
					
					var tNode = findTextNodeWithRegexp($bubble, regex);
					if (tNode) {
						$foundBubble = $bubble;
						foundNode = tNode;
						idx = -1;
					}
				} // foreach editable
				
				if ($foundBubble) {
					// simulate a user edit
					$foundBubble.focus();
					foundNode.nodeValue = foundNode.nodeValue.replace( regex, re_replace );
					$foundBubble.data('dirty', true);
					$foundBubble.blur();
					
					if (app.getChannelPref(chan, 'chat_sounds')) {
						app.sound.play('correction');
					}
					
					return true;
				} // found match
				else {
					app.doInlineError("No matches found for: " + re_match);
				}
			} // found editables
		} // well formed regexp
		else {
			// formatting error
			app.doInlineError("Malformed regular expression: " + text);
		}
		
		return true;
	},
	
	status: function(text) {
		// set user status, if it has changed
		// Option 1: /status :imp:
		// Option 2: /status imp
		// Option 3: /status :imp: going to store
		// Option 4: /status going to store
		var new_status = '';
		var new_hint = '';
		var orig_text = text;
		// var status_map = app.server_config.status_map || {};
		
		text = app.emoji.expandShortcuts( text );
		text = text.toLowerCase() || 'large_blue_circle';
		
		if (text.match(emoji_fast_name_regex)) {
			// Options 1 & 3
			new_status = RegExp.$1;
			new_hint = orig_text.replace(/\:([\w\-\+]+)\:/g, '').trim();
		}
		else if (app.emoji.names[text]) {
			// Option 2
			new_status = text;
		}
		else {
			// some common status shortcuts
			switch (text) {
				case 'away': new_status = 'red_circle'; break;
				case 'dnd': new_status = 'no_entry_sign'; break;
				case 'brb': new_status = 'clock4'; break;
				case 'back': new_status = 'large_blue_circle'; break;
				case 'here': new_status = 'large_blue_circle'; break;
			}
		}
		
		if (!new_status || !app.emoji.names[new_status]) {
			// Option 4
			new_status = 'red_circle';
			new_hint = orig_text;
			
			// reverse match hint vs. user status hints, to find matching emoji
			var status_hints = app.config.get('status_hints') || {};
			for (var key in status_hints) {
				if (new_hint.toLowerCase().match(status_hints[key].toLowerCase())) {
					new_status = key;
					break;
				}
			}
		}
		
		var old_status = app.user.status || 'large_blue_circle';
		var old_hint = app.user.status_hint || '';
		
		if ((new_status == old_status) && (new_hint == old_hint)) {
			if (new_status == 'large_blue_circle') return; // don't emit dupe notification
			
			// repeat command with non-avail status, toogle back to avail
			new_status = 'large_blue_circle';
			new_hint = '';
		}
		
		app.sidebar.setUserStatus( new_status, new_hint );
		return true;
	},
	
	brb: function() { 
		// shortcut for /status brb, except this toggles
		// if (app.user.status == 'clock4') return this.status("");
		this.status('brb'); 
	},
	
	dnd: function() { 
		// shortcut for /status dnd, except this toggles
		// if (app.user.status == 'no_entry_sign') return this.status("");
		this.status('dnd'); 
	},
	
	userinfo: function(text) {
		// get info about user
		var user = app.findUser(text);
		if (!user) return app.doInlineError("User not found: " + text);
		var username = user.username;
		app.sidebar.getUserInfo(username);
		return true;
	},
	
	topic: function(text) {
		// change channel topic
		if (app.searchMode) return;
		var chan = app.current_channel_id;
		app.comm.sendCommand('topic', { channel_id: chan, topic: text });
	},
	
	nick: function(text) {
		// change own nickname
		var nickname = text.replace(/\s+/g, '').trim();
		if (nickname) {
			app.comm.sendCommand('nick', { nickname: nickname });
		}
		return true;
	},
	
	emoji: function(text) {
		// add, update or delete custom emoji
		if (app.searchMode) return;
		if (text.match(/^(create|add|update)\s+\:?([\w\-\+]+)\:?\s+(.+)$/i)) {
			var api = RegExp.$1.toLowerCase();
			var id = RegExp.$2.toLowerCase();
			var stuff = RegExp.$3;
			var title = id;
			var urls = [];
			
			stuff = stuff.replace(/(https?\:\/\/\S+)/ig, function(m_all, m_g1) {
				urls.push(m_g1); return '';
			}).trim();
			
			if (stuff.match(/\S/)) title = stuff;
			if (api == 'add') api = 'create';
			
			if (!urls.length) {
				return app.doInlineError("No URLs found for Emoji: " + text);
			}
			
			app.comm.sendCommand('emoji', {
				api: api,
				id: id,
				title: title,
				urls: urls
			});
		}
		else if (text.match(/^(delete|remove)\s+\:?([\w\-\+]+)\:?$/i)) {
			var api = RegExp.$1.toLowerCase();
			var id = RegExp.$2.toLowerCase();
			
			if (api == 'remove') api = 'delete';
			
			app.comm.sendCommand('emoji', {
				api: 'delete',
				id: id
			});
		}
		else {
			app.doInlineError( "Malformed emoji command: " + text );
		}
	},
	
	slap: function(text) {
		if (app.searchMode) return;
		if (!text) text = 'self';
		app.newChatMessage( 'pose', 'slaps ' + text + '.', { pose: 'raised_back_of_hand' } );
	},
	
	punch: function(text) {
		if (app.searchMode) return;
		if (!text) text = 'self';
		app.newChatMessage( 'pose', 'punches ' + text + '.', { pose: 'right-facing_fist' } );
	},
	
	cut: function(text) {
		if (app.searchMode) return;
		if (!text) text = 'self';
		app.newChatMessage( 'pose', 'cuts ' + text + '.', { pose: 'knife' } );
	},
	
	bless: function(text) {
		if (app.searchMode) return;
		if (!text) text = 'self';
		app.newChatMessage( 'pose', 'blesses ' + text + '.', { pose: 'fairy' } );
	},
	
	rimshot: function() {
		if (app.searchMode) return;
		app.newChatMessage( 'pose', 'plays a rimshot.', { pose: 'drum_with_drumsticks' } );
	},
	
	crickets: function() {
		if (app.searchMode) return;
		app.newChatMessage( 'pose', 'plays crickets.', { pose: 'cricket' } );
	},
	
	applause: function(text) {
		if (app.searchMode) return;
		if (!text) text = 'applauds.';
		else text = 'applauds ' + text + '.';
		app.newChatMessage( 'pose', text, { pose: 'clap' } );
	},
	
	rejoice: function(text) {
		if (app.searchMode) return;
		if (!text) text = 'rejoices.';
		else text = 'rejoices ' + text + '.';
		app.newChatMessage( 'pose', text, { pose: 'tada' } );
	},
	
	search: function(text) {
		// jump to search tab
		// using timeout because current thread empties text field -- app.search.run() will restore it
		setTimeout( function() { app.search.run(text); }, 1 );
	},
	
	clear: function() {
		// clear current channel scroll buffer
		if (app.searchMode == 'search') return app.search.clear();
		if (app.searchMode) return;
		
		var chan = app.current_channel_id;
		if (!chan) return;
		var channel = app.channels[ chan ];
		if (!channel || !channel.ui) return;
		
		channel.last_day_code = '';
		channel.last_min_code = '';
		
		var $scrollarea = $('#sa_' + chan);
		$scrollarea.find('.sb_chat_row_container').each( function() {
			var $this = $(this);
			if (($this.data('type') != 'progress') && !$this.data('special')) $this.remove();
		} );
	},
	
	location: function() {
		// determine user's location using Google Chrome / Google Geolocation API
		// emit coords privately to user in local notice
		if (app.searchMode) return;
		var progress = app.newProgressBar( 1.0, "Determining your location..." );
		
		var opts = {
			enableHighAccuracy: false,
			timeout: 10000,
			maximumAge: 0
		};
		
		var geoSuccess = function(pos) {
			var crd = pos.coords;
			// latitude, longitude, accuracy (meters)
			
			if (progress) {
				app.deleteProgressBar( progress );
				progress = null;
			}
			
			app.newLocalNotice( '**Your personal geo location is:** `' + crd.latitude + ', ' + crd.longitude + '` (<span class="link" onmouseup="clipboard.writeText($(this).prev().html());$(this).removeClass().html(\'Copied!\')">Copy to Clipboard</span>)', { label: 'Local' } );
			
			app.newLocalNotice( '**Privacy Warning:** These coordinates are often **highly accurate**, and may pinpoint the exact location of your home.  Please be careful where and how you share them.', { label: 'Local' } );
		};
		
		var geoError = function(err) {
			if (progress) {
				app.deleteProgressBar( progress );
				progress = null;
			}
			app.doInlineError("Geolocation failed: " + err.message);
			console.warn(`ERROR(${err.code}): ${err.message}`);
		};
		
		navigator.geolocation.getCurrentPosition(geoSuccess, geoError, opts);
	},
	
	upload: function() {
		// shortcut for upload button
		if (app.searchMode) return;
		app.upload.clickUpload();
	},
	
	snapshot: function() {
		// shortcut for snapshot button
		if (app.searchMode) return;
		app.upload.clickCamera();
	},
	
	react: function(text) {
		// add emoji reaction to custom or nearest chat
		if (app.searchMode) return;
		if (text.match(/(\w+)\s+\:([\w\-\+]+)\:/)) {
			// react to specific chat
			var chat_id = RegExp.$1;
			var emoji_id = RegExp.$2;
			app.react.toggle( chat_id, emoji_id );
		}
		else if (text.match(/\:([\w\-\+]+)\:/)) {
			// react to nearest chat
			var emoji_id = RegExp.$1;
			var $foundElem = null;
			var chan = app.current_channel_id;
			var $scrollarea = $('#sa_' + chan);
			var $mine = $scrollarea.find('div.sb_chat_row_container');
			
			if ($mine.length) {
				var $last = $mine.slice(-20);
				
				for (var idx = $last.length - 1; idx >= 0; idx--) {
					var $elem = $last.slice(idx, idx + 1);
					var type = $elem.data('type') || '';
					
					if (type.match(/^(standard|code|pose)$/)) {
						$foundElem = $elem;
						idx = -1;
					}
				} // foreach editable
				
				if ($foundElem) {
					// react to this chat message
					var chat_id = $foundElem.data('id');
					app.react.toggle( chat_id, emoji_id );
				}
			} // $mine.length
		} // react to last
	},
	
	upvote: function(text) {
		// upvote specific chat by id (defaults to nearest)
		if (app.searchMode) return;
		this.react( text + " :+1:" );
	},
	
	downvote: function(text) {
		// downvote specific chat by id (defaults to nearest)
		if (app.searchMode) return;
		this.react( text + " :-1:" );
	},
	
	mute: function() {
		// toggle sound mute
		app.sound.toggleMute();
	},
	
	channel: function(text) {
		// select channel from sidebar
		if (text.match(/search/i)) app.sidebar.selectSearch();
		else if (text.match(/timeline/i)) app.sidebar.selectTimeline();
		else if (text.match(/favorites/i)) app.sidebar.selectFavorites();
		else if (text.match(/(\d+)/)) {
			var chan_idx = parseInt( RegExp.$1 ) - 1;
			var $tab = $('#sg_channels > .sidebar_tab').slice(chan_idx, chan_idx + 1);
			if ($tab.length && $tab.data('channel')) {
				app.sidebar.selectChannel( $tab.data('channel') );
			}
		}
		else this.join(text);
	},
	
	server: function() {
		// open server UI in web browser
		var url = app.base_url + '/?auth=' + app.config.get('session_id');
		window.location = url;
	},
	
	paste: function() {
		// paste clipboard contents as URL
		var content = clipboard.readHtml();
		if (!content) return;
		
		if (content.match(/<.+>/)) {
			// html
			var html_doc = '<!DOCTYPE HTML><html lang="en"><head><meta charset="utf-8"><title>Pasted content by ' + (app.user.full_name || app.username) + '</title><style>body { font-family: Helvetica, sans-serif; } p { margin:0; }</style></head><body>' + content + '</body></html>';
			app.upload.uploadRawData( html_doc, "paste.html", "text/html" );
		}
		else {
			// plain text
			app.upload.uploadRawData( "\ufeff" + content, "paste.txt", "text/plain" );
		}
	},
	
	quit: function() {
		// quit app
		window.close();
	}
	
};

// shortcuts
app.commands.slaps = app.commands.slap;
app.commands.punches = app.commands.punch;
app.commands.cuts = app.commands.cut;
app.commands.blesses = app.commands.bless;
app.commands.rimshots = app.commands.rimshot;
app.commands.applauds = app.commands.applause;
app.commands.rejoices = app.commands.rejoice;
