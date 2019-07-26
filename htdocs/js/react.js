// Emoji Reactions

app.react = {
	
	lastReaction: 0,
	
	toggle: function(chat_id, emoji_id) {
		// toggle specific reaction on/off
		// perform immediate local UI update, and send command to server for other users
		// Note: 'chat_id' here may be prefixed with 's', 't' or 'f'
		var $chat_cont = $('#' + chat_id);
		if (!$chat_cont.length) return; // sanity
		if (!app.emoji.names[emoji_id]) return; // sanity
		
		// only allow one reaction per user every 500ms
		var now = timeNow();
		if (now - this.lastReaction < 0.5) return;
		this.lastReaction = now;
		
		var chat = $chat_cont.data();
		var chan = chat.orig_chan || chat.channel_id;
		
		if (!chat.reactions) chat.reactions = {};
		var reactions = chat.reactions;
		
		var username = app.username;
		var action = '';
		
		if (!reactions[emoji_id]) {
			reactions[emoji_id] = { users: {}, date: now };
			if (emoji_id == "+1") reactions[emoji_id].date = 1; // special case sort for upvote
			else if (emoji_id == "-1") reactions[emoji_id].date = 2; // special case sort for downvote
		}
		if (reactions[emoji_id].users[username]) {
			// user has already reacted this emoji on this message, so toggle it back off
			delete reactions[emoji_id].users[username];
			if (!numKeys(reactions[emoji_id].users)) delete reactions[emoji_id];
			action = 'delete';
		}
		else {
			// add new reaction
			reactions[emoji_id].users[username] = 1;
			action = 'add';
			
			// special behavior for +1/-1 emoji: can only vote on one or the other
			if ((emoji_id == "+1") && reactions["-1"] && reactions["-1"].users && reactions["-1"].users[username]) {
				delete reactions["-1"].users[username];
				if (!numKeys(reactions["-1"].users)) delete reactions["-1"];
			}
			else if ((emoji_id == "-1") && reactions["+1"] && reactions["+1"].users && reactions["+1"].users[username]) {
				delete reactions["+1"].users[username];
				if (!numKeys(reactions["+1"].users)) delete reactions["+1"];
			}
			
			// check for and play emoji sound here
			var emoji = app.emoji.names[ emoji_id ];
			if (emoji && emoji.sound && app.getChannelPref(chan, 'emoji_sounds') && (action == 'add')) {
				if (!app.prefCache.mute_emoji[emoji_id]) {
					app.sound.play('emoji/' + emoji_id);
				}
			}
		} // add
		
		// update local UI
		$chat_cont.data( 'reactions', reactions );
		this.render(chat, true);
		
		// send command to server
		app.comm.sendCommand('react', {
			channel_id: chan,
			chat_id: chat.orig_id || chat_id,
			seq_id: chat.seq_id || '',
			emoji_id: emoji_id,
			action: action
		});
	},
	
	render: function(chat, ignore_history) {
		// render reactions under chat message
		var self = this;
		var $scrollarea = $('#sa_' + chat.channel_id);
		var should_scroll = (chat.history && !ignore_history) ? false : app.shouldAutoScroll( chat.channel_id );
		var html = '';
		
		var sorted_keys = Object.keys(chat.reactions || {}).sort( function(a, b) {
			return chat.reactions[a].date - chat.reactions[b].date;
		} );
		var num_reactions = sorted_keys.length;
		
		sorted_keys.forEach( function(key) {
			// foreach unique emoji
			var emoji = app.emoji.names[key];
			if (!emoji) { num_reactions--; return; } // i.e. someone reacted with custom emoji which was since deleted
			
			var reaction = chat.reactions[key];
			var usernames = Object.keys(reaction.users);
			var count = usernames.length;
			var tooltip = self.getNiceUserList(usernames, 5);
			
			if (key == "+1") tooltip += " upvoted this message.";
			else if (key == "-1") tooltip += " downvoted this message.";
			else tooltip += " reacted with " + toTitleCase(emoji.name) + " (:" + emoji.short_name + ":)";
			
			html += '<div class="sb_chat_reaction" title="' + tooltip + '" onMouseUp="app.react.toggle(\'' + chat.id + '\',\'' + key + '\')">';
			html += app.emoji.getEmojiHTML(emoji, 18, '', '', tooltip);
			html += '<span>' + commify(count) + '</span>';
			html += '</div>';
		} );
		
		var $cont = $scrollarea.find('#' + chat.id + '_react');
		if ($cont.length) {
			// special case: all reactions removed, kill container
			if (!num_reactions) {
				$cont.remove();
				return;
			}
			
			// replace existing (update reactions)
			$cont.find('div').html( html );
		}
		else if (num_reactions) {
			// create new reaction container
			$cont = $('<div></div>')
				.prop('id', chat.id + '_react')
				.addClass('sb_chat_row_container repeat other react');
			
			$cont.append( 
				$('<div></div>').addClass( 'react_' + $scrollarea.find('#' + chat.id).data('type') ).html( html ) 
			);
			
			// append after embed (if found), or parent chat cont
			$scrollarea.find('#' + chat.id + ', #' + chat.id + '_embed').last().after( $cont );
			
			// remove 'repeat' class on next chat cont, if found
			var $next = $cont.next();
			if ($next.length && $next.hasClass('repeat')) $next.removeClass('repeat');
			
			// if chat.replace, remove old _react cont
			if (chat.replace) {
				$scrollarea.find('#' + chat.replace + '_react').remove();
			}
		}
		
		if (should_scroll) app.scrollToBottom( chat.channel_id, chat.history );
	},
	
	getNiceUserList: function(usernames, max) {
		// get nice display-ready list of user nicks, formatted in english style
		if (usernames.indexOf(app.username) > -1) {
			// sort our username first
			usernames.unshift( usernames.splice( usernames.indexOf(app.username), 1 )[0] );
		}
		var nicks = usernames.map( function(username) {
			var user = app.users[username] || { nickname: username };
			return (username == app.username) ? "You" : user.nickname;
		} );
		
		if (nicks.length > max) {
			var num_extras = nicks.length - max;
			nicks.splice( max );
			nicks.push( num_extras + " " + pluralize("other", num_extras) );
		}
		
		var text = '';
		for (var idx = 0, len = nicks.length; idx < len; idx++) {
			text += nicks[idx];
			if (idx < len - 2) text += ", ";
			else if (idx < len - 1) text += " and ";
		}
		return text;
	}
	
};
