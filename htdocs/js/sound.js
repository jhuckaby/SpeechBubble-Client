// SpeechBubble Sound System

app.sound = {
	
	tracks: {},
	
	init: function() {
		// make sure we get user's sound setup sent to browser window
		app.sendAppCommand('get_sound_setup');
		
		$('#i_toggle_sound > i').addClass('fa fa-volume-' + (app.config.get('sound_muted') ? 'off' : 'up'));
		$('#i_toggle_sound').on('mouseup', function() {
			// toggle mute on/off
			app.sound.toggleMute();
		});
		
		this.notifyVolumeChanged();
	},
	
	toggleMute: function() {
		// toggle mute on/off
		if (app.doNotDisturb()) {
			app.sidebar.setUserStatus();
			return;
		}
		var new_muted = !app.config.get('sound_muted');
		app.config.set('sound_muted', new_muted);
		app.sound.notifyVolumeChanged();
		if (!new_muted) app.sound.play('message');
	},
	
	play: function(name, force_refresh) {
		// play named sound event
		if (!app.sound_setup) {
			Debug.trace('sound', "in play, app.sound_setup is false!");
			return false;
		}
		if (app.doNotDisturb()) return false;
		if (force_refresh) delete this.tracks[name];
		
		Debug.trace('sound', "Playing sound: " + name);
		
		var self = this;
		var track = this.tracks[name];
		if (track) {
			// track already loaded, replay
			if (!track.paused) track.currentTime = 0;
			else track.play();
		}
		else {
			// first time for track
			var prefs = app.config.store;
			var url = prefs.sounds[name];
			if (url === '') return false; // user has muted this sound
			if (url) {
				if (url.match(/^user\/(.+)$/)) {
					// custom user sound
					var filename = RegExp.$1;
					url = app.sound_setup.user_dir + '/' + filename;
				}
				else {
					// custom pack sound
					url += '.mp3';
				}
			}
			else if (name.match(/^emoji\/(.+)$/)) {
				// special emoji sound (serve from server)
				var emoji_name = RegExp.$1;
				var pack_filename = emoji_name + '.mp3';
				url = app.base_url + '/sounds/emoji/' + pack_filename;
			}
			else {
				// user has not customized sound, pull from pack
				var pack_filename = name + '.mp3';
				var pack_name = prefs.sound_pack;
				var pack_files = app.sound_setup.packs[pack_name] || [];
				var pack_has_sound = !!(pack_files.indexOf(pack_filename) > -1);
				if (pack_has_sound) {
					url = 'sounds/' + pack_name + '/' + pack_filename;
				}
				else {
					// pack doesn't have sound, try looking in misc/
					var misc_files = app.sound_setup.packs.misc || [];
					var misc_has_sound = !!(misc_files.indexOf(pack_filename) > -1);
					if (misc_has_sound) {
						url = 'sounds/misc/' + pack_filename;
					}
					else {
						// pack doesn't have sound
						return false;
					}
				}
			}
			
			var track = new Audio();
			
			track.autoplay = true;
			track.loop = false;
			track.preload = 'auto';
			track.volume = prefs.sound_volume;
			track.muted = prefs.sound_muted;
			track.src = url;
			
			this.tracks[name] = track;
			
		} // first play
		
		return true;
	},
	
	getSoundURL: function(value) {
		// get valid URL to sound given value
		// value can point to a pack sound, e.g. sounds/pack1/message
		// or a user sound filename, e.g. user/MYFILE1.WAV
		var url = '';
		if (value.match(/^user\/(.+)$/)) {
			var filename = RegExp.$1;
			url = app.sound_setup.user_dir + '/' + filename;
		}
		else {
			url = value + '.mp3';
		}
		return url;
	},
	
	preview: function(value) {
		// preview sound
		if (!app.sound_setup) {
			Debug.trace('sound', "in preview, app.sound_setup is false!");
			return;
		}
		
		var url = this.getSoundURL(value);
		
		var track = new Audio();
		track.autoplay = true;
		track.loop = false;
		track.preload = 'auto';
		track.volume = app.config.get('sound_volume');
		// deliberately ignoring 'sound_muted' pref here -- if user asks for a preview, it should be heard
		track.src = url;
		
		track.addEventListener('ended', function() {
			track = null;
		}, true);
	},
	
	notifyVolumeChanged: function() {
		// update all preloaded tracks
		var prefs = app.config.store;
		var new_volume = prefs['sound_volume'];
		var new_muted = prefs['sound_muted'];
		
		if (app.doNotDisturb()) new_muted = true; // always muted in DND
		
		for (var name in this.tracks) {
			this.tracks[name].volume = new_volume;
			this.tracks[name].muted = new_muted;
		}
		
		// change muted icon in header
		if (app.doNotDisturb()) {
			$('#i_toggle_sound > i').removeClass().addClass('fa fa-bell-slash').attr('title', "Do Not Disturb");
		}
		else {
			$('#i_toggle_sound > i').removeClass().addClass('fa fa-volume-' + (new_muted ? 'off' : 'up')).attr('title', "Toggle Sound");
		}
		
		// pass along event to embed
		if (app.embed) app.embed.changeAllWebviewSoundLevels();
	}
	
};