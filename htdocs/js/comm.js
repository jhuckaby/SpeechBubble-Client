// SpeechBubble Communication Layer

app.comm = {
	
	heyFreqSec: 10,
	statusTimeoutSec: 60,
	
	socket: null,
	firstConnect: true,
	firstLogin: true,
	
	init: function() {
		// connect to server via socket.io
		// this is called on app init AND on every login
		var prefs = app.config.store;
		
		// auto-connect if we have session_id or user+pass
		if (prefs.session_id || (prefs.username && prefs.password)) {
			this.socketConnect();
		}
		
		// hey clock (custom ping from client to server)
		if (!this.heyTimer) {
			this.heyTimer = setInterval( this.sendHey.bind(this), this.heyFreqSec * 1000 );
		}
	},
	
	disconnect: function() {
		// kill socket if connected, and prevent auto-reconnect
		if (this.socket) {
			this.socket.forceDisconnect = true;
			Debug.trace('comm', "Destroying previous socket");
			try { this.socket.close(); } 
			catch(err) {
				Debug.trace('comm', "Failed to close socket: " + err);
			}
			this.socket = null;
		}
	},
	
	socketConnect: function() {
		// connect to server via websocket
		var self = this;
		var url = app.base_url.replace(/^http/i, "ws"); // this regexp works for both https and http
		var progress_message = "Reconnecting to server...";
		
		this.disconnect();
		
		// prevent socket reconnect if screen is asleep/off and user is idle
		if (!this.firstConnect && this.progress && app.lastScreenStatus && (timeNow() - app.last_event_time >= 60)) {
			// Debug.trace('comm', "Screen is " + app.lastScreenStatus + ", trying again in a sec...");
			// hide progress bar and try again
			$('#' + self.progress).remove();
			setTimeout( function() { self.socketConnect(); }, 5000 );
			return;
		}
		
		Debug.trace('comm', "WebSocket Connect: " + url);
		
		// custom socket abstraction layer
		var socket = this.socket = {
			ws: new WebSocket( url ),
			
			connected: false,
			disconnected: false,
			
			connectTimer: setTimeout( function() {
				Debug.trace('comm', "Socket connect timeout");
				socket.close();
			}, 3000 ),
			
			emit: function(cmd, data) {
				if (cmd != 'hey') Debug.trace('comm', "Sending socket message: " + cmd, data);
				this.ws.send( JSON.stringify({ cmd: cmd, data: data }) );
			},
			
			close: function() {
				this.ws.close();
			}
		};
		
		socket.ws.onopen = function (event) {
			// socket connected
			if (socket.connectTimer) {
				clearTimeout( socket.connectTimer );
				delete socket.connectTimer;
			}
			
			socket.connected = true;
			socket.lastPing = timeNow();
			self.firstConnect = false;
			
			Debug.trace('comm', "WebSocket connected successfully");
			
			if (self.progress) {
				app.deleteProgressBar( self.progress );
				delete self.progress;
			}
			
			// if we are already logged in, authenticate websocket now
			var prefs = app.config.store;
			var session_id = prefs['session_id'];
			if (session_id) {
				// resume existing session
				socket.emit( 'authenticate', { session_id: session_id } );
			}
			else if (prefs['username'] && prefs['password']) {
				// user login
				socket.emit( 'authenticate', {
					username: prefs['username'],
					password: prefs['password']
				} );
			}
		};
		
		socket.ws.onmessage = function (event) {
			// got message from server, parse JSON and handle
			// Debug.trace('comm', "Got message from server: " + event.data);
			var json = JSON.parse( event.data );
			self.handleSocketMessage(socket, json);
		};
		
		socket.ws.onclose = function (event) {
			// socket has closed
			Debug.trace('comm', "Socket closed");
			socket.disconnected = true;
			socket.connected = false;
			
			if (socket.connectTimer) {
				clearTimeout( socket.connectTimer );
				delete socket.connectTimer;
			}
			if (socket.forceDisconnect) {
				// deliberate disconnect, stop here
				return;
			}
			if (self.firstConnect) {
				self.initialFailure();
				return;
			}
			
			Debug.trace('comm', "Reconnecting in 5 sec...");
			if (!self.progress) {
				self.progress = app.newProgressBar( 1.0, progress_message );
			}
			setTimeout( function() { self.socketConnect(); }, 5000 );
			self.socket = null;
		};
	},
	
	handleSocketMessage: function(socket, json) {
		// process message from server
		var self = this;
		var cmd = json.cmd;
		var data = json.data;
		
		switch (cmd) {
			case 'status':
				app.epoch = data.epoch;
				socket.lastPing = timeNow();
			break;
			
			case 'echo':
				// send back same data we got
				socket.emit('echoback', data);
			break;
			
			case 'auth_failure':
				// authentiation failure, jump to prefs screen
				var msg = data.description;
				// app.doSystemErrorDialog("Authentication Failure", msg);
				// app.doError(msg);
				
				// completely reset app window
				app.reset();
				
				// send message to show prefs window and hide main
				app.sendAppCommand('auth_failure');
			break;
			
			case 'login':
				// auth successful
				Debug.trace('user', "Auth successful! Logged in!", data);
				
				// hide splash preloader
				$('body').addClass('loaded');
				
				app.session_id = data.session_id;
				app.username = data.username;
				app.user = data.user;
				app.users = data.users;
				app.server_config = data.config;
				app.api_keys = data.api_keys;
				
				// allow server to add emoji shortcuts
				if (app.server_config.emoji_shortcuts) {
					mergeHashInto( app.emoji_shortcuts, app.server_config.emoji_shortcuts );
					app.emoji.compileShortcuts();
				}
				
				// merge in channels, in case this is a relog
				if (!app.channels) app.channels = {};
				for (var chan in data.channels) {
					if (!app.channels[chan]) app.channels[chan] = data.channels[chan];
					else mergeHashInto( app.channels[chan], data.channels[chan] );
				}
				
				// channels may have been removed (i.e. server restart wipes all PMs)
				for (var chan in app.channels) {
					if (!data.channels[chan]) {
						// remove channel from client app
						this.server_goodbye({ channel_id: chan, reason: "" });
						delete app.channels[chan];
					}
				}
				
				// now we can save some prefs
				app.config.set('session_id', data.session_id);
				app.config.set('username', data.username);
				
				// join standard channels
				// for relog: channel_order SHOULD match all channels that have 'ui'
				var channel_ids = app.config.get('channel_order');
				channel_ids.forEach( function(chan) {
					// app.commands.join( chan );
					if (app.channels[chan]) app.comm.sendCommand('join', { channel_id: chan });
				} );
				
				// also rejoin PMs if this is a relog (preserve above)
				for (var chan in app.channels) {
					if (app.channels[chan].pm && app.channels[chan].ui) {
						app.comm.sendCommand('join', { channel_id: chan });
					}
				}
				
				// add user words to spellchecker
				for (var username in app.users) {
					var user = app.users[username];
					
					app.spell.skipWords[ username ] = 1;
					app.spell.skipWords[ user.nickname ] = 1;
					user.full_name.split(/\W+/).forEach( function(word) {
						if (word) app.spell.skipWords[ word ] = 1;
					} );
				}
				
				// show lock icon in header if secure
				if (socket.ws.url.match(/^wss\:/i)) $('#i_ssl').show();
				else $('#i_ssl').hide();
				
				// this may simply be a socket reconnect, so only run firstLogin items once
				if (this.firstLogin) {
					app.emoji.indexSearchPrep();
					if (data.emoji) app.emoji.importCustom(data.emoji);
					if (data.emoji_sounds) app.emoji.assignSounds(data.emoji_sounds);
					// app.sound.play('login');
				}
				
				app.upload.onLogin();
				app.sidebar.onLogin();
				
				// if we are connected via SSL, request cert info
				if (app.base_api_url.match(/^https/)) {
					app.sendAppCommand( 'get_ssl_cert', { url: app.base_api_url + '/ping' } );
				}
				
				delete this.firstLogin;
			break;
			
			case 'speechbubble':
				// speechbubble message from server
				// error, pong, joined, welcome, said, left, user_updated, avatar_changed, channel_updated, topic_changed
				var sb_cmd = data.cmd;
				delete data.cmd;
				
				Debug.trace('comm', "Received SpeechBubble command from server: " + sb_cmd, data);
				
				var func = 'server_' + sb_cmd.replace(/\W+/g, '');
				if (self[func]) self[func](data);
				else {
					Debug.trace('error', "Received unknown command from server: " + sb_cmd);
				}
			break;
		} // switch cmd
	},
	
	initialFailure: function() {
		// initial failure to connect after N retries -- fail app and flip back to prefs
		Debug.trace('comm', "Initial socket connect failure");
		
		// app.doSystemErrorDialog("Connection Failure", "Failed to connect to server: " + app.config.get('hostname'));
		
		// completely reset app window
		app.reset();
		
		// send message to show prefs window and hide main
		app.sendAppCommand('auth_failure');
	},
	
	sendCommand: function(sb_cmd, data) {
		// send user command to server
		Debug.trace('comm', "Sending command to server: " + sb_cmd, data);
		
		data.cmd = sb_cmd;
		
		if (this.socket) {
			this.socket.emit('speechbubble', data);
		}
	},
	
	sendHey: function() {
		// send hey (ping) to server to keep connection alive
		if (this.socket && this.socket.connected) {
			this.socket.emit('hey', { last_event_time: app.last_event_time || 0 });
		}
	},
	
	tick: function() {
		// called once per second from app.tick()
		// see if we're receiving frequent status updates from server (might be dead socket)
		if (this.socket && this.socket.connected) {
			if (timeNow() - this.socket.lastPing >= this.statusTimeoutSec) {
				// 5 seconds and no ping = likely dead
				Debug.trace('comm', "No status update in last " + this.statusTimeoutSec + " seconds, assuming socket is dead");
				this.socket.close(); // should auto-reconnect
			}
		}
	},
	
	// 
	// Commands from server:
	// 
	
	server_joined: function(data) {
		// a user has joined a channel that we're in
		// (could be us, could be other user)
		// data: { channel_id, username, user }
		var username = data.username;
		var chan = data.channel_id;
		var channel = app.channels[chan];
		if (!channel) return;
		
		var first_join = false;
		if (!channel.live_users || !channel.live_users[username]) first_join = true;
		
		if (!channel.live_users) channel.live_users = {};
		channel.live_users[username] = { live: 1 };
		
		// Update "Who's Here" if channel is current
		if (app.current_channel_id == chan) {
			app.sidebar.updateWhoHere();
		}
		
		if ((username != app.username) && first_join) {
			if (app.getChannelPref(chan, 'chat_sounds') && (app.current_channel_id == chan)) app.sound.play('joined');
			
			// add server message into channel's timeline
			var user = app.users[username] || { full_name: username, nickname: username };
			var user_disp = user.full_name;
			if (!user.full_name.match(new RegExp("\\b" + escapeRegExp(user.nickname) + "\\b", "i"))) user_disp += " (" + user.nickname + ")";
			app.newLocalNotice( "<b>" + user_disp + "</b> has joined the channel.", { label: 'User', channel_id: chan, local: false } );
		}
	},
	
	server_left: function(data) {
		// a user has left a channel that we're still in
		// example: {"channel_id":"lobby","username":"tinymouse449","reason":"self","cmd":"left"}
		var username = data.username;
		var chan = data.channel_id;
		var channel = app.channels[chan];
		if (!channel) return;
		
		if (!channel.live_users) channel.live_users = {};
		delete channel.live_users[username];
		
		// Update "Who's Here" if channel is current
		if (app.current_channel_id == chan) {
			app.sidebar.updateWhoHere();
		}
		
		// add server message into channel's timeline
		if (username != app.username) {
			var user = app.users[username] || { full_name: username, nickname: username };
			var user_disp = user.full_name;
			if (!user.full_name.match(new RegExp("\\b" + escapeRegExp(user.nickname) + "\\b", "i"))) user_disp += " (" + user.nickname + ")";
			app.newLocalNotice( "<b>" + user_disp + "</b> " + data.nice_reason, { label: 'User', channel_id: chan, local: false } );
			if (app.getChannelPref(chan, 'chat_sounds') && (app.current_channel_id == chan)) app.sound.play('left');
			app.forceExpireUserTyping( username );
		}
	},
	
	server_welcome: function(data) {
		// server is welcoming us, and only us, to a new channel we just joined
		// this is the cue to setup the UI for a new channel
		// data: { channel_id, channel }
		var chan = data.channel_id;
		
		// update local channel in memory (this version contains live_users)
		if (!app.channels[chan]) app.channels[chan] = data.channel;
		else mergeHashInto( app.channels[chan], data.channel );
		
		var channel = app.channels[chan];
		
		var channel_history = channel.history || [];
		delete channel.history; // release memory
		
		if (!channel.ui) {
			channel.ui = true;
			
			// private messages: if we're the founder, auto-select the channel
			if (channel.pm) {
				if (app.pm_auto_select == chan) {
					app.sidebar.clearTypingIndicator(); // this must be done BEFORE changing app.current_channel_id
					app.current_channel_id = chan;
					delete app.pm_auto_select;
				}
				
				// adjust title, find other username
				var friend_username = '';
				for (var key in channel.users) {
					if (key != app.username) friend_username = key;
				}
				var friend = app.users[friend_username] || { nickname: friend_username, full_name: friend_username };
				
				channel.friend_username = friend_username;
				channel.custom_title = friend.full_name || friend.nickname; // for header
				channel.short_title = friend.nickname; // for sidebar
			}
			
			// add channel to sidebar, preserve sort
			app.sidebar.addChannel(chan);
			
			// add scrollarea DIV
			// <div class="scrollarea" id="sa_lobby">
			var $scrollarea = $('<div></div>')
				.prop( 'id', 'sa_' + channel.id )
				.data( 'channel', channel.id )
				.addClass( 'scrollarea' )
				.html( '<div style="height:100%"></div>' )
				.appendTo( '#d_main' )
				.on( 'mousewheel', function(event) {
					if (app.dialog.active) event.preventDefault();
				} );
			
			// add recent chat history
			if (channel_history.length) {
				
				// add link to timeline jump
				if (!channel.pm && !channel.private) {
					var msg = '<a href="#" onMouseUp="app.timeline.jumpToOldestVisible()"><i class="fa fa-history">&nbsp;</i><b>See Older</b></a>';
					
					$scrollarea.append(
						$('<div></div>').addClass('sb_chat_row_container other').data('special', 1).append(
							$('<div></div>').addClass('sb_chat_day_banner').append(
								$('<span></span>').addClass('sb_chat_day_banner_text').html( msg )
							).append(
								$('<div></div>').addClass('sb_chat_day_banner_line see_older')
							)
						)
					);
				}
				
				// add messages
				channel_history.forEach( function(chat) {
					chat.history = 1;
					app.renderChatMessage(chat);
				} );
			}
			
			// scroll to bottom
			app.scrollToBottom( chan, true );
			
			// and stick it there for first render
			channel.pinToBottom = true;
			
			// select channel if applicable
			if (app.current_channel_id == chan) {
				app.sidebar.selectChannel( chan );
			}
			
			// add new channel to prefs 'channel_order', if not already there
			// only standard channels (not PMs)
			if (!channel.pm) {
				var channel_order = app.config.get('channel_order');
				if (channel_order.indexOf(chan) == -1) {
					channel_order.push( chan );
					app.config.set('channel_order', channel_order);
				}
			}
			
		} // channel.ui
		else {
			// must be a re-login (conn flap), recover lost history here
			// FUTURE: this relies on perfect forward epoch timeflow (NTP server hiccup could break it)
			var last_timestamp = channel.last_timestamp || 0;
			
			if (channel_history.length) {
				channel_history.forEach( function(chat) {
					if (chat.date && (chat.date > last_timestamp)) {
						chat.history = 1;
						app.renderChatMessage(chat);
					}
				} );
			} // channel_history
			
			if (app.current_channel_id == chan) {
				app.sidebar.selectChannel( chan );
			}
		} // re-login
	},
	
	server_goodbye: function(data) {
		// we left a channel
		// example: {"channel_id":"lobby", "reason":"self"}
		var username = data.username;
		var chan = data.channel_id;
		var channel = app.channels[chan];
		if (!channel) return;
		
		// Update UI to reflect
		if (app.current_channel_id == chan) {
			// we left the active channel
			// try to find "nearest" channel to switch to
			var new_chan = '';
			
			var $nearest = $('#st_' + chan).prev('.sidebar_tab');
			if ($nearest.length) new_chan = $nearest.data('channel');
			else {
				$nearest = $('#st_' + chan).next('.sidebar_tab');
				if ($nearest.length) new_chan = $nearest.data('channel');
				else {
					if (channel.pm) {
						// out of other pms to switch to, so pick last real channel
						new_chan = app.config.get('last_channel') || '';
						
						// still no go?  just pick first real channel in list
						if (!new_chan) {
							$nearest = $('#sg_channels div.sidebar_tab').first();
							if ($nearest.length) new_chan = $nearest.data('channel');
						}
					}
					else {
						// out of other channels to switch to, so pick first pm
						$nearest = $('#sg_chats div.sidebar_tab').first();
						if ($nearest.length) new_chan = $nearest.data('channel');
					}
				}
			}
			
			if (new_chan) app.sidebar.selectChannel(new_chan);
			else {
				// no channel selected at all?  rejoin lobby again I guess
				app.comm.sendCommand('join', { channel_id: chan });
			}
		} // current channel
		
		// remove embeds safely (they may have timers running)
		$('#sa_' + chan).find('div.sb_chat_row_container.embed').trigger('collapse'); // custom event
		
		// kill scrollTimer if active
		if (app.scrollTimers[chan]) {
			clearTimeout( app.scrollTimers[chan] );
			delete app.scrollTimers[chan];
		}
		
		// delete channel elements
		$('#st_' + chan).remove();
		$('#sa_' + chan).remove();
		delete channel.ui;
		delete channel.live_users;
		
		// also remove channel from prefs
		app.config.set( 'channel_order', app.config.get('channel_order').filter( function(value) {
			return value != chan;
		} ) );

		// show notification if reason was 'private', 'delete', etc.
		switch (data.reason) {
			case 'private':
			case 'delete':
			case 'kick':
				app.doError("You were kicked from channel '"+chan+"'.");
			break;
		}
	},
	
	server_said: function(chat) {
		// a user has said something in a channel that we're in
		// (could be us, could be other user)
		// data: { channel_id, type, content }
		var chan = chat.channel_id;
		var channel = app.channels[chan];
		if (!channel || !channel.ui) return; // safety
		
		var user = app.users[chat.username] || { username: chat.username, nickname: chat.username };
		var is_self = (chat.username == app.username);
		
		var $scrollarea = $('#sa_' + chat.channel_id);
		if (!$scrollarea.length) return; // should never happen
		
		var $old_cont = $scrollarea.find('#' + chat.id);
		
		if (is_self && $old_cont.length) {
			// found local echo of ourself -- remove temp class
			$old_cont.find('.sb_chat_bubble.temp').removeClass('temp');
			
			// update seq_id, for things like reactions
			if (chat.seq_id) $old_cont.data('seq_id', chat.seq_id);
			
			// gotta update channel.last_timestamp tho
			var channel = app.channels[ chat.channel_id ];
			channel.last_timestamp = chat.date;
			
			return;
		}
		
		app.renderChatMessage( chat );
		app.forceExpireUserTyping( chat.username );
		
		// special handling for apps (api keys)
		// chat.username should be api key "id"
		if (chat.type == 'app') {
			user = app.api_keys[ chat.username ];
			if (!user) return;
		}
		
		if (!app.mainFocus && !is_self && chat.type.match(/^(standard|pose|code|whisper|app)$/) && !chat.hidden && !chat.replace && !app.doNotDisturb()) {
			// optionally post OS notification
			// all, highlights, pms, highlights_pms
			var is_private = !!channel.pm;
			var is_highlight = !!chat.highlight;
			
			if (app.getChannelPref(chan, 'show_notifications')) {
				var ntypes = app.prefCache.notification_type;
				var ok_notify = false;
				if (ntypes.match(/all/) || (ntypes.match(/highlights/) && is_highlight)) ok_notify = true;
				else if (ntypes.match(/all/) || (ntypes.match(/pms/) && is_private)) ok_notify = true;
				
				if (ok_notify) {
					var title = '';
					if (chat.type == 'whisper') title = user.nickname + ' whispered to you:';
					else if (is_private) title = user.nickname + ' spoke to you privately:';
					else if (chat.type == 'pose') title = user.nickname + ' posed in ' + channel.title + ':';
					else if (chat.type == 'app') {
						title = user.title + ' posted in ' + channel.title + ':';
						title = app.emoji.renderUnicodeEmoji(title, chat);
					}
					else title = user.nickname + ' spoke in ' + channel.title + ':';
					
					// prepare body
					var msg = (chat.type == 'code') ? chat.content : htmlToText(chat.content, true);
					msg = app.emoji.renderUnicodeEmoji(msg, chat);
					msg = msg.replace(/[\*\`\~]+/g, ''); // strip (some) markdown
					msg = msg.substring(0, 255);
					
					// prepare notification options
					var opts = {
						body: msg,
						silent: true
					};
					
					if (chat.type != 'app') {
						// prepare image
						opts.icon = app.getUserAvatarURL(user, 64);
					}
					
					Debug.trace('notify', "Displaying notification: " + title, opts);
					
					var myNotification = new Notification( title, opts );
					myNotification.onclick = function() {
						app.sidebar.selectChannel( chan );
					};
				} // ok_notify
			} // show_notifications
			
			// bounce dock icon?  this also increments the dock icon badge counter
			if (app.prefCache.bounce_icon) {
				var btypes = app.prefCache.bounce_type;
				var ok_bounce = false;
				if (btypes.match(/all/) || (btypes.match(/highlights/) && is_highlight)) ok_bounce = true;
				else if (btypes.match(/all/) || (btypes.match(/pms/) && is_private)) ok_bounce = true;
				
				if (ok_bounce) {
					app.sendAppCommand('bounce', {});
				}
			} // bounce_icon
			
		} // show notification
		
		if (!is_self && chat.type.match(/^(standard|pose|code|whisper|custom|app)$/) && !chat.hidden && !chat.replace) {
			// optionally increase unread count
			if ((chan != app.current_channel_id) && app.getChannelPref(chan, 'show_unread')) {
				if (!channel.unread) channel.unread = 0;
				channel.unread++;
				$('#st_' + chan).addClass('unread').find('.sidebar_channel_unread').html( Math.min(999, channel.unread) );
			}
		} // unread
	},
	
	server_user_updated: function(user) {
		// a user has been created or updated
		var username = user.username;
		
		// unindex spell check skip words
		if (app.users[username]) {
			var old_user = app.users[username];
			delete app.spell.skipWords[ username ];
			delete app.spell.skipWords[ old_user.nickname ];
			old_user.full_name.split(/\W+/).forEach( function(word) {
				if (word) delete app.spell.skipWords[ word ];
			} );
		}
		
		// could be us
		if (username == app.username) {
			for (var key in user) app.user[key] = user[key]; 
			app.sidebar.updateUserStatus();
		}
		
		if (!app.users[username]) app.users[username] = user;
		else {
			// check for notable changes that should be posted as notices
			app.detectNotifyUserChanges(app.users[username], user);
			for (var key in user) app.users[username][key] = user[key];
		}
		
		var channel = app.channels[app.current_channel_id];
		if (channel && channel.live_users && channel.live_users[username]) {
			app.sidebar.updateWhoHere();
		}
		
		// update private chat list in sidebar
		for (var chan in app.channels) {
			var channel = app.channels[chan];
			if (channel.pm && (channel.friend_username == username)) {
				channel.custom_title = user.full_name || user.nickname; // for header
				channel.short_title = user.nickname; // for sidebar
				
				$('#st_' + channel.id + ' > span').html(
					'<i class="fa fa-user">&nbsp;</i>' + 
					(channel.short_title || channel.custom_title || channel.title)
				);
				
				// if private chat is active, update title
				if (chan == app.current_channel_id) {
					app.updateHeader();
				}
				
				break;
			}
		}
		
		// re-index updated user words into spell checker
		app.spell.skipWords[ username ] = 1;
		app.spell.skipWords[ user.nickname ] = 1;
		user.full_name.split(/\W+/).forEach( function(word) {
			if (word) app.spell.skipWords[ word ] = 1;
		} );
	},
	
	server_user_deleted: function(user) {
		// a user has been deleted
		var username = user.username;
		
		// TODO: test this for race conditions first (i.e. logging out of channels, private chats, etc.)
		// delete app.users[username];
	},
	
	server_channel_updated: function(data) {
		// a channel has been updated
		var chan = data.channel_id;
		var update = data.channel;
		
		if (!app.channels[chan]) {
			app.channels[chan] = {};
		}
		var channel = app.channels[chan];
		for (var key in update) {
			channel[key] = update[key];
		}
		
		// Check for channel.deleted!
		if (channel.deleted) {
			// someone straight up deleted the channel from the server
			// we should have been sent a "goodbye" just before this, which takes care of almost everything
			Debug.trace('channel', "Channel was deleted: " + chan);
			delete app.channels[chan];
			return;
		}
		
		// check for private channel invite (this piggybacks on the channel update cmd)
		if (channel.pm) {
			// adjust title, find other username
			var friend_username = '';
			for (var key in channel.users) {
				if (key != app.username) friend_username = key;
			}
			var friend = app.users[friend_username] || { nickname: friend_username, full_name: friend_username };
			
			channel.friend_username = friend_username;
			channel.custom_title = friend.full_name || friend.nickname; // for header
			channel.short_title = friend.nickname; // for sidebar
			
			if (!channel.ui) {
				// make sure friend isn't on our ignore list
				if (app.userMatchesRegExp(friend, app.hideUsersRegExp)) {
					Debug.trace('user', "Ignoring PM request from hidden user: " + friend_username);
					delete app.channels[chan];
					delete app.pm_auto_join;
					return;
				}
				
				// join should send back a welcome, so make sure we auto-switch to the channel
				// but only if we are the founder
				if (app.username == channel.founder) app.pm_auto_select = chan;
				
				// join channel
				app.comm.sendCommand('join', { channel_id: chan });
				
				// play invite sound if we're not the founder
				if (app.username != channel.founder) {
					app.sound.play('request');
					
					if (!app.doNotDisturb()) {
						// optionally post OS notification
						// all, highlights, pms, highlights_pms
						if (app.prefCache.notification_type.match(/(all|pms)/)) {
							// prepare notification options
							var title = "Private Message Request";
							var opts = {
								body: (friend.full_name || friend_username) + ' (' + friend.nickname + ') wishes to speak with you privately.',
								silent: true,
								icon: app.getUserAvatarURL(friend, 64)
							};
							
							Debug.trace('notify', "Displaying notification: " + title, opts);
							
							var myNotification = new Notification( title, opts );
							myNotification.onclick = function() {
								app.sidebar.selectChannel( chan );
							};
						} // show_notifications
						
						// bounce dock icon?  this also increments the dock icon badge counter
						if (!app.mainFocus && app.prefCache.bounce_icon && app.prefCache.bounce_type.match(/(all|pms)/)) {
							app.sendAppCommand('bounce', {});
						} // bounce_icon
					} // show notification
				} // invite
			}
			else if (app.pm_auto_join == friend_username) {
				// rejoin existing pm channel
				app.sidebar.selectChannel( chan );
			}
			
			delete app.pm_auto_join;
		} // PM
		
		// update channel name in sidebar
		var icon_name = channel.pm ? 'user' : (channel.private ? 'lock' : 'comments');
		$('#st_' + chan + ' > span').html( 
			'<i class="fa fa-' + icon_name + '">&nbsp;</i>' + 
			(channel.short_title || channel.custom_title || channel.title)
		);
		
		if (chan == app.current_channel_id) {
			// update current title, topic
			app.updateHeader();
		}
	},
	
	server_notice: function(chat) {
		// a notice was sent from the server, display it
		// for all channels, set channel_id to '*'
		if (!chat.label) chat.label = 'Server';
		chat.local = false;
		
		if (chat.channel_id == '*') {
			for (var chan in app.channels) {
				var channel = app.channels[chan];
				if (channel.ui) {
					chat.channel_id = chan;
					app.newLocalNotice( chat.content, chat );
				}
			}
		}
		else {
			app.newLocalNotice( chat.content, chat );
		}
	},
	
	server_typing: function(data) {
		// a user is typing in a channel OMG
		// data: { channel_id, username }
		var username = data.username;
		if (username == app.username) return;
		
		var chan = data.channel_id;
		var channel = app.channels[chan];
		if (!channel || !channel.ui) return;
		if (chan != app.current_channel_id) return; // we only care about the current channel
		
		if (!channel.typing_users) channel.typing_users = {};
		if (!channel.typing_users[username]) channel.typing_users[username] = {};
		
		var tinfo = channel.typing_users[username];
		tinfo.date = timeNow();
		
		if (!tinfo.div) {
			app.notifyUserTyping( username );
		}
	},
	
	server_error: function(data) {
		// error from server, show notification
		app.doError( data.description );
	},
	
	server_avatar_changed: function(data) {
		// user has uploaded a new avatar image
		var username = data.username;
		var channel = app.channels[app.current_channel_id];
		
		if (app.users[username]) {
			app.users[username].custom_avatar = timeNow();
		}
		
		// could be us (this is just in case, as app.user SHOULD be the same as app.users[ME])
		if (username == app.username) {
			app.user.custom_avatar = timeNow();
		}
		
		if (channel && channel.live_users && channel.live_users[username]) {
			app.sidebar.updateWhoHere();
		}
		
		// FUTURE: Update all historical avatar icons in all channels?
	},
	
	server_emoji_created: function(emoji) {
		// new emoji added to server
		app.emoji.addCustomEmoji(emoji);
		app.newLocalNotice( "New Emoji Added: :" + emoji.short_name + ": <b>" + emoji.name + "</b> `:" + emoji.short_name + ":`", { label: "Emoji", local: false } );
	},
	
	server_emoji_updated: function(emoji) {
		// existing emoji updated on server
		app.emoji.updateCustomEmoji(emoji);
		app.newLocalNotice( "Emoji Updated: :" + emoji.short_name + ": <b>" + emoji.name + "</b> `:" + emoji.short_name + ":`", { label: "Emoji", local: false } );
	},
	
	server_emoji_deleted: function(emoji) {
		// emoji deleted from server
		app.emoji.deleteCustomEmoji(emoji);
		app.newLocalNotice( "Emoji Deleted: <b>" + emoji.title + "</b> `:" + emoji.id + ":`", { label: "Emoji", local: false } );
	},
	
	server_api_key_updated: function(api_key) {
		// api key created or updated on server
		app.api_keys[ api_key.id ] = api_key;
	},
	
	server_api_key_deleted: function(api_key) {
		// api key deleted on server
		delete app.api_keys[ api_key.id ];
	},
	
	server_reacted: function(data) {
		// someone reacted to a message via emoji
		// (could be us, could be some other user)
		// data: { channel_id, id, username, emoji_id, action }
		var chan = data.channel_id;
		var channel = app.channels[chan];
		if (!channel || !channel.ui) return; // safety
		
		var username = data.username;
		var user = app.users[username] || { nickname: username };
		var is_self = (username == app.username);
		
		// update local jquery data
		var $chat_cont = $('#' + data.id);
		if (!$chat_cont.length) return; // sanity
		
		var chat = $chat_cont.data();
		var action = data.action;
		var emoji_id = data.emoji_id;
		
		if (!chat.reactions) chat.reactions = {};
		var reactions = chat.reactions;
		
		if (action == 'add') {
			// add new reaction
			if (!reactions[emoji_id]) {
				reactions[emoji_id] = { users: {}, date: timeNow() };
				if (emoji_id == "+1") reactions[emoji_id].date = 1; // special case sort for upvote
				else if (emoji_id == "-1") reactions[emoji_id].date = 2; // special case sort for downvote
			}
			
			reactions[emoji_id].users[username] = 1;
			
			// special behavior for +1/-1 emoji: can only vote on one or the other
			if ((emoji_id == "+1") && reactions["-1"] && reactions["-1"].users && reactions["-1"].users[username]) {
				delete reactions["-1"].users[username];
				if (!numKeys(reactions["-1"].users)) delete reactions["-1"];
			}
			else if ((emoji_id == "-1") && reactions["+1"] && reactions["+1"].users && reactions["+1"].users[username]) {
				delete reactions["+1"].users[username];
				if (!numKeys(reactions["+1"].users)) delete reactions["+1"];
			}
		}
		else if (action == 'delete') {
			// remove reaction
			if (reactions[emoji_id] && reactions[emoji_id].users && reactions[emoji_id].users[username]) {
				// user has already reacted this emoji on this message, so toggle it back off
				delete reactions[emoji_id].users[username];
				if (!numKeys(reactions[emoji_id].users)) delete reactions[emoji_id];
			}
		}
		
		$chat_cont.data( 'reactions', chat.reactions );
		
		// always update the UI, even if self, because of multi-socket
		app.react.render( chat, true );
		
		if (!is_self) {
			// play an appropriate sound for the occasion, but only if chat is recent
			if (timeNow() - chat.date <= app.prefCache.react_sound_max_age) {
				var emoji = app.emoji.names[ emoji_id ];
				if (emoji && emoji.sound && app.getChannelPref(chan, 'emoji_sounds') && (action == 'add') && !app.prefCache.mute_emoji[emoji_id]) {
					app.sound.play('emoji/' + emoji_id);
				}
				else if (app.getChannelPref(chan, 'chat_sounds')) app.sound.play('react');
			}
			
			app.forceExpireUserTyping( username );
		}
	},
	
	server_tags_updated: function(data) {
		// chat tags have been updated in the DB (i.e. fav_USERNAME tag add/removed)
		// data: { channel_id, chat_id, seq_id, action, tags }
		app.favorites.tagsUpdated(data);
	}
	
};
