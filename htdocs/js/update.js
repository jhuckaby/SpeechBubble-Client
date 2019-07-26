// Auto-Update system
// Main Window: check for available update on startup
// Also, show notification for download complete if user wants

app.update = {
	
	init: function() {
		// request info from main, if feature is enabled
		if (app.config.get('auto_update_enabled')) {
			app.sendAppCommand( 'auto_update_get_state', {} );
		}
	},
	
	receiveState: function(data) {
		// got state change from main process
		var self = this;
		Debug.trace('update', "State change: ", data);
		
		for (var key in data) {
			this[key] = data[key];
		}
		
		if (!this.url) {
			Debug.trace('update', "No update URL provided in state, aborting check");
			return;
		}
		
		Debug.trace('update', "Fetching update info: " + this.url);
		
		fetch( this.url )
			.then( function(res) {
				if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
				return res.json();
			} )
			.then(function(json) {
				self.receiveLatestInfo(json);
			} )
			.catch( function(err) {
				// API error, don't bug user
				Debug.trace('update', "API ERROR: " + err);
			} );
	},
	
	receiveLatestInfo: function(data) {
		// got latest release info from server
		if (data.name && !data.version) {
			data.version = data.name.replace(/^\D+(\d+\.\d+\.\d+)$/, '$1');
		}
		Debug.trace('update', "Got release data: ", data);
		this.latest = data;
		
		var state = this.state;
		if (state == 'dev') return; // sanity
		
		var cur_version = package.version;
		var latest_version = this.latest.version;
		var is_update_available = ( get_int_version(latest_version) > get_int_version(cur_version) );
		
		if (!state && is_update_available) {
			Debug.trace('update', "Downloading update in background");
			app.sendAppCommand( 'auto_update_download', {} );
		}
	},
	
	updateDownloaded: function() {
		// show notification if user enjoys such things
		if (this.latest && this.latest.version && app.config.get('auto_update_notify')) {
			var msg = package.productName + " update v" + this.latest.version + " has been downloaded.  Please restart to complete installation.";
			var myNotification = new Notification('Auto Update', {
				body: msg,
				silent: true
			});
			app.sound.play('upload');
		}
	}
	
};
