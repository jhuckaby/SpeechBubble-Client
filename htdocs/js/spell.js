// Spell checker layer for Electron (en-US only right now)
// Relies on native C++ module 'spellchecker'
var remote = require('electron').remote;
var webFrame = require('electron').webFrame;
var spellchecker = require('spellchecker');

var skipWords = { 'ain': 1, 'couldn': 1, 'didn': 1, 'doesn': 1, 'hadn': 1, 'hasn': 1, 'mightn': 1, 'mustn': 1, 'needn': 1, 'oughtn': 1, 'shan': 1, 'shouldn': 1, 'wasn': 1, 'weren': 1, 'wouldn': 1 };
var userSkipWords = {};

webFrame.setSpellCheckProvider( 'en-US', true, {
	spellCheck: function(text) {
		// true = spelled correctly
		// false = misspelling
		if (!app.prefCache.spelling_enabled) return true;
		
		// skip words shorter than 3 chars
		if (text.length < 3) return true;
		
		// skip camelCase and TitleCase words
		if (text.match(/[a-z0-9][A-Z]/)) return true;
		
		// skip words.with.periods (i.e. domains, filenames)
		if (text.match(/\w\.\w/)) return true;
		
		// Debug.trace('spell', "Spell check: " + text);
		if (skipWords[text.toLowerCase()]) return true;
		if (userSkipWords[text.toLowerCase()]) return true;
		
		return !spellchecker.isMisspelled(text);
	}
});

// prevent crash if page is reloaded
var win = remote.getCurrentWindow();
(win.webContents || win.getWebContents()).removeAllListeners('context-menu');

// hook context menu
require('electron-context-menu')({
	window: remote.getCurrentWindow(),
	prepend: function(params, browserWindow) {
		var items = [];
		
		if (params.misspelledWord) {
			// console.log("misspelledWord: " + params.misspelledWord);
			var suggestions = spellchecker.getCorrectionsForMisspelling(params.misspelledWord);
			if (suggestions.length) {
				suggestions.forEach( function(word) {
					items.push({
						label: word,
						click: function() {
							browserWindow.webContents.replaceMisspelling(word);
							browserWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" });
							browserWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "Right" });
						}
					});
				} );
				items.push({ type: 'separator' });
			} // got suggestions
			
			items.push({
				label: "Add to Dictionary",
				click: function() {
					// spellchecker.add( params.misspelledWord );
					var word = params.misspelledWord.toLowerCase();
					userSkipWords[word] = 1;
					
					var dictionary = app.config.get('dictionary');
					dictionary[word] = 1;
					app.config.set('dictionary', dictionary);
					
					browserWindow.webContents.replaceMisspelling(params.misspelledWord);
				}
			});
			items.push({ type: 'separator' });
		} // word misspelled
		else {
			var word = window.getSelection().toString().toLowerCase();
			if (word && userSkipWords[word]) {
				items.push({
					label: "Remove from Dictionary",
					click: function() {
						delete userSkipWords[word];
						
						var dictionary = app.config.get('dictionary');
						delete dictionary[word];
						app.config.set('dictionary', dictionary);
					}
				});
			}
		}
		
		if (params.linkURL) items.push({
			id: 'openLink',
			label: 'Open Link',
			click: function() {
				// electron.shell.openExternal( params.linkURL );
				window.location = params.linkURL;
			}
		});
		
		return items;
	}
});

// init skip words
app.spell = {
	
	skipWords: skipWords,
	userSkipWords: userSkipWords,
	
	init: function() {
		var dictionary = app.config.get('dictionary');
		for (var word in dictionary) {
			userSkipWords[word] = 1;
		}
	}
	
};
