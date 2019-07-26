// SpeechBubble Timeline Layer

app.timeline = {
	
	first: true,
	scrollHint: 0,
	
	params: {
		channel: '',
		limit: 100,
		offset: 0
	},
	
	channel: {
		last_day_code: '',
		last_min_code: '',
		topic: ''
	},
	
	init: function() {
		// setup timeline
		var dargs = getDateArgs( timeNow() );
		
		// year
		var $yearMenu = $('#fe_timeline_year');
		$yearMenu.empty();
		
		for (var year = dargs.year - 10; year <= dargs.year; year++) {
			$yearMenu.append(
				$('<option></option>').attr('value', year).html( year )
			);
		}
		
		$yearMenu.val( dargs.yyyy );
		
		// month
		var $monthMenu = $('#fe_timeline_month');
		$monthMenu.empty();
		
		for (var mon = 1; mon <= 12; mon++) {
			var mm = mon; if (mm < 10) mm = '0' + mm;
			$monthMenu.append(
				$('<option></option>').attr('value', mm).html( month_names[mon - 1] )
			);
		}
		
		$monthMenu.val( dargs.mm );
		
		// day
		var $dayMenu = $('#fe_timeline_day');
		$dayMenu.empty();
		
		for (var mday = 1; mday <= 31; mday++) {
			var dd = mday; if (dd < 10) dd = '0' + dd;
			$dayMenu.append(
				$('<option></option>').attr('value', dd).html( dd )
			);
		}
		
		$dayMenu.val( dargs.dd );
		
		// hour
		var $hourMenu = $('#fe_timeline_hour');
		$hourMenu.empty();
		
		for (var hour = 0; hour <= 23; hour++) {
			var hh = hour; if (hh < 10) hh = '0' + hh;
			var ampm = '';
			var hour12 = '';
			
			if (hour >= 12) { ampm = 'PM'; hour12 = (hour - 12) || 12; }
			else { ampm = 'AM'; hour12 = hour || 12; }
			
			$hourMenu.append(
				$('<option></option>').attr('value', hh).html( hour12 + ' ' + ampm )
			);
		}
		
		$hourMenu.val( dargs.hh );
	},
	
	reset: function() {
		// remove everything
		$('#sa_--timeline').find('.sb_chat_row_container').remove();
		this.params.offset = 0;
		this.params.channel = '';
		delete this.params.seq_id;
		this.channel.last_day_code = '';
		this.channel.last_min_code = '';
		this.channel.topic = '';
		this.first = true;
	},
	
	populateMenus: function() {
		// setup channel, user and date menus
		if (!this.params.channel) {
			// first time visit, pre-populate things
			this.params.channel = app.config.get('last_channel') || firstKey(app.channels);
		}
		
		// channel menu
		var $channelMenu = $('#fe_timeline_channel');
		$channelMenu.empty();
		
		hashKeysToArray(app.channels).sort().forEach( function(chan) {
			var channel = app.channels[chan];
			if (!channel.private && !channel.pm) {
				$channelMenu.append(
					$('<option></option>').attr('value', chan).html( channel.title )
				);
			}
		} );
		
		$channelMenu.val( this.params.channel );
		
		// first time visit, send request
		if (this.first) this.jump();
	},
	
	jump: function() {
		// jump to channel/time specified in menus
		this.first = false;
		
		var chan = $('#fe_timeline_channel').val();
		this.params.channel = chan;
		this.params.offset = 0;
		
		var yyyy = $('#fe_timeline_year').val();
		var mm = $('#fe_timeline_month').val();
		var dd = $('#fe_timeline_day').val();
		var hh = $('#fe_timeline_hour').val();
		
		this.params.date = yyyy + '/' + mm + '/' + dd;
		this.params.hour = hh;
		delete this.params.seq_id;
		
		app.sidebar.selectTimeline();
		delete this.highlight;
		this.scrollHint = 0;
		this.send();
	},
	
	jumpToChat: function(chat) {
		// jump to specific chat by timeline_idx
		// load N records before and after, highlight and scroll to it
		this.first = false;
		
		this.params.channel = chat.orig_chan || chat.channel_id;
		this.params.offset = chat.timeline_idx - Math.floor(this.params.limit / 2);
		if (this.params.offset < 0) this.params.offset = 0;
		
		delete this.params.date;
		delete this.params.hour;
		delete this.params.seq_id;
		
		app.sidebar.selectTimeline();
		this.highlight = 't' + (chat.orig_id || chat.id);
		this.scrollHint = 0;
		this.send();
	},
	
	jumpToOldestVisible: function() {
		// jump to timeline of oldest visible chat message in current channel
		if (app.searchMode) return; // sanity
		var chan = app.current_channel_id;
		var $scrollarea = $('#sa_' + chan);
		var $all = $scrollarea.find('div.sb_chat_row_container');
		
		var $chat = null;
		var idx = 0;
		while (!$chat) {
			var $elem = $all.slice(idx, idx + 1);
			if ($elem.data('seq_id')) {
				$chat = $elem;
				break;
			}
			idx++;
			if (idx >= this.params.limit) break; // sanity
		}
		
		if ($chat) {
			var chat = $chat.data();
			this.first = false;
			
			this.params.channel = chat.channel_id;
			this.params.offset = 0;
			this.params.seq_id = chat.seq_id;
			
			delete this.params.date;
			delete this.params.hour;
			
			app.sidebar.selectTimeline();
			this.highlight = 't' + chat.id;
			this.scrollHint = 0;
			this.send();
		}
		else {
			// no chat found?  just jump to current hour
			var dargs = getDateArgs( timeNow() );
			$('#fe_timeline_channel').val( chan );
			$('#fe_timeline_year').val( dargs.yyyy );
			$('#fe_timeline_month').val( dargs.mm );
			$('#fe_timeline_day').val( dargs.dd );
			$('#fe_timeline_hour').val( dargs.hh );
			this.jump();
		}
	},
	
	older: function() {
		// prev N timeline results
		this.params.offset -= this.params.limit;
		if (this.params.offset < 0) this.params.offset = 0;
		
		delete this.params.date;
		delete this.params.hour;
		delete this.params.seq_id;
		delete this.highlight;
		
		this.scrollHint = 99999;
		this.send();
	},
	
	newer: function() {
		// next N timeline results
		this.params.offset += this.params.limit;
		
		delete this.params.date;
		delete this.params.hour;
		delete this.params.seq_id;
		delete this.highlight;
		
		this.scrollHint = 0;
		this.send();
	},
	
	send: function() {
		// send search query to server
		$('#sa_--timeline').find('.sb_chat_row_container').remove();
		
		this.channel.last_day_code = '';
		this.channel.last_min_code = '';
		
		app.api.get('app/timeline', this.params, this.receive.bind(this), this.error.bind(this) );
	},
	
	receive: function(resp) {
		// receive timeline results
		// resp: { code, records, offset, total }
		var self = this;
		var params = this.params;
		var first_chat = resp.records[0] || null;
		var msg = '';
		
		// API needs to send offset back from server
		params.offset = resp.offset;
		
		if (resp.records.length) {
			// include top notice
			if (params.offset > 0) {
				msg = '<a href="#" onMouseUp="app.timeline.older()"><b>See Older</b></a>';
				app.newLocalSpacer( { channel_id: '--timeline', special: 1 } );
				app.newLocalNotice( msg, { channel_id: '--timeline', label: "Time", special: 1 } );
				
				this.channel.last_day_code = '';
				this.channel.last_min_code = '';
			}
			else {
				msg = "Start of timeline.";
				app.newLocalSpacer( { channel_id: '--timeline', special: 1 } );
				app.newLocalNotice( msg, { channel_id: '--timeline', label: "Notice", special: 1 } );
			}
			
			// render page of timeline results
			resp.records.forEach( function(chat) {
				chat.orig_id = chat.id;
				chat.id = 't' + chat.id; // unique ID for DOM
				if (chat.replace) chat.replace = 't' + chat.replace; // unique ID for DOM
				chat.orig_chan = chat.channel_id;
				chat.channel_id = '--timeline';
				chat.local = 1;
				chat.history = 1;
				
				// if highlight, add class
				var extra_classes = '';
				if (self.highlight && (chat.id == self.highlight)) extra_classes = 'highlight flash_outside';
				
				app.renderChatMessage(chat, extra_classes);
			} );
			
			if (params.offset + params.limit < resp.total) {
				msg = '<a href="#" onMouseUp="app.timeline.newer()"><b>See Newer</b></a>';
				app.newLocalSpacer( { channel_id: '--timeline', special: 1 } );
				app.newLocalNotice( msg, { channel_id: '--timeline', label: "Time", special: 1 } );
			}
			else {
				msg = "End of timeline.";
				app.newLocalSpacer( { channel_id: '--timeline', special: 1 } );
				app.newLocalNotice( msg, { channel_id: '--timeline', label: "Notice", special: 1 } );
			}
			
			// if highlight, scroll snap to it
			var $scrollarea = $('#sa_--timeline');
			
			if (this.highlight) {
				var $highlit = $scrollarea.find('#' + this.highlight);
				var pos = $highlit.position();
				if (pos) $scrollarea.scrollTop( pos.top - Math.floor($scrollarea[0].offsetHeight * 0.25) );
			}
			else {
				$scrollarea.scrollTop( this.scrollHint );
			}
		}
		else {
			msg = "No messages found.  Please select a different date/time using the menus below.";
			// app.newLocalSpacer( { channel_id: '--timeline', special: 1 } );
			app.newLocalNotice( msg, { channel_id: '--timeline', label: "Notice", special: 1 } );
		}
		
		if (first_chat) {
			var chat = first_chat;
			var dargs = getDateArgs( chat.date );
			var channel = app.channels[ chat.orig_chan ] || { title: chat.orig_chan };
			var topic = channel.title + ' - ' + dargs.weekday + ', ' + dargs.month + ' ' + dargs.mday + ', ' + dargs.year;
			topic += ' - ' + dargs.hour12 + ' ' + dargs.ampm.toUpperCase();
			$('#s_topic').html(topic).show();
			this.channel.topic = topic;
			
			// update menus from top chat message
			$('#fe_timeline_channel').val( chat.orig_chan );
			$('#fe_timeline_year').val( dargs.yyyy );
			$('#fe_timeline_month').val( dargs.mm );
			$('#fe_timeline_day').val( dargs.dd );
			$('#fe_timeline_hour').val( dargs.hh );
		}
		else {
			$('#s_topic').hide();
		}
	},
	
	error: function(resp) {
		// server search error
		app.newLocalNotice( resp.description, { channel_id: '--timeline', label: "Error", special: 1 } );
	}
	
};
