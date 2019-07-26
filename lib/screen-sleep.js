// Detect screen saver / screen sleep / lock screen
var os = require('os');
var cp = require('child_process');

exports.detect = function(callback) {
	// detect screen sleep
	
	// OS X only for now
	if (os.platform() != 'darwin') {
		return callback(false);
	}
	
	// first check for screen saver
	cp.exec( "ps -ef | grep ScreenSaverEngine.app | grep -v grep", function(err, stdout, stderr) {
		if (stdout && stdout.toString().match(/ScreenSaverEngine/)) return callback('screensaver');
		
		// next check for screen lock
		cp.exec( "python -c 'import sys,Quartz; d=Quartz.CGSessionCopyCurrentDictionary(); print d'", function(err, stdout, stderr) {
			if (stdout && stdout.toString().match(/CGSSessionScreenIsLocked\D+1/)) return callback('locked');
			
			// finally check for screen off
			cp.exec( "ioreg -n IODisplayWrangler | grep -i IOPowerManagement", function(err, stdout, stderr) {
				if (stdout && stdout.toString().match(/DevicePowerState\D+([0-3])/)) return callback('off');
				
				// nope, all good
				callback(false);
			} ); // screen off
		} ); // screen lock
	} ); // screensaver
};
