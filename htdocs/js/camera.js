// SpeechBubble Camera Layer

app.camera = {
	
	init: function() {
		// setup webcam
		var self = this;
		
		Webcam.on('error', function(err) {
			app.doError("Webcam Error: " + err);
			// app.dialog.hide();
		});
		
		// get list of available cameras
		// { deviceId, kind, label }
		app.cameras = [];
		this.loadDeviceList();
	},
	
	loadDeviceList: function(callback) {
		// load or reload device list
		if (navigator.mediaDevices.enumerateDevices) {
			navigator.mediaDevices.enumerateDevices().then(function (devices) {
				app.cameras = devices.filter(function (device) {
					return (device.kind == 'videoinput');
				});
				if (callback) callback();
			});
		}
		else if (callback) callback();
	},
	
	getUserDeviceId: function() {
		// get user's preferred camera device id
		if (!app.cameras.length) return null;
		var prefs = app.config.store;
		
		// default to first camera if user doesn't prefer one
		var user_device_id = prefs.webcam_device_id || app.cameras[0].deviceId;
		if (!findObject(app.cameras, { deviceId: user_device_id })) {
			// user may have disconnected the camera (s)he was using before
			user_device_id = app.cameras[0].deviceId;
		}
		
		return user_device_id;
	},
	
	chooseDevice: function(callback) {
		// show popup menu of all available webcams
		// refresh WebcamJS if user picks different item
		var user_device_id = this.getUserDeviceId();
		var menu = new Menu();
		
		app.cameras.forEach( function(device) {
			menu.append(new MenuItem({
				label: device.label.replace(/\s+\(.+\)$/, ''),
				click: function(menuItem, browserWindow, event) {
					// switch cameras
					if (device.deviceId != user_device_id) {
						user_device_id = device.deviceId;
						
						// fire user callback (UI spinner)
						callback();
						
						// reset webcamjs
						var webcam_container = Webcam.container;
						Webcam.reset();
						Webcam.params.constraints.deviceId = user_device_id;
						Webcam.attach( webcam_container );
						
						// save user's selection
						app.config.set('webcam_device_id', user_device_id);
					}
				},
				type: 'checkbox', 
				checked: !!(device.deviceId == user_device_id)
			}));
		} );
		
		menu.popup();
	}
	
};
