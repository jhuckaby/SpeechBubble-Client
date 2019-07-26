// SpeechBubble Client App
// Extension of global `app` singleton.

app.extend({
	
	setupEntryField: function() {
		// debounce entry field measurement
		var adjustTEF_Debounce = debounce( this.adjustTEF.bind(this), 250 );
		var emojiSearch_Debounce = this.emojiSearch_Debounce = debounce( this.emoji.doAutoSearch.bind(this.emoji), 100 );
		var typing_Debounce = this.typing_Debounce = debounce( this.indicateTyping.bind(this), 500 );
		
		$('#d_footer_textfield')
			.on('focus', function() { app.tff = true; })
			.on('blur', function() { app.tff = false; })
			.on('keydown', function(event) {
				if (app.dialog.active && app.dialog.onKeyDown && event.keyCode.toString().match(/^(9|13|37|38|39|40)$/)) {
					// dialog intercepts tab, enter, arrow keys
					app.dialog.onKeyDown(event);
					return;
				}
				else if (event.keyCode == 38) {
					// up arrow
					if (event.altKey || event.shiftKey || event.metaKey || (app.searchMode == 'search')) {
						event.preventDefault();
						app.prevTextEntryHistory();
						return;
					}
					
					// possibly jump to nearest editable
					var text = $(this).text().trim();
					if (!text.match(/\S/)) {
						// whitespace or nothing, proceed
						event.preventDefault();
						var $editable = $('#sa_' + app.current_channel_id).find('> div.sb_chat_row_container.editable').last();
						if ($editable.length) {
							var bubble_class = ($editable.data('type') == 'pose') ? 'sb_chat_pose' : 'sb_chat_bubble';
							placeCaretAtEnd( $editable.find('> div.' + bubble_class) );
							app.editIgnoreKey = 38;
						}
					}
				}
				else if (event.keyCode == 40) {
					// down arrow
					if (event.altKey || event.shiftKey || event.metaKey || (app.searchMode == 'search')) {
						event.preventDefault();
						app.nextTextEntryHistory();
						return;
					}
				}
				else if (event.keyCode == 9) {
					// autocomplete or insert a real tab
					event.preventDefault();
					if (!app.tabAutoComplete() && !app.shortcutAutoComplete()) {
						document.execCommand("insertText", false, "\t");
					}
				}
				else if (event.keyCode == 32) {
					// spacebar, possibly expand user shortcuts
					app.shortcutAutoComplete();
				}
				else if ((event.keyCode == 13) && !event.shiftKey) {
					// return without modifier = send to chat
					event.preventDefault();
					app.shortcutAutoComplete();
					
					// check for command, pose, etc.
					var code_mode = $('#i_code_toggle').hasClass('selected');
					var content = $(this).html().trim();
					var text = $(this).text().trim();
					var handled = false;
					
					// super-large message?  upload as file instead
					if (code_mode) {
						if (text.length > app.server_config.max_message_content_length) {
							app.upload.uploadRawData( "\ufeff" + stripIndent(this.innerText), "paste.txt", "text/plain" );
							$(this).html('').focus().trigger('input');
							return;
						}
					}
					else {
						if (content.length > app.server_config.max_message_content_length) {
							var html_doc = '<!DOCTYPE HTML><html lang="en"><head><meta charset="utf-8"><title>Pasted content by ' + (app.user.full_name || app.username) + '</title><style>body { font-family: Helvetica, sans-serif; } p { margin:0; }</style></head><body>' + content + '</body></html>';
							app.upload.uploadRawData( html_doc, "paste.html", "text/html" );
							$(this).html('').focus().trigger('input');
							return;
						}
					}
					
					// save in history
					app.addToTextEntryHistory({ code: code_mode, html: content });
					
					// Textual carry-over: Cmd+Enter = Pose
					if (event.metaKey && !text.match(/^\/me\s+/)) text = '/me ' + text;
					
					// Plain emoji /me --> reaction
					if (text.match(/^\/me\s+(\:[\w\-\+]+\:)$/)) text = '/react ' + RegExp.$1;
					
					// upvote/downvote shortcuts
					if (text == "^^") text = "/upvote";
					else if (text == "vv") text = "/downvote";
					
					if (!code_mode && text.match(/^\/(\w+)(.*)$/)) {
						// is command
						var cmd = RegExp.$1.toLowerCase();
						text = RegExp.$2.trim();
						
						if (app.commands[cmd]) {
							app.commands[cmd]( text, this );
							handled = true;
						}
						else {
							// app.doError("Unknown command: " + cmd);
						}
					}
					else if (app.searchMode == 'search') {
						// special: send text as search query
						app.search.runFromTextField();
						handled = true;
						return; // preserve text field contents
					}
					else if (!code_mode && text.match(/^s\/(.+)\/(.+)\/?$/i)) {
						// regular expression shortcut
						app.commands.replace( text );
						handled = true;
					}
					else if (!code_mode && text.match(/^\-{2,}$/)) {
						// special case: insert spacer
						app.newChatMessage( 'spacer', '' );
						handled = true;
					}
					else if (!text.match(/\S/)) {
						// whitespace, do nothing
						handled = true;
					}
					else if ((text.length == 1) && app.single_character_append) {
						// single character auto-append to previous
						var $editable = $('#sa_' + app.current_channel_id).find('> div.sb_chat_row_container.editable').last();
						if ($editable.length && ($editable.data('type') == 'standard')) {
							
							var $bubble = $editable.find('> div.sb_chat_bubble');
							if ($bubble.length) {
								$bubble.focus();
								$bubble.append( text );
								$bubble.data('dirty', true);
								$bubble.blur();
								
								if (app.getChannelPref(app.current_channel_id, 'chat_sounds')) {
									// app.sound.play('correction');
								}
								
								handled = true;
							} // found bubble
						} // found editable
					} // single char
					
					if (!handled) {
						// standard HTML message or code
						// optionally convert to code (via markdown)
						var type = 'standard';
						var overrides = {};
						
						// automatic code syntax for obvious JSON, XML, etc.
						// var text = htmlToText(content);
						text = this.innerText;
						
						if (text.match(/^\s*(\{|<|\[)[\s\S]*(\}|\]|>)\s*$/)) {
							// auto-detect JSON or XML
							type = 'code';
							content = stripIndent( text ).trim();
							
							// detect [log][syntax] vs JSON and set plain flag for better formatting
							if (text.match(/^\[.+\]\[.+\]/)) overrides.plain = true;
						}
						else if (!code_mode && text.match(/^\s*\`{3,}([\s\S]+)$/)) {
							// Markdown-style ```fenced code block```
							type = 'code';
							content = stripIndent( RegExp.$1.replace(/(\`+)\s*$/, '') ).trim();
						}
						else if (code_mode) {
							type = 'code';
							content = stripIndent( text ).trim();
						}
						else {
							// try to strip HTML line breaks from beginning and end
							while (content.match(/^\s*<br\s*\/?>/i)) {
								content = content.replace(/^\s*<br\s*\/?>/i, '');
							}
							while (content.match(/\s*<br\s*\/?>$/i)) {
								content = content.replace(/\s*<br\s*\/?>$/i, '');
							}
						}
						$('#i_code_toggle').removeClass('selected');
						$('#d_footer_textfield').removeClass('codelike').removeAttr('spellcheck');
						
						// Code & Opt+Enter = plain monospace, no highlight
						if ((type == 'code') && event.altKey) overrides.plain = true;
						
						app.newChatMessage( type, content, overrides );
					} // standard
					
					// reset text entry field
					$(this).html('').focus().trigger('input');
				} // enter
			})
			.on('input', function() {
				// thanks Chrome (contentEditable will SCROLL the entire window, GAH!)
				document.body.scrollTop = 0;
				setTimeout( function() { document.body.scrollTop = 0; }, 1 );
				
				// auto-adjust height of text entry field if typing multi-line content
				adjustTEF_Debounce();
				
				// check for emoji search / autocomplete
				emojiSearch_Debounce();
				
				// notify server that we're typing (debounced)
				if (this.childNodes.length) {
					var text = $(this).text().trim();
					if (!text.match(/^\/$/) && !text.match(/^\/w/)) {
						app.typing = true;
						typing_Debounce();
					}
				}
			});
		
		// cleanup HTML on paste
		// $('#d_footer_textfield')[0].addEventListener( "paste", function(event) {
		window.addEventListener( "paste", function(event) {
			var code_mode = $('#i_code_toggle').hasClass('selected');
			var html = event.clipboardData.getData('text/html');
			
			if (!app.sff && !app.tff && !app.dialog.active && !app.searchMode && !window.getSelection().toString().length) {
				$('#d_footer_textfield').focus();
			}
			
			// paste image, file, etc.
			if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length) {
				var file = event.clipboardData.files[0];
				if (file.name.match(/\.(\w+)$/)) {
					var ext = RegExp.$1;
					Debug.trace('upload', "Uploading file from paste: " + file.name);
					
					ZeroUpload.upload( [file], {
						session_id: app.session_id,
						webcam: 'paste',
						ext: ext,
						orient: 1,
						convert: 1
					});
					
					event.preventDefault();
					return;
				}
			}
			
			if (html) {
				event.preventDefault();
				
				html = sanitizeHtml(html, {
					allowedTags: ["h4", "h5", "h6", "blockquote", "p", "a", "ul", "ol", "nl", "li", "b", "i", "strong", "em", "strike", "hr", "br", "div", "table", "thead", "caption", "tbody", "tr", "th", "td", "span"],
					allowedAttributes: {
						'*': [ 'href', 'style' ]
					},
					allowedStyles: {
						'*': {
							// 'font-family': [/.+/],
							// 'font-size': [/.+/],
							'font-weight': [/.+/],
							'font-style': [/.+/],
							'border': [/.+/],
							'border-top': [/.+/],
							'border-right': [/.+/],
							'border-bottom': [/.+/],
							'border-left': [/.+/],
							/*'margin': [/.+/],
							'margin-top': [/.+/],
							'margin-right': [/.+/],
							'margin-bottom': [/.+/],
							'margin-left': [/.+/],
							'padding': [/.+/],
							'padding-top': [/.+/],
							'padding-right': [/.+/],
							'padding-bottom': [/.+/],
							'padding-left': [/.+/],*/
							'text-align': [/.+/],
							'display': [/.+/],
							'vertical-align': [/.+/],
							'transform': [/.+/],
							'transform-origin': [/.+/],
							'text-transform': [/.+/],
							'text-decoration': [/.+/]
						}
					}
				}).trim();
				
				// strip all color (alas, with day/night themes we cannot preserve pasted colors)
				html = html.replace(/\b(style\s*\=\s*\")([^\"]*)(\")/ig, function(m_all, m_g1, m_g2, m_g3) {
					m_g2 = m_g2.replace(/(border\-|background\-)?color\:[^\;\"]*/ig, '');
					m_g2 = m_g2.replace(/\#\w+/g, '').replace(/(rgba?|hsla?)\([^\)]+\)/g, '');
					return m_g1 + m_g2 + m_g3;
				});
				
				if (code_mode) {
					// strip HTML in code mode
					var text = htmlToText(html);
					
					// fix line indents
					text = stripIndent(text);
					
					// tab = 4 spaces
					text = text.replace(/\t/g, "    ");
					
					// insert as text
					document.execCommand("insertText", false, text);
				}
				else {
					// insert as formatted HTML
					document.execCommand("insertHTML", false, html);
					// placeCaretAtEnd(this);
				}
				
				this.scrollTop = this.scrollHeight;
			}
			else {
				// not html, maybe text?
				var text = event.clipboardData.getData('text/plain');
				if (text) {
					if (code_mode) {
						event.preventDefault();
						
						// fix line indents
						text = stripIndent(text);
						
						// tab = 4 spaces
						text = text.replace(/\t/g, "    ");
						
						// insert as text
						document.execCommand("insertText", false, text);
					}
				}
			} // not html
		}, false ); // paste
		
		// icon actions
		$('#i_code_toggle').on('mousedown', function(event) {
			// toggle code mode on/off
			event.preventDefault();
			var $this = $(this);
			if ($this.hasClass('selected')) {
				$this.removeClass('selected');
				$('#d_footer_textfield').removeClass('codelike').removeAttr('spellcheck');
			}
			else {
				$this.addClass('selected');
				$('#d_footer_textfield').addClass('codelike').attr('spellcheck', 'false');
			}
		});
		
		$('#i_pick_emoji').on('mousedown', function(event) {
			// insert emoji into current message
			event.preventDefault();
			app.emoji.showPicker();
		});
		
		$('#i_upload_file').on('mousedown', function(event) {
			// upload file into chat
			event.preventDefault();
			app.upload.clickUpload();
		});
		
		$('#i_take_snapshot').on('mousedown', function(event) {
			// take snapshot via webcam
			event.preventDefault();
			app.upload.clickCamera();
		});
		
		$('#i_join_channel').on('mousedown', function(event) {
			// join new channel
			event.preventDefault();
			
			app.sidebar.showSelectionDialog({
				items: hashValuesToArray(app.channels).sort( function(a, b) {
					return a.title.toLowerCase().localeCompare( b.title.toLowerCase() );
				} ),
				elem: this,
				text: "Join Channel",
				empty: '<div class="sel_dialog_item check selected">No channels found.</div>',
				renderer: function(channel, value) {
					if (channel.pm) return false;
					if (!value || channel.title.toLowerCase().replace(/\W+/g, '').match( value.toLowerCase() )) {
						// render one channel
						var classes = 'sel_dialog_item check';
						var addons = [];
						
						if (channel.ui) {
							classes += ' selected';
							addons.push( '<div class="sel_dialog_item_check"><i class="fa fa-check"></i></div>' );
						}
						
						return $('<div></div>')
							.addClass( classes )
							.html( '<span>' + channel.title + '</span>' )
							.append( addons );
					}
					else return false;
				}
			},
			function(channel) {
				// channel chosen from dialog
				app.commands.join( channel.id );
			});
		});
		
		$('#i_join_private').on('mousedown', function(event) {
			event.preventDefault();
			
			// guess which users are live
			// Caveat: Must be in at least one channel with user to see them
			var all_live_users = {};
			for (var key in app.channels) {
				mergeHashInto(all_live_users, app.channels[key].live_users || {});
			}
			
			app.sidebar.showSelectionDialog({
				items: hashValuesToArray(app.users).sort( function(a, b) {
					return a.nickname.toLowerCase().localeCompare( b.nickname.toLowerCase() );
				} ),
				elem: this,
				text: "New Private Chat",
				empty: '<div class="sel_dialog_item check selected">No users found.</div>',
				renderer: function(user, value) {
					// omit ourselves
					if (user.username == app.username) return false;
					if (!all_live_users[user.username]) return false;
					
					// match on username, nickname or full name
					var user_text = [user.username, user.nickname, user.full_name].join('_');
					if (!value || user_text.toLowerCase().replace(/\W+/g, '').match( value.toLowerCase() )) {
						// render one user
						var avatar_url = app.getUserAvatarURL(user, 64);
						var classes = 'sel_dialog_item avatar';
						var tooltip = user.full_name || user.nickname;
						var addons = [
							$('<div></div>').addClass('sel_dialog_item_avatar').css('background-image', 'url('+avatar_url+')')
						];
						
						if (user.status) {
							var status_text = user.status_hint || app.sidebar.getStatusText(user.status);
							if (status_text == 'Custom') status_text = 'Away';
							tooltip += ' (' + status_text + ')';
							classes += ' status';
							addons.push(
								app.emoji.getEmojiHTML( user.status, 23, 'emoji sidebar_user_status', user.emoji_skin_tone, tooltip ) 
							);
						} // user.status
						
						return $('<div></div>')
							.addClass( classes )
							.attr( 'title', tooltip )
							.html( '<span>' + user.nickname + '</span>' )
							.append( addons );
					}
					else return false;
				}
			},
			function(user) {
				// user chosen from dialog
				app.commands.pm( user.username );
			});
		});
		
		$('#i_channel_settings').on('mousedown', function(event) {
			event.preventDefault();
			if (app.searchMode == 'search') app.search.popupPresetMenu();
			else app.showChannelSettingsDialog();
		});
		
		$('#i_ssl').on('mousedown', function(event) {
			event.preventDefault();
			app.showSSLDialog();
		});
		
		// run search from header widget
		$('#sb_header_search')
			.on('focus', function() { app.sff = true; })
			.on('blur', function() { app.sff = false; })
			.on('keydown', function(event) {
				if (event.keyCode == 13) {
					event.preventDefault();
					var query = $(this).val();
					$(this).val("").blur();
					app.sff = false;
					if (query.match(/\S/)) {
						app.search.run(query);
					}
				}
			});
		
		// add right-click support to channel name and topic in header
		$('#s_title').get(0).addEventListener('contextmenu', function(event) {
			event.preventDefault();
			app.sidebar.popupChannelMenu( app.current_channel_id );
		}, true); // useCapture
		
		$('#s_topic').get(0).addEventListener('contextmenu', function(event) {
			event.preventDefault();
			app.sidebar.popupChannelMenu( app.current_channel_id );
		}, true); // useCapture
	},
	
	prepEditable: function($cont, $content) {
		// prep editable chat element
		var is_code = !!($cont.data('type') == 'code');
		
		$cont.append( $('<div></div>')
			.addClass('sb_chat_row_delete_icon hidden')
			.attr('title', "Delete Message")
			.html( '<i class="fa fa-trash-o"></i>' )
			.on('mousedown', function(event) {
				// prevent blur firing on editable
				event.preventDefault();
			})
			.on('mouseup', function(event) {
				// user clicked on delete, simulate it
				event.preventDefault();
				$content.data('dirty', true).html('').blur();
			})
		);
		
		$content.attr('contentEditable', 'true')
			.on('focus', function() {
				// user is about to make an edit
				if (timeNow() - app.last_focus_time < 0.5) {
					// too soon after window focus, abort!
					this.blur();
					return;
				}
				
				var $this = $(this);
				var $cont = $this.parent();
				
				app.tff = true; // text field focus
				app.eff = true; // edit field focus
				
				$this.data('orig_html', $this.html());
				
				// show delete button in place of timestamp
				$cont.find('> div.sb_chat_row_delete_icon').removeClass('hidden');
				$cont.find('> div.sb_chat_row_timestamp').addClass('hidden');
			})
			.on('blur', function() {
				// element has been blurred -- check for changes
				var $this = $(this);
				var $cont = $this.parent();
				var content = $this.html().trim();
				
				app.tff = false; 
				app.eff = false;
				
				if ($this.data('dirty') && (content != $this.data('orig_html'))) {
					$this.data('dirty', false);
					
					var text = $this.text().trim();
					var type = $cont.data('type');
					var overrides = { replace: $cont.data('id') };
					
					if (!text.match(/\S/)) {
						// whitespace, delete entire chat
						content = '';
						type = 'delete';
					}
					else {
						// standard HTML message or code
						if ($cont.data('reactions')) overrides.reactions = $cont.data('reactions');
						
						// optionally convert to code (via markdown)
						text = htmlToText(content, true);
						
						if (type == 'pose') {
							// reconstruct pose text, removing old nick prefix
							overrides.pose = $cont.data('pose') || '';
							
							var re = new RegExp( '^' + escapeRegExp(app.user.nickname) + "\\s*", 'i' );
							content = text.replace(/^\:[^\:]+\:\s*/, '').replace(re, '');
						}
						else if (type == 'code') {
							type = 'code';
							content = text;
						}
						else {
							// automatic code syntax for obvious JSON, XML, etc.
							if (text.match(/^(\{|\<|\[)[\s\S]*(\}|\]|\>)$/)) {
								type = 'code';
								content = text;
								
								// detect [log][syntax] vs JSON and set plain flag for better formatting
								if (text.match(/^\[.+\]\[.+\]/)) overrides.plain = true;
							}
							else if (text.match(/^\`{3,}([\s\S]+)$/)) {
								// Markdown-style ```fenced code block```
								type = 'code';
								content = RegExp.$1.replace(/(\`+)\s*$/, '');
							}
							else if ($('#i_code_toggle').hasClass('selected')) {
								type = 'code';
								content = text;
							}
							else {
								// try to strip HTML line breaks from end
								while (content.match(/\s*<br\s*\/?>$/i)) {
									content = content.replace(/\s*<br\s*\/?>$/i, '');
								}
							}
						}
						
						if (type == 'standard') {
							// decode emoji back to text (shortnames)
							content = content.replace(/<img[^>]*?data\-emoji\=\"([\w\-\+]+)\"[^>]*>/g, ':$1:');
							
							// decode checkboxes back to GFH short codes
							content = content.replace(/<input[^>]*?checked[^>]*>/g, '[X]');
							content = content.replace(/<input[^>]*?>/g, '[ ]');
						}
					} // standard, code or pose
					
					$('#i_code_toggle').removeClass('selected');
					$('#d_footer_textfield').removeClass('codelike').removeAttr('spellcheck');
					
					app.newChatMessage( type, content, overrides );
				} // dirty
				
				$this.data('orig_html', '');
				$this.data('dirty', false);
				
				// swap back to timestamp display
				$cont.find('> div.sb_chat_row_delete_icon').addClass('hidden');
				$cont.find('> div.sb_chat_row_timestamp').removeClass('hidden');
			})
			.on('keydown', function(event) {
				// user pressed key in editable
				var $this = $(this);
				var $cont = $this.parent();
				
				if (app.dialog.active && app.dialog.onKeyDown && event.keyCode.toString().match(/^(9|13|37|38|39|40)$/)) {
					// dialog intercepts tab, enter, arrow keys
					app.dialog.onKeyDown(event);
					return;
				}
				else if ((event.keyCode == 38) && event.altKey) {
					// alt + up arrow = find nearest editable above us
					event.preventDefault();
					var $prev = findClosestSiblingWithClass($cont, 'prev', 'editable');
					if ($prev.length) {
						var bubble_class = ($prev.data('type') == 'pose') ? 'sb_chat_pose' : 'sb_chat_bubble';
						placeCaretAtEnd( $prev.find('> div.' + bubble_class) );
					}
				}
				else if ((event.keyCode == 40) && event.altKey) {
					// alt + down arrow = find nearest editable beloew us
					event.preventDefault();
					var $next = findClosestSiblingWithClass($cont, 'next', 'editable');
					if ($next.length) {
						var bubble_class = ($next.data('type') == 'pose') ? 'sb_chat_pose' : 'sb_chat_bubble';
						placeCaretAtEnd( $next.find('> div.' + bubble_class) );
					}
					else placeCaretAtEnd( $('#d_footer_textfield')[0] );
				}
				else if (event.keyCode == 9) {
					// autocomplete or insert a real tab
					event.preventDefault();
					if (!app.tabAutoComplete() && !app.shortcutAutoComplete()) {
						document.execCommand("insertText", false, "\t");
					}
				}
				else if (event.keyCode == 32) {
					// spacebar, possibly expand user shortcuts
					app.shortcutAutoComplete();
				}
				else if ((event.keyCode == 13) && !event.shiftKey) {
					// return without modifier = send to chat
					event.preventDefault();
					app.shortcutAutoComplete();
					this.blur();
				} // enter key
				else if (event.keyCode == 27) {
					// esc key = revert changes to original, blur
					event.preventDefault();
					
					var $this = $(this);
					if ($this.data('dirty')) {
						$this.html( $this.data('orig_html') );
					}
					$this.data('dirty', false);
					this.blur();
					
					if (app.dialog.active) app.dialog.hide();
				} // esc key
			})
			.on('keyup', function(event) {
				// user released key in editable
				var $this = $(this);
				var $cont = $this.parent();
				if (app.dialog.active || event.altKey) return;
				
				if (app.editIgnoreKey && (app.editIgnoreKey == event.keyCode)) {
					event.preventDefault();
					delete app.editIgnoreKey;
					return;
				}
				
				if ((event.keyCode == 38) && isCaretAtStart(this)) {
					// up arrow released and caret is at start, so jump to prev editable
					event.preventDefault();
					var $prev = findClosestSiblingWithClass($cont, 'prev', 'editable');
					if ($prev.length) {
						var bubble_class = ($prev.data('type') == 'pose') ? 'sb_chat_pose' : 'sb_chat_bubble';
						placeCaretAtEnd( $prev.find('> div.' + bubble_class) );
					}
				}
				else if ((event.keyCode == 40) && isCaretAtEnd(this)) {
					// down arrow released and caret is at end, so jump to next editable
					event.preventDefault();
					var $next = findClosestSiblingWithClass($cont, 'next', 'editable');
					if ($next.length) {
						var bubble_class = ($next.data('type') == 'pose') ? 'sb_chat_pose' : 'sb_chat_bubble';
						placeCaretAtEnd( $next.find('> div.' + bubble_class) );
					}
					else placeCaretAtEnd( $('#d_footer_textfield')[0] );
				}
			})
			.on('input', function() {
				// user typed text, mark as dirty
				if (!is_code) app.emojiSearch_Debounce();
				$(this).data('dirty', true);
				
				// notify server that we're typing (debounced)
				app.typing = true;
				app.typing_Debounce();
			});
	},
	
	adjustTEF: function() {
		// adjust TEF (Text Entry Field) height for contentEditable height
		// should be debounced to 250ms or so, for keeping CPU usage low while typing
		if (!app.current_channel_id) return;
		
		if (!this.measure_div) {
			this.measure_div = $('<div></div>').addClass('tef-measure').appendTo('body');
		}
		var $tef = $('#d_footer_textfield');
		this.measure_div.css('width', $tef.width() ).html( $tef.html() );
		
		// console.log("Height: " + this.measure_div.height() + ", OffsetHeight: " + this.measure_div[0].offsetHeight);
		var height = Math.min( 300, Math.max( 35, this.measure_div[0].offsetHeight ) );
		
		// only pop scroll to bottom if we are already "near" it
		var should_scroll = this.shouldAutoScroll();
		
		setDocumentVariable('entrybar-height', height + 'px');
		
		if (should_scroll) this.scrollToBottom(null, true);
	},
	
	indicateTyping: function() {
		// indicate to server that we're typing in a channel
		// should be debounced to 500ms or so
		if (this.typing && app.current_channel_id) {
			app.comm.sendCommand('typing', { channel_id: app.current_channel_id });
			this.typing = false;
		}
	},
	
	newChatMessage: function(type, content, overrides) {
		// create new chat message in current channel, add placeholder to dom and send to server
		var chat = mergeHashes({
			id: generateUniqueID(32, app.username),
			username: app.username,
			channel_id: app.current_channel_id,
			date: timeNow(),
			type: type || 'standard',
			content: content
		}, overrides || {});
		
		// auto-restore user status if applicable
		if (this.auto_back && this.user.status && !this.user.status.match(this.auto_back_exclude) && (chat.type != 'whisper')) {
			this.sidebar.setUserStatus();
		}
		
		// send to server
		this.comm.sendCommand('say', chat);
		
		// local echo (server sync won't dupe, due to id matching)
		this.renderChatMessage(chat, 'temp');
		
		// we are no longer typing (avoid debounced ghost typing event)
		this.typing = false;
	},
	
	newLocalNotice: function(content, overrides) {
		// post local system notice (do not send to server)
		var chat = mergeHashes({
			id: generateUniqueID(32, app.username),
			username: app.username, // for emoji skin tone
			channel_id: app.current_channel_id,
			date: timeNow(),
			type: 'notice',
			content: content,
			label: "Local",
			local: true
		}, overrides || {});
		
		if (!chat.channel_id) return false;
		this.renderChatMessage( chat );
	},
	
	newLocalSpacer: function(overrides) {
		// post local spacer (do not send to server)
		var chat = mergeHashes({
			id: generateUniqueID(32, app.username),
			username: app.username,
			channel_id: app.current_channel_id,
			date: timeNow(),
			type: 'spacer',
			content: '',
			local: true
		}, overrides || {});
		
		if (!chat.channel_id) return false;
		this.renderChatMessage( chat );
	},
	
	newProgressBar: function(counter, caption, overrides) {
		// post local system notice (do not send to server)
		if (!app.current_channel_id) return false;
		var chat = {
			id: generateUniqueID(32, app.username),
			username: '',
			channel_id: app.current_channel_id,
			date: 0,
			type: 'progress',
			counter: counter,
			caption: caption
		};
		this.renderChatMessage( mergeHashes(chat, overrides || {}) );
		
		return chat.id;
	},
	
	updateProgressBar: function(id, counter, caption) {
		// update progress bar width and/or counter
		var $cont = $('#' + id);
		if ($cont.length) {
			var $prog_cont = $cont.find('> div.sb_chat_progress > div.progress_bar_container');
			var counter = counter || 0;
			var max_width = $cont.data('width') || 200; // chat.width
			var cx = Math.floor( counter * max_width );
			
			if ((counter == 1.0) && !$prog_cont.hasClass('indeterminate')) $prog_cont.addClass('indeterminate');
			else if ((counter < 1.0) && $prog_cont.hasClass('indeterminate')) $prog_cont.removeClass('indeterminate');
			
			$prog_cont.find('> div.progress_bar_inner').css('width', '' + cx + 'px');
			if (caption) $cont.find('div.progress_bar_caption').html(caption);
		}
	},
	
	deleteProgressBar: function(id) {
		// remove progress bar
		var $cont = $('#' + id);
		if ($cont.length) {
	 		// $cont.hide( 250, function() { $(this).remove(); } );
	 		$cont.animate( { height: 0, marginTop: 0, marginBottom: 0 }, 250, 'easeOutQuart', function() { $(this).remove(); } );
		}
	},
	
	renderChatMessage: function(chat, extra_classes) {
		// send chat to any channel
		// chat requires: id, channel_id, type
		// usually also required: username, content, date
		if (!extra_classes) extra_classes = '';
		var self = this;
		var is_self = (chat.username == app.username);
		var user = app.users[ chat.username ] || { username: chat.username, nickname: chat.username, modified: 0 };
		var avatar_url = app.getUserAvatarURL(user, 64);
		
		var channel = app.channels[ chat.channel_id ];
		var ok_sound = app.getChannelPref(chat.channel_id, 'chat_sounds');
		if (app.mainFocus && app.prefCache.mute_chat_sounds_in_focus) ok_sound = false;
		
		var $scrollarea = $('#sa_' + chat.channel_id);
		var $cont = null;
		var $content = null;
		
		if (!channel && (chat.channel_id == '--search')) {
			channel = app.search.channel;
		}
		else if (!channel && (chat.channel_id == '--timeline')) {
			channel = app.timeline.channel;
		}
		else if (!channel && (chat.channel_id == '--favorites')) {
			channel = app.favorites.channel;
		}
		
		if (!channel || !$scrollarea.length) {
			Debug.trace('display', "Channel not in UI yet, skipping message", chat);
			return;
		}
		
		if (!chat.type) chat.type = 'standard';
		
		// special handling for apps (api keys)
		// chat.username should be api key "id"
		if (chat.type == 'app') {
			user = app.api_keys[ chat.username ];
			if (!user) {
				Debug.trace('display', "API key not found, skipping message", chat);
				return;
			}
		}
		
		// optionally hide general notices
		if ((chat.type == 'notice') && !chat.local && !app.getChannelPref(chat.channel_id, 'show_general')) {
			Debug.trace('display', "Skipping hidden notice", chat);
			return;
		}
		
		// make sure user isn't completely hidden
		if (!is_self && chat.type.match(/^(standard|pose|code|spacer|delete|custom|whisper|app)$/) && this.userMatchesRegExp(user, this.hideUsersRegExp)) {
			Debug.trace('display', "Skipping hidden user", chat);
			chat.hidden = true;
			return;
		}
		
		// prepare for timestamp / day banner
		if (!channel.last_day_code) channel.last_day_code = '';
		if (!channel.last_min_code) channel.last_min_code = '';
		
		var dargs = getDateArgs( chat.date || 0 );
		var day_code = dargs.yyyy_mm_dd;
		var min_code = dargs.yyyy_mm_dd + '/' + dargs.hh + '/' + dargs.mi;
		var is_new_day = (chat.date && (day_code != channel.last_day_code));
		var is_repeat_timestamp = (min_code == channel.last_min_code);
		var extra_ts_classes = is_repeat_timestamp ? 'repeat' : '';
		if (chat.replace) extra_ts_classes = '';
		
		if (chat.date && !chat.replace && !chat.special) {
			channel.last_day_code = day_code;
		}
		if (chat.date && !chat.replace && !chat.special && chat.type.match(/^(standard|pose|code|app|notice)$/)) {
			channel.last_min_code = min_code;
		}
		if (chat.date && (!channel.last_timestamp || (chat.date > channel.last_timestamp))) {
			channel.last_timestamp = chat.date;
		}
		
		var fmt_day_banner = dargs.weekday + ", " + dargs.month + " " + dargs.mday + ", " + dargs.yyyy;
		var fmt_timestamp = '' + dargs.hour12 + ':' + dargs.mi + dargs.ampm;
		var fmt_date_time = dargs.yyyy_mm_dd + ", " + dargs.hour12 + ':' + dargs.mi + ':' + dargs.ss + ' ' + dargs.ampm.toUpperCase();
		
		if (chat.type == 'delete') {
			// delete becomes a local notice
			chat.type = 'notice';
			chat.label = 'Notice';
			chat.content = "Chat message deleted by <b>" + user.nickname + "</b>.";
			
			// delete associated embeds and reactions, if present
			$('#' + chat.replace + '_embed').remove();
			$('#' + chat.replace + '_react').remove();
		} // delete
		
		// switch on type
		switch (chat.type) {
			case 'spacer':
				// horizontal spacer
				$cont = $('<div></div>').addClass('sb_chat_row_container other').attr('title', "Added by " + user.nickname);
				$cont.append( $('<div></div>').addClass('sb_chat_spacer') );
			break;
			
			case 'code':
				// syntax highlighted code or text
				var text = chat.content;
				var results = null;
				if (chat.plain) {
					// plain monospace, no highlight
					results = { value: encodeEntities(text) };
				}
				else {
					// highlighted code or markup (auto-detect format)
					try { results = hljs.highlightAuto( text ); }
					catch (err) {
						// fallback to monospace with no hightlight
						Debug.trace('highlight', "Highlight.js Error: " + err);
						results = { value: encodeEntities(text) };
						chat.plain = true;
					}
				}
				
				var html = '';
				
				if (chat.plain) {
					html = '<pre class="wrap"><code>' + results.value + '</code></pre>';
				}
				else {
					// wrap in horiz-scroll div for extra-long lines
					// Note: JH 2018-12-24: We MUST do this for code, because Chromium breaks lines at random points
					html = '<div class="table_wrapper"><pre><code>' + results.value + '</code></pre></div>';
				}
				
				// wrap for click-to-expand
				if (!is_self && !chat.history && !chat.replace) {
					html = '<div class="sb_chat_expand_wrapper collapsed">' + html + '</div>';
				}
				
				$cont = $('<div></div>').addClass('sb_chat_row_container nick');
				
				$cont.append( $('<div></div>').addClass('sb_chat_row_avatar').css('background-image', 'url('+avatar_url+')').attr('title', user.nickname) );
				$cont.append( $('<div></div>').addClass('sb_chat_row_nick').html( user.nickname ) );
				$cont.append( $('<div></div>').addClass('sb_chat_row_timestamp ' + extra_ts_classes).attr('title', fmt_date_time).html( fmt_timestamp ) );
				
				$content = $('<div></div>').addClass('sb_chat_bubble ' + extra_classes).html(html).attr('spellcheck', 'false');
				$cont.append( $content );
			break;
			
			case 'pose':
				// user action (a.k.a. pose)
				var html = '';
				if (chat.pose) html += ':' + chat.pose + ':'; // emoji pose
				html += '**' + user.nickname + '** ' + chat.content;
				
				html = this.renderInlineMarkdown(html);
				html = this.emoji.renderEmoji(html, chat);
				
				$cont = $('<div></div>').addClass('sb_chat_row_container other');
				$cont.append( $('<div></div>').addClass('sb_chat_row_timestamp ' + extra_ts_classes).attr('title', fmt_date_time).html( fmt_timestamp ) );
				
				$content = $('<div></div>').addClass('sb_chat_pose').html( html );
				
				$cont.append( $content );
			break;
			
			case 'whisper':
				// user whispered to us, or WE are whispering to someone else (display differently)
				var html = chat.content;
				html = this.renderInlineMarkdown(html);
				html = this.emoji.renderEmoji(html, chat);
				
				$cont = $('<div></div>').addClass('sb_chat_row_container other');
				$cont.append( $('<div></div>').addClass('sb_chat_row_timestamp ' + extra_ts_classes).attr('title', fmt_date_time).html( fmt_timestamp ) );
				
				if (is_self) {
					var whisper_user = app.users[ chat.to ] || { nickname: chat.to, modified: 0 };
					$content = $('<div></div>').addClass('sb_chat_whisper self').html(
						this.emoji.getEmojiHTML( chat.pose || 'ear', 0, '', app.user.emoji_skin_tone) + 
						'&nbsp;<strong>You whispered to ' + whisper_user.nickname + ':</strong> ' + html
					);
				}
				else {
					$content = $('<div></div>').addClass('sb_chat_whisper').html(
						this.emoji.getEmojiHTML( chat.pose || 'ear', 0, 'emoji whisper_reply', user.emoji_skin_tone, "Reply...") + 
						'&nbsp;<strong>' + user.nickname + ' whispered to you:</strong> ' + html
						// '<span class="sb_chat_whisper_reply">Reply&nbsp;<i class="fa fa-chevron-down"></i></span>'
					);
					$content.find('img.whisper_reply').css('cursor', 'pointer').on('mouseup', function(event) {
						event.preventDefault();
						app.promptEntry("/whisper " + user.nickname + "&nbsp;");
					} );
					$content.find('img.click_to_hide').css('cursor', 'pointer').attr('title', "Click to Hide").on('mouseup', function(event) {
						// this is for the bot mobile QR code thing
						event.preventDefault();
						$(this).remove();
					} );
					if (ok_sound) app.sound.play('whisper');
					chat.sound = 1;
				}
				
				$cont.append( $content );
			break;
			
			case 'notice':
				// system notice
				chat.quiet = 1; // prevent emoji sounds in notices
				var html = chat.content;
				html = this.renderInlineMarkdown(html);
				html = this.emoji.renderEmoji(html, chat, 18);
				
				$cont = $('<div></div>').addClass('sb_chat_row_container other notice');
				if (!chat.special) {
					$cont.append( $('<div></div>').addClass('sb_chat_row_timestamp ' + extra_ts_classes).attr('title', fmt_date_time).html( fmt_timestamp ) );
				}
				$content = $('<div></div>').addClass('sb_chat_notice').html( html );
				
				var label = chat.label || 'Notice';
				var label_class = label.toLowerCase().replace(/\W+/g, '');
				if (!chat.no_label) $cont.append( $('<div></div>').addClass('sb_chat_row_notice ' + label_class).html( label ) );
				$cont.append( $content );
			break;
			
			case 'app':
				// app (api key) post
				var html = '' + chat.content;
				var is_highlight = false;
				if (chat.markdown) html = this.renderInlineMarkdown(html);
				if (chat.emoji) html = this.emoji.renderEmoji(html, chat);
				
				// check text for user highlight
				if (!chat.quiet && !chat.nolight && this.getChannelPref(chat.channel_id, 'show_highlights')) {
					var text = htmlToText(html);
					if (text.match(this.highlightRegExp) && !this.userMatchesRegExp(user, this.ignoreUsersRegExp)) {
						// html = html.replace( this.highlightRegExp, '<span class="highlight">$1</span>' );
						is_highlight = true;
						
						if (extra_classes) extra_classes += ' ';
						extra_classes += 'highlight';
						
						if (!chat.history && !chat.replace) {
							if (ok_sound) app.sound.play('highlight');
							chat.sound = 1;
							chat.highlight = 1;
							extra_classes += ' flash_outside';
						}
					}
				} // highlight
				
				html = '<legend>' + this.emoji.renderEmoji(user.title, chat, 18) + '</legend>' + html;
				
				$cont = $('<div></div>').addClass('sb_chat_row_container other');
				$cont.append( $('<div></div>').addClass('sb_chat_row_timestamp ' + extra_ts_classes).attr('title', fmt_date_time).html( fmt_timestamp ) );
				$content = $('<fieldset></fieldset>').addClass('sb_chat_app ' + extra_classes).html( html );
				
				if (is_highlight) {
					wrapTextWithRegExp( $content, {
						regex: this.highlightRegExp,
						filter: function(elem) { return elem.nodeName != 'A'; },
						wrap: 'span',
						class: 'highlight'
					});
				}
				
				$cont.append( $content );
			break;
			
			case 'custom':
				// custom HTML (i.e. bot, no bubble, just raw HTML in a plain container)
				var html = chat.content;
				if (chat.markdown) html = this.renderInlineMarkdown(html);
				if (chat.emoji) html = this.emoji.renderEmoji(html, chat);
				
				$cont = $('<div></div>').addClass('sb_chat_row_container other');
				$content = $('<div></div>').html( html );
				
				$cont.append( $content );
			break;
			
			case 'progress':
				// special progress action (file upload, lost conn)
				var caption = chat.caption || "Please wait...";
				var counter = chat.counter || 0;
				var max_width = chat.width || 200;
				
				var html = '';
				if (counter == 1.0) extra_classes = 'indeterminate';
				var cx = Math.floor( counter * max_width );
				
				html += '<div class="progress_bar_container ' + extra_classes + '" style="width:' + max_width + 'px; margin:0 auto 0 auto;">';
					html += '<div class="progress_bar_inner" style="width:' + cx + 'px;"></div>';
				html += '</div>';
				html += '<div class="progress_bar_caption">' + caption + '</div>';
				
				$cont = $('<div></div>').addClass('sb_chat_row_container other');
				$content = $('<div></div>').addClass('sb_chat_progress').html( html );
				
				$cont.append( $content );
			break;
			
			default:
				// standard HTML message in a bubble
				var html = chat.content;
				var is_highlight = false;
				var text = htmlToText(html);
				
				// emoji and markdown
				if (text.match(/(^|\n)(\#+|\-|\*|\d+\.|\||>|\`\`\`\w*|\-+\|\-)\s/)) {
					html = this.renderBlockMarkdown(text);
				}
				if (!text.match(/^\!\w+/)) {
					// omit markdown if bot command
					html = this.renderInlineMarkdown(html);
				}
				html = this.emoji.renderEmoji(html, chat);
				
				// check text for user highlight
				if (!is_self && !chat.quiet && this.getChannelPref(chat.channel_id, 'show_highlights')) {
					if (text.match(this.highlightRegExp) && !this.userMatchesRegExp(user, this.ignoreUsersRegExp)) {
						// html = html.replace( this.highlightRegExp, '<span class="highlight">$1</span>' );
						is_highlight = true;
						
						if (extra_classes) extra_classes += ' ';
						extra_classes += 'highlight';
						
						if (!chat.history && !chat.replace) {
							if (ok_sound) app.sound.play('highlight');
							chat.sound = 1;
							chat.highlight = 1;
							extra_classes += ' flash_outside';
						}
					}
				} // highlight
				
				// try to remove leading and trailing line breaks
				html = html.replace(/^(<br\/?>)+/i, '').replace(/(<br\/?>)+$/i, '');
				
				// try to remove leading and trailing whitespace
				html = html.replace(/^(\s|\&nbsp\;)+/g, '').replace(/(\s|\&nbsp\;)+$/g, '');
				
				// special case for messages that end in emoji
				// html = html.replace(/(<\/span>)$/i, '$1<br/>');
				
				// tables get special treatment (horiz scroller)
				if (html.match(/<table/i)) html = '<div class="table_wrapper">' + html + '</div>';
				
				// wrap for click-to-expand
				if (!is_self && !chat.history && !chat.replace) {
					html = '<div class="sb_chat_expand_wrapper collapsed">' + html + '</div>';
				}
				
				$cont = $('<div></div>').addClass('sb_chat_row_container nick');
				
				$cont.append( $('<div></div>').addClass('sb_chat_row_avatar').css('background-image', 'url('+avatar_url+')').attr('title', user.nickname) );
				$cont.append( $('<div></div>').addClass('sb_chat_row_nick').html( user.nickname ) );
				$cont.append( $('<div></div>').addClass('sb_chat_row_timestamp ' + extra_ts_classes).attr('title', fmt_date_time).html( fmt_timestamp ) );
				
				$content = $('<div></div>').addClass('sb_chat_bubble ' + extra_classes).html(html);
				
				if (is_highlight) {
					wrapTextWithRegExp( $content, {
						regex: this.highlightRegExp,
						filter: function(elem) { return elem.nodeName != 'A'; },
						wrap: 'span',
						class: 'highlight'
					});
				}
				
				$cont.append( $content );
			break;
		} // switch type
		
		// store chat object inside jQuery data system
		$cont.prop('id', chat.id)
			.data( copyHashRemoveKeys(chat, { content: 1 }) );
		
		// check if user is near bottom of scroll area
		var should_scroll = chat.history ? false : this.shouldAutoScroll( chat.channel_id );
		if (is_self && !chat.history && !chat.replace && chat.type.match(/^(standard|pose|code|spacer)$/)) should_scroll = true;
		if (chat.special) should_scroll = false;
		
		// add right-click to user avatar, if conditions are right
		if (!is_self && chat.type.match(/^(standard|code)$/)) {
			var avatar = $cont.find('div.sb_chat_row_avatar').get(0);
			if (avatar) avatar.addEventListener('contextmenu', function(event) {
				event.preventDefault();
				app.sidebar.popupUserMenu( chat.username );
			}, true); // useCapture
		}
		
		// add right-click to chat text, if conditions are right
		if (chat.type.match(/^(standard|code|pose|app)$/)) {
			var bubble = $content.get(0);
			if (bubble) bubble.addEventListener('contextmenu', function(event) {
				// if (!app.eff) {
					event.preventDefault();
					app.popupChatMenu( chat, channel, event );
				// }
			}, true); // useCapture
		}
		
		// handle correction here, and return before going any further
		if (chat.replace) {
			var $target = $scrollarea.find('#' + chat.replace);
			if ($target.length) {
				if ($target.hasClass('repeat')) $cont.addClass('repeat');
				else if ($target.hasClass('nick')) $cont.addClass('nick');
				
				var edit_extra_classes = 'edited';
				if (!is_self && !chat.history) edit_extra_classes += ' edit_flash_outside';
				$cont.find('.sb_chat_bubble').addClass( edit_extra_classes );
				
				$target.replaceWith( $cont );
				
				if (is_self && $content && chat.type.match(/^(standard|code|pose)$/) && !chat.local) {
					// augment chat bubble / pose so it is editable
					this.prepEditable($cont, $content);
					$cont.addClass('editable');
				}
				
				if ((chat.type == 'standard') && !chat.history) {
					// remove previous embed if found (will be regenerated)
					// $scrollarea.find('#' + chat.replace + '_embed').remove();
					
					// check for URLs to convert into embeds
					this.embed.checkEmbedMedia(chat, false);
				}
				
				if (chat.reactions) {
					// chat already has reactions (will auto-delete old ones)
					this.react.render(chat);
				}
				
				if (!is_self && !chat.history && ok_sound) app.sound.play('correction');
				
				// edited chat may have grown
				if (should_scroll) this.scrollToBottom( chat.channel_id, chat.history );
				
				return;
			}
			else {
				// original not found?  just render it inline as per usual then
				$cont.find('.sb_chat_bubble').addClass('edited');
			}
		} // replacement
		
		// keep latest timestamp per channel, for relog recovery catch-up
		if (is_new_day && !chat.special) {
			// add new day banner
			$scrollarea.append(
				$('<div></div>').addClass('sb_chat_row_container other').append(
					$('<div></div>').addClass('sb_chat_day_banner').append(
						$('<span></span>').addClass('sb_chat_day_banner_text').html( fmt_day_banner )
					).append(
						$('<div></div>').addClass('sb_chat_day_banner_line')
					)
				)
			);
		} // new day
		
		// add 'repeat' class if previous chat is from same user and is of type 'code' or 'standard'
		var $all = $scrollarea.find('.sb_chat_row_container');
		var $last = $all.last();
		while ($last.data('type') == 'progress') {
			$last = $last.prev();
		}
		var last_type = $last.data('type') || '';
		
		if (($last.data('username') == chat.username) && chat.type.match(/^(standard|code|app)$/) && last_type.match(/^(standard|code|app)$/)) {
			$cont.addClass('repeat');
			$cont.removeClass('nick');
		}
		
		// only pop scroll to bottom if we are already "near" it
		$scrollarea.append( $cont );
		if (should_scroll) this.scrollToBottom( chat.channel_id, chat.history );
		
		if (is_self && $content && chat.type.match(/^(standard|code|pose)$/) && !chat.local) {
			// augment chat bubble / pose so it is editable
			this.prepEditable($cont, $content);
			$cont.addClass('editable');
		}
		
		if (chat.reactions) {
			// chat already has reactions (probably from history)
			this.react.render(chat);
		}
		
		if (chat.type.match(/^(standard|app)$/) && !chat.history) {
			// check for URLs to convert into embeds
			this.embed.checkEmbedMedia(chat, should_scroll);
		}
		
		// play sound if conditions are right
		if (!is_self && !chat.history && !chat.sound && chat.type.match(/^(standard|pose|code|spacer|custom|app)$/) && ok_sound) {
			if (channel.pm) app.sound.play('private');
			else app.sound.play('message');
		}
		
		// add click-to-expand control if needed
		if (!is_self && !chat.history && !chat.replace && chat.type.match(/^(standard|code)$/)) {
			var $ewrap = $content.find('> div.sb_chat_expand_wrapper');
			var ew_scrollHeight = $ewrap[0].scrollHeight;
			var ew_height = $ewrap.height();
			
			if (ew_scrollHeight > ew_height + 30) {
				// larger than grace area
				var expand_html = '<i class="fa fa-chevron-down"></i>&nbsp;Expand&nbsp;<i class="fa fa-chevron-down"></i>';
				$content.append( $('<div></div>').addClass('sb_chat_expand_fader') );
				$content.append( $('<div></div>').addClass('sb_chat_click_to_expand').html(expand_html).on('mouseup', function(event) {
					// $(this).parent().find('div.sb_chat_expand_wrapper').removeClass('collapsed');
					var should_scroll = self.shouldAutoScroll( chat.channel_id );
					
					$(this).parent().find('div.sb_chat_expand_wrapper')
						.css('height', '' + ew_height + 'px')
						.removeClass('collapsed')
						.animate( { height: ew_scrollHeight }, 250, 'easeOutQuart', function() { 
							$(this).css('height', 'auto').addClass('expanded'); 
							if (should_scroll) self.scrollToBottom( chat.channel_id, true );
						} );
					
					$(this).parent().find('div.sb_chat_expand_fader').remove();
					$(this).remove();
				}) );
			}
			else {
				// within grace area
				$ewrap.removeClass('collapsed').addClass('expanded');
			}
		} // click-to-expand
		
		// mark channel as "dirty" so it gets swept for cleanup on the next maint
		channel.client_dirty = true;
	},
	
	getChatTimestamp: function(epoch) {
		// render HTML for chat timestamp (HH:MM)
		var dargs = getDateArgs(epoch);
		return '' + dargs.hour12 + ':' + dargs.mi + dargs.ampm;
	},
	
	shouldAutoScroll: function(chan) {
		// determine if scroll is near bottom, so content should auto-scroll if appended
		if (!chan) chan = app.current_channel_id;
		var div = $('#sa_' + chan)[0];
		if (!div) return false;
		
		// do not scroll if editing previous chat
		if ((chan == app.current_channel_id) && app.eff) return false;
		
		// if there is a scroll timer active for channel, then we can assume true
		if (this.scrollTimers[chan]) return true;
		
		var maxScrollY = div.scrollHeight - div.offsetHeight;
		return( div.scrollTop >= (maxScrollY - 50) );
	},
	
	scrollToBottom: function(chan, instant) {
		// scroll chat history to bottom
		if (!chan) chan = app.current_channel_id;
		// $('#sa_' + chan).scrollTop( 99999 );
		
		if ((chan == app.current_channel_id) && !instant) {
			var div = $('#sa_' + chan)[0];
			var scroll_speed = app.config.get('autoscroll_speed') || 0.25;
			var self = this;
			
			if (!this.scrollTimers[chan]) this.scrollTimers[chan] = setInterval( function() {
				var maxScrollY = div.scrollHeight - div.offsetHeight;
				var scrollTop = div.scrollTop;
				var delta = Math.floor( (maxScrollY - scrollTop) * scroll_speed );
				if (maxScrollY && (delta > 0)) {
					div.scrollTop = scrollTop + delta;
				}
				else {
					div.scrollTop = maxScrollY;
					clearTimeout( self.scrollTimers[chan] );
					delete self.scrollTimers[chan];
				}
			}, 1000 / 60 );
		}
		else {
			$('#sa_' + chan).scrollTop( 99999 );
		}
	},
	
	renderBlockMarkdown: function(text) {
		// convert a block of plain text to markdown using marked
		var html = marked(text, {
			gfm: true,
			tables: true,
			breaks: false,
			pedantic: false,
			sanitize: false,
			smartLists: true,
			smartypants: false,
			silent: true,
			headerIds: false,
			mangle: false,
			highlight: function(code, lang) {
				var hl_result = null;
				try { hl_result = hljs.highlight(lang, code).value; }
				catch (e) {;}
				return hl_result || code;
			}
		});
		html = html.replace(/(<li>)\s*(<input)/ig, '<li class="task">$2');
		return '<div class="markdown-body">' + html + '</div>';
	},
	
	renderInlineMarkdown: function(html) {
		// support a subset of markdown syntax
		html = html.replace(/\&nbsp\;/g, " ");
		
		// inline code spans
		html = html.replace(/\`+([\s\S]+?)\`+/g, function(m_all, m_g1) {
			var text = htmlToText(m_g1);
			var results = { value: encodeEntities(text) };
			
			var code_html = results.value
				.replace(/\*/g, '&ast;')
				.replace(/\:/g, '&colon;')
				.replace(/\~/g, '__TILDE__') // weird chromium bug with &tilde;
				.replace(/\[/g, '&lbrack;')
				.replace(/\#/g, '&num;');
			
			return '<code class="sb_inline">' + code_html + '</code>';
		});
		
		// **bold**
		html = html.replace(/(^|[^\w\\])\*{2}([^\*]+)\*{2}($|\W)/g, '$1<strong>$2</strong>$3');
		
		// *italic*
		html = html.replace(/(^|[^\w\\])\*{1}([^\*]+)\*{1}($|\W)/g, '$1<em>$2</em>$3');
		
		// ~~strike~~
		html = html.replace(/(^|[^\w\\])\~{2}([^\~]+)\~{2}($|\W)/g, '$1<s>$2</s>$3');
		
		// add tooltips to natural links already in HTML
		html = html.replace(/<a\s+href\s*\=\s*\"(\w+\:\/\/[^\"]*)\"/ig, function(m_all, m_g1) {
			return m_all + ' title="' + m_g1 + '"';
		});
		
		// hashtags into channel joins, if applicable
		html = html.replace(/(^|\s)\#(\w+)(?=$|\s|<)/g, function(m_all, m_g1, m_g2) {
			var channel = app.findChannel(m_g2);
			if (channel) return m_g1 + '[#' + m_g2 + '](speech:///join+' + channel.id + ')';
			else return m_all;
		});
		
		// [link](http://link)
		html = html.replace(/(^|[^\\])\[([^\]]+)\]\((\w+\:\/\/[^\)]+)\)/g, '$1<a href="$3" title="$3">$2</a>');
		
		// GFH checkbox short codes
		html = html.replace(/(^|\s|>)(\[X\])(?=$|\s|<)/ig, '$1<input type="checkbox" disabled checked>');
		html = html.replace(/(^|\s|>)(\[ \])(?=$|\s|<)/ig, '$1<input type="checkbox" disabled>');
		
		// prevent weirdness in Chromium / Electron
		// (strange rendering bug when converting tilde to entity, so have to do it this crazy way)
		html = html.replace(/__TILDE__/g, '~');
		
		// convert loose URLs to links (but not inside quotes, and make sure to not double-wrap)
		// html = html.replace(/(^|[^\"\w])(\w+\:\/\/\S+)/g, '$1<a href="$2">$2</a>');
		html = html.replace(/(^|[^\"\w])(\w+\:\/\/[^<]+)([^>]*)/g, function(m_all, m_g1, m_g2, m_g3) {
			if (m_g3.match(/<\/a/i)) return m_all;
			if (m_g2.match(/^(.+?)(\s.*)$/)) { m_g2 = RegExp.$1; m_g3 = RegExp.$2 + m_g3; }
			return m_g1 + '<a href="'+ m_g2+'">' + m_g2 + '</a>' + m_g3;
		});
		
		return html;
	},
	
	tabAutoComplete: function() {
		// user hit tab, try to autocomplete nicks, first names, or usernames
		// limit to users currently in current channel
		var channel = app.channels[app.current_channel_id];
		if (!channel || !channel.live_users) return false;
		
		var text_to_insert = '';
		var text_query = null;
		var sel = window.getSelection();
		var range = null;
		
		if (sel.rangeCount) {
			range = sel.getRangeAt(0);
			if (range && range.collapsed && range.endContainer && (range.endContainer.nodeValue !== null) && range.endContainer.nodeValue.substring) {
				// caret is inside a text node
				var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
				if (before_str.match(/\/([\w]{1,})$/)) {
					// user is asking for auto-complete of /slash command
					return this.commandAutoComplete();
				}
				if (before_str.match(/\b([\w]{1,})$/)) {
					text_query = RegExp.$1;
				}
			}
		} // caret is in dom
		
		if (!text_query) return false;
		var text_regex = new RegExp( '^' + text_query, 'i' );
		
		// nicknames first
		for (var username in channel.live_users) {
			var user = app.users[username];
			if (user) {
				if (user.nickname.match(text_regex)) {
					text_to_insert = user.nickname;
					break;
				}
			}
		}
		
		// try first names next
		if (!text_to_insert) {
			for (var username in channel.live_users) {
				var user = app.users[username];
				if (user) {
					var first_name = user.full_name.replace(/\s.*$/, '');
					if (first_name.match(text_regex)) {
						text_to_insert = first_name;
						break;
					}
				}
			}
		}
		
		// finally, try usernames
		if (!text_to_insert) {
			for (var username in channel.live_users) {
				if (username.match(text_regex)) {
					text_to_insert = username;
					break;
				}
			}
		}
		
		// still no text?  try user shortcuts
		/*if (!text_to_insert && app.prefCache.shortcuts) {
			for (var shortcut in app.prefCache.shortcuts) {
				if (shortcut.match(text_regex)) {
					text_to_insert = shortcut;
					break;
				}
			}
		}*/
		
		if (!text_to_insert) return false;
		
		// insert auto-completion text
		var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
		var after_str = range.endContainer.nodeValue.substring(range.endOffset);
		
		// remove user's search query, if present
		before_str = before_str.replace(/\b[\w]+\s*$/, '');
		
		range.endContainer.nodeValue = before_str + text_to_insert + after_str;
		range.setEnd( range.endContainer, before_str.length + text_to_insert.length );
		range.collapse(false);
		
		sel.removeAllRanges();
		sel.addRange( range );
		
		document.execCommand("insertText", false, " ");
		return true;
	},
	
	commandAutoComplete: function() {
		// auto-complete built-in /slash commands
		var channel = app.channels[app.current_channel_id];
		if (!channel) return false;
		
		var text_to_insert = '';
		var text_query = null;
		var sel = window.getSelection();
		var range = null;
		
		if (sel.rangeCount) {
			range = sel.getRangeAt(0);
			if (range && range.collapsed && range.endContainer && (range.endContainer.nodeValue !== null) && range.endContainer.nodeValue.substring) {
				// caret is inside a text node
				var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
				if (before_str.match(/\/([\w]{1,})$/)) {
					// user is asking for auto-complete of /slash command
					text_query = RegExp.$1;
				}
			}
		} // caret is in dom
		
		if (!text_query) return false;
		var text_regex = new RegExp( '^' + text_query, 'i' );
		
		for (var key in app.commands) {
			if (key.match(text_regex)) {
				text_to_insert = '/' + key;
				break;
			}
		}
		
		if (!text_to_insert) return false;
		
		// insert auto-completion text
		var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
		var after_str = range.endContainer.nodeValue.substring(range.endOffset);
		
		// remove user's search query, if present
		before_str = before_str.replace(/\/[\w]+\s*$/, '');
		
		range.endContainer.nodeValue = before_str + text_to_insert + after_str;
		range.setEnd( range.endContainer, before_str.length + text_to_insert.length );
		range.collapse(false);
		
		sel.removeAllRanges();
		sel.addRange( range );
		
		document.execCommand("insertText", false, " ");
		return true;
	},
	
	shortcutAutoComplete: function() {
		// user hit space or enter, try to autocomplete shortcuts
		if (!app.current_channel_id) return false;
		var channel = app.channels[app.current_channel_id];
		if (!channel) return false;
		if (!app.prefCache || !app.prefCache.shortcuts || !numKeys(app.prefCache.shortcuts)) return false;
		
		var text_to_insert = '';
		var text_query = null;
		var sel = window.getSelection();
		var range = null;
		var re = null;
		
		if (sel.rangeCount) {
			range = sel.getRangeAt(0);
			if (range && range.collapsed && range.endContainer && (range.endContainer.nodeValue !== null) && range.endContainer.nodeValue.substring) {
				// caret is inside a text node
				text_query = range.endContainer.nodeValue.substring(0, range.endOffset);
			}
		} // caret is in dom
		
		if (!text_query) return false;
		
		for (var key in app.prefCache.shortcuts) {
			// FUTURE: Pre-compile these for performance
			re = new RegExp( "(^|\\s)" + escapeRegExp(key) + '$' );
			if (text_query.match(re)) {
				text_to_insert = app.prefCache.shortcuts[key];
				break;
			}
		}
		
		if (!text_to_insert) return false;
		
		// insert auto-completion text
		var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
		var after_str = range.endContainer.nodeValue.substring(range.endOffset);
		
		// remove user's search query, if present
		before_str = before_str.replace(re, '$1');
		
		range.endContainer.nodeValue = before_str + text_to_insert + after_str;
		range.setEnd( range.endContainer, before_str.length + text_to_insert.length );
		range.collapse(false);
		
		sel.removeAllRanges();
		sel.addRange( range );
		return true;
	},
	
	updateTypingIndicatorHeight: function() {
		// update container height based on number of users currently typing
		if (!this.current_channel_id) return;
		var channel = this.channels[ this.current_channel_id ];
		if (!channel) return;
		var typing_users = channel.typing_users || {};
		var num_typing = 0;
		
		for (var username in typing_users) {
			var tinfo = typing_users[username];
			if (tinfo.div) num_typing++;
		}
		
		var height = num_typing * 40;
		$('#typing_container').css('margin-top', 0 - height);
	},
	
	notifyUserTyping: function(username) {
		// add user avatar to typing indicator container
		if (!this.current_channel_id) return;
		var channel = this.channels[ this.current_channel_id ];
		if (!channel) return;
		if (!channel.typing_users || !channel.typing_users[username]) return;
		
		var tinfo = channel.typing_users[ username ];
		var user = this.users[ username ] || { username: username, nickname: username, modified: 0 };
		
		var avatar_url = app.getUserAvatarURL(user, 64);
		
		if (this.userMatchesRegExp(user, this.hideUsersRegExp)) return;
		// if (username == app.username) return;
		
		tinfo.div = $('<div></div>').addClass('typing_indicator').attr('title', user.nickname + " is typing...").append(
			$('<div></div>').addClass('typing_avatar').css('background-image', 'url(' + avatar_url + ')'),
			$('<div></div>').addClass('talky_icon')
		);
		$('#typing_container').append( tinfo.div );
		
		this.updateTypingIndicatorHeight();
	},
	
	typingIndicatorMaint: function() {
		// have any users stopped typing lately?
		if (!this.current_channel_id) return;
		var channel = this.channels[ this.current_channel_id ];
		if (!channel || !channel.ui || !channel.typing_users) return;
		
		var typing_users = channel.typing_users;
		var now = timeNow();
		var num_removed = 0;
		
		for (var username in typing_users) {
			var tinfo = typing_users[username];
			if (now - tinfo.date >= 1.0) {
				// user.div.remove(  );
				if (tinfo.div) {
					tinfo.div.animate( { opacity: 0, height: 0, marginBottom: 0 }, 500, 'easeOutQuart', function() { $(this).remove(); } );
				}
				delete typing_users[username];
				num_removed++;
			}
		}
		
		if (num_removed) this.updateTypingIndicatorHeight();
	},
	
	forceExpireUserTyping: function(username) {
		// force user's typing indicator to expire (i.e. after 'said' or 'left')
		if (!this.current_channel_id) return;
		var channel = this.channels[ this.current_channel_id ];
		if (!channel) return;
		if (!channel.typing_users || !channel.typing_users[username]) return;
		
		var tinfo = channel.typing_users[ username ];
		tinfo.date = 0;
		
		this.typingIndicatorMaint();
	},
	
	detectNotifyUserChanges: function(old_user, new_user) {
		// called from app.comm.server_user_updated
		// see if there were any notable user changes, and if so, post local notices for them
		var username = new_user.username;
		var affected_channels = {};
		
		for (var chan in app.channels) {
			var channel = app.channels[chan];
			if (channel.ui && channel.live_users && channel.live_users[username]) {
				affected_channels[chan] = 1;
			}
		}
		if (!numKeys(affected_channels)) return;
		
		// honor user hide list
		if (this.userMatchesRegExp(new_user, this.hideUsersRegExp)) return;
		
		if (new_user.nickname != old_user.nickname) {
			var msg = "<b>" + (old_user.full_name || username) + " (" + old_user.nickname + ")</b> has changed their nickname to: <b>" + new_user.nickname + '</b>';
			
			for (var chan in affected_channels) {
				app.newLocalNotice( msg, { label: 'User', channel_id: chan, local: false } );
			}
		}
		
		if (new_user.full_name != old_user.full_name) {
			var msg = "<b>" + (old_user.full_name || username) + " (" + old_user.nickname + ")</b> has changed their full name to: <b>" + (new_user.full_name || '(n/a)') + '</b>';
			
			for (var chan in affected_channels) {
				app.newLocalNotice( msg, { label: 'User', channel_id: chan, local: false } );
			}
		}
	},
	
	displayMaint: function() {
		// check channels for maint sweep
		for (var chan in this.channels) {
			var channel = this.channels[chan];
			
			if (channel.ui && channel.client_dirty && !this.scrollTimers[chan] && !this.eff) {
				// channel is dirty and NOT currently animating its scrollTop
				var $scrollarea = $('#sa_' + chan);
				var scrollTop = $scrollarea.scrollTop();
				var oldScrollTop = scrollTop;
				var pinnedToBottom = this.shouldAutoScroll(chan);
				
				// collapse offscreen embeds
				var $embeds = $scrollarea.find('div.sb_chat_row_container.embed');
				var max_buffer_y = $scrollarea.height() * this.max_embed_offscreen_distance;
				
				if ($embeds.length) {
					for (var idx = $embeds.length - 1; idx >= 0; idx--) {
						var $embed = $embeds.slice(idx, idx + 1);
						var pos = $embed.position();
						var bottom = pos.top + oldScrollTop + $embed.height();
						if (bottom < oldScrollTop - max_buffer_y) {
							Debug.trace('embed', "Collapsing embed: " + $embed.prop('id') + " with bottom " + bottom + " (scrollTop: " + oldScrollTop + ", max_buffer_y: " + max_buffer_y);
							scrollTop -= Math.floor( $embed.outerHeight(true) || 0 );
							$embed.trigger('collapse'); // custom event
						}
					}
				}
				
				// remove old messages
				var $all = $scrollarea.find('div.sb_chat_row_container');
				var num_messages = $all.length;
				var idx = 0;
				while (num_messages > this.max_recent_channel_history) {
					var $elem = $all.slice(idx, idx + 1);
					// skip over special notices
					if (!$elem.data('special')) {
						scrollTop -= Math.floor( $elem.outerHeight(true) || 0 );
						$elem.remove();
						num_messages--;
					}
					idx++;
				}
				
				// at this point, topmost (oldest) message should not have .repeat class
				if (idx) $all.slice(idx, idx + 1).removeClass('repeat');
				
				// adjust scroll to compensate for removed elements
				if ((scrollTop != oldScrollTop) && !pinnedToBottom) $scrollarea.scrollTop( scrollTop );
				
				// all clean now!
				channel.client_dirty = false;
			} // client_dirty
		} // foreach channel
	},
	
	updateHeader: function() {
		// update channel name / topic
		var chan = app.current_channel_id;
		var channel = app.channels[chan];
		if (!channel) return;
		
		var icon_name = channel.pm ? 'user' : (channel.private ? 'lock' : 'comments');
		
		$('#s_title').html(
			'<i class="fa fa-' + icon_name + '">&nbsp;</i>' + 
			(channel.custom_title || channel.title || '')
		);
		
		if (channel.topic) {
			var html = channel.topic;
			
			html = this.renderInlineMarkdown(html);
			html = this.emoji.renderEmoji(html);
			
			$('#s_topic').show().html( html );
		}
		else $('#s_topic').hide();
	},
	
	popupChatMenu: function(chat, channel, event) {
		// show contextual menu for chat bubbles
		var menu = new Menu();
		
		if (event.target && event.target.href) {
			var url = event.target.href;
			menu.append(new MenuItem({
				label: 'Open Link',
				click: function(menuItem, browserWindow, event) {
					// open link in browser
					window.location = url;
					
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
				}
			}));
			
			menu.append(new MenuItem({
				label: 'Copy Link',
				click: function(menuItem, browserWindow, event) {
					// copy link to clipboard
					clipboard.writeText( url );
					
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
				}
			}));
			
			menu.append(new MenuItem({ type: 'separator' }));
		} // link
		
		if (event.target && event.target.getAttribute('data-emoji')) {
			var emoji_id = event.target.getAttribute('data-emoji');
			menu.append(new MenuItem({
				label: 'Copy Emoji',
				click: function(menuItem, browserWindow, event) {
					// copy emoji to clipboard
					clipboard.writeText( ':' + emoji_id + ':' );
					
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
				}
			}));
			
			var emoji = app.emoji.names[emoji_id];
			if (emoji && emoji.sound) {
				if (app.prefCache.mute_emoji[emoji_id]) {
					menu.append(new MenuItem({
						label: 'Unmute Emoji',
						click: function(menuItem, browserWindow, event) {
							// remove emoji from mute list
							app.config.delete( 'mute_emoji.' + emoji_id );
							app.prefsChanged( 'mute_emoji' );
							
							// prevent contentEditable from kicking in
							$('#d_footer_textfield').focus().trigger('input');
						}
					}));
				}
				else {
					menu.append(new MenuItem({
						label: 'Mute Emoji',
						click: function(menuItem, browserWindow, event) {
							// add emoji to mute list
							app.config.set( 'mute_emoji.' + emoji_id, true );
							app.prefsChanged( 'mute_emoji' );
							
							// prevent contentEditable from kicking in
							$('#d_footer_textfield').focus().trigger('input');
						}
					}));
				}
			} // emoji.sound
		} // emoji
		
		if (event.target && (event.target.nodeName == 'CODE') && (event.target.className == 'sb_inline')) {
			var snippet = event.target.innerText;
			menu.append(new MenuItem({
				label: 'Copy Code Snippet',
				click: function(menuItem, browserWindow, event) {
					// copy text to clipboard
					clipboard.writeText( snippet );
					
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
				}
			}));
		} // code
		
		menu.append(new MenuItem({
			label: 'Copy Message',
			click: function(menuItem, browserWindow, event) {
				// copy entire message to clipboard as text
				// (electron's clipboard.writeHTML() copies something that cannot be pasted as text)
				if (chat.type == 'code') {
					// try to preserve exact code formatting as plain text
					// attempt to convert 4-spaces back to tabs (ugh, may remove this in future)
					clipboard.writeText( chat.content.replace(/[ \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]{4}/g, "\t") );
				}
				else if (chat.type == 'pose') {
					// prepend user's nickname to mimic display style
					var user = app.users[ chat.username ] || { nickname: chat.username, modified: 0 };
					clipboard.writeText( user.nickname + " " + htmlToText(chat.content, true) );
				}
				else {
					// downconvert HTML to text for clipboard
					clipboard.writeText( htmlToText(chat.content, true) );
				}
				
				// prevent contentEditable from kicking in
				$('#d_footer_textfield').focus().trigger('input');
			}
		}));
		
		menu.append(new MenuItem({
			label: 'Copy as Quote',
			click: function(menuItem, browserWindow, event) {
				// copy quote to clipboard
				var user = app.users[ chat.username ] || { nickname: chat.username, modified: 0 };
				var dargs = getDateArgs(chat.date);
				var nice_time = dargs.hour12 + ':' + dargs.mi + ' ' + dargs.ampm.toUpperCase();
				var quote = '`' + dargs.yyyy_mm_dd + ' ' + nice_time + '` ';
				
				if (chat.type == 'app') {
					// show app title, which is diff than user nick
					user = app.api_keys[ chat.username ] || { title: chat.username };
					quote += '**' + user.title + ':** ';
				}
				else {
					if (user.full_name && user.nickname) quote += '**' + user.full_name + " (" + user.nickname + '):** ';
					else quote += '**' + user.nickname + ':** ';
				}
				
				quote += htmlToText(chat.content, true);
				
				// app.promptEntry( quote );
				clipboard.writeText(quote);
				
				// prevent contentEditable from kicking in
				$('#d_footer_textfield').focus().trigger('input');
			}
		}));
		
		if (app.searchMode.match(/(search|favorites)/)) {
			menu.append(new MenuItem({
				label: 'Jump to Timeline',
				click: function(menuItem, browserWindow, event) {
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
					
					app.timeline.jumpToChat(chat);
				}
			}));
		}
		
		var need_hide_sep = true;
		
		if (chat.type.match(/^(standard|code|pose)$/)) {
			menu.append(new MenuItem({ type: 'separator' }));
			
			menu.append(new MenuItem({
				label: '👍 Upvote',
				click: function(menuItem, browserWindow, event) {
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
					
					app.react.toggle( chat.id, "+1" );
				}
			}));
			
			menu.append(new MenuItem({
				label: '👎 Downvote',
				click: function(menuItem, browserWindow, event) {
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
					
					app.react.toggle( chat.id, "-1" );
				}
			}));
			
			menu.append(new MenuItem({
				label: 'Custom Reaction...',
				click: function(menuItem, browserWindow, event) {
					// prompt user for custom emoji reaction
					
					// prevent contentEditable from kicking in
					if (!app.searchMode) {
						$('#d_footer_textfield').focus().trigger('input');
					}
					
					// app.promptEntry("/react " + chat.id + "&nbsp;", false);
					// setTimeout( function() { app.emoji.showPicker(); }, 100 );
					var $bubble = $('#' + chat.id + ' > div.sb_chat_bubble');
					if (!$bubble.length) return; // sanity
					
					setTimeout( function() {
						app.emoji.showCustomPicker( $bubble, function(emoji_id) {
							app.react.toggle( chat.id, emoji_id );
						} ); // picker
					}, 50 );
				} // click
			}));
			
			if (!channel.private && !channel.pm) {
				menu.append(new MenuItem({ type: 'separator' }));
				
				if (app.favorites.isFavorite(chat)) {
					menu.append(new MenuItem({
						label: 'Remove from Favorites',
						click: function(menuItem, browserWindow, event) {
							// prevent contentEditable from kicking in
							$('#d_footer_textfield').focus().trigger('input');
							
							app.favorites.remove( chat.id, chat );
						}
					}));
				}
				else {
					menu.append(new MenuItem({
						label: 'Add to Favorites',
						click: function(menuItem, browserWindow, event) {
							// prevent contentEditable from kicking in
							$('#d_footer_textfield').focus().trigger('input');
							
							app.favorites.add( chat.id, chat );
						}
					}));
				}
				
				need_hide_sep = false;
			} // not private
		} // standard|code
		
		if (chat.type.match(/^(standard|code|pose|app)$/) && !app.searchMode) {
			if (need_hide_sep) menu.append(new MenuItem({ type: 'separator' }));
			
			menu.append(new MenuItem({
				label: 'Hide Message',
				click: function(menuItem, browserWindow, event) {
					// prevent contentEditable from kicking in
					$('#d_footer_textfield').focus().trigger('input');
					
					var $cont = $('<div></div>').addClass('sb_chat_row_container other notice');
					var $content = $('<div></div>').addClass('sb_chat_notice').html( "Message has been hidden." );
					$cont.append( $('<div></div>').addClass('sb_chat_row_notice fav').html( "Local" ) );
					$cont.append( $content );
					$('#' + chat.id).replaceWith( $cont );
					$('#' + chat.id + '_embed').trigger('collapse'); // custom event
					$('#' + chat.id + '_react').remove();
				}
			}));
		} // hide message
		
		$('#d_footer_textfield').focus().trigger('input');
		menu.popup();
	},
	
	promptEntry: function(html, ok_flash) {
		// prompt user for text entry by highlighting TEF with prefilled text and CSS effect
		if (typeof(ok_flash) == 'undefined') ok_flash = true;
		if (app.searchMode && (app.searchMode != 'search')) return; // sanity
		
		$('#i_code_toggle').removeClass('selected');
		$('#d_footer_textfield').removeClass('codelike flash').removeAttr('spellcheck');
		$('#d_footer_textfield').html('').focus().trigger('input');
		if (html) document.execCommand("insertHTML", false, html);
		
		if (ok_flash) {
			setTimeout( function() {
				$('#d_footer_textfield').addClass('flash');
			}, 1 );
		}
	},
	
	showChannelSettingsDialog: function() {
		// edit channel specific settings
		var self = this;
		var chan = app.current_channel_id;
		var channel = app.channels[chan];
		var prefs = this.prefCache;
		var channel_settings = prefs.channel_settings;
		var has_chan_prefs = !!channel_settings[chan];
		var html = '';
		
		html += '<div class="csd_container">';
		html += '<div class="sel_dialog_label" style="text-align:center">Channel Settings for #' + channel.title + '</div>';
		
		html += '<div style="margin-top:10px; margin-left:10px;">';
		html += '<input type="checkbox" id="fe_cpref_override" value="1" onChange="app.changeChannelSettingsDialogMode()" ' + 
			(has_chan_prefs ? 'checked="checked" ' : '') + '/>';
		html += '<label for="fe_cpref_override" class="csd_group">Override Default Settings</label>';
		html += '</div>';
		
		var items = [
			['show_notifications', 'Show Notifications'],
			['show_unread', 'Show Unread Count'],
			['show_general', 'Show General Notices'],
			['show_highlights', 'Enable Highlights'],
			['autoplay_media', 'Show Inline Media'],
			['chat_sounds', 'Play Chat Sounds'],
			['autoplay_sounds', 'Play User Sounds'],
			['emoji_sounds', 'Play Emoji Sounds']
		];
		
		items.forEach( function(item) {
			var key = item[0];
			var label = item[1];
			html += '<div style="margin-top:2px; margin-left:30px;">';
			html += '<input type="checkbox" class="cpref_cbox" id="fe_csd_' + key + '" data-key="' + key + '" value="1" ' + 
				(self.getChannelPref(chan, key) ? 'checked="checked" ' : '') + 
				(has_chan_prefs ? '' : 'disabled="disabled" ') + '/>';
			html += '<label for="fe_csd_' + key + '">' + label + '</label>';
			html += '</div>';
		});
		
		html += '</div>';
		
		app.dialog.show( $('#i_channel_settings'), 'bottom', html );
		
		$('input.cpref_cbox').on( 'change', function() {
			var $this = $(this);
			var key = $this.data('key');
			var value = !!$this.is(':checked');
			
			// just in case...
			if (!channel_settings[chan]) {
				channel_settings[chan] = copyHash( self.default_channel_settings );
			}
			
			// set value
			channel_settings[chan][key] = value;
			self.config.set( 'channel_settings', channel_settings );
		} );
		
		$('#i_channel_settings').addClass('selected');
		
		// icon state follows dialog
		app.dialog.onHide = function() { 
			$('#i_channel_settings').removeClass('selected');
		};
	},
	
	changeChannelSettingsDialogMode: function() {
		// set mode of channel override settings
		var self = this;
		var chan = app.current_channel_id;
		var prefs = this.prefCache;
		var channel_settings = prefs.channel_settings;
		var yes_override = $('#fe_cpref_override').is(':checked');
		
		if (yes_override) {
			// yes, user wants to override defaults for this channel
			channel_settings[chan] = copyHash( this.default_channel_settings );
		}
		else {
			// revert to defaults for this channel
			delete channel_settings[chan];
		}
		
		this.config.set( 'channel_settings', channel_settings );
		
		$('input.cpref_cbox').each( function() {
			var $this = $(this);
			var key = $this.data('key');
			if (yes_override) $this.removeAttr('disabled');
			else $this.attr('disabled', true);
			
			// set checkbox state
			$this.prop('checked', !!self.getChannelPref(chan, key));
		} );
	},
	
	showSSLDialog: function() {
		// show dialog with SSL connection info
		var self = this;
		var html = '';
		var cert_warn = app.ssl_cert_warning || null;
		var url = app.comm.socket.ws.url;
		var proto = 'Unknown';
		var host = 'Unknown';
		if (url.match(/^(\w+\:\/\/)([\w\-\.\:]+)/)) {
			proto = RegExp.$1;
			host = RegExp.$2;
			if (proto.match(/wss/i)) proto += ' (WebSocket SSL)';
		}
		
		html += '<div style="width:275px; margin:10px;">';
		
		html += '<div class="user_info_label">Summary</div>';
		html += '<div class="user_info_value" style="color:var(--highlight-color);"><i class="fa fa-lock">&nbsp;</i>Your connection is encrypted with SSL.</div>';
		
		html += '<div class="user_info_spacer"></div>';
		html += '<div class="user_info_label">Protocol</div>';
		html += '<div class="user_info_value">' + proto + '</div>';
		
		html += '<div class="user_info_spacer"></div>';
		html += '<div class="user_info_label">Hostname</div>';
		html += '<div class="user_info_value">' + host + '</div>';
		
		if (cert_warn) {
			var cert = cert_warn.cert;
			html += '<div class="user_info_spacer"></div>';
			html += '<div class="user_info_label">Certificate Warning</div>';
			html += '<div class="user_info_value">Your SSL certificate could not be verified with a CA (Certificate Authority). ' + cert_warn.err + '</div>';
			
			html += '<div class="user_info_spacer"></div>';
			html += '<div class="user_info_label">Certificate Name / Issuer</div>';
			html += '<div class="user_info_value">' + cert.subjectName + ' / ' + cert.issuerName + '</div>';
			
			html += '<div class="user_info_spacer"></div>';
			html += '<div class="user_info_label">Certificate Serial #</div>';
			html += '<div class="user_info_value">' + cert.serialNumber + '</div>';
			
			html += '<div class="user_info_spacer"></div>';
			html += '<div class="user_info_label">Certificate Expiration</div>';
			html += '<div class="user_info_value">' + (new Date( cert.validExpiry * 1000 )).toLocaleString() + '</div>';
		}
		else {
			html += '<div class="user_info_spacer"></div>';
			html += '<div class="user_info_label">SSL Certificate Status</div>';
			html += '<div class="user_info_value" style="color:var(--highlight-color);">Validated</div>';
			
			if (app.ssl_cert_info) {
				// got SSL cert info from Node.js https
				var cert = app.ssl_cert_info;
				html += '<div class="user_info_spacer"></div>';
				html += '<div class="user_info_label">Certificate Name / Issuer</div>';
				html += '<div class="user_info_value">' + cert.subject + ' / ' + cert.issuer + '</div>';
				
				html += '<div class="user_info_spacer"></div>';
				html += '<div class="user_info_label">Certificate Serial #</div>';
				html += '<div class="user_info_value" style="word-break:break-all;">' + cert.serialNumber + '</div>';
				
				html += '<div class="user_info_spacer"></div>';
				html += '<div class="user_info_label">Certificate Expiration</div>';
				html += '<div class="user_info_value">' + cert.valid_to + '</div>';
			}
		}
		
		html += '</div>';
		
		app.dialog.show( $('#i_ssl'), 'bottom', html );
		
		$('#i_ssl').addClass('selected');
		
		// icon state follows dialog
		app.dialog.onHide = function() { 
			$('#i_ssl').removeClass('selected');
		};
	},
	
	gotoTextEntryHistory: function(idx) {
		// jump to specific text entry history state
		if (idx < 0) return;
		
		if (idx >= this.textEntryHistory.length) {
			// off the end
			// if we're already there, just return
			if (this.tehIdx == this.textEntryHistory.length) return;
			
			// set to empty
			this.tehIdx = this.textEntryHistory.length;
			$('#i_code_toggle').removeClass('selected');
			$('#d_footer_textfield').removeClass('codelike').removeAttr('spellcheck');
			$('#d_footer_textfield').html('').focus().trigger('input');
			return;
		}
		
		this.tehIdx = idx;
		var state = this.textEntryHistory[idx];
		
		if (state.code) {
			// code mode
			$('#i_code_toggle').addClass('selected');
			$('#d_footer_textfield').addClass('codelike').attr('spellcheck', 'false');
		}
		else {
			// standard mode
			$('#i_code_toggle').removeClass('selected');
			$('#d_footer_textfield').removeClass('codelike').removeAttr('spellcheck');
		}
		
		$('#d_footer_textfield').html('').focus().trigger('input');
		document.execCommand("insertHTML", false, state.html);
	},
	
	prevTextEntryHistory: function() {
		// restore state from previous text entry history
		this.gotoTextEntryHistory( this.tehIdx - 1 );
	},
	
	nextTextEntryHistory: function() {
		// restore state from next text entry history
		this.gotoTextEntryHistory( this.tehIdx + 1 );
	},
	
	addToTextEntryHistory: function(data) {
		// add row to bottom of text entry history (cmd-up-arrow to retrieve)
		this.textEntryHistory.push( data );
		if (this.textEntryHistory.length > 100) this.textEntryHistory.shift();
		
		// move index to end
		this.tehIdx = this.textEntryHistory.length;
	}
	
});
