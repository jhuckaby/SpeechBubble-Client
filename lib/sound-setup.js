// Scan sound packs and user sounds at startup
var electron = require('electron');
var shell = electron.shell;

var fs = require('fs');
var os = require('os');
var cp = require('child_process');
var Path = require('path');
var glob = require('glob');
var mkdirp = require('mkdirp');

var envPaths = require('env-paths');
var paths = envPaths( "SpeechBubble", { suffix: '' } );

var packs = {};
var sys_sounds_dir = Path.resolve( Path.join(__dirname, '..', 'htdocs', 'sounds', '*') );

glob.sync( sys_sounds_dir ).forEach( function(dir) {
	var pack_name = Path.basename(dir);
	var pack = packs[pack_name] = [];
	
	glob.sync( Path.join(dir, '*') ).forEach( function(file) {
		pack.push( Path.basename(file) );
	} );
} );

// make sure user sounds directory exists, and load all sounds within
var user_sounds_dir = Path.resolve( Path.join(paths.data, 'SpeechBubble Custom Sounds') );
mkdirp.sync( user_sounds_dir );

var open_user_sounds = exports.openUserSounds = function() {
	// tell the os to open the user sounds folder
	shell.openItem( user_sounds_dir );
	
	// OS X doesn't seem to focus the finder after doing this
	if (os.platform() == 'darwin') {
		var cmd = "osascript -e 'tell application \"Finder\" to activate'";
		cp.exec( cmd, function(err, stdout, stderr) {
			if (err) console.error("Shell command failed: " + cmd + ": " + err);
		} );
	}
};

var get_user_sounds = exports.getUserSounds = function() {
	// glob all user sounds into array
	var user_sounds = [];
	
	glob.sync( Path.join(user_sounds_dir, '*') ).forEach( function(file) {
		user_sounds.push( Path.basename(file) );
	} );
	
	return user_sounds;
};

var get_all = exports.getAll = function() {
	return {
		packs: packs,
		user_dir: user_sounds_dir,
		user_sounds: get_user_sounds()
	};
};

// export data
exports.packs = packs;
