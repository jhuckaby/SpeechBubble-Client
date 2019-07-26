// SpeechBubble Favorites Layer

app.favorites = {
	
	first: true,
	
	params: {
		query: '',
		limit: 100,
		offset: 0,
		sort_by: "_id",
		sort_dir: -1
	},
	
	channel: {
		last_day_code: '',
		last_min_code: ''
	},
	
	init: function() {
		// setup favs
	},
	
	reset: function() {
		// remove everything
		$('#sa_--favorites').find('.sb_chat_row_container').remove();
		this.params.offset = 0;
		this.params.query = '';
		this.first = true;
	},
	
	populateMenus: function() {
		// setup channel
		
		// first time visit, send request
		if (this.first) this.run();
	},
	
	run: function() {
		// perform search query
		var text = "tags:fav_" + crammify(app.username);
		
		this.first = false;
		this.params.offset = 0;
		this.params.query = text;
		
		app.sidebar.selectFavorites();
		$('#s_topic').hide();
		
		this.send();
	},
	
	older: function() {
		// next N search results
		this.params.offset += this.params.limit;
		this.send();
	},
	
	newer: function() {
		// prev N search results
		this.params.offset -= this.params.limit;
		this.send();
	},
	
	send: function() {
		// send search query to server
		$('#sa_--favorites').find('.sb_chat_row_container').remove();
		$('#sa_--favorites').scrollTop( 99999 );
		
		this.channel.last_day_code = '';
		this.channel.last_min_code = '';
		
		app.api.get('app/search', this.params, this.receive.bind(this), this.error.bind(this) );
	},
	
	receive: function(resp) {
		// receive search results
		var params = this.params;
		var msg = '';
		
		if (resp.records.length) {
			// include top notice if >N results
			var actions = [];
			if (resp.total > params.limit) {
				var nice_start = params.offset + 1;
				var nice_end = Math.min( params.offset + params.limit, resp.total );
				// msg = commify(resp.total) + " messages are in your favorites, " + nice_start + ' - ' + nice_end + " of which are displayed below.";
				if (params.offset + params.limit < resp.total) actions.push('<a href="#" onMouseUp="app.favorites.older()"><b>See Older</b></a>');
				if (params.offset > 0) actions.push('<a href="#" onMouseUp="app.favorites.newer()"><b>See Newer</b></a>');
				msg += "  " + actions.join(' - ');
				
				app.newLocalSpacer( { channel_id: '--favorites', special: 1 } );
				app.newLocalNotice( msg, { channel_id: '--favorites', label: "Favs", special: 1 } );
				
				this.channel.last_day_code = '';
				this.channel.last_min_code = '';
			}
			
			// render page of search results
			resp.records.reverse().forEach( function(chat) {
				chat.orig_id = chat.id;
				chat.id = 'f' + chat.id; // unique ID for DOM
				if (chat.replace) chat.replace = 'f' + chat.replace; // unique ID for DOM
				chat.orig_chan = chat.channel_id;
				chat.channel_id = '--favorites';
				chat.local = 1;
				chat.history = 1;
				app.renderChatMessage(chat);
			} );
			
			// pagination notice
			if (resp.total > params.limit) {
				var nice_start = params.offset + 1;
				var nice_end = Math.min( params.offset + params.limit, resp.total );
				// msg = commify(resp.total) + " messages are in your favorites, " + nice_start + ' - ' + nice_end + " of which are displayed above.";
				msg += "  " + actions.join(' - ');
			}
			else if (resp.total > 1) {
				// single page
				// msg = commify(resp.total) + " messages are in your favorites list, all of which are displayed above.";
			}
			else {
				// msg = "One single message is in your favorites list, which is displayed above.";
			}
		}
		else {
			// msg = "No messages are in your favorites list.";
			var html = '';
			html += '<div class="banner_title">About Favorites</div>';
			html += '<div class="banner_text">';
				html += '<p>Add any chat messages you like to your personal favorites list, which is saved on the server.</p>';
				html += '<p>To add a message, right-click on it and select <b>"Add to Favorites"</b>.</p>';
				html += '<p>To remove a message, right-click on it and select <b>"Remove from Favorites"</b>.</p>';
			html += '</div>';
			
			var $cont = $('<div></div>').addClass('sb_chat_row_container other');
			var $content = $('<div></div>').addClass('special_banner').css('margin-top', '40vh').html( html );
			$cont.append( $content );
			$('#sa_--favorites').append( $cont );
		}
		
		if (msg) {
			app.newLocalSpacer( { channel_id: '--favorites', special: 1 } );
			app.newLocalNotice( msg, { channel_id: '--favorites', label: "Favs", special: 1 } );
		}
		$('#sa_--favorites').scrollTop( 99999 );
		
		this.channel.last_day_code = '';
		this.channel.last_min_code = '';
	},
	
	error: function(resp) {
		// server search error
		// app.doInlineError( resp.description );
		app.newLocalNotice( resp.description, { channel_id: '--favorites', label: "Error", special: 1 } );
	},
	
	isFavorite: function(chat) {
		// return true if chat is currently a favorite for the current user, false otherwise
		var tag_name = 'fav_' + crammify(app.username);
		var tags = chat.tags || '';
		var regex = new RegExp( "\\b" + tag_name + "\\b" );
		return !!tags.match(regex);
	},
	
	add: function(chat_id, orig_chat) {
		// add chat to favorites
		// perform immediate local data update, and send command to server for DB update
		// Note: 'chat_id' here may be prefixed with 's', 't' or 'f'
		var tag_name = 'fav_' + crammify(app.username);
		var $chat_cont = $('#' + chat_id);
		if (!$chat_cont.length) return; // sanity
		
		var chat = $chat_cont.data();
		var chan = chat.orig_chan || chat.channel_id;
		var tags = chat.tags || '';
		
		var chat_tags = csvToHash( chat.tags || '' );
		var new_tags = csvToHash( tag_name );
		mergeHashInto( chat_tags, new_tags );
		tags = hashKeysToCSV( chat_tags );
		
		// update local data
		$chat_cont.data( 'tags', tags );
		if (orig_chat) orig_chat.tags = tags;
		
		if (chat.orig_id) {
			// user must have added to favs from search or timeline view, 
			// so try to locate actual chat in main view too
			// (this is just for the context menu really)
			var $orig_cont = $('#' + chat.orig_id);
			if ($orig_cont.length) $orig_cont.data( 'tags', tags );
		}
		
		// send tags command to server
		app.comm.sendCommand('tags', {
			channel_id: chan,
			chat_id: chat.orig_id || chat_id,
			seq_id: chat.seq_id || '',
			action: 'add',
			tags: tag_name,
			notify_user: 1
		});
	},
	
	remove: function(chat_id, orig_chat) {
		// remove chat from favorites
		// perform immediate local data update, and send command to server for DB update
		// Note: 'chat_id' here may be prefixed with 's', 't' or 'f'
		var tag_name = 'fav_' + crammify(app.username);
		var $chat_cont = $('#' + chat_id);
		if (!$chat_cont.length) return; // sanity
		
		var chat = $chat_cont.data();
		var chan = chat.orig_chan || chat.channel_id;
		var tags = chat.tags || '';
		
		var chat_tags = csvToHash( chat.tags || '' );
		delete chat_tags[ tag_name ];
		tags = hashKeysToCSV( chat_tags );
		
		// update local data
		$chat_cont.data( 'tags', tags );
		if (orig_chat) orig_chat.tags = tags;
		
		if (chat.orig_id) {
			// try to update actual chat tags in main view too
			var $orig_cont = $('#' + chat.orig_id);
			if ($orig_cont.length) $orig_cont.data( 'tags', tags );
		}
		
		// prepare command
		var cmd_data = {
			channel_id: chan,
			chat_id: chat.orig_id || chat_id,
			seq_id: chat.seq_id || '',
			action: 'remove',
			tags: tag_name
		};
		
		// If user is currently on the favorites tab, update UI directly
		// Otherwise, have server response trigger a refresh
		if (app.searchMode == 'favorites') {
			// update UI directly
			var $cont = $('<div></div>').addClass('sb_chat_row_container other notice');
			var $content = $('<div></div>').addClass('sb_chat_notice').html( "Item has been removed from your favorites." );
			$cont.append( $('<div></div>').addClass('sb_chat_row_notice fav').html( "Favs" ) );
			$cont.append( $content );
			$chat_cont.replaceWith( $cont );
		}
		else {
			// we're on a different view, so have favs update in background
			cmd_data.notify_user = 1;
		}
		
		// send tags command to server
		app.comm.sendCommand('tags', cmd_data);
	},
	
	tagsUpdated: function(data) {
		// server notification that tags (favs) were updated
		// refresh, even if we're in the background
		// but only if we've been first'ed (otherwise no need)
		if (!this.first) this.send();
	}
	
};
