// Embedded Media

app.embed = {
	
	init: function() {
		// pre-compile regexps for speed
		var rewrites = this.rewrites;
		var wrappers = this.wrappers;
		var providers = this.providers;
		
		rewrites.forEach( function(rewrite) {
			rewrite[0] = new RegExp(rewrite[0], "i");
		} );
		
		for (var type in wrappers) {
			wrappers[type] = new RegExp( wrappers[type], "i" );
		}
		
		for (var api_url in providers) {
			providers[api_url] = providers[api_url].map( function(pat) {
				return new RegExp(pat, "i");
			});
		}
		
		// pre-load media templates (these come in as IPC message)
		this.templates = {};
	},
	
	checkEmbedMedia: function(chat, should_scroll) {
		// check chat message for supported embedded URL
		var self = this;
		var prefs = app.prefCache;
		var chan = chat.channel_id;
		var content = chat.content;
		var rewrites = this.rewrites;
		var wrappers = this.wrappers;
		var providers = this.providers;
		var urls = {};
		
		// check config for feature enabled
		if (!app.getChannelPref(chan, 'autoplay_media')) return;
		
		// do not expand embeds if user is away (any kind of away, not just DND)
		if (app.user.status) return;
		
		// Debug.trace('embed', "checkEmbedMedia: ", chat);
		
		// check config for for user mute
		var mute_user = false;
		if (prefs.mute_users) {
			var re = new RegExp(
				"\\b(" + prefs.mute_users.split(/\,\s*/).map( function(word) { return escapeRegExp(word); } ).join('|') + ")\\b", "i"
			);
			var user = app.users[ chat.username ] || { nickname: chat.username };
			if (chat.username.match(re)) mute_user = true;
			else if (user.nickname && user.nickname.match(re)) mute_user = true;
			else if (user.full_name && user.full_name.match(re)) mute_user = true;
			if (mute_user) {
				Debug.trace('embed', "User is muted, skipping embed check: " + chat.username);
				return;
			}
		}
		
		// ignore if message appears to be a bot command
		var text = htmlToText(content);
		if (text.match(/^\!\w+/)) {
			Debug.trace('embed', "Message appears to be a bot command, skipping embed check: " + text);
			return;
		}
		
		// extract all URLs from chat message
		content.replace(/\b(https?\:\/\/[^\s\'\"\)\]\<]+)/ig, function(m_all, m_g1) {
			urls[m_g1] = true;
			return '';
		});
		
		var num_urls = numKeys(urls);
		if (num_urls) Debug.trace('embed', "Found URLs: ", urls);
		
		var $scrollarea = $('#sa_' + chat.channel_id);
		
		// only process embeds with exactly one unique URL
		if (num_urls == 1) {
			var url = firstKey(urls);
			
			var eargs = {
				id: chat.id,
				url: url,
				maxwidth: Math.floor( $scrollarea[0].offsetWidth * (prefs.embed_max_width || 0.6) ),
				maxheight: Math.floor( $scrollarea[0].offsetHeight * (prefs.embed_max_height || 1.0) ),
				video_muted: app.getChannelPref(chan, 'autoplay_sounds') ? '' : 'muted="muted"',
				audio_muted: prefs['sound_muted'] ? 'muted="muted"' : '',
				audio_autoplay: app.getChannelPref(chan, 'autoplay_sounds') ? 'autoplay="autoplay"' : '',
				volume: prefs.sound_volume,
				theme: prefs.theme,
				should_scroll: should_scroll,
				class_name: ''
			};
			
			// special case for imgur: mute video by default
			// (making the assumption that NO ONE will want audio on by default for imgur video links)
			if (url.match(/imgur\.com/i)) eargs.video_muted = 'muted="muted"';
			
			// special case for twitter: remove :large so basic image embed works
			if (url.match(/twimg\.com/i)) url = url.replace(/\:large$/, '');
			
			// special case for reddit: always force white background to work on dark theme
			if (url.match(/reddit\.com/i)) eargs.class_name = 'reddit_embed';
			
			Debug.trace('embed', "eargs: ", eargs);
			
			// rewrite filters
			for (var idx = 0, len = rewrites.length; idx < len; idx++) {
				var rewrite = rewrites[idx];
				url = url.replace( rewrite[0], rewrite[1] );
			}
			eargs.url = url;
			
			// if chat is a correction, only proceed if embed url has changed
			if (chat.replace) {
				var $old_embed_cont = $scrollarea.find('#' + chat.replace + '_embed');
				if ($old_embed_cont.length && ($old_embed_cont.data('url') == url)) {
					// url has NOT changed, so just change embed ID to match new chat ID,
					// and bail out here and now
					$old_embed_cont.prop('id', chat.id + '_embed');
					return;
				}
			}
			
			// oEmbed provider check
			var provider_url = false;
			for (var api_url in providers) {
				var regs = providers[api_url];
				for (var idx = 0, len = regs.length; idx < len; idx++) {
					if (url.match( regs[idx] )) {
						provider_url = api_url;
						idx = len;
					}
				}
				if (provider_url) break;
			}
			
			if (provider_url) {
				// hit up oembed provider for content (async)
				provider_url += '?url=' + encodeURIComponent(url) + '&format=json&maxwidth=' + eargs.maxwidth + '&maxheight=' + eargs.maxheight;
				Debug.trace('embed', "oEmbed Provider API: " + provider_url);
				
				var wv_src = app.base_api_url + "/app/oembed" + composeQueryString(mergeHashes(eargs, {
					provider_url: provider_url,
					session_id: app.session_id
				}));
				// Debug.trace('embed', "Server IFRAME Wrapper URL: " + wv_src);
				
				eargs.wv_src = wv_src;
				this.insertMedia(chat, 'oembed', eargs);
				
				/*$.getJSON( provider_url, function(data) {
					Debug.trace('embed', "Got eEmbed JSON Response:", data);
					if (data && data.html) {
						eargs.oembed = data.html;
						self.insertMedia(chat, 'oembed', eargs);
					}
				} );*/
			}
			else {
				// try simple media wrapper
				var media_type = null;
				var fmt = '';
				for (var type in wrappers) {
					if (url.match(wrappers[type])) {
						media_type = type;
						fmt = RegExp.$1;
						Debug.trace('embed', "Matched wrapper: " + type);
						break;
					}
				}
				
				if (media_type) {
					eargs.fmt = fmt;
					
					// Hack: m4v is actually mp4 in disguise (thanks Apple)
					// This makes the embedded video player happy
					if (eargs.fmt == 'm4v') eargs.fmt = 'mp4';
					
					this.insertMedia(chat, media_type, eargs);
				} // found type
				else {
					Debug.trace('embed', "No providers or wrappers found for URL: " + url);
				}
			} // wrapper
		} // single url
		else {
			// zero or multiple URLs, not doing embed
			if (chat.replace) {
				$scrollarea.find('#' + chat.replace + '_embed').remove();
			}
		}
	},
	
	insertMedia: function(chat, media_type, eargs) {
		// embed webview into chat stream, just under target message container
		var $scrollarea = $('#sa_' + chat.channel_id);
		
		var data_uri = '';
		if (eargs.wv_src) data_uri = eargs.wv_src;
		else {
			// var html = substitute( this.templates[media_type], eargs );
			// data_uri = 'data:text/html,' + encodeURIComponent(html);
			return this.insertDirectMedia(chat, media_type, eargs);
		}
		
		var wv_html = '<webview src="'+data_uri+'" class="hide ' + eargs.class_name + '" preload="./js/webview.js" allowfullscreen="allowfullscreen"></webview>';
		
		Debug.trace('embed', "Inserting " + media_type + " webview for: " + chat.id + ": " + eargs.url);
		
		var $cont = $('<div></div>')
			.prop('id', chat.id + '_embed')
			.addClass('sb_chat_row_container other embed')
			.data('url', eargs.url);
			
		$cont.append( $('<div></div>').html( wv_html ) );
		$cont.append( $('<div></div>').addClass('sb_chat_row_embed_close hidden').html( '<i class="fa fa-times-circle"></i>' ) );
		
		$scrollarea.find('#' + chat.id).after( $cont );
		
		// if chat.replace, remove old _embed cont
		if (chat.replace) {
			$scrollarea.find('#' + chat.replace + '_embed').remove();
		}
		
		// add IPC listener for size changes, and other events
		var $wv = $cont.find('webview');
		var wv = $wv[0];
		var webContents = null;
		
		// now that $cont is in the dom, we can add listeners safely
		$cont.find('div.sb_chat_row_embed_close').on('mouseup', function() {
			// close 'X' button
			$cont.remove();
			$cont = null;
			$wv = null;
			wv = null;
			webContents = null;
		});
		$cont.on('collapse', function() {
			// custom event, fired by offscreen maint
			Debug.trace('embed', "Collapse custom event triggered");
			$cont.remove();
			$cont = null;
			$wv = null;
			wv = null;
			webContents = null;
		});
		
		// redirect all clicks to external browser
		var handleNewWindow = function(e, url) {
			if(url != webContents.getURL()) {
				e.preventDefault();
				electron.shell.openExternal(url);
			}
		};
		var handleNav = function(e, url) {
			if(url != webContents.getURL()) {
				e.preventDefault();
				electron.shell.openExternal(url);
				
				// Electron has NO WAY of preventing webviews from navigating, so we have to destroy the entire thing
				// (e.preventDefault() does nothing in this case, or so say the docs)
				$cont.remove();
				$cont = null;
				$wv = null;
				wv = null;
				webContents = null;
			}
		};
		
		wv.addEventListener('ipc-message', function(event) {
			Debug.trace('ipc', "Got ipc-message from webview: " + chat.id, event);
			switch (event.channel) {
				case 'wvsize':
					// Allow webviews to auto-size themselves based on their content
					var wvargs = event.args[0];
					var should_scroll = app.shouldAutoScroll( chat.channel_id );
					// var $wv = $('#wv_' + wvargs.wvid);
					// Debug.trace('ipc', "#wv_" + event.args.wvid + '.length = ' + $wv.length);
					
					$wv.removeClass('hide').css({
						width: '' + wvargs.width + 'px',
						height: '' + wvargs.height + 'px'
					});
					if (should_scroll) app.scrollToBottom( chat.channel_id );
					
					if (!webContents) {
						// can't get webContents until webview is at least partially loaded
						webContents = wv.getWebContents();
						if (webContents) {
							webContents.on('will-navigate', handleNav);
							webContents.on('new-window', handleNewWindow);
							
							// also take this opportunity to set muted
							wv.setAudioMuted( app.config.get('sound_muted') );
							
							// and also show the close 'X' button
							$cont.find('div.sb_chat_row_embed_close').removeClass('hidden');
						}
					}
				break;
				
				case 'wvwheel':
					// Allow scroll wheel to work while on top of webview (scroll main chat channel instead)
					// Here be dragons: We need to generate our own mousewheel event,
					// but point it somewhere INSIDE the channel div, but OUTSIDE any webviews (otherside it infinite loops).
					// Ugly hack alert, but I don't see any better way.
					var wevent = event.args[0];
					// var wloc = $wv.offset();
					var sloc = $scrollarea.offset();
					// app.sendAppCommand('wvwheel', wevent);
					
					wevent.type = 'mouseWheel';
					wevent.x = sloc.left + ($scrollarea.width() - 2);
					wevent.y = sloc.top + 20;
					/*wevent.x += wloc.left;
					wevent.y += wloc.top;*/
					wevent.deltaX = 0;
					wevent.deltaY = 0 - wevent.deltaY; // I have NO IDEA why this needs to be inversed.
					// wevent.modifiers = [];
					
					remote.getCurrentWebContents().sendInputEvent(wevent);
				break;
			} // switch
		});
		
		wv.addEventListener('mousewheel', function(event) {
			event.preventDefault();
			var sloc = $scrollarea.offset();
			var wevent = {};
			wevent.type = 'mouseWheel';
			wevent.x = sloc.left + ($scrollarea.width() - 2);
			wevent.y = sloc.top + 20;
			wevent.deltaX = 0;
			wevent.deltaY = 0 - event.deltaY; // I have NO IDEA why this needs to be inversed.
			Debug.trace('embed', "Simulating mouse wheel: ", wevent);
			remote.getCurrentWebContents().sendInputEvent(wevent);
		}, true); // Note: useCapture
		
		wv.addEventListener('mousedown', function(event) {
			if (event.shiftKey) {
				event.preventDefault();
				Debug.trace('webview', "Caught shift-click, destroying webview container");
				$cont.remove();
				$cont = null;
				$wv = null;
				wv = null;
				webContents = null;
			}
		}, true); // Note: useCapture
		
		wv.addEventListener('keydown', function(event) {
			event.preventDefault();
			Debug.trace('webview', "Caught keydown, redirecing to host page");
			// console.log(event);
			// app.handleKeyDown(event);
			// window.focus();
			placeCaretAtEnd( $('#d_footer_textfield')[0] );
			if (event.key && (event.keyCode >= 32) && (event.keyCode < 128)) {
				document.execCommand("insertText", false, event.key);
			}
			
		}, true); // Note: useCapture
		
		wv.addEventListener('contextmenu', function(event) {
			event.preventDefault();
			wv.href = eargs.url;
			app.popupChatMenu( chat, app.channels[chat.channel_id] || {}, event );
		}, true); // useCapture
		
		wv.addEventListener('close', function(event) {
			event.preventDefault();
			Debug.trace('webview', "Caught close, destroying webview container");
			if ($cont) {
				$cont.remove();
				$cont = null;
				$wv = null;
				wv = null;
				webContents = null;
			}
		});
		
		wv.addEventListener('console-message', function(event) {
			Debug.trace('webview', "CONSOLE LOG: " + event.message);
		});
		
		// also set shift-click toggle on our associated chat bubble that spawned us
		var $bubble = (chat.type == 'app') ? 
			$scrollarea.find('#' + chat.id + ' > fieldset.sb_chat_app') : 
			$scrollarea.find('#' + chat.id + ' > div.sb_chat_bubble');
		
		if ($bubble.length) {
			var bubble_mousedown = function(event) {
				if (event.shiftKey) {
					event.preventDefault();
					Debug.trace('embed', "Caught shift-click on bubble, toggling webview container");
					if ($cont) {
						$cont.remove();
						$cont = null;
						$wv = null;
						wv = null;
						webContents = null;
					}
					else {
						// re-embed the embed (prevent listener leak too)
						$bubble[0].removeEventListener('mousedown', bubble_mousedown, true); // Note: useCapture
						app.embed.insertMedia(chat, media_type, eargs);
					}
				} // shiftKey
			}; // function
			
			$bubble[0].addEventListener('mousedown', bubble_mousedown, true); // Note: useCapture
		}
	},
	
	changeAllWebviewSoundLevels: function() {
		// change volume and/or muted on all webviews
		var prefs = app.config.store;
		var new_muted = prefs['sound_muted'];
		
		if (app.doNotDisturb()) new_muted = true; // always muted in DND
		
		var wv_args = {
			volume: prefs.sound_volume,
			muted: new_muted
		};
		
		$('webview').each( function(idx) {
			this.send('sound_change', wv_args); // for HTML5 audio/video
			this.setAudioMuted( new_muted ); // for oEmbeds
		} );
		
		// also handle direct media (outside of webviews)
		$('div.direct_embed_container audio, div.direct_embed_container video').each( function() {
			this.volume = args.volume;
			this.muted = args.muted;
		} );
	},
	
	changeAllWebviewThemes: function() {
		// change theme in all webviews
		var new_theme = app.config.get('theme');
		
		$('webview').each( function(idx) {
			this.send('theme_change', new_theme);
		} );
	},
	
	/*setWebviewSize: function(data) {
		// this is called by ipcRenderer inside the webview code
		$('wv_' + data.wvid).removeClass('hide').css({
			width: '' + data.width + 'px',
			height: '' + data.height + 'px'
		});
	},*/
	
	insertDirectMedia: function(chat, media_type, eargs) {
		// embed direct media (image, audio, video) into chat stream, just under target message container
		var $scrollarea = $('#sa_' + chat.channel_id);
		var should_scroll = eargs.should_scroll;
		var timer = null;
		var $media = null;
		var oldSize = '0x0';
		var html = '';
		
		Debug.trace('embed', "Inserting direct " + media_type + " for: " + chat.id + ": " + eargs.url);
		
		switch (media_type) {
			case 'image':
				html += '<a href="[url]" target="_blank" draggable="false"><img src="[url]" style="max-width:[maxwidth]px; max-height:[maxheight]px;"/></a>';
			break;
			
			case 'audio':
				html += '<audio preload="auto" [audio_autoplay] [audio_muted] controls="controls" webkit-playsinline="" style="width:[maxwidth]px;"><source src="[url]" type="audio/[fmt]"></audio>';
			break;
			
			case 'video':
				html += '<video preload="auto" autoplay="autoplay" [video_muted] loop="loop" controls="controls" webkit-playsinline="" style="width:[maxwidth]px; max-height:[maxheight]px;"><source src="[url]" type="video/[fmt]"></video>';
			break;
		} // switch media_type
		
		var $cont = $('<div></div>')
			.prop('id', chat.id + '_embed')
			.addClass('sb_chat_row_container other embed')
			.data('url', eargs.url);
			
		$cont.append( $('<div></div>').addClass('direct_embed_container').html( substitute(html, eargs) ) );
		$cont.append( $('<div></div>').addClass('sb_chat_row_embed_close').html( '<i class="fa fa-times-circle"></i>' ) );
		
		$scrollarea.find('#' + chat.id).after( $cont );
		
		// if chat.replace, remove old _embed cont
		if (chat.replace) {
			$scrollarea.find('#' + chat.replace + '_embed').remove();
		}
		
		// get ref to inner media container
		$media = $cont.find('div.direct_embed_container');
		
		// special adjustments for audio/video
		if (media_type == 'audio') {
			// cannot set volume via html attribute (thanks chrome)
			$media.find('audio')[0].volume = eargs.volume;
		}
		if (media_type == 'video') {
			// cannot set volume via html attribute (thanks chrome)
			$media.find('video')[0].volume = eargs.volume;
			
			// click to toggle playback
			$media.find('video')[0].addEventListener('click', function(event) {
				if (this.paused) this.play();
				else this.pause();
			}, false);
		}
		
		// now that $cont is in the dom, we can add listeners safely
		$cont.find('div.sb_chat_row_embed_close').on('mouseup', function() {
			// close 'X' button
			if (timer) { clearTimeout(timer); timer = null; }
			$cont.remove();
			$cont = null;
			$media = null;
		});
		$cont.on('collapse', function() {
			// custom event, fired by offscreen maint
			Debug.trace('embed', "Collapse custom event triggered");
			if (timer) { clearTimeout(timer); timer = null; }
			$cont.remove();
			$cont = null;
			$media = null;
		});
		
		// handle shift-click
		$media[0].addEventListener('mousedown', function(event) {
			if (event.shiftKey) {
				event.preventDefault();
				Debug.trace('embed', "Caught shift-click, destroying embed container");
				if (timer) { clearTimeout(timer); timer = null; }
				$cont.remove();
				$cont = null;
				$media = null;
			}
		}, true); // Note: useCapture
		
		// handle right-click
		$media[0].addEventListener('contextmenu', function(event) {
			event.preventDefault();
			event.target.href = eargs.url;
			app.popupChatMenu( chat, app.channels[chat.channel_id] || {}, event );
		}, true); // useCapture
		
		// also set shift-click toggle on our associated chat bubble that spawned us
		var $bubble = (chat.type == 'app') ? 
			$scrollarea.find('#' + chat.id + ' > fieldset.sb_chat_app') : 
			$scrollarea.find('#' + chat.id + ' > div.sb_chat_bubble');
		
		if ($bubble.length) {
			var bubble_mousedown = function(event) {
				if (event.shiftKey) {
					event.preventDefault();
					Debug.trace('embed', "Caught shift-click on bubble, toggling embed container");
					if ($cont) {
						if (timer) { clearTimeout(timer); timer = null; }
						$cont.remove();
						$cont = null;
						$media = null;
					}
					else {
						// re-embed the embed (prevent listener leak too)
						$bubble[0].removeEventListener('mousedown', bubble_mousedown, true); // Note: useCapture
						eargs.should_scroll = app.shouldAutoScroll( chat.channel_id ); // recalc this
						app.embed.insertMedia(chat, media_type, eargs);
					}
				} // shiftKey
			}; // function
			
			$bubble[0].addEventListener('mousedown', bubble_mousedown, true); // Note: useCapture
		}
		
		// watch for media self-resizing itself (image loading), scroll down if applicable
		// only do this for 5 seconds
		var count = 0;
		if (should_scroll) timer = setInterval( function() {
			if (!$media) return; // sanity
			
			var size = '' + $media[0].offsetWidth + 'x' + $media[0].offsetHeight;
			if (size != oldSize) {
				Debug.trace('embed', "New media size: " + size + " (scrolling down to accomodate)");
				oldSize = size;
				app.scrollToBottom( chat.channel_id );
			}
			
			count++;
			if (count > 100) { clearTimeout( timer ); timer = null; }
		}, 50 );
	},
	
	"rewrites": [
		["^(https?\\:)\\/\\/www\\.dropbox\\.com\\/", "$1//dl.dropbox.com/"],
		["^(https?\\:)\\/\\/(imgur\\.com\\/\\w+\\.\\w+)$", "$1//i.$2"],
		["^(https?\\:\\/\\/i\\.imgur\\.com\\/\\w+)\\.gifv$", "$1.mp4"]
	],
	"wrappers": {
		"audio": "\\.(mp3|wav|aiff|aac)(\\?|$)",
		"video": "\\.(mp4|m4v|mpg|webm|ogg)(\\?|$)",
		"image": "\\.(jpg|jpeg|gif|png|apng|webp|tiff|bmp|ico)(\\?|$)"
	},
	"providers": {
		"https://www.reddit.com/oembed": [
			"^https?://reddit\\.com/.+$",
			"^https?://www\\.reddit\\.com/.+$"
		],
		"https://api.imgur.com/oembed.json": [
			"^https?://imgur\\.com/.+$"
		],
		"https://api.twitter.com/1/statuses/oembed.json": [
			"^http(?:s)?://twitter\\.com/(?:#!)?[^#?/]+/status/.+$"
		],
		"https://www.facebook.com/plugins/video/oembed.json/": [
			"^https?://www\\.facebook\\.com/.*video.*$"
		],
		"https://www.facebook.com/plugins/post/oembed.json/": [
			"^https?://www\\.facebook\\.com/.*$"
		],
		"https://speakerdeck.com/oembed.json": [
			"^http(?:s)?://speakerdeck\\.com/.+$"
		],
		"https://www.youtube.com/oembed": [
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/watch.+$",
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/v/.+$",
			"^http(?:s)?://youtu\\.be/.+$",
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/user/.+$",
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/[^#?/]+#[^#?/]+/.+$",
			"^http(?:s)?://m\\.youtube\\.com/index.+$",
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/profile.+$",
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/view_play_list.+$",
			"^http(?:s)?://(?:[-\\w]+\\.)?youtube\\.com/playlist.+$"
		],
		"http://backend.deviantart.com/oembed": [
			"^http://(?:[-\\w]+\\.)?deviantart\\.com/art/.+$",
			"^http://fav\\.me/.+$",
			"^http://sta\\.sh/.+$",
			"^http://(?:[-\\w]+\\.)?deviantart\\.com/[^#?/]+#/d.+$"
		],
		"http://www.dailymotion.com/api/oembed/": [
			"^http://[-\\w]+\\.dailymotion\\.com/.+$"
		],
		"https://www.flickr.com/services/oembed/": [
			"^https?://[-\\w]+\\.flickr\\.com/photos/.+$",
			"^https?://flic\\.kr\\.com/.+$"
		],
		"https://www.hulu.com/api/oembed.json": [
			"^http://www\\.hulu\\.com/watch/.+$"
		],
		"https://www.vimeo.com/api/oembed.json": [
			"^http(?:s)?://(?:www\\.)?vimeo\\.com/.+$",
			"^http(?:s)?://player\\.vimeo\\.com/.+$"
		],
		"http://www.yfrog.com/api/oembed": [
			"^http(?:s)?://(?:www\\.)?yfrog\\.com/.+$",
			"^http(?:s)?://(?:www\\.)?yfrog\\.us/.+$"
		],
		"https://photobucket.com/oembed": [
			"^https?://(?:[-\\w]+\\.)?photobucket\\.com/albums/.+$",
			"^https?://(?:[-\\w]+\\.)?photobucket\\.com/groups/.+$"
		],
		"https://api.instagram.com/oembed": [
			"^https?://(?:www\\.)?instagr\\.am/p/.+$",
			"^https?://(?:www\\.)?instagram\\.com/p/.+$"
		],
		"https://www.slideshare.net/api/oembed/2": [
			"^http://www\\.slideshare\\.net/.+$"
		],
		"http://skitch.com/oembed": [
			"^http(?:s)?://(?:www\\.)?skitch\\.com/.+$",
			"^http://skit\\.ch/.+$"
		],
		"https://soundcloud.com/oembed": [
			"^https://soundcloud\\.com/[^#?/]+/.+$"
		],
		"http://www.collegehumor.com/oembed.json": [
			"^http://(?:www\\.)?collegehumor\\.com/video/.+$",
			"^http://(?:www\\.)?collegehumor\\.com/video:.+$"
		],
		"http://api.smugmug.com/services/oembed/": [
			"^http(?:s)?://(?:www\\.)?smugmug\\.com/[^#?/]+/.+$"
		],
		"https://github.com/api/oembed": [
			"^http(?:s)?://gist\\.github\\.com/.+$"
		],
		"http://www.rdio.com/api/oembed": [
			"^http://(?:wwww\\.)?rdio\\.com/people/[^#?/]+/playlists/.+$",
			"^http://(?:wwww\\.)?rdio\\.com/artist/[^#?/]+/album/.+$"
		],
		"https://500px.com/photo/{1}/oembed.json": [
			"^http://500px\\.com/photo/([^#?/]+)(?:.+)?$"
		],
		"http://www.mixcloud.com/oembed/": [
			"^http://www\\.mixcloud\\.com/oembed/[^#?/]+/.+$"
		],
		"https://www.kickstarter.com/services/oembed": [
			"^https?://[-\\w]+\\.kickstarter\\.com/projects/.+$"
		],
		"http://www.screenr.com/api/oembed.json": [
			"^https?://www\\.screenr\\.com/.+$"
		],
		"http://www.funnyordie.com/oembed.json": [
			"^http://www\\.funnyordie\\.com/videos/.+$"
		],
		"http://www.ustream.tv/oembed": [
			"^http(?:s)?://(?:www\\.)?ustream\\.tv/.+$",
			"^http(?:s)?://(?:www\\.)?ustream\\.com/.+$",
			"^http://ustre\\.am/.+$"
		],
		"http://www.ted.com/talks/oembed.json": [
			"^http(?:s)?://(?:www\\.)?ted\\.com/talks/.+$",
			"^http(?:s)?://(?:www\\.)?ted\\.com/talks/lang/[^#?/]+/.+$",
			"^http(?:s)?://(?:www\\.)?ted\\.com/index\\.php/talks/.+$",
			"^http(?:s)?://(?:www\\.)?ted\\.com/index\\.php/talks/lang/[^#?/]+/.+$"
		],
		"https://embed.spotify.com/oembed/": [
			"^http(?:s)?://open\\.spotify\\.com/.+$",
			"^http(?:s)?://spoti\\.fi/.+$"
		]
	}
	
};