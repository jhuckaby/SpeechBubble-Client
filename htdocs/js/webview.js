// This runs inside webviews (embedded media) as a preload script
// It alone has access to the Electron Node API.
// Keep host notified of the desired size of our #container contents, for up to 10 seconds.
// This allows embedded widgets to load and size themselves.

(function() {
	var electron = require('electron');
	var ipcRenderer = electron.ipcRenderer;
	var oldWidth = 0;
	var oldHeight = 0;
	var count = 0;
	
	var timer = setInterval( function() {
		var div = document.getElementById('container');
		if (!div) return;
		var width = div.offsetWidth;
		var height = div.offsetHeight;
		
		if (width && height && ((width != oldWidth) || (height != oldHeight))) {
			ipcRenderer.sendToHost('wvsize', { width: width, height: height });
			oldWidth = width;
			oldHeight = height;
		}
		
		count++;
		if (count > 100) clearTimeout( timer );
	}, 100 );
	
	ipcRenderer.on('sound_change', function(event, args) {
		// change audio/video sound and muted, if applicable
		var elem = document.querySelector('audio') || document.querySelector('video');
		if (elem) {
			elem.volume = args.volume;
			elem.muted = args.muted;
		}
	});
	
	ipcRenderer.on('theme_change', function(event, theme) {
		// change theme
		document.body.className = theme;
	});
	
})();
