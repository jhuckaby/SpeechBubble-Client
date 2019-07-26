// SpeechBubble File Upload / Webcam Layer

app.upload = {
	
	init: function() {
		// setup file upload system
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('progress', this.uploadProgress.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		ZeroUpload.setMaxFiles( 1 );
		ZeroUpload.setMaxBytes( 100 * 1024 * 1024 ); // 100 MB
		ZeroUpload.init();
	},
	
	onLogin: function() {
		// called on user login (now we have a session id)
		ZeroUpload.setURL( app.base_api_url + '/app/upload_file' );
		ZeroUpload.removeDropTarget( '#d_main' );
		ZeroUpload.addDropTarget( '#d_main', {
			session_id: app.session_id,
			orient: 1,
			convert: 1
		} );
	},
	
	clickUpload: function() {
		// upload file
		delete this.customCallback;
		ZeroUpload.chooseFiles({
			session_id: app.session_id,
			orient: 1,
			convert: 1
		});
	},
	
	customUpload: function(api_name, query, callback) {
		// perform custom one-off file upload to specified API and query, and fire one-time callback
		if (!query) query = {};
		if (!query.session_id) query.session_id = app.session_id;
		var url = app.base_api_url + '/app/' + api_name + composeQueryString(query);
		
		this.customCallback = callback;
		ZeroUpload.chooseFiles( url, { custom: 1 } );
	},
	
	uploadStart: function(files, userData) {
		// file upload has started
		if (!this.progress) {
			this.progress = app.newProgressBar( 0.0, "Uploading file..." );
		}
	},
	
	uploadProgress: function(progress, userData) {
		// upload in progress
		// `progress.amount` is the upload progress from 0.0 to 1.0
		if (this.progress) {
			app.updateProgressBar( this.progress, progress.amount );
		}
	},
	
	uploadComplete: function(response, userData) {
		// file upload has completed
		if (this.progress) {
			app.deleteProgressBar( this.progress );
			delete this.progress;
		}
		
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			data = { code: 1, description: "JSON Parse Error: " + err };
		}
		
		if (data.code != 0) {
			return app.doInlineError("Upload Failed: " + data.description);
		}
		
		// check for custom upload
		if (userData && userData.custom && this.customCallback) {
			this.customCallback( data );
			delete this.customCallback;
			return;
		}
		
		// post URL to file as message, auto-detect image and make it snapshotty
		if (data.url.match(/\.(jpg|jpeg|gif|png|apng|webp|tiff|bmp|ico|mp4|m4v|mpg|webm)$/i)) {
			app.newChatMessage( 'standard', ':camera: ' + data.url, { tags: "snapshot" } );
		}
		else {
			app.newChatMessage( 'standard', ':floppy_disk: ' + data.url, { tags: "upload" } );
		}
	},
	
	uploadError: function(type, message, userData) {
		// file upload error
		if (this.progress) {
			app.deleteProgressBar( this.progress );
			delete this.progress;
		}
		
		app.doInlineError("Upload Failed: " + message);
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
			// return app.doInlineError("No available cameras were found on your machine.");
			app.dialog.onHide = function () { $('#i_take_snapshot').removeClass('selected'); };
			app.dialog.show( $('#i_take_snapshot')[0], 'top', '<i class="fa fa-exclamation-triangle">&nbsp;</i><b>Sorry, an error occurred:</b><br/>No available cameras were found on your machine.' );
			return;
		}
		
		// default to first camera if user doesn't prefer one
		var user_device_id = app.camera.getUserDeviceId();
		
		// construct HTML for dialog
		html += '<div class="webcam_container">';
			html += '<div class="webcam_preloader"><i class="fa fa-refresh fa-spin"></i></div>';
			html += '<div id="d_webcam" class="webcam"></div>';
			html += '<div class="webcam_snap"><div class="button right" style="width:80px;" title="Take Snapshot [Space / Enter]">Snapshot</div></div>';
		html += '</div>';
		
		app.dialog.onHide = function () {
			// hook dialog hide so we can properly shut down the camera
			Webcam.off('live');
			Webcam.reset();
			$('#i_take_snapshot').removeClass('selected');
		};
		
		app.dialog.onKeyDown = function(event) {
			// keydown in dialog
			if ((event.keyCode == 13) || (event.keyCode == 32)) {
				event.preventDefault();
				self.clickCameraSnap();
			}
		};
		
		app.dialog.show( $('#i_take_snapshot')[0], 'top', html );
		
		$('#i_take_snapshot').addClass('selected');
		$('#d_webcam').on('contextmenu', this.selectCameraDevice.bind(this) );
		
		Webcam.set({
			// native HTML5 webcam only
			enable_flash: false,
			
			// live preview size
			width: 480,
			height: 270,
			
			// device capture size
			dest_width: 1280,
			dest_height: 720,
			
			// format and quality
			image_format: 'jpeg',
			jpeg_quality: 95,
			upload_name: 'file1',
			
			// constraints
			constraints: {
				width: 1280,
				height: 720,
				deviceId: user_device_id
			}
		});
		
		Webcam.on('live', function() {
			// camera is live, show snap icon and hide preloader animation
			$('.webcam_preloader').css('display', 'none');
			$('.webcam_snap').css('opacity', 1).find('.button').off().on('mouseup', self.clickCameraSnap.bind(self));
		});
		
		Webcam.attach( '#d_webcam' );
	},
	
	selectCameraDevice: function(event) {
		// popup context menu with selection of camera devices
		event.preventDefault();
		
		app.camera.chooseDevice( function(device) {
			// user changed selection (webcam will reload and fire 'live' again)
			$('.webcam_preloader').css('display', 'block');
		} );
	},
	
	clickCameraSnap: function() {
		// snap webcam pic!
		var self = this;
		app.sound.play('snapshot');
		
		Webcam.snap( function(data_uri) {
			// got image, now upload it
			app.dialog.hide();
			var progress = app.newProgressBar( 1.0, "Uploading snapshot..." );
			
			var upload_url = ZeroUpload.url + '?webcam=snapshot&session_id=' + app.session_id;
			
			Webcam.upload( data_uri, upload_url, function(code, text, status) {
				// upload complete, check for error
				app.deleteProgressBar(progress);
				
				if (code != 200) {
					return app.doInlineError("Webcam upload failed: HTTP " + code + " " + status);
				}
				
				// check for JSON error as well
				var data = null;
				try { data = JSON.parse(text); } 
				catch (err) {
					data = { code: 1, description: "JSON Parse Error: " + err };
				}
				if (data.code != 0) {
					return app.doInlineError("Webcam upload failed: " + data.description);
				}
				
				// post URL to file as message
				app.newChatMessage( 'standard', ':camera: ' + data.url, { tags: "snapshot" } );
				
			} ); // upload
		} ); // snap
	},
	
	uploadRawData: function(text, filename, mime_type) {
		// upload raw text string as file
		var blob = new Blob([text], { type: mime_type });
		var file = new File([blob], filename, { lastModified: Date.now() });
		
		delete this.customCallback;
		ZeroUpload.upload( [file], {
			session_id: app.session_id,
			orient: 1,
			convert: 1
		});
	}
	
};