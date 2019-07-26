// Preferences

app.prefs = {
	
	pages: {},
	current_page_id: 'account',
	
	init: function() {
		var self = this;
		
		if (app.debug) {
			Debug.enable( app.debug_cats );
			Debug.trace('system', "SpeechBubble Prefs Starting Up");
		}
		
		app.config = new Config({
			name: (process.env.IS_DEV === "1") ? 'dev' : 'config',
			defaults: app.default_config
		});
		
		// apply theme (loads CSS)
		app.updateTheme();
		
		// show or hide usernames under avatars
		app.updateShowUsernames();
		
		// user highlight color
		app.updateHighlightColor();
		
		// setup sidebar
		setDocumentVariable('sidebar-width', '120px');
		app.sidebar.updateColor();
		
		// setup API
		app.api.init();
		
		// setup sound system
		app.sound.init();
		
		// setup camera
		app.camera.init();
		
		// setup emoji picker
		app.emoji.init( function() {
			// tell Electron we are ready (but give CSS a few ms to finish loading)
			// (no easy way to hook the CSS and font loads, to my knowledge anyway)
			// setTimeout( function() { app.sendAppCommand('appReady', {}); }, 50 );
			
			// $('body').addClass('logged_in');
			
			app.emoji.indexSearchPrep();
		} );
		
		// setup file upload system
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		ZeroUpload.init();
		
		// tabs
		$('.sidebar_tab').on('mouseup', function() {
			self.clickTab(this);
		});
		
		// resume session
		if (app.config.get('session_id')) {
			// try to resume session
			$('body').addClass('loading');
			app.api.post( 'user/resume_session', {}, function(resp) {
				app.username = resp.username;
				app.user = resp.user;
				self.doLoginFinish();
			},
			function(resp) {
				// error
				$('body').removeClass('loading');
				// app.doError( "Login Error: " + resp.description );
				app.doSystemErrorDialog( "Login Error", resp.description );
			} );
		}
		
		// false channel id to activate some features we need (i.e. emoji autosearch)
		app.current_channel_id = 'prefs';
		
		// catch paste and strip html
		window.addEventListener( "paste", function(event) {
			event.preventDefault();
			var html = event.clipboardData.getData('text/html');
			if (html) {
				var text = htmlToText(html);
				if (text) document.execCommand("insertText", false, text);
			}
			else {
				var text = event.clipboardData.getData('text/plain');
				if (text) document.execCommand("insertText", false, text);
			}
		});
		
		// init all pages
		for (var id in this.pages) {
			if (this.pages[id].init) this.pages[id].init();
		}
		
		// go go default page
		this.pages.account.onActivate();
	},
	
	clickTab: function(elem) {
		// click prefs tab
		var $elem = $(elem);
		var old_id = $('.sidebar_tab.selected').prop('id').replace(/^tab_/, '');
		var id = $elem.prop('id').replace(/^tab_/, '');
		if (id == old_id) return; // same tab
		
		var page_id = 'page_' + id;
		
		// swap pages
		$('.scrollarea').css('display', 'none');
		$('#' + page_id).css('display', 'block');
		
		// swap tabs
		$('.sidebar_tab').removeClass('selected');
		$elem.addClass('selected');
		
		// set title
		$('.titlebar > .title').html( this.pages[id].title || $elem.html() );
		
		if (this.pages[old_id] && this.pages[old_id].onDeactivate) this.pages[old_id].onDeactivate(id);
		if (this.pages[id] && this.pages[id].onActivate) this.pages[id].onActivate(old_id);
		
		this.current_page_id = id;	
	},
	
	doLogin: function() {
		// attempt to login
		var self = this;
		var params = {};
		app.clearError();
		
		var remember = !!$('#fe_remember').is(':checked');
		var ssl = !!$('#fe_ssl').is(':checked');
		
		// grab hostname and ssl first, so we can init the api layer
		var hostname = $('#fe_hostname').val();
		if (!hostname || !hostname.match(/^[\w\-\.\:]+$/)) return app.badField('#fe_hostname');
		
		app.config.set('hostname', hostname);
		app.config.set('ssl', ssl );
		app.api.init();
		
		// validate form fields
		params.username = $('#fe_username').val();
		if (!params.username || !params.username.match(/^\w+$/)) return app.badField('#fe_username');
		
		params.password = $('#fe_password').val();
		if (!params.password) return app.badField('#fe_password');
		
		$('body').addClass('loading');
		
		app.api.post( 'user/login', params, function(resp) {
			// successfully logged in
			app.username = resp.username;
			app.user = resp.user;
			
			// now we can save some prefs
			app.config.set('session_id', resp.session_id);
			app.config.set('username', resp.username);
			if (remember) {
				app.config.set('password', params.password);
			}
			else {
				app.config.delete('password');
			}
			app.config.set('remember', remember);
			
			// pre-populate highlight words if not set
			if (!app.config.get('highlight_words')) {
				var words = app.user.full_name.split(/\s+/);
				if (words.indexOf(app.user.nickname) == -1) words.unshift( app.user.nickname );
				app.config.set('highlight_words', words.join(', '));
			}
			
			self.doLoginFinish();
			
			// notify other window
			app.sendAppCommand('login');
		},
		function(resp) {
			// error
			$('body').removeClass('loading');
			// app.doError( "Login Error: " + resp.description );
			app.doSystemErrorDialog( "Login Error", resp.description );
		} );
	},
	
	doLoginFinish: function() {
		// user logged in
		app.cacheBust = app.user.modified;
		
		// now we can populate the right side of the account form
		$('#fe_nickname').val( app.user.nickname || '' );
		$('#fe_fullname').val( app.user.full_name || '' );
		$('#fe_email').val( app.user.email || '' );
		$('#d_avatar').css('background-image', 'url(' + app.base_api_url + '/app/avatar/'+app.username+'.png?size=64&mod='+app.cacheBust+')');
		$('#btn_login').html( '&laquo; Logout' );
		
		// remove loading spinner and reflow form to show right panel
		$('body').removeClass('loading').addClass('logged_in');
	},
	
	doLogout: function() {
		// bye user!
		var self = this;
		app.api.post( 'user/logout', {}, function(resp) {
			// successfully logged out
			self.doLogoutFinish();
			
			// notify other window
			app.sendAppCommand('logout');
		},
		function(resp) {
			// error logging out, assume success
			self.doLogoutFinish();
			
			// notify other window
			app.sendAppCommand('logout');
		});
	},
	
	doLogoutFinish: function() {
		// user logged out
		app.config.delete('session_id');
		delete app.user;
		delete app.username;
		$('#d_avatar').css('background-image', '');
		$('#btn_login').html( 'Login &raquo;' );
		
		$('body').removeClass('loading logged_in');
	},
	
	uploadStart: function(files, userData) {
		// upload has started
		if ($P().uploadStart) $P().uploadStart(files, userData);
		$('body').addClass('loading');
	},
	
	uploadComplete: function(response, userData) {
		// avatar upload has completed
		$('body').removeClass('loading');
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			return app.doError("Upload Failed: JSON Parse Error: " + err);
		}
		
		if (data && (data.code != 0)) {
			return app.doError("Upload Failed: " + data.description);
		}
		
		if ($P().uploadComplete) $P().uploadComplete(data, userData);
	},
	
	uploadError: function(type, message, userData) {
		// avatar upload error
		$('body').removeClass('loading');
		app.doError("Upload Failed: " + message);
	},
	
	doSave: function() {
		// tell current page to save its state
		if ($P().doSave) $P().doSave();
	},
	
	handleKeyDown: function(event) {
		// user has hit a key
		
		// check for hot key (record)
		var key_id = app.getHotKeyID(event);
		if (key_id && this.onHotKeyRecord) {
			event.preventDefault();
			this.onHotKeyRecord(key_id);
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
	}
	
}; // app.prefs

function $P(id) {
	// locate prefs page
	if (!id) id = app.prefs.current_page_id;
	return app.prefs.pages[id] || {};
}

//
// Account Page
//

app.prefs.pages.account = {
	
	init: function() {
		// init account page
		var self = this;
		
		$('#fe_hostname').val( app.config.get('hostname') || '' );
		$('#fe_username').val( app.config.get('username') || '' );
		$('#fe_password').val( app.config.get('password') || '' );
		
		$('#fe_remember')
			.prop('checked', !!app.config.get('remember') )
			.on('change', function() { app.config.set('remember', $(this).is(':checked')); } );
			
		$('#fe_ssl')
			.prop( 'checked', !!app.config.get('ssl') )
			.on('change', function() { app.config.set('ssl', $(this).is(':checked')); } );
		
		$('#btn_login').on('mouseup', this.toggleLoginLogout.bind(this) );
		$('#btn_upload').on('mouseup', this.clickUpload.bind(this) );
		$('#btn_camera').on('mousedown', this.clickCamera.bind(this) );
		$('#btn_delete').on('mouseup', this.clickDelete.bind(this) );
		
		$('#fe_hostname, #fe_username, #fe_password').on('keydown', function(event) {
			if (event.keyCode == 13) {
				event.preventDefault();
				if (!app.user) app.prefs.doLogin();
			}
		});
		
		$('#fe_nickname, #fe_fullname, #fe_email').on('keyup', function() {
			if (app.user) app.user.dirty = true;
		});
		
		if (!$('#fe_hostname').val()) $('#fe_hostname').focus();
		
		// password show/hide toggle
		$('#s_pwd_toggle').on('mouseup', function() {
			var $this = $(this);
			var $fe = $('#fe_password');
			
			if ($fe.attr('type') == 'password') {
				$fe.attr('type', 'text');
				$this.html('(Hide)');
			}
			else {
				$fe.attr('type', 'password');
				$this.html('(Show)');
			}
		});
		
		// open server
		$('#btn_server').on('mouseup', this.clickOpenServer.bind(this) );
	},
	
	onActivate: function() {
		// setup upload for avatar
		ZeroUpload.setURL( app.base_api_url + '/app/upload_avatar' );
		ZeroUpload.setMaxFiles( 1 );
		ZeroUpload.setMaxBytes( 1 * 1024 * 1024 ); // 1 MB
		ZeroUpload.setFileTypes( "image/jpeg", "image/png", "image/gif" );
	},
	
	clickOpenServer: function() {
		// launch server in user's default browser
		var url = app.base_url + '/?auth=' + app.config.get('session_id');
		window.location = url;
	},
	
	clickUpload: function() {
		// upload avatar
		if (app.user) {
			ZeroUpload.chooseFiles({
				session_id: app.config.get('session_id'),
				orient: 1,
				convert: 1
			});
		}
	},
	
	clickCamera: function() {
		// load device list (may have changed), then show dialog
		app.camera.loadDeviceList( this.showCameraDialog.bind(this) );
	},
	
	showCameraDialog: function() {
		// show webcam capture dialog
		var self = this;
		var html = '';
		
		// early check -- does the user actually have a webcam?
		if (!app.cameras.length) {
			return app.doError("No available cameras were found on your machine.");
		}
		
		// default to first camera if user doesn't prefer one
		var user_device_id = app.camera.getUserDeviceId();
		
		// construct HTML for dialog
		html += '<div class="prefs_avatar_webcam_container">';
			html += '<div class="prefs_avatar_webcam_preloader"><i class="fa fa-refresh fa-spin"></i></div>';
			
			html += '<div id="d_webcam" class="prefs_avatar_webcam"></div>';
			
			// border-radius doesn't work on <video> elements, so we have to superimpose something on top
			html += '<div class="prefs_avatar_webcam_overlay">';
				html += '<div class="prefs_avatar_webcam_overlay_inner"></div>';
			html += '</div>';
			
			// snap button
			html += '<div id="btn_snap" class="form_icon" title="Take Snapshot [Space / Enter]"><i class="fa fa-camera"></i></div>';
			
		html += '</div>';
		
		app.dialog.onHide = function () {
			// hook dialog hide so we can properly shut down the camera
			Webcam.off('live');
			Webcam.reset();
			$('#btn_camera').removeClass('selected');
		};
		
		app.dialog.onKeyDown = function(event) {
			// keydown in dialog
			if ((event.keyCode == 13) || (event.keyCode == 32)) {
				event.preventDefault();
				self.clickCameraSnap();
			}
		};
		
		app.dialog.show( $('#btn_camera')[0], 'top', html );
		
		$('#btn_camera').addClass('selected');
		$('.scrollarea').addClass('disabled');
		$('.prefs_avatar_webcam_overlay').on('contextmenu', this.selectCameraDevice.bind(this) );
		
		Webcam.set({
			// native HTML5 webcam only
			enable_flash: false,
			
			// live preview size
			width: 240,
			height: 180,
			
			// device capture size
			dest_width: 480,
			dest_height: 360,
			
			// final cropped size
			crop_width: 360,
			crop_height: 360,
			
			// format and quality
			image_format: 'jpeg',
			jpeg_quality: 95,
			upload_name: 'file1',
			
			// constraints
			constraints: {
				width: 480,
				height: 360,
				deviceId: user_device_id
			}
		});
		
		Webcam.on('live', function() {
			// camera is live, show snap icon and hide preloader animation
			$('.prefs_avatar_webcam_preloader').css('display', 'none');
			$('#btn_snap').css('opacity', 1).off().on('mouseup', self.clickCameraSnap.bind(self));
		});
		
		Webcam.attach( '#d_webcam' );
	},
	
	selectCameraDevice: function(event) {
		// popup context menu with selection of camera devices
		event.preventDefault();
		
		app.camera.chooseDevice( function(device) {
			// user changed selection (webcam will reload and fire 'live' again)
			$('.prefs_avatar_webcam_preloader').css('display', 'block');
		} );
	},
	
	clickCameraSnap: function() {
		// snap webcam pic!
		var self = this;
		app.sound.play('snapshot');
		
		Webcam.snap( function(data_uri) {
			// got image, now upload it
			app.dialog.hide();
			$('body').addClass('loading');
			
			var upload_url = ZeroUpload.url + '?session_id=' + app.config.get('session_id');
			
			Webcam.upload( data_uri, upload_url, function(code, text, status) {
				// upload complete, check for error
				$('body').removeClass('loading');
				
				if (code != 200) {
					return app.doError("Avatar Webcam upload failed: HTTP " + code + " " + status);
				}
				
				// check for JSON error as well
				var resp = null;
				try { resp = JSON.parse(text); } 
				catch (err) {
					return app.doError("Avatar Webcam upload failed: " + err);
				}
				if (resp.code != 0) {
					return app.doError("Avatar Webcam upload failed: " + resp.description);
				}
				
				// done
				self.uploadComplete();
			} ); // upload
		} ); // snap
	},
	
	clickDelete: function() {
		// delete avatar
		var self = this;
		
		if (app.user && app.user.custom_avatar) {
			$('body').addClass('loading');
			app.api.post( 'app/delete_avatar', {}, function(resp) {
				// avatar deleted
				$('body').removeClass('loading');
				self.uploadComplete();
			});
		}
	},
	
	uploadComplete: function(response, userData) {
		// new avatar uploaded
		app.user.custom_avatar = 1;
		app.cacheBust = timeNow(true);
		$('#d_avatar').css('background-image', 'url(' + app.base_api_url + '/app/avatar/'+app.username+'.png?size=64&mod='+app.cacheBust+')');
	},
	
	toggleLoginLogout: function() {
		// toggle login / logout, based on current state
		if (app.user) app.prefs.doLogout();
		else if (!$('body').hasClass('loading')) app.prefs.doLogin();
	},
	
	doSave: function() {
		// app is telling us to save state (i.e. user closed the prefs window)
		if (app.user && app.user.dirty) {
			app.api.post( 'user/update', {
				username: app.username,
				old_password: $('#fe_password').val(),
				nickname: trim($('#fe_nickname').val().replace(/\s+/g, '')) || app.username,
				full_name: trim($('#fe_fullname').val()),
				email: trim($('#fe_email').val())
			}, 
			function(resp) {
				// save complete
				Debug.trace("User save complete");
				delete app.user.dirty;
			} );
		}
	},
	
	onDeactivate: function() {
		// user leaving account tab
		this.doSave();
	}
	
}; // account page

//
// Theme Page
//

app.prefs.pages.theme = {
	
	init: function() {
		// init theme page
		var self = this;
		var prefs = app.config.store;
		
		// theme menu
		$('#fe_theme')
			.val(prefs.theme)
			.on('change', function() {
				// theme changed
				app.config.set('theme', $(this).val());
				app.prefsChanged({ theme: 1 });
				app.sendAppCommand( 'prefs_changed', { theme: 1 } );
			});
		
		// sidebar color
		$('#fe_sidebar_color')
			.val(prefs.sidebar_color)
			.on('change', function() {
				// sidebar color changed
				app.config.set('sidebar_color', $(this).val());
				app.prefsChanged({ sidebar: 1 });
				app.sendAppCommand( 'prefs_changed', { sidebar: 1 } );
			});
		
		// highlight color
		$('#fe_highlight_color')
			.val( prefs.highlight_color )
			.on('change', function() {
				// highlight color changed
				app.config.set('highlight_color', $(this).val());
				app.prefsChanged({ highlight_color: 1 });
				app.sendAppCommand( 'prefs_changed', { highlight_color: 1 } );
			});
		
		// edited color
		$('#fe_edit_color')
			.val( prefs.edit_color )
			.on('change', function() {
				// edited color changed
				app.config.set('edit_color', $(this).val());
				app.prefsChanged({ edit_color: 1 });
				app.sendAppCommand( 'prefs_changed', { edit_color: 1 } );
			});
		
		// main body font
		$('#fe_font')
			.val(prefs.body_font)
			.on('change', function() {
				// body font changed
				app.config.set('body_font', $(this).val());
				app.prefsChanged({ theme: 1 });
				app.sendAppCommand( 'prefs_changed', { theme: 1 } );
			});
		
		// code font
		$('#fe_mfont')
			.val(prefs.mono_font)
			.on('change', function() {
				// mono font changed
				app.config.set('mono_font', $(this).val());
				app.prefsChanged({ theme: 1 });
				app.sendAppCommand( 'prefs_changed', { theme: 1 } );
			});
		
		// show usernames
		$('#fe_show_nicknames')
			.prop( 'checked', !!app.config.get('show_usernames') )
			.on('change', function() {
				app.config.set('show_usernames', $(this).is(':checked')); 
				app.prefsChanged({ show_usernames: 1 });
				app.sendAppCommand( 'prefs_changed', { show_usernames: 1 } );
			} );
	},
	
	onActivate: function() {
		// tab is being activated, user will be logged in now
		var self = this;
		var prefs = app.config.store;
		
		// main font text preview
		$('#d_prefs_sample_text_main > .sb_chat_row_avatar').css('background-image', 'url(' + app.base_api_url + '/app/avatar/'+app.username+'.png?size=64&mod='+app.cacheBust+')');
		$('#d_prefs_sample_text_main > .sb_chat_row_nick').html( app.user.nickname );
		
		// code font text preview
		$('#d_prefs_sample_text_code > .sb_chat_row_avatar').css('background-image', 'url(' + app.base_api_url + '/app/avatar/'+app.username+'.png?size=64&mod='+app.cacheBust+')');
		$('#d_prefs_sample_text_code > .sb_chat_row_nick').html( app.user.nickname );
		
		var results = hljs.highlightAuto( '{"sample":"code"}' );
		var code_html = '<pre><code>' + results.value + '</code></pre>';
		$('#d_prefs_sample_text_code > .sb_chat_bubble').html( code_html );
		
		// emoji style
		$('#fe_emoji_style')
			.val(prefs.emoji_style)
			.on('change', function() {
				// emoji style changed
				app.config.set('emoji_style', $(this).val());
				app.prefsChanged({ emoji_style: 1 });
				app.sendAppCommand( 'prefs_changed', { emoji_style: 1 } );
			});
		
		$('#d_prefs_sample_emoji').html(
			app.emoji.getEmojiHTML('smiley') + 
			app.emoji.getEmojiHTML('smiling_imp') + 
			app.emoji.getEmojiHTML('ghost') + 
			app.emoji.getEmojiHTML('bee') + 
			app.emoji.getEmojiHTML('deciduous_tree') + 
			app.emoji.getEmojiHTML('earth_americas')
		);
		
		// emoji_skin_tone
		$('#fe_emoji_skin_tone')
			.val( app.user.emoji_skin_tone || '' )
			.on('change', function() {
				// emoji skin tone changed (this is stored in the user record)
				var new_skin_tone = $(this).val();
				
				// might as well give instant feedback here
				app.user.emoji_skin_tone = new_skin_tone;
				self.updateSkinTones();
				
				// save user record
				app.api.post( 'app/user_update', {
					emoji_skin_tone: new_skin_tone
				}, 
				function(resp) {
					// save complete (server will notify all users including us in the other window)
					
					Debug.trace("User save complete (emoji_skin_tone: " + new_skin_tone + ")");
					
					// app.prefsChanged({ emoji_skin_tone: new_skin_tone });
					// app.sendAppCommand( 'prefs_changed', { emoji_skin_tone: new_skin_tone } );
				} );
			});
		
		this.updateSkinTones();
	},
	
	updateSkinTones: function() {
		// update skin tone preview
		$('#d_prefs_sample_emoji_skin_tones').html(
			app.emoji.getEmojiHTML('+1', 0, '', app.user.emoji_skin_tone) + 
			app.emoji.getEmojiHTML('-1', 0, '', app.user.emoji_skin_tone) + 
			app.emoji.getEmojiHTML('v', 0, '', app.user.emoji_skin_tone) + 
			app.emoji.getEmojiHTML('raised_hand_with_fingers_splayed', 0, '', app.user.emoji_skin_tone) + 
			app.emoji.getEmojiHTML('blond-haired-woman', 0, '', app.user.emoji_skin_tone) + 
			app.emoji.getEmojiHTML('person_with_blond_hair', 0, '', app.user.emoji_skin_tone)
		);
	}
	
}; // theme page

//
// Notifications Page
//

app.prefs.pages.notifications = {
	
	init: function() {
		// init notifications page
		var self = this;
		var prefs = app.config.store;
		
		// show notifications
		$('#fe_show_notifications')
			.prop( 'checked', !!prefs.show_notifications )
			.on('change', function() {
				app.config.set('show_notifications', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			} );
		
		// notification types
		$('#fe_notification_types')
			.val( prefs.notification_type )
			.on('change', function() {
				app.config.set('notification_type', $(this).val());
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			});
		
		// bounce icon
		$('#fe_bounce_icon')
			.prop( 'checked', !!prefs.bounce_icon )
			.on('change', function() {
				app.config.set('bounce_icon', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			} );
		
		// bounce types
		$('#fe_bounce_types')
			.val( prefs.bounce_type )
			.on('change', function() {
				app.config.set('bounce_type', $(this).val());
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			});
		
		// highlight words
		// moved to onActivate() below
		
		// ignore users
		$('#fe_ignore_users')
			.val( prefs.ignore_users )
			.on('change', function() {
				app.config.set('ignore_users', $(this).val());
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			});
		
		// hide users
		$('#fe_hide_users')
			.val( prefs.hide_users )
			.on('change', function() {
				app.config.set('hide_users', $(this).val());
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			});
		
		// auto away
		$('#fe_auto_away')
			.prop( 'checked', !!prefs.auto_away )
			.on('change', function() {
				app.config.set('auto_away', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			} );
		
		// auto back
		$('#fe_auto_back')
			.prop( 'checked', !!prefs.auto_back )
			.on('change', function() {
				app.config.set('auto_back', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			} );
	},
	
	onActivate: function() {
		// tab is being activated, user will be logged in now
		var self = this;
		var prefs = app.config.store;
		
		// delaying highlight words until onActivate because
		// we're auto-populating it with account info on first login
		
		$('#fe_highlight_words')
			.val( prefs.highlight_words )
			.on('change', function() {
				app.config.set('highlight_words', $(this).val());
				app.sendAppCommand( 'prefs_changed', { notifications: 1 } );
			});
		
		// add emoji to auto_away, auto_back
		var aa_em_html = app.emoji.getEmojiHTML('desktop_computer', 16, 'emoji prefs_label', '', "Screensaver");
		$('#lbl_auto_away').html( 'Set my status to &nbsp;' + aa_em_html + '&nbsp; when my screensaver activates' );
		
		var ab_em_html = app.emoji.getEmojiHTML('large_blue_circle', 16, 'emoji prefs_label', '', "Available");
		$('#lbl_auto_back').html( 'Set my status back to &nbsp;' + ab_em_html + '&nbsp; when I post a message' );
	}

};

//
// Hot Keys Page
//

app.prefs.pages.hotkeys = {
	
	init: function() {
		// init hot keys page
		var self = this;
		// var prefs = app.config.store;
		
		$('#btn_hk_reset').on('mouseup', function() { self.resetToDefaults(); } );
		$('#btn_hk_add').on('mouseup', function() { self.addNewKey(); } );
	},
	
	onActivate: function() {
		// tab is being activated, user will be logged in now
		var self = this;
		var prefs = app.config.store;
		var hot_keys = prefs.hot_keys;
		var key_list = Object.keys(hot_keys).sort( function(a, b) {
			// sort Cmd+1, Cmd+2 to end of list
			if (a.match(/^Cmd\+\d+$/)) a = 'Z' + a;
			if (b.match(/^Cmd\+\d+$/)) b = 'Z' + b;
			return a.localeCompare(b);
		} );
		
		var html = '';
		html += '<table class="prefs_table">';
		html += '<tr><th>Key Combo</th><th>Command</th></tr>';
		
		key_list.forEach( function(key) {
			var cmd = hot_keys[key];
			html += '<tr data-key="' + key + '">';
				html += '<td width="50%">';
					html += '<span class="prefs_key_group" title="Click to Record" onMouseUp="$P().recordKey(this)">';
					key.split(/\+/).forEach( function(cap) {
						html += '<span class="prefs_key_cap">' + cap + '</span>';
					} );
					html += '</span>';
				html += '</td>';
				html += '<td width="50%">';
					html += '<input type="text" class="form_input codelike prefs_key_cmd" value="' + encodeAttribEntities(cmd) + '" onFocus="$P().onCommandFocus(this,event)" onKeyDown="$P().onCommandKeyDown(this,event)" onChange="$P().onCommandChange(this)"/>';
					html += '<span class="prefs_key_delete" title="Delete Key" onMouseUp="$P().promptDelete(this)"><i class="fa fa-trash-o"></i></span>';
				html += '</td>';
			html += '</tr>';
		} );
		
		html += '</table>';
		
		$('#d_hot_keys').html( html );
		
		if (!key_list.length) {
			this.addNewKey('quiet');
		}
	},
	
	resetToDefaults: function(confirmed) {
		// reset all keys to defaults, refresh
		if (!confirmed) {
			var html = '';
			html += '<div style="width:300px; padding:12px 20px 12px 20px; text-align:center">';
				html += '<div style="">Are you sure you want to reset all hot keys to their factory default settings?</div>';
				html += '<div style="margin:20px 20px 0px 20px;">';
					html += '<div class="button left" style="width:80px" onMouseUp="app.dialog.hide()">Cancel</div>';
					html += '<div class="button right" style="width:80px" onMouseUp="$P().resetToDefaults(true)">Reset</div>';
					html += '<div class="clear"></div>';
				html += '</div>';
			html += '</div>';
			
			app.dialog.show( $('#btn_hk_reset')[0], 'top', html );
			return;
		}
		
		app.dialog.hide();
		app.config.set( 'hot_keys', app.default_config.hot_keys );
		app.sendAppCommand( 'prefs_changed', { hot_keys: 1 } );
		this.onActivate();
	},
	
	addNewKey: function(quiet) {
		// add new hot key row
		var $table = $('#d_hot_keys > table');
		
		if (!$table.find('tr.new_key').length) {
			// add row
			$table.append(
				'<tr class="new_key">' + 
					'<td width="50%"><span class="prefs_key_group" title="Click to Record" onMouseUp="$P().recordKey(this)"><span class="prefs_key_cap" style="background-color:transparent">Record New...</span></span></td>' + 
					'<td width="50%"><input type="text" class="form_input codelike prefs_key_cmd" placeholder="/command" value="" onFocus="$P().onCommandFocus(this,event)" onKeyDown="$P().onCommandKeyDown(this,event)" onChange="$P().onCommandChange(this)"/><span class="prefs_key_delete" title="Delete Key" onMouseUp="$P().promptDelete(this)"><i class="fa fa-trash-o"></i></span></td>' + 
				'</tr>'
			);
		}
		
		if (!quiet) {
			$('#d_hot_keys').scrollTop( 9999 );
			this.recordKey( $table.find('tr.new_key td .prefs_key_group')[0] );
		}
	},
	
	recordKey: function(elem) {
		// record new key combo
		var prefs = app.config.store;
		var hot_keys = prefs.hot_keys;
		var $elem = $(elem);
		var $tr = $elem.closest('tr');
		var old_key = $tr.data('key'); // may not exist yet
		var cmd = old_key ? hot_keys[old_key] : $tr.find('input').val();
		
		var html = '';
		html += '<div style="padding:12px 20px 12px 20px; text-align:center">';
			html += '<div><span class="highlight"><i class="fa fa-keyboard-o">&nbsp;&nbsp;</i>Recording...</span></div>';
			html += '<div style="margin-top:10px;">Type the desired key combination now.</div>';
			html += '<div style="margin-top:15px;"><div class="button center" style="width:80px" onMouseUp="app.dialog.hide()">Cancel</div></div>';
		html += '</div>';
		
		app.dialog.show( elem, 'top', html );
		$elem.addClass('selected');
		
		// capture hot key recording and apply
		app.prefs.onHotKeyRecord = function(new_key) {
			if (old_key && (new_key == old_key)) {
				// same key combo as before, just abort silently
				app.dialog.hide();
				return;
			}
			if (hot_keys[new_key]) {
				// key conflict
				app.doError("The key combination " + new_key + " is already in use.");
				return;
			}
			
			app.dialog.hide();
			
			// swap key in prefs
			if (old_key) app.config.delete( 'hot_keys.' + old_key );
			app.config.set( 'hot_keys.' + new_key, cmd );
			app.sendAppCommand( 'prefs_changed', { hot_keys: 1 } );
			
			// redraw keycap UI
			var html = '';
			new_key.split(/\+/).forEach( function(cap) {
				html += '<span class="prefs_key_cap flash_outside">' + cap + '</span>';
			} );
			$elem.html( html );
			
			$tr.data('key', new_key);
			$tr.removeClass('new_key');
			
			if (!cmd) $tr.find('input').focus();
		};
		
		// remove our hook on dialog hide
		app.dialog.onHide = function() {
			delete app.prefs.onHotKeyRecord;
			$elem.removeClass('selected');
		};
	},
	
	onCommandFocus: function(elem, event) {
		// remove flash from before
		var $elem = $(elem);
		$elem.removeClass('flash_outside');
	},
	
	onCommandKeyDown: function(elem, event) {
		// capture enter
		switch (event.keyCode) {
			case 13: // enter
				event.preventDefault();
				elem.blur();
			break;
		}
	},
	
	onCommandChange: function(elem) {
		// update existing hot key command
		var $elem = $(elem);
		var key = $elem.closest('tr').data('key');
		if (!key) return; // new row, no key assigned yet
		
		app.config.set( 'hot_keys.' + key, $elem.val().trim() );
		app.sendAppCommand( 'prefs_changed', { hot_keys: 1 } );
		$elem.addClass('flash_outside');
	},
	
	promptDelete: function(elem) {
		// prompt user to delete hot key
		var $elem = $(elem);
		var $tr = $elem.closest('tr');
		var key = $tr.data('key');
		// $elem.addClass('selected');
		
		if (key) {
			app.config.delete( 'hot_keys.' + key );
			app.sendAppCommand( 'prefs_changed', { hot_keys: 1 } );
		}
		$tr.remove();
		
		// no more?
		var $table = $('#d_hot_keys > table');
		if (!$table.find('tr td').length) {
			this.addNewKey('quiet');
		}
	}

};

//
// Shortcuts Page
//

app.prefs.pages.shortcuts = {
	
	init: function() {
		// init shortcuts page
		var self = this;
		// var prefs = app.config.store;
		this.emojiSearch_Debounce = debounce( app.emoji.doAutoSearch.bind(app.emoji), 100 );
		
		$('#btn_sc_reset').on('mouseup', function() { self.resetToDefaults(); } );
		$('#btn_sc_add').on('mouseup', function() { self.addNewShortcut(); } );
	},
	
	onActivate: function() {
		// tab is being activated, user will be logged in now
		var self = this;
		var prefs = app.config.store;
		var shortcuts = prefs.shortcuts;
		var cut_list = Object.keys(shortcuts).sort();
		
		var html = '';
		html += '<table class="prefs_table">';
		html += '<tr><th>Shortcut</th><th>Expand To</th></tr>';
		
		cut_list.forEach( function(key) {
			var value = shortcuts[key];
			html += '<tr data-key="' + encodeAttribEntities(key) + '">';
				html += '<td width="50%">';
					html += '<input type="text" class="form_input prefs_shortcut_key" placeholder="" value="' + encodeAttribEntities(key) + '" onFocus="$P().onShortcutFocus(this,event)" onKeyDown="$P().onShortcutKeyDown(this,event)" onChange="$P().onShortcutKeyChange(this,event)"/>';
				html += '</td>';
				html += '<td width="50%">';
					html += '<div class="prefs_shortcut_editable" contentEditable="true" onFocus="$P().onEditableFocus(this,event)" onKeyDown="$P().onEditableKeyDown(this,event)" onInput="$P().onEditableInput(this,event)" onBlur="$P().onEditableBlur(this,event)">' + value + '</div>';
					html += '<div class="prefs_shortcut_delete" title="Delete Shortcut" onMouseUp="$P().deleteShortcut(this)"><i class="fa fa-trash-o"></i></div>';
					html += '<div class="clear"></div>';
				html += '</td>';
			html += '</tr>';
		} );
		
		html += '</table>';
		
		$('#d_shortcuts').html( html );
		
		if (!cut_list.length) {
			this.addNewShortcut('quiet');
		}
	},
	
	onShortcutFocus: function(elem, event) {
		// remove flash from last time, if applicable
		$(elem).removeClass('flash_outside');
	},
	
	onShortcutKeyDown: function(elem, event) {
		// prevent spaces and other undesirables
		switch (event.keyCode) {
			case 32: // space
			case 220: // backslash
				event.preventDefault();
			break;
			
			case 13: // enter
				event.preventDefault();
				elem.blur();
			break;
		}
	},
	
	onShortcutKeyChange: function(elem, event) {
		// shortcut key has changed
		var $elem = $(elem);
		var $tr = $elem.closest('tr');
		var old_key = $tr.data('key') || '';
		var new_key = $elem.val().trim().replace(/\s+/g, '');
		var value = $tr.find('div.prefs_shortcut_editable').text().trim();
		var prefs = app.config.store;
		var shortcuts = prefs.shortcuts;
		
		if (old_key && (new_key == old_key)) {
			// same key as before, just abort silently
			return;
		}
		if (!new_key) return; // empty field
		
		if (shortcuts[new_key]) {
			// key conflict
			app.doError("The shortcut macro '" + new_key + "' is already in use.");
			$elem.val('').focus();
			return;
		}
		
		// swap key in prefs
		if (old_key) app.config.delete( 'shortcuts.' + escapeDotProp(old_key) );
		app.config.set( 'shortcuts.' + escapeDotProp(new_key), value );
		app.sendAppCommand( 'prefs_changed', { shortcuts: 1 } );
		
		// update UI
		$tr.data('key', new_key);
		$tr.removeClass('new_cut');
		
		if (!value) $tr.find('div.prefs_shortcut_editable').focus();
		else $elem.addClass('flash_outside');
	},
	
	onEditableFocus: function(elem, event) {
		// remove flash from last time, if applicable
		$(elem).removeClass('flash_outside');
	},
	
	onEditableKeyDown: function(elem, event) {
		// capture enter key
		switch (event.keyCode) {
			case 13: // enter
				event.preventDefault();
				elem.blur();
				$(elem).trigger('blur');
			break;
		}
	},
	
	onEditableInput: function(elem, event) {
		// allow emoji auto-complete inside editable
		this.emojiSearch_Debounce();
	},
	
	onEditableBlur: function(elem, event) {
		// update shortcut value after blur
		var $elem = $(elem);
		var $tr = $elem.closest('tr');
		var key = $tr.data('key') || '';
		if (!key) return; // no key set yet
		var value = $elem.text().trim();
		
		var prefs = app.config.store;
		var shortcuts = prefs.shortcuts;
		if (value != shortcuts[key]) {
			// value has changed, update and flash
			app.config.set( 'shortcuts.' + escapeDotProp(key), value );
			app.sendAppCommand( 'prefs_changed', { shortcuts: 1 } );
			$elem.addClass('flash_outside');
		}
	},
	
	resetToDefaults: function(confirmed) {
		// reset all shortcuts to defaults, refresh
		if (!confirmed) {
			var html = '';
			html += '<div style="padding:12px 20px 12px 20px; text-align:center">';
				html += '<div style="">Are you sure you want to delete all shortcuts?</div>';
				html += '<div style="margin:20px 20px 0px 20px;">';
					html += '<div class="button left" style="width:80px" onMouseUp="app.dialog.hide()">Cancel</div>';
					html += '<div class="button right" style="width:80px" onMouseUp="$P().resetToDefaults(true)">Delete</div>';
					html += '<div class="clear"></div>';
				html += '</div>';
			html += '</div>';
			
			app.dialog.show( $('#btn_sc_reset')[0], 'top', html );
			return;
		}
		
		app.dialog.hide();
		app.config.set( 'shortcuts', app.default_config.shortcuts );
		app.sendAppCommand( 'prefs_changed', { shortcuts: 1 } );
		this.onActivate();
	},
	
	addNewShortcut: function(quiet) {
		// add new shortcut row
		var $table = $('#d_shortcuts > table');
		
		if (!$table.find('tr.new_cut').length) {
			// add row
			$table.append(
				'<tr class="new_cut">' + 
					'<td width="50%"><input type="text" class="form_input prefs_shortcut_key" placeholder="Enter shortcut..." value="" onFocus="$P().onShortcutFocus(this,event)" onKeyDown="$P().onShortcutKeyDown(this,event)" onChange="$P().onShortcutKeyChange(this,event)"/></td>' + 
					'<td width="50%"><div class="prefs_shortcut_editable" contentEditable="true" onFocus="$P().onEditableFocus(this,event)" onKeyDown="$P().onEditableKeyDown(this,event)" onInput="$P().onEditableInput(this,event)" onBlur="$P().onEditableBlur(this,event)"></div><div class="prefs_shortcut_delete" title="Delete Shortcut" onMouseUp="$P().deleteShortcut(this)"><i class="fa fa-trash-o"></i></div><div class="clear"></div></td>' + 
				'</tr>'
			);
		}
		
		if (!quiet) {
			$('#d_shortcuts').scrollTop( 9999 );
			$table.find('tr.new_cut td input.prefs_shortcut_key').focus();
		}
	},
	
	deleteShortcut: function(elem) {
		// remove shortcut from prefs and UI
		var $elem = $(elem);
		var $tr = $elem.closest('tr');
		var key = $tr.data('key');
		// $elem.addClass('selected');
		
		if (key) {
			app.config.delete( 'shortcuts.' + escapeDotProp(key) );
			app.sendAppCommand( 'prefs_changed', { shortcuts: 1 } );
		}
		$tr.remove();
		
		// no more?
		var $table = $('#d_shortcuts > table');
		if (!$table.find('tr td').length) {
			this.addNewShortcut('quiet');
		}
	}

};


//
// Sounds Page
//

app.prefs.pages.sounds = {
	
	title: 'Sounds &amp; Media',
	
	events: {
		message: "Message Received",
		joined: "User Joined",
		left: "User Left",
		
		private: "Private Message",
		request: "Chat Request",
		highlight: "Highlight",
		correction: "Correction",
		upload: "File Uploaded",
		
		whisper: "Whisper",
		snapshot: "Take Snapshot",
		react: "Reaction",
		
		error: "Error Occurred"
	},
	
	event_order: ['message', 'joined', 'left', 'private', 'request', 'highlight', 'correction', 'upload', 'whisper', 'snapshot', 'react', 'error'],
	
	pack_titles: {
		pack1: "Sound Pack 1",
		pack2: "Sound Pack 2",
		pack3: "Sound Pack 3",
		chatterclassic: "Chatter Classic",
		misc: "Miscellaneous"
	},
	
	short_pack_titles: {
		pack1: "Pack 1",
		pack2: "Pack 2",
		pack3: "Pack 3",
		chatterclassic: "Chatter",
		misc: "Misc"
	},
	
	pack_order: ['pack1', 'pack2', 'pack3', 'chatterclassic', 'misc'],
	
	init: function() {
		// init sounds page
		var self = this;
		var prefs = app.config.store;
		
		// fe_sound_pack
		var sound_pack = numKeys(prefs.sounds) ? 'custom' : prefs.sound_pack;
		$('#fe_sound_pack')
			.val( sound_pack )
			.on('change', function() {
				var sel = $(this).val();
				if (sel != 'custom') {
					app.config.set('sound_pack', sel);
					app.config.set('sounds', {}); // clear all user selections
					app.sound.tracks = {};
					app.sendAppCommand( 'prefs_changed', { sound: 1 } );
					self.refreshSoundEffects();
				}
			});
		
		// fe_volume
		$('#fe_volume')
			.val( prefs.sound_volume )
			.on('change', function() {
				var vol = parseFloat( $(this).val() );
				app.config.set({
					'sound_volume': vol,
					'sound_mute': false
				});
				app.sound.notifyVolumeChanged();
				app.sound.play('message');
				app.sendAppCommand( 'prefs_changed', { volume: 1 } );
				$('#d_sound_volume').html( 'Sound Volume (' + Math.floor(vol * 100) + '%)' );
			});
		$('#d_sound_volume').html( 
			prefs.sound_muted ? 'Sound Volume (Muted)' : 
			('Sound Volume (' + Math.floor(prefs.sound_volume * 100) + '%)')
		);
		
		// fe_auto_media
		$('#fe_auto_media')
			.prop( 'checked', !!prefs.autoplay_media )
			.on('change', function() {
				app.config.set('autoplay_media', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { autoplay: 1 } );
			} );
		
		// fe_auto_play
		$('#fe_auto_play')
			.prop( 'checked', !!prefs.autoplay_sounds )
			.on('change', function() {
				app.config.set('autoplay_sounds', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { autoplay: 1 } );
			} );
		
		// fe_emoji_sounds
		$('#fe_emoji_sounds')
			.prop( 'checked', !!prefs.emoji_sounds )
			.on('change', function() {
				app.config.set('emoji_sounds', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { autoplay: 1 } );
			} );
		
		// fe_mute_chat_sounds_in_focus
		$('#fe_mute_chat_sounds_in_focus')
			.prop( 'checked', !!prefs.mute_chat_sounds_in_focus )
			.on('change', function() {
				app.config.set('mute_chat_sounds_in_focus', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { autoplay: 1 } );
			} );
		
		// btn_open_folder
		$('#btn_open_folder').on('mouseup', function() {
			app.sendAppCommand( 'open_user_sounds' );
		});
		
		// fe_mute_users
		$('#fe_mute_users')
			.val( prefs.mute_users )
			.on('change', function() {
				app.config.set('mute_users', $(this).val());
				app.sendAppCommand( 'prefs_changed', { autoplay: 1 } );
			});
	},
	
	onActivate: function() {
		// prefs page is being activated
		this.refreshSoundEffects();
	},
	
	getEffectOptions: function(sel_value) {
		// get menu options html for a given event
		var self = this;
		var op_html = '';
		
		this.pack_order.forEach( function(pack_name) {
			var pack_title = self.pack_titles[pack_name];
			var short_pack_title = self.short_pack_titles[pack_name];
			var pack_files = app.sound_setup.packs[pack_name];
			
			if (pack_files && pack_files.length) {
				op_html += '<option value="" disabled="disabled"></option>';
				op_html += '<optgroup label="' + pack_title + '">';
				for (var idx = 0, len = pack_files.length; idx < len; idx++) {
					var filename = pack_files[idx];
					var sound_name = filename.replace(/\.\w+$/, '');
					var sound_title = self.events[sound_name];
					var sound_id = 'sounds/' + pack_name + '/' + sound_name;
					
					op_html += '<option value="' + sound_id + '"';
					if (sel_value == sound_id) op_html += ' selected="selected"';
					op_html += '>' + short_pack_title + ' - ' + sound_title + '</option>';
				}
				op_html += '</optgroup>';
			}
		} );
		
		// user sounds
		if (app.sound_setup.user_sounds && app.sound_setup.user_sounds.length) {
			op_html += '<option value="" disabled="disabled"></option>';
			op_html += '<optgroup label="Custom Sounds">';
			app.sound_setup.user_sounds.forEach( function(filename) {
				var sound_id = 'user/' + filename;
				
				op_html += '<option value="' + sound_id + '"';
				if (sel_value == sound_id) op_html += ' selected="selected"';
				op_html += '>' + filename + '</option>';
			} );
			op_html += '</optgroup>';
		}
		
		return op_html;
	},
	
	refreshSoundEffects: function() {
		// redraw sounds effects in scroll area
		if (!app.sound_setup) {
			Debug.trace('sound', "in refreshSoundEffects, app.sound_setup is false!");
			return;
		}
		
		var self = this;
		var prefs = app.config.store;
		var html = '';
		
		this.event_order.forEach( function(event_name) {
			var event_title = self.events[event_name];
			html += '<div class="form_group">';
			
			html += '<div class="form_label">' + event_title;
			html += '<span class="form_label_icon" onMouseUp="app.sound.play(\'' + event_name + '\')"><i class="fa fa-volume-up"></i></span>';
			// html += '<div class="clear"></div>';
			html += '</div>';
			
			html += '<div><select data-sound="' + event_name + '" onChange="$P().changeSoundEffect(this)">';
			html += '<option value="">(No Sound)</option>';
			
			var sel_value = '';
			if (event_name in prefs.sounds) {
				sel_value = prefs.sounds[event_name];
			}
			else {
				var pack_filename = event_name + '.mp3';
				var pack_name = prefs.sound_pack;
				var pack_files = app.sound_setup.packs[pack_name] || [];
				var pack_has_sound = !!(pack_files.indexOf(pack_filename) > -1);
				if (pack_has_sound) {
					sel_value = 'sounds/' + pack_name + '/' + event_name;
				}
				else {
					// pack doesn't have sound, try looking in misc/
					var misc_files = app.sound_setup.packs.misc || [];
					var misc_has_sound = !!(misc_files.indexOf(pack_filename) > -1);
					if (misc_has_sound) {
						sel_value = 'sounds/misc/' + event_name;
					}
				}
			}
			
			html += self.getEffectOptions(sel_value);
			
			html += '</select></div>';
			html += '</div>'; // form_group
		} );
		
		$('#d_sound_effects').html( html );
	},
	
	changeSoundEffect: function(elem) {
		// select custom sound effect for event, and play it
		var $elem = $(elem);
		var value = $elem.val();
		var event_name = $elem.data('sound');
		
		// update sound in prefs
		app.config.set('sounds.' + event_name, value);
		
		// inform chat window
		app.sendAppCommand( 'prefs_changed', { sound: 1 } );
		
		// set pack menu to custom
		$('#fe_sound_pack').val( 'custom' );
		
		// play new sound
		app.sound.play(event_name, true);
	},
	
	notifySoundSetupUpdate: function(sound_setup) {
		// if we're the active tab, refresh menus
		if (app.prefs.current_page_id == 'sounds') {
			this.refreshSoundEffects();
		}
	}
	
};

//
// Updates Page
//

app.prefs.pages.updates = {
	
	title: "Software Updates",
	
	init: function() {
		// init updates page
		var self = this;
		var prefs = app.config.store;
		
		// enable auto updates
		$('#fe_auto_update_enabled')
			.prop( 'checked', !!prefs.auto_update_enabled )
			.on('change', function() {
				app.config.set('auto_update_enabled', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { auto_update: 1 } );
			} );
		
		// show notifications
		$('#fe_auto_update_notify')
			.prop( 'checked', !!prefs.auto_update_notify )
			.on('change', function() {
				app.config.set('auto_update_notify', $(this).is(':checked')); 
				app.sendAppCommand( 'prefs_changed', { auto_update: 1 } );
			} );
		
		// hook state change event
		ipcRenderer.on('auto_update_state', function(event, message) {
			self.onStateChange(message);
		});
		
		// request initial state from main process
		app.sendAppCommand( 'auto_update_get_state', {} );
	},
	
	onStateChange: function(data) {
		// got state change from main process
		Debug.trace('update', "State change: ", data);
		
		for (var key in data) {
			this[key] = data[key];
		}
		
		if (!this.latest) this.fetchLatestInfo();
		else this.displayInfo();
	},
	
	onActivate: function() {
		// tab is being activated, user will be logged in now
		this.fetchLatestInfo();
	},
	
	fetchLatestInfo: function() {
		// fetch latest release info
		var self = this;
		if (!this.url) return;
		
		fetch( this.url )
			.then( function(res) {
				if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
				return res.json();
			} )
			.then(function(json) {
				self.receiveLatestInfo(json);
			} )
			.catch( function(err) {
				// API error from update server
				Debug.trace('update', "API ERROR: " + err);
				var html = '';
				
				html += '<i class="fa fa-exclamation-triangle" style="font-size:32px; padding-right:16px;"></i>';
				
				html += '<div>';
					html += '<div class="user_info_label">Update Server Error</div>';
					html += '<div class="user_info_value">An error occurred accessing the server:<br/>' + (err.message || err) + '</div>';
				html += '</div>';
				
				$('#d_update_state').html( html );
			} );
	},
	
	receiveLatestInfo: function(data) {
		// got latest release info from server
		if (data.name && !data.version) {
			data.version = data.name.replace(/^\D+(\d+\.\d+\.\d+)$/, '$1');
		}
		Debug.trace('update', "Got release data: ", data);
		this.latest = data;
		this.displayInfo();
	},
	
	displayInfo: function() {
		// show current and latest info, state, actions
		var html = '';
		html += '<div>';
		
		var state = this.state;
		var cur_version = package.version;
		var latest_version = this.latest.version;
		var is_update_available = ( get_int_version(latest_version) > get_int_version(cur_version) );
		
		// States: dev, checking-for-update, downloading-update, update-not-available, update-downloaded
		
		html += '<div style="display:flex; align-items:center; justify-content:center;">';
			html += '<i class="fa ' + (is_update_available ? 'fa-upload' : 'fa-check-circle') + '" style="font-size:32px; padding-right:16px;"></i>';
			html += '<div style="margin-right:16px;">';
				html += '<div class="user_info_label">Current Version</div>';
				html += '<div class="user_info_value">v' + cur_version + '</div>';
			html += '</div>';
			html += '<div>';
				html += '<div class="user_info_label ' + (is_update_available ? 'highlight' : '') + '">Latest Version</div>';
				html += '<div class="user_info_value ' + (is_update_available ? 'highlight' : '') + '">v' + latest_version + '</div>';
			html += '</div>';
		html += '</div>';
		
		html += '<div style="display:flex; align-items:center; justify-content:center; margin-top:12px;">';
			html += '<div>';
			switch (state) {
				case 'dev':
					html += '<div class="user_info_value" style="font-weight:normal">You are running in development mode,<br/>so the update system is disabled.</div>';
				break;
				
				case 'checking-for-update':
				case 'downloading-update':
					html += '<div class="user_info_value" style="font-weight:normal">The update is downloading...</div>';
					html += '<div style="text-align:center; margin-top:8px;"><i class="fa fa-refresh fa-spin" style="font-size:20px; color:var(--highlight-color)"></i></div>';
				break;
				
				case 'update-downloaded':
					html += '<div class="user_info_value" style="font-weight:normal">Please restart the app to complete installation.</div>';
					html += '<div class="button center flash_outside" style="width:130px; margin-top:14px;" onMouseUp="$P().quitAndInstall()">Restart Now</div>';
				break;
				
				default:
					if (is_update_available) {
						html += '<div class="user_info_value" style="font-weight:normal">A new update is available!</div>';
						html += '<div class="button center" style="width:130px; margin-top:14px;" onMouseUp="$P().requestDownload()">Install</div>';
					}
					else {
						html += '<div class="user_info_value" style="font-weight:normal">You are on the latest version.<br/>No new updates are available.</div>';
					}
				break;
			} // switch state
			html += '</div>';
		html += '</div>';
		
		html += '</div>';
		$('#d_update_state').html( html );
	},
	
	refresh: function() {
		// re-check server for latest info
		$('#d_update_state').html( '<i class="fa fa-refresh fa-spin" style="font-size:20px"></i>' );
		this.fetchLatestInfo();
	},
	
	requestDownload: function() {
		// send command to begin download of latest version
		app.sendAppCommand( 'auto_update_download', {} );
	},
	
	quitAndInstall: function() {
		// send command to install and restart
		app.sendAppCommand( 'auto_update_install', {} );
	}

};
