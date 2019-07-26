// SpeechBubble Sidebar

app.sidebar = {
	
	dragging: false,
	
	init: function() {
		// initialize sidebar
		
		// setup sidebar drag
		$('#sidebar_drag_handle').on('mousedown', function(event) {
			app.sidebar.startDrag(event);
		});
		
		this.updateWidth();
		this.updateColor();
		
		this.inited = true;
	},
	
	onLogin: function() {
		// user has logged in (this is called only once)
		$('.sidebar_footer_status').off('mousedown').on('mousedown', function(event) {
			event.preventDefault();
			app.sidebar.popupStatusMenu(this);
		});
		
		if (!$('.sidebar_footer_status > img').length) {
			$('.sidebar_footer_status').append('<span></span><img src="images/1x1.gif" width="1" height="1" style="display:none"/>');
		}
		
		this.updateUserStatus();
	},
	
	getStatusText: function(status_emoji) {
		// get appropriate status text to accompany status emoji
		var status_text = '';
		switch (status_emoji) {
			case 'large_blue_circle': status_text = "Available"; break;
			case 'red_circle': status_text = "Away"; break;
			case 'no_entry_sign': status_text = "Do Not Disturb"; break;
			case 'clock4': status_text = "Be Right Back"; break;
			default: status_text = "Custom"; break;
		}
		return status_text;
	},
	
	updateUserStatus: function() {
		// update user status
		var status_emoji = app.user.status || 'large_blue_circle';
		var status_text = app.user.status_hint || this.getStatusText(status_emoji);
		
		$('.sidebar_footer_status > span').html( status_text );
		$('.sidebar_footer_status > img').replaceWith(
			app.emoji.getEmojiHTML( status_emoji, 23, 'emoji sidebar_footer_status_icon', app.user.emoji_skin_tone, status_text )
		);
		
		// notify node.js of our status
		app.sendAppCommand( 'user_status', { status: app.user.status } );
	},
	
	popupStatusMenu: function(elem) {
		// show status popup menu
		var $elem = $(elem);
		var html = '';
		var user_status = app.user.status || 'large_blue_circle';
		var status_hints = app.config.get('status_hints') || {};
		
		var std_statuses = [
			['large_blue_circle', "Available"],
			['red_circle', "Away"],
			['clock4', "Be Right Back"],
			['no_entry_sign', "Do Not Disturb"]
		];
		
		// standard statuses
		std_statuses.forEach( function(item) {
			var status_emoji = item[0];
			var status_text = item[1];
			var is_selected = (user_status == status_emoji);
			
			html += '<div class="status_menu_item ' + (is_selected ? 'selected' : '') + '" data-status="'+status_emoji+'">';
				html += '<div class="status_menu_item_check"><i class="fa fa-check"></i></div>';
				html += app.emoji.getEmojiHTML( status_emoji, 23, 'emoji status_menu_icon', '', status_text );
				html += '<span>' + status_text + '</span>';
			html += '</div>';
		} );
		
		// separator
		html += '<div class="status_menu_separator" style="margin-top:4px;">';
			html += '<span class="status_menu_separator_text">Custom Away</span>';
			html += '<div class="status_menu_separator_line"></div>';
		html += '</div>';
		
		// recent status emoji
		html += '<div style="width:164px; margin:5px;">';
		
		app.emoji.getSortedRecentList('recent_statuses').forEach( function(status_emoji) {
			var is_selected = (user_status == status_emoji);
			if (app.emoji.names[status_emoji]) {
				html += app.emoji.getEmojiHTML(status_emoji, 23, 'ep_emoji' + (is_selected ? ' selected' : ''), app.user.emoji_skin_tone, status_hints[status_emoji] || '');
			}
		} );
		
		if (!app.searchMode) html += '<div class="status_menu_more">More...</div>';
		html += '</div>';
		
		app.dialog.show( $elem, 'top', html );
		
		// add glow to menu under dialog
		$elem.addClass('glow');
		
		// menu state follows dialog
		app.dialog.onHide = function() { 
			$elem.removeClass('glow');
		};
		
		// add mouse events
		var $popper = $('#popper_dialog');
		
		$popper.find('div.status_menu_item').on('mouseup', function(event) {
			// click on std status item
			var new_status = $(this).data('status');
			app.dialog.hide();
			if (new_status != user_status) app.sidebar.setUserStatus( new_status );
		});
		$popper.find('img.ep_emoji').on('mouseup', function(event) {
			// click on custom emoji
			var new_status = $(this).data('emoji');
			app.dialog.hide();
			if (new_status != user_status) app.sidebar.setUserStatus( new_status );
		});
		$popper.find('div.status_menu_more').on('mouseup', function(event) {
			// click on more...
			event.preventDefault();
			app.dialog.hide();
			if (app.searchMode) return; // sanity
			app.promptEntry("/status&nbsp;", false);
			// $('#i_pick_emoji').trigger('mousedown');
			setTimeout( function() { app.emoji.showPicker(); }, 100 );
		});
	},
	
	setUserStatus: function(new_status, new_hint, quiet) {
		// set new user status
		var old_status = app.user.status;
		
		if (!new_status || (new_status == 'large_blue_circle')) new_status = '';
		if (!new_hint) new_hint = '';
		
		// clean up hint
		new_hint = new_hint.replace(/[\<\>\'\"\&\r\n]+/g, '');
		
		var is_custom_status = !!(new_status && !new_status.match(/^(red_circle|no_entry_sign|clock4)$/));
		if (is_custom_status && !quiet) {
			if (new_hint) {
				// associate status hint with this emoji for next time, save in user prefs
				app.config.set('status_hints.' + new_status, new_hint);
			}
			else {
				// no hint, see if user has a saved hint for this emoji
				new_hint = app.config.get('status_hints.' + new_status) || '';
				
				if (!new_hint) {
					// pick standard hint from emoji title, and DON'T save it in user prefs
					var emoji = app.emoji.names[new_status];
					new_hint = toTitleCase(emoji.name);
				}
			}
		}
		
		app.user.status = new_status;
		app.user.status_hint = new_hint;
		this.updateUserStatus();
		
		// send to server
		app.comm.sendCommand('status', { status: new_status, hint: new_hint, quiet: quiet || false });
		
		// update recent_statuses, but only if custom emoji was chosen
		if (is_custom_status && !quiet) {
			app.emoji.updateUserRecentList('recent_statuses', new_status, 16);
		}
		
		// special case for DND: immediately mute ALL audio
		if ((new_status == 'no_entry_sign') || (old_status == 'no_entry_sign')) {
			app.sound.notifyVolumeChanged();
			app.config.set('dnd', !!(new_status == 'no_entry_sign'));
		}
	},
	
	updateWidth: function() {
		// set sidebar width from user prefs
		setDocumentVariable('sidebar-width', app.config.get('sidebar_width') + 'px');
	},
	
	updateColor: function() {
		// set sidebar color, and make sure text is visible on it
		var color = app.config.get('sidebar_color');
		setDocumentVariable('sidebar-background-color', color);
		
		if (!color.match(/^\#?(\w{2})(\w{2})(\w{2})$/)) return;
		
		var red = parseInt(RegExp.$1, 16);
		var green = parseInt(RegExp.$2, 16);
		var blue = parseInt(RegExp.$3, 16);
		var brightness = ( (red * 299) + (green * 587) + (blue * 114) ) / 1000;
		
		$('div.sidebar').removeClass('dark light').addClass(
			(brightness < 128) ? 'light' : 'dark'
		);
	},
	
	startDrag: function(event) {
		// click in sidebar drag area, start a drag
		event.preventDefault();
		$('#sidebar_drag_handle').addClass('dragging');
		
		this.dragging = true;
		this.sd_pin_scroll = app.shouldAutoScroll();
		this.sd_origin_x = event.clientX;
		this.sd_origin_width = app.config.get('sidebar_width');
		this.sd_max_width = Math.floor( window.innerWidth / 2 );
		this.sd_current_width = this.sd_origin_width;
	},
	
	mouseMove: function(event) {
		if (this.dragging) {
			// mouse moved while drag is in effect
			var x = event.clientX;
			var width = this.sd_origin_width + (x - this.sd_origin_x);
			width = Math.max( 100, Math.min( this.sd_max_width, width ) );
			
			// sanity
			if (!width || (width < 100)) width = 200;
			
			this.sd_current_width = width;
			setDocumentVariable('sidebar-width', width + 'px');
			
			if (this.sd_pin_scroll) app.scrollToBottom(null, true);
		}
	},
	
	endDrag: function(event) {
		// complete drag operation, save new sidebar width
		if (this.dragging) {
			event.preventDefault();
			$('#sidebar_drag_handle').removeClass('dragging');
			
			app.config.set('sidebar_width', this.sd_current_width);
			this.dragging = false;
		}
	},
	
	handleWindowResize: function(event) {
		// window was resized, make sure sidebar isn't more than 50% wide now
		// var sd_origin_width = app.config.get('sidebar_width');
		var sd_width = $('.sidebar').width() + 1;
		var sd_max_width = Math.floor( window.innerWidth / 2 );
		
		// sanity
		if (!sd_max_width) sd_max_width = 500;
		
		if (sd_width > sd_max_width) {
			setDocumentVariable('sidebar-width', sd_max_width + 'px');
			app.config.set('sidebar_width', sd_max_width);
		}
	},
	
	addChannel: function(chan) {
		// add channel to sidebar, handle PMs, preserve user sorting
		var channel = app.channels[chan];
		var dest_sel = channel.pm ? '#sg_chats' : '#sg_channels';
		var icon_name = channel.pm ? 'user' : (channel.private ? 'lock' : 'comments');
		
		// sanity check
		if ($('#st_' + chan).length) {
			Debug.trace('sidebar', "Channel already added: " + chan);
			return false;
		}
		
		// add sidebar tab
		$('<div></div>')
			.prop( 'id', 'st_' + channel.id )
			.data( 'channel', channel.id )
			.addClass( 'sidebar_tab' )
			.html( '<span>' + 
				'<i class="fa fa-' + icon_name + '">&nbsp;</i>' + 
				(channel.short_title || channel.custom_title || channel.title) + 
			'</span>' )
			.attr( 'title', channel.pm ? channel.custom_title : '' )
			.append( $('<div></div>').addClass('sidebar_channel_unread') )
			.appendTo(dest_sel)
			.on('mouseup', function(event) {
				app.sidebar.selectChannel( $(this).data('channel') );
			})
			.get(0).addEventListener('contextmenu', function(event) {
				event.preventDefault();
				app.sidebar.popupChannelMenu(chan);
			}, true); // useCapture
		
		// resort all tabs based on user prefs (standard channels only)
		if (!channel.pm) {
			var channel_order = app.config.get('channel_order');
			var tabs = {};
			
			// remove all, create hash of DOM elems
			$('#sg_channels > div.sidebar_tab').detach().each( function(idx) {
				tabs[ $(this).data('channel') ] = this;
			} );
			
			// re-add known channels in sorted order
			channel_order.forEach( function(key) {
				if (tabs[key]) {
					$('#sg_channels').append( tabs[key] );
					delete tabs[key];
				}
			} );
			
			// append the rest to the bottom
			for (var key in tabs) {
				$('#sg_channels').append( tabs[key] );
			}
			
			tabs = null;
		}
		
		// enable drag-drop sorting
		DragSort.detach( dest_sel, 'div.sidebar_tab' );
		DragSort.attach( dest_sel, 'div.sidebar_tab', function($items) {
			// a drag-drop resort operation has completed, $items is new sorted list (jQuery)
			if (channel.pm) return;
			
			// update prefs: 'channel_order'
			var channel_order = [];
			$items.each( function(idx) {
				var chan = $(this).data('channel');
				channel_order.push( chan );
			} );
			app.config.set('channel_order', channel_order);
		} );
	},
	
	selectChannel: function(chan) {
		// make channel the active channel
		var channel = app.channels[chan];
		if (!channel) return;
		
		// save scroll state of previous channel (the one we're leaving)
		if (app.current_channel_id && app.channels[app.current_channel_id] && (chan != app.current_channel_id)) {
			app.channels[app.current_channel_id].pinToBottom = app.shouldAutoScroll();
		}
		
		$('.sidebar .sidebar_tab').removeClass('selected');
		$('.main .scrollarea').removeClass('active');
		
		$('#st_' + chan).addClass('selected').removeClass('unread');
		$('#sa_' + chan).addClass('active');
		
		// cleanup
		this.clearTypingIndicator();
		
		// switch master id
		app.current_channel_id = chan;
		if (!channel.pm) {
			app.config.set('last_channel', chan);
		}
		
		// was new channel pinned to bottom the last time we left?  if so, restore it now
		if (channel.pinToBottom) app.scrollToBottom(chan, true);
		
		// Who's here
		this.updateWhoHere();
		
		// header
		app.updateHeader();
		
		// reset unread count
		channel.unread = 0;
		
		// misc
		$('#i_channel_settings').show().attr('title', "Channel Settings");
		$('#sb_header_search_container').show();
		$('#d_footer_icon_container').show();
		$('#d_footer_search_container').hide();
		$('#d_footer_timeline_container').hide();
		$('#d_footer_favorites_container').hide();
		$('#d_footer_textfield_container').show().removeClass();
		
		if (app.searchMode == 'search') {
			// clear search query
			$('#i_code_toggle').removeClass('selected');
			$('#d_footer_textfield').removeClass('codelike flash').removeAttr('spellcheck');
			$('#d_footer_textfield').html('').focus().trigger('input');
		}
		app.searchMode = '';
	},
	
	selectSearch: function() {
		// select special search channel
		if (app.searchMode != 'search') {
			// save scroll state of previous channel (the one we're leaving)
			if (app.current_channel_id && app.channels[app.current_channel_id]) {
				app.channels[app.current_channel_id].pinToBottom = app.shouldAutoScroll();
			}
			
			$('.sidebar .sidebar_tab').removeClass('selected');
			$('.main .scrollarea').removeClass('active');
			
			$('#st_--search').addClass('selected');
			$('#sa_--search').addClass('active');
			
			// no one is here
			$('#sg_who').hide();
			
			// header
			$('#s_title').html( $('#st_--search').html() );
			
			if (app.search.params.query) $('#s_topic').html(app.search.params.query).show();
			else $('#s_topic').hide();
			
			// no active channel
			app.current_channel_id = '';
			app.searchMode = 'search';
			
			// misc
			$('#i_channel_settings').show().attr('title', "Search Presets");
			$('#sb_header_search_container').hide();
			$('#d_footer_icon_container').hide();
			$('#d_footer_search_container').show();
			$('#d_footer_textfield_container').show().addClass('search');
			$('#d_footer_timeline_container').hide();
			$('#d_footer_favorites_container').hide();
			
			// scroll to bottom
			if (!$('#sa_--search').find('.sb_chat_row_container').length) {
				$('#sa_--search').scrollTop( 99999 );
				app.promptEntry("", false);
				setDocumentVariable('entrybar-height', '35px');
			}
			else if (app.search.params.query) {
				app.promptEntry( app.search.params.query, false );
			}
			
			// setup menus
			app.search.populateMenus();
		}
	},
	
	selectTimeline: function() {
		// select special timeline channel
		if (app.searchMode != 'timeline') {
			// save scroll state of previous channel (the one we're leaving)
			if (app.current_channel_id && app.channels[app.current_channel_id]) {
				app.channels[app.current_channel_id].pinToBottom = app.shouldAutoScroll();
			}
			
			$('.sidebar .sidebar_tab').removeClass('selected');
			$('.main .scrollarea').removeClass('active');
			
			$('#st_--timeline').addClass('selected');
			$('#sa_--timeline').addClass('active');
			
			// no one is here
			$('#sg_who').hide();
			
			// header
			$('#s_title').html( $('#st_--timeline').html() );
			
			if (app.timeline.channel.topic) $('#s_topic').html(app.timeline.channel.topic).show();
			else $('#s_topic').hide();
			
			if (app.searchMode == 'search') {
				// clear search query
				$('#i_code_toggle').removeClass('selected');
				$('#d_footer_textfield').removeClass('codelike flash').removeAttr('spellcheck');
				$('#d_footer_textfield').html('').focus().trigger('input');
			}
			
			// no active channel
			app.current_channel_id = '';
			app.searchMode = 'timeline';
			
			// misc
			$('#i_channel_settings').hide();
			$('#d_footer_icon_container').hide();
			$('#d_footer_timeline_container').show();
			$('#d_footer_textfield_container').hide();
			$('#d_footer_search_container').hide();
			$('#d_footer_favorites_container').hide();
			
			setDocumentVariable('entrybar-height', '35px');
			
			// setup menus
			app.timeline.populateMenus();
		}
	},
	
	selectFavorites: function() {
		// select special favorites channel
		if (app.searchMode != 'favorites') {
			// save scroll state of previous channel (the one we're leaving)
			if (app.current_channel_id && app.channels[app.current_channel_id]) {
				app.channels[app.current_channel_id].pinToBottom = app.shouldAutoScroll();
			}
			
			$('.sidebar .sidebar_tab').removeClass('selected');
			$('.main .scrollarea').removeClass('active');
			
			$('#st_--favorites').addClass('selected');
			$('#sa_--favorites').addClass('active');
			
			// no one is here
			$('#sg_who').hide();
			
			// header
			$('#s_title').html( $('#st_--favorites').html() );
			$('#s_topic').hide();
			
			if (app.searchMode == 'search') {
				// clear search query
				$('#i_code_toggle').removeClass('selected');
				$('#d_footer_textfield').removeClass('codelike flash').removeAttr('spellcheck');
				$('#d_footer_textfield').html('').focus().trigger('input');
			}
			
			// no active channel
			app.current_channel_id = '';
			app.searchMode = 'favorites';
			
			// misc
			$('#i_channel_settings').hide();
			$('#d_footer_icon_container').hide();
			$('#d_footer_timeline_container').hide();
			$('#d_footer_textfield_container').hide();
			$('#d_footer_search_container').hide();
			$('#d_footer_favorites_container').show();
			
			setDocumentVariable('entrybar-height', '35px');
			
			// setup menus
			app.favorites.populateMenus();
		}
	},
	
	clearTypingIndicator: function() {
		// remove all typing indicators, as channel is about to change
		if (!app.current_channel_id) return;
		var channel = app.channels[app.current_channel_id];
		if (!channel || !channel.typing_users) return;
		
		for (var username in channel.typing_users) {
			var tinfo = channel.typing_users[username];
			if (tinfo.div) {
				tinfo.div.stop().remove();
				delete tinfo.div;
			}
		}
		
		channel.typing_users = {};
		app.updateTypingIndicatorHeight();
	},
	
	getNickFromUsername: function(username) {
		// get user nickname from username
		var user = app.users[username];
		return user ? user.nickname : "";
	},
	
	updateWhoHere: function() {
		// update 'Who's Here' list in sidebar
		var self = this;
		if (!app.current_channel_id) return;
		var channel = app.channels[app.current_channel_id];
		if (!channel) return;
		
		$('#sg_who').show();
		$('#sg_who > .sidebar_user').remove();
		
		if (channel.live_users) {
			var $sg_who = $('#sg_who');
			var sorted_users = hashKeysToArray(channel.live_users).sort( function(a, b) {
				return self.getNickFromUsername(a).localeCompare( self.getNickFromUsername(b) );
			} );
			
			sorted_users.forEach( function(username) {
				var user = app.users[username];
				if (user) {
					// <div class="sidebar_user"><div class="sidebar_avatar" style="background-image:url(images/joe.png)"></div>Joe</div>
					var avatar_url = app.getUserAvatarURL(user, 64);
					
					var classes = 'sidebar_user';
					var tooltip = user.full_name || user.nickname;
					var addons = [
						$('<div></div>').addClass('sidebar_avatar').css('background-image', 'url('+avatar_url+')')
					];
					if (user.status) {
						var status_text = user.status_hint || self.getStatusText(user.status);
						if (status_text == 'Custom') status_text = 'Away';
						tooltip += ' (' + status_text + ')';
						classes += ' status';
						addons.push(
							app.emoji.getEmojiHTML( user.status, 23, 'emoji sidebar_user_status', user.emoji_skin_tone, tooltip ) 
						);
					} // user.status
					
					$('<div></div>')
						.addClass( classes )
						.data('username', username )
						.attr( 'title', tooltip )
						.html( '<span>' + user.nickname + '</span>' )
						.append( addons )
						.appendTo( $sg_who )
						.on('mousedown', function(event) {
							// if (username != app.username) {
								event.preventDefault();
								app.sidebar.popupUserMenu(username);
							// }
						})
						.get(0).addEventListener('contextmenu', function(event) {
							event.preventDefault();
						}, true); // useCapture
						
				} // got user
			} ); // forEach
		} // live_users
	},
	
	popupUserMenu: function(username) {
		// popup contextual menu for specific user
		var user = app.users[username];
		if (!user) return; // sanity
		if (app.searchMode) return; // sanity
		
		var menu = new Menu();
		
		if (username != app.username) {
			menu.append(new MenuItem({
				label: 'Private Message...',
				click: function(menuItem, browserWindow, event) {
					// invite user to private message session
					if (username == app.username) return app.doError("You cannot private message yourself.");
					app.comm.sendCommand('pm', { username: username });
				}
			}));
		
			menu.append(new MenuItem({
				label: 'Whisper...',
				click: function(menuItem, browserWindow, event) {
					// start a whisper command
					app.promptEntry("/whisper " + user.nickname + "&nbsp;");
				}
			}));
		} // not self
		
		menu.append(new MenuItem({
			label: 'Get User Info...',
			click: function(menuItem, browserWindow, event) {
				// get user info
				app.sidebar.getUserInfo(username);
			}
		}));
		
		if (username != app.username) {
			menu.append(new MenuItem({
				type: 'separator'
			}));
			
			menu.append(new MenuItem({
				label: 'Replace Avatar...',
				click: function(menuItem, browserWindow, event) {
					// replace user avatar
					// HACK ALERT: Horrible ugly Electron hack to allow form element "click" to work from a context menu
					// See: https://github.com/electron/electron/issues/6809
					var code = 'app.sidebar.replaceUserAvatar("' + username + '");';
					electron.webFrame.executeJavaScript(code, true);
				}
			}));
			
			if (app.prefCache.user_avatars[username] != '/images/default.png') {
				menu.append(new MenuItem({
					label: 'Hide Avatar',
					click: function(menuItem, browserWindow, event) {
						// hide user avatar
						app.sidebar.hideUserAvatar(username);
					}
				}));
			}
			
			if (app.prefCache.user_avatars[username]) {
				menu.append(new MenuItem({
					label: 'Reset Avatar',
					click: function(menuItem, browserWindow, event) {
						// reset user avatar
						app.sidebar.resetUserAvatar(username);
					}
				}));
			}
			
			menu.append(new MenuItem({
				type: 'separator'
			}));
			
			menu.append(new MenuItem({
				label: 'Hide User',
				click: function(menuItem, browserWindow, event) {
					// add user to local hide list (local prefs change)
					app.commands.hide(username);
				}
			}));
			
			menu.append(new MenuItem({
				label: 'Kick User',
				click: function(menuItem, browserWindow, event) {
					// kick user from current channel
					app.comm.sendCommand('kick', { username: username, channel_id: app.current_channel_id });
				}
			}));
			
			menu.append(new MenuItem({
				label: 'Ban User',
				click: function(menuItem, browserWindow, event) {
					// ban user from server
					app.comm.sendCommand('ban', { username: username });
				}
			}));
		} // not self
		
		menu.popup();
	},
	
	popupChannelMenu: function(chan) {
		// popup contextual menu for specific channel
		if (!chan) return;
		var menu = new Menu();
		var channel = app.channels[chan] || {};
		if (app.searchMode) return; // sanity
		
		if (!channel.pm) {
			menu.append(new MenuItem({
				label: 'New Topic...',
				click: function(menuItem, browserWindow, event) {
					// start a topic command
					app.promptEntry("/topic&nbsp;");
				}
			}));
			
			if (channel.topic) {
				menu.append(new MenuItem({
					label: 'Edit Topic...',
					click: function(menuItem, browserWindow, event) {
						// start a topic command
						app.promptEntry("/topic " + channel.topic);
					}
				}));
			}
		}
		
		menu.append(new MenuItem({
			label: 'Leave Channel',
			click: function(menuItem, browserWindow, event) {
				// leave channel
				app.commands.leave(chan);
				// app.comm.sendCommand('leave', { channel_id: chan });
			}
		}));
		
		menu.popup();
	},
	
	showSelectionDialog: function(args, callback) {
		// show user or channel selection dialog
		// args: { items, elem, text, empty, renderer }
		var html = '';
		var $elem = $(args.elem);
		var max_height = window.innerHeight - 80;
		
		html += '<div style="width:200px;">';
		html += '<div class="sel_dialog_label">' + args.text + '</div>';
		html += '<div class="sel_dialog_search_container">';
			html += '<input type="text" id="fe_sel_dialog_search" class="sel_dialog_search" value=""/>';
			html += '<div class="sel_dialog_search_icon"><i class="fa fa-search"></i></div>';
		html += '</div>';
		html += '<div id="d_sel_dialog_scrollarea" class="sel_dialog_scrollarea" style="max-height:' + max_height + 'px; margin-top:7px;"></div>';
		html += '</div>';
		
		app.dialog.show( $elem, 'right', html );
		
		// add glow to menu under dialog
		$elem.addClass('glow');
		
		// menu state follows dialog
		app.dialog.onHide = function() { 
			$elem.removeClass('glow');
		};
		
		// add mouse/keyboard events
		var $popper = $('#popper_dialog');
		var $input = $('#fe_sel_dialog_search');
		var $cont = $('#d_sel_dialog_scrollarea');
		var current_items = [];
		
		var updateSelectionChoices = function() {
			// redraw choices based on text field
			var value = $input.val();
			$cont.empty();
			current_items = [];
			
			args.items.forEach( function(item) {
				var $result = args.renderer(item, value);
				if ($result) {
					current_items.push( item );
					$cont.append($result);
					$result.on('mouseup', function() {
						app.dialog.hide();
						callback( item );
					});
				}
			} );
			
			if (!current_items.length && args.empty) {
				$cont.append( args.empty );
			}
		};
		
		$input.on('keyup', function(event) {
			// refresh list on every keypress
			setTimeout( debounce(updateSelectionChoices, 100), 1 );
		});
		$input.on('keydown', function(event) {
			// capture enter key
			if (event.keyCode == 13) {
				event.preventDefault();
				if (current_items.length == 1) {
					app.dialog.hide();
					callback( current_items[0] );
				}
			}
		}).focus();
		
		// populate initial list
		updateSelectionChoices();
	},
	
	getUserInfo: function(username) {
		// fetch and display information about any user
		var self = this;
		var $elem = $('#sg_who > .sidebar_user').filter( function() {
			return $(this).data('username') == username;
		} );
		if (!$elem.length) $elem = $('#sg_who > .sidebar_group_title');
		
		app.api.post( 'app/user_info', { username: username }, 
			function(resp) {
				// got info, show it
				var user = resp.user;
				var html = '';
				var avatar_url = app.getUserAvatarURL(user, 256);
				
				html += '<div class="user_info_container">';
					html += '<div class="user_info_avatar" style="background-image:url(' + avatar_url + ')"></div>';
					html += '<div class="user_info_online">';
						if (resp.is_online) {
							html += '<div class="user_info_online_status online"><i class="fa fa-wifi">&nbsp;</i>Online</div>';
							if (resp.online_time) {
								var time_disp = getTextFromSeconds( resp.online_time, false, true );
								html += '<div class="user_info_online_time">' + time_disp + '</div>';
							}
						}
						else {
							html += '<div class="user_info_online_status">Offline</div>';
							if (resp.offline_time) {
								var time_disp = getTextFromSeconds( resp.offline_time, false, true );
								html += '<div class="user_info_online_time">' + time_disp + '</div>';
							}
						}
					html += '</div>';
					html += '<div class="user_info_main">';
						
						// username
						html += '<div class="user_info_label">Username</div>';
						html += '<div class="user_info_value">' + username + '</div>';
						
						// nickname
						html += '<div class="user_info_spacer"></div>';
						html += '<div class="user_info_label">Nickname</div>';
						html += '<div class="user_info_value">' + user.nickname + '</div>';
						
						// full name
						html += '<div class="user_info_spacer"></div>';
						html += '<div class="user_info_label">Real Name</div>';
						html += '<div class="user_info_value">' + (user.full_name || '(n/a)') + '</div>';
						
						if (user.email) {
							// email (admin only)
							html += '<div class="user_info_spacer"></div>';
							html += '<div class="user_info_label">Email Address</div>';
							html += '<div class="user_info_value">' + user.email + '</div>';
						}
						
						// channels
						// sockets (ip + ping)
						
					html += '</div>';
				html += '</div>';
				
				app.dialog.show( $elem, 'right', html );
			}
		);
	},
	
	replaceUserAvatar: function(username) {
		// upload custom avatar replacement for user
		var user = app.users[username];
		if (!user) return; // sanity
		
		app.upload.customUpload('override_avatar', {}, function(data) {
			if (!data.url) return;
			
			// don't use fully qualified url, store only uri in prefs
			var uri = data.url.replace(/^\w+\:\/\/[^\/]+/, '');
			
			app.config.set('user_avatars.' + username, uri);
			app.prefsChanged('user_avatars');
			
			// update sidebar
			var channel = app.channels[app.current_channel_id];
			if (channel && channel.live_users && channel.live_users[username]) {
				app.sidebar.updateWhoHere();
			}
			
			// notify user
			app.newLocalNotice( "<b>" + (user.full_name || username) + " (" + user.nickname + ")</b> will now be displayed using your custom uploaded avatar.</b>" );
		});
	},
	
	hideUserAvatar: function(username) {
		// hide custom avatar for user
		var user = app.users[username];
		if (!user) return; // sanity
		
		app.config.set('user_avatars.' + username, '/images/default.png');
		app.prefsChanged('user_avatars');
		
		// update sidebar
		var channel = app.channels[app.current_channel_id];
		if (channel && channel.live_users && channel.live_users[username]) {
			app.sidebar.updateWhoHere();
		}
		
		// notify user
		app.newLocalNotice( "<b>" + (user.full_name || username) + " (" + user.nickname + ")</b> will now be displayed using a generic avatar.</b>" );
	},
	
	resetUserAvatar: function(username) {
		// remove custom avatar replacement for user
		var user = app.users[username];
		if (!user) return; // sanity
		
		app.config.delete('user_avatars.' + username);
		app.prefsChanged('user_avatars');
		
		// update sidebar
		var channel = app.channels[app.current_channel_id];
		if (channel && channel.live_users && channel.live_users[username]) {
			app.sidebar.updateWhoHere();
		}
		
		// notify user
		app.newLocalNotice( "<b>" + (user.full_name || username) + " (" + user.nickname + ")</b> will now be displayed using their default avatar.</b>" );
	}
};
