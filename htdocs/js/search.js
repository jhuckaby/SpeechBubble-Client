// SpeechBubble Search Layer

app.search = {
	
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
		// setup search
		$('#sa_--search div.banner_text code').addClass('sb_inline');
		$('#st_--search').get(0).addEventListener('contextmenu', function(event) {
			event.preventDefault();
			app.search.popupPresetMenu();
		}, true); // useCapture
		
		$('#fe_search_channel').on('change', this.insertChannelFromMenu.bind(this));
		$('#fe_search_user').on('change', this.insertUserFromMenu.bind(this));
		$('#fe_search_date').on('change', this.insertDateFromMenu.bind(this));
	},
	
	reset: function() {
		// remove everything
		$('#sa_--search').find('.sb_chat_row_container').remove();
		this.params.offset = 0;
		this.params.query = '';
	},
	
	clear: function() {
		// clear last search result
		$('#sa_--search').find('.sb_chat_row_container').remove();
		$('#sa_--search').scrollTop( 99999 );
		this.params.offset = 0;
		this.params.query = '';
		$('#s_topic').hide();
		
		$('#sa_--search > .special_banner').show();
	},
	
	populateMenus: function() {
		// setup channel, user and date menus
		
		// channel menu
		var $channelMenu = $('#fe_search_channel');
		$channelMenu.empty();
		$channelMenu.append(
			$('<option></option>').attr('value', "").html( "Channel" )
		);
		hashKeysToArray(app.channels).sort().forEach( function(chan) {
			var channel = app.channels[chan];
			if (!channel.private && !channel.pm) {
				$channelMenu.append(
					$('<option></option>').attr('value', chan).html( channel.title )
				);
			}
		} );
		
		// user menu
		var $userMenu = $('#fe_search_user');
		$userMenu.empty();
		$userMenu.append(
			$('<option></option>').attr('value', "").html( "User" )
		);
		hashKeysToArray(app.users).sort().forEach( function(username) {
			var user = app.users[username];
			$userMenu.append(
				$('<option></option>').attr('value', username).html( user.nickname )
			);
		} );
		hashKeysToArray(app.api_keys).sort().forEach( function(key_id) {
			var api_key = app.api_keys[key_id];
			$userMenu.append(
				$('<option></option>').attr('value', key_id).html( app.emoji.renderUnicodeEmoji(api_key.title) )
			);
		} );
		
		// date menu
		var $dateMenu = $('#fe_search_date');
		$dateMenu.empty();
		$dateMenu.append(
			$('<option></option>').attr('value', "").html( "Date" )
		);
		
		var today = getDateArgs( normalizeTime(timeNow(), { hour:12, min:0, sec:0 }) );
		$dateMenu.append(
			$('<option></option>').attr('value', today.yyyy + '-' + today.mm + '-' + today.dd).html( "Today" )
		);
		
		var yesterday = getDateArgs( today.epoch - 86400 );
		$dateMenu.append(
			$('<option></option>').attr('value', yesterday.yyyy + '-' + yesterday.mm + '-' + yesterday.dd).html( "Yesterday" )
		);
		
		var week = getDateArgs( today.epoch - (86400 * today.wday) );
		$dateMenu.append(
			$('<option></option>').attr('value', '>=' + week.yyyy + '-' + week.mm + '-' + week.dd).html( "This Week" )
		);
		
		$dateMenu.append(
			$('<option></option>').attr('value', today.yyyy + '-' + today.mm).html( "This Month" )
		);
		$dateMenu.append(
			$('<option></option>').attr('value', today.yyyy).html( "This Year" )
		);
	},
	
	appendTextEntry: function(text_to_insert) {
		// append text to end of main text field entry box
		placeCaretAtEnd( $('#d_footer_textfield')[0] );
		document.execCommand("insertText", false, text_to_insert );
	},
	
	insertChannelFromMenu: function() {
		// insert channel sub-query from menu selection
		var chan = $('#fe_search_channel').val();
		$('#fe_search_channel').val('');
		if (chan) this.appendTextEntry( ' channel:' + chan );
	},
	
	insertUserFromMenu: function() {
		// insert user sub-query from menu selection
		var username = $('#fe_search_user').val();
		$('#fe_search_user').val('');
		if (username) this.appendTextEntry( ' user:' + username );
	},
	
	insertDateFromMenu: function() {
		// insert date sub-query from menu selection
		var date = $('#fe_search_date').val();
		$('#fe_search_date').val('');
		if (date) this.appendTextEntry( ' date:' + date );
	},
	
	runFromTextField: function() {
		// execute search query based on content in main text entry field
		// this assumes user is already on the search channel
		if (app.searchMode != 'search') return;
		
		var text = $('#d_footer_textfield').text().trim();
		if (!text) return;
		
		this.params.offset = 0;
		this.params.query = text;
		
		$('#s_topic').html(this.params.query).show();
		this.send();
	},
	
	run: function(text) {
		// perform search query from anywhere (i.e. header search field, menus, /search command)
		// will auto-switch to search channel as needed
		if (!text) return;
		
		this.params.offset = 0;
		this.params.query = text;
		
		app.sidebar.selectSearch();
		
		$('#i_code_toggle').removeClass('selected');
		$('#d_footer_textfield').removeClass('codelike flash').removeAttr('spellcheck');
		$('#d_footer_textfield').html('').focus().trigger('input');
		document.execCommand("insertHTML", false, text);
		
		$('#s_topic').html(this.params.query).show();
		$('#sa_--search > .special_banner').hide();
		
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
		$('#sa_--search').find('.sb_chat_row_container').remove();
		$('#sa_--search').scrollTop( 99999 );
		
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
				msg = commify(resp.total) + " messages matched your search query, " + nice_start + ' - ' + nice_end + " of which are displayed below.";
				if (params.offset + params.limit < resp.total) actions.push('<a href="#" onMouseUp="app.search.older()"><b>See Older</b></a>');
				if (params.offset > 0) actions.push('<a href="#" onMouseUp="app.search.newer()"><b>See Newer</b></a>');
				msg += "  " + actions.join(' - ');
				
				app.newLocalSpacer( { channel_id: '--search', special: 1 } );
				app.newLocalNotice( msg, { channel_id: '--search', label: "Search", special: 1 } );
				
				this.channel.last_day_code = '';
				this.channel.last_min_code = '';
			}
			
			// render page of search results
			resp.records.reverse().forEach( function(chat) {
				chat.orig_id = chat.id;
				chat.id = 's' + chat.id; // unique ID for DOM
				if (chat.replace) chat.replace = 's' + chat.replace; // unique ID for DOM
				chat.orig_chan = chat.channel_id;
				chat.channel_id = '--search';
				chat.local = 1;
				chat.history = 1;
				app.renderChatMessage(chat);
			} );
			
			// pagination notice
			if (resp.total > params.limit) {
				var nice_start = params.offset + 1;
				var nice_end = Math.min( params.offset + params.limit, resp.total );
				msg = commify(resp.total) + " messages matched your search query, " + nice_start + ' - ' + nice_end + " of which are displayed above.";
				msg += "  " + actions.join(' - ');
			}
			else if (resp.total > 1) {
				// single page
				msg = commify(resp.total) + " messages matched your search query, all of which are displayed above.";
			}
			else {
				msg = "One single message matched your search query, which is displayed above.";
			}
		}
		else {
			msg = "No messages matched your search query.";
		}
		
		app.newLocalSpacer( { channel_id: '--search', special: 1 } );
		app.newLocalNotice( msg, { channel_id: '--search', label: "Search", special: 1 } );
		$('#sa_--search').scrollTop( 99999 );
		
		this.channel.last_day_code = '';
		this.channel.last_min_code = '';
	},
	
	error: function(resp) {
		// server search error
		// app.doInlineError( resp.description );
		app.newLocalNotice( resp.description, { channel_id: '--search', label: "Error", special: 1 } );
	},
	
	popupPresetMenu: function() {
		var menu = new Menu();
		
		menu.append(new MenuItem({
			label: 'Search Presets:',
			enabled: false
		}));
		
		if (app.prefCache.highlight_words) {
			menu.append(new MenuItem({
				label: '🔍 My Highlights',
				click: function(menuItem, browserWindow, event) {
					// custom search
					app.search.run( app.prefCache.highlight_words.split(/\,\s*/).join(' | ') );
				}
			}));
		}
		
		menu.append(new MenuItem({
			label: '🔍 My Files',
			click: function(menuItem, browserWindow, event) {
				// custom search
				app.search.run( "tags:upload user:" + app.username );
			}
		}));
		
		menu.append(new MenuItem({
			label: '🔍 My Snapshots',
			click: function(menuItem, browserWindow, event) {
				// custom search
				app.search.run( "tags:snapshot user:" + app.username );
			}
		}));
		
		menu.append(new MenuItem({
			type: 'separator'
		}));
		
		menu.append(new MenuItem({
			label: '🔍 All Files',
			click: function(menuItem, browserWindow, event) {
				// custom search
				app.search.run( "tags:upload" );
			}
		}));
		
		menu.append(new MenuItem({
			label: '🔍 All Snapshots',
			click: function(menuItem, browserWindow, event) {
				// custom search
				app.search.run( "tags:snapshot" );
			}
		}));
		
		menu.popup();
	}
	
};
