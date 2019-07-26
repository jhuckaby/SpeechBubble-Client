// Emoji Stuff

var emoji_full_code_regex = /\uD83D\uDC69(?:\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC67|\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC66)?|\uD83D\uDC68(?:\u200D(?:(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC67|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC66))?|\uD83D\uDC41\uFE0F|\uD83C\uDFF4|\uD83C\uDFF3\uFE0F|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC6F\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3C-\uDD3E\uDDD6-\uDDDF]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFC2\uDFC5-\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDC67\uDC6A-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78-\uDC80\uDC83-\uDC85\uDC88-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE44\uDE48-\uDE4A\uDE4C\uDE4F\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEC5\uDECC\uDED0-\uDED2\uDEEB\uDEEC\uDEF4-\uDEF8]|\uD83E[\uDD10-\uDD25\uDD27-\uDD36\uDD3A\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDD5\uDDE0-\uDDE6]|\uD83D\uDC69\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\u2764\uFE0F\u200D(?:\uD83D[\uDC68\uDC69]|\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])))|\uD83D\uDC69\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC68\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC66\u200D\uD83D\uDC66)|\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|(?:[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2660\u2663\u2665\u2666\u2668\u267B\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270C\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u2764\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD74\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDD90\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]|\uD83D\uDC69\u200D[\u2695\u2696\u2708]|\uD83D\uDC68\u200D[\u2695\u2696\u2708]|\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC6F\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3C-\uDD3E\uDDD6-\uDDDF]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F)\u200D[\u2640\u2642])\uFE0F|[#\*0-9]\uFE0F\u20E3/g;

var emoji_skin_tone_regex = /(?:\uD83D[\uDC68\uDC69])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFC3\uDFC4\uDFCA-\uDFCC]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDD75\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\uD83D[\uDC68\uDC69])(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92])|(?:\uD83D[\uDC68\uDC69])(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]\uFE0F|(?:\u26F9|\uD83C[\uDFC3\uDFC4\uDFCA-\uDFCC]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDD75\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]\uFE0F|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDD1-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])/g;

/*var emoji_skin_tone_unicode_map = {
	"\udffb": "1F3FB",
	"\udffc": "1F3FC",
	"\udffd": "1F3FD",
	"\udffe": "1F3FE",
	"\udfff": "1F3FF"
};*/

// var emoji_full_name_regex = new RegExp( '(' + Object.keys(gemoji.name).join('|') + ')', 'g' );
var emoji_full_name_regex = /\:([\w\-\+]+)\:/g;
// var emoji_full_code_regex = new RegExp( '(' + Object.keys(gemoji.unicode).join('|') + ')', 'g' );
// var emoji_full_code_regex = emojiRegex();
var emoji_fast_name_regex = /\:([\w\-\+]+)\:/;
var emoji_fast_code_regex = /[\u200d-\ufe0f]/;

var emoji_name_fixes = {
	hankey: 'poo',
	hocho: 'knife'
};

app.emoji = {
	
	names: {},
	unicode: {},
	categories: {},
	skin_tone_dict: {},
	shortcut_cache: [],
	words: {},
	
	cat_titles: {
		recent: "Recently Used",
		people: "Smileys & People",
		nature: "Animals & Nature",
		foods: "Food & Drink",
		activity: "Activities",
		places: "Travel & Places",
		objects: "Objects",
		flags: "Flags",
		symbols: "Symbols",
		custom: "Custom"
	},
	cat_order: ["recent", "people", "nature", "foods", "activity", "places", "objects", "flags", "symbols", "custom"],
	
	init: function(callback) {
		// initialize, pre-calc some emoji stuff
		var self = this;
		
		// force sprite sheet to load
		this.img = new Image();
		this.img.onload = function() {
			// ugh, chrome is trolling me
			// need to force an image into the DOM for the sheet to really be loaded
			$(
				$('<div id="emoji_force_load"></div>').css({
					width: '28px',
					height: '28px',
					position: 'fixed',
					overflow: 'hidden',
					left: '100%',
					marginLeft: '-4px',
					top: '0px',
					// zIndex: '-999'
				}).html(
					self.getEmojiHTML('black_small_square', 28, 'ep_emoji')
				)
			).appendTo('body');
			
			// NOW we're done
			// callback();
		};
		this.img.src = 'images/emoji/sheet_' + app.config.get('emoji_style') + '_64.png';
		
		// pre-compile regexps for shortcuts :)
		this.compileShortcuts();
		
		callback();
	},
	
	importCustom: function(custom_emoji) {
		// import custom emoji from server
		// called once on firstLogin
		// emoji: { id, title, keywords?, category?, url?, format }
		var self = this;
		
		if (custom_emoji) {
			for (var key in custom_emoji) {
				var emoji = custom_emoji[key];
				this.addCustomEmoji( emoji );
			}
		}
	},
	
	prepCustomEmoji: function(emoji) {
		// prepare custom emoji for import
		if (!emoji.url) emoji.url = "/images/emoji/" + emoji.id + "." + emoji.format;
		if (!emoji.url.match(/^\w+\:\/\//)) emoji.url = app.base_url + emoji.url;
		if (!emoji.category) emoji.category = 'custom';
		if (!emoji.emoji) emoji.emoji = ':' + emoji.id + ':'; // for notifications
		
		// emulate emoji-datasource format
		emoji.short_name = emoji.id;
		emoji.name = emoji.title;
		emoji.short_names = [ emoji.id ];
		
		// cleanup
		delete emoji.id;
		delete emoji.title;
		
		// preload image
		var url = emoji.url;
		if (emoji.modified) url += '?mod=' + emoji.modified;
		
		emoji.img = new Image();
		emoji.img.src = url;
		
		// construct search text
		emoji._search = emoji.short_names.join(' ') + ' ' + emoji.name.toLowerCase();
		if (emoji.keywords) emoji._search += ' ' + emoji.keywords.join(' ').toLowerCase();
		
		// sound or not
		if (!emoji.sound) emoji.sound = false;
	},
	
	addCustomEmoji: function(emoji) {
		// add custom emoji or "replace" built-in one
		this.prepCustomEmoji(emoji);
		
		var old_emoji = findObject( emojiData, { short_name: emoji.short_name } );
		if (old_emoji) {
			// replace built-in
			old_emoji.url = emoji.url;
			old_emoji.modified = emoji.modified;
			old_emoji.sound = emoji.sound;
		}
		else {
			// add new custom emoji
			emojiData.push( emoji );
			
			// add to name cache
			this.names[ emoji.short_name ] = emoji;
			
			// add to category as well
			var cat_name = emoji.category.toLowerCase();
			if (!this.categories[cat_name]) this.categories[cat_name] = [];
			var cat = this.categories[cat_name];
			cat.push(emoji);
		}
	},
	
	updateCustomEmoji: function(emoji) {
		// update custom emoji
		this.prepCustomEmoji(emoji);
		
		var old_emoji = findObject( emojiData, { short_name: emoji.short_name } );
		if (old_emoji) {
			if (old_emoji.unified) {
				// built-in
				old_emoji.url = emoji.url;
				old_emoji.modified = emoji.modified;
				old_emoji.sound = emoji.sound || false;
				old_emoji.img = emoji.img;
			}
			else {
				// custom
				mergeHashInto(old_emoji, emoji);
			}
		}
	},
	
	deleteCustomEmoji: function(emoji) {
		// delete custom emoji
		// return true on success, false on error
		var old_emoji = findObject( emojiData, { short_name: emoji.id } );
		if (old_emoji) {
			if (old_emoji.unified && old_emoji.url) {
				// revert built-in emoji to stock
				delete old_emoji.url;
				delete old_emoji.modified;
				delete old_emoji.sound;
				delete old_emoji.img;
				return true;
			}
			else if (old_emoji.url) {
				// delete custom
				deleteObject( emojiData, { short_name: emoji.id } );
				
				if (!emoji.category) emoji.category = 'custom';
				var cat_name = emoji.category.toLowerCase();
				var cat = this.categories[cat_name];
				if (cat) deleteObject( cat, { short_name: emoji.id } );
				
				cat = this.categories.recent;
				if (cat) deleteObject( cat, { short_name: emoji.id } );
				
				delete this.names[ emoji.id ];
				
				// handle user custom status
				if (app.user.status == emoji.id) {
					app.sidebar.setUserStatus('', '', true);
				}
				
				return true;
			}
			else return false;
		}
		else return false;
	},
	
	assignSounds: function(sounds) {
		// assign sound flags to specific emoji
		var sound_hash = {
			camera: 1, // special case sound (plays 'snapshot')
			floppy_disk: 1 // special case sound (plays 'upload')
		};
		sounds.forEach( function(sound) { sound_hash[sound] = 1; } );
		
		for (var idx = 0, len = emojiData.length; idx < len; idx++) {
			var emoji = emojiData[idx];
			if (sound_hash[emoji.short_name]) emoji.sound = 1;
		}
	},
	
	indexSearchPrep: function() {
		// index all emoji for search
		// called once on firstLogin
		var self = this;
		
		var rev_titles = {};
		for (var key in this.cat_titles) {
			rev_titles[ this.cat_titles[key] ] = key;
		}
		
		for (var idx = 0, len = emojiData.length; idx < len; idx++) {
			var emoji = emojiData[idx];
			if (rev_titles[emoji.category]) emoji.category = rev_titles[emoji.category];
			var cat_name = emoji.category.toLowerCase();
			
			if (!emoji.name && emoji.short_name) {
				emoji.name = toTitleCase( emoji.short_name.replace(/_+/g, ' ') );
			}
			
			if (this.cat_titles[cat_name]) {
				if (!this.categories[cat_name]) this.categories[cat_name] = [];
				var cat = this.categories[cat_name];
				
				// include actual unicode representation
				if (emoji.unified) {
					// emoji.emoji = String.fromCodePoint( parseInt(emoji.unified, 16) );
					var points = [];
					emoji.unified.split(/\-/).forEach( function(point) {
						points.push( String.fromCodePoint( parseInt(point, 16) ) );
					} );
					emoji.emoji = points.join('');
					
					// index by unicode
					this.unicode[ emoji.emoji ] = emoji;
				}
				
				// also index by short names
				if (!emoji.short_names || !emoji.short_names.length) emoji.short_names = [];
				
				for (var idy = 0, ley = emoji.short_names.length; idy < ley; idy++) {
					this.names[ emoji.short_names[idy] ] = emoji;
				}
				
				// search string for autocomplete
				if (!emoji.name) emoji.name = '';
				if (typeof(emoji.name) != 'string') emoji.name = emoji.name.toString();
				emoji._search = emoji.short_names.join(' ') + ' ' + emoji.name.toLowerCase();
				if (emoji.keywords) emoji._search += ' ' + emoji.keywords.join(' ').toLowerCase();
				
				// index each word for fuzzy matching
				emoji._search.split(/\s+/).forEach( function(word) {
					word = crammify(word);
					if (word) self.words[word] = emoji;
				} );
				
				// fix skin_variation codes
				if (emoji.skin_variations) {
					for (var sv_code in emoji.skin_variations) {
						if (sv_code.match(/\b(1F3F[BCDEF])\b/)) {
							var new_sv_code = RegExp.$1;
							if (new_sv_code != sv_code) {
								emoji.skin_variations[new_sv_code] = emoji.skin_variations[sv_code];
								delete emoji.skin_variations[sv_code];
							}
						}
					}
					for (var sv_code in emoji.skin_variations) {
						var variant = emoji.skin_variations[sv_code];
						this.skin_tone_dict[ variant.unified ] = { emoji: emoji, skin_tone: sv_code };
						
						// include actual unicode representation
						points = [];
						variant.unified.split(/\-/).forEach( function(point) {
							points.push( String.fromCodePoint( parseInt(point, 16) ) );
						} );
						variant.emoji = points.join('');
					}
				} // skin_variations
				
				// each category is an array of the emoji within it	
				cat.push(emoji);
			} // valid cat
		} // foreach emoji
		
		// sort emoji in each category
		for (var key in this.categories) {
			if (key != 'custom') {
				this.categories[key] = this.categories[key].sort( function(a, b) {
					return a.sort_order < b.sort_order ? -1 : 1;
				} );
			}
		}
		
		// add recent cat from config (self-sorted)
		this.categories.recent = [];
		var recent = this.categories.recent;
		this.getSortedRecentList('recent_emoji').forEach( function(key) {
			if (self.names[key]) recent.push( self.names[key] );
		} );
		
		// A few of our own emoji fixes
		for (var key in emoji_name_fixes) {
			var new_key = emoji_name_fixes[key];
			if (this.names[key]) {
				this.names[new_key] = this.names[key];
				delete this.names[key];
				this.names[new_key].short_name = new_key;
			}
		}
	},
	
	compileShortcuts: function() {
		// compile user shortcuts into regexps
		this.shortcut_cache = [];
		var user_map = app.emoji_shortcuts;
		
		for (var str in user_map) {
			var value = user_map[str];
			var regex = new RegExp( 
				"(^|\\s|\\&nbsp\\;|>)(" + 
				str.split(/\s+/).map( function(text) {
					var ent_text = encodeEntities(text);
					if (ent_text != text) return escapeRegExp(text) + '|' + escapeRegExp(ent_text);
					else return escapeRegExp(text);
				} ).join('|') + 
				")(?=$|\\s|\\&nbsp\\;|<)", "ig" 
			);
			this.shortcut_cache.push([ regex, value ]);
		}
	},
	
	showCustomPicker: function($ref, callback) {
		// show custom full-size emoji picker attached to any element
		// fire callback when emoji is picked
		var self = this;
		var html = '<div id="d_emoji_picker"></div>';
		
		app.dialog.show( $ref, 'top', html );
		this.updatePicker();
		
		app.dialog.onHide = function() { 
			delete self.dialogMode;
		};
		
		// save scroll on close
		app.dialog.onBeforeHide = function() {
			self.lastScrollTop = $('#d_emoji_picker').scrollTop();
		};
		
		// handle some keypresses in dialog
		app.dialog.onKeyDown = function() {};
		
		// click on emoji
		$('#d_emoji_picker').on('mousedown', function(event) {
			event.preventDefault();
			var $target = $(event.target);
			if ($target.hasClass('ep_emoji')) {
				var key = $target.data('emoji');
				app.dialog.hide();
				callback(key);
			}
		});
	},
	
	showPicker: function(filter) {
		// open emoji picker dialog
		var self = this;
		var $ref = null;
		var html = '';
		
		if (filter) {
			// using filter, try to locate caret for ref point
			var sel = window.getSelection();
			if (sel.rangeCount) {
				var range = sel.getRangeAt(0);
				if (range && range.collapsed && range.endContainer) {
					var node = range.endContainer;
					while (node && !node.getBoundingClientRect) { node = node.parentNode; }
					if (node) {
						$ref = $(node);
						html = '<div id="d_emoji_picker" class="filter"></div>';
					} // found parent node
				} // found range
			} // caret in dom
		} // filter
		
		if (!$ref) {
			// standard picker, ref is emoji toolbar icon
			$ref = $('#i_pick_emoji');
			html = '<div id="d_emoji_picker"></div>';
			$('#i_pick_emoji').addClass('selected');
		}
		
		app.dialog.show( $ref, 'top', html );
		this.updatePicker(filter);
		
		// icon state follows dialog
		app.dialog.onHide = function() { 
			$('#i_pick_emoji').removeClass('selected');
			delete self.dialogMode;
		};
		
		// save scroll on close
		app.dialog.onBeforeHide = function() {
			self.lastScrollTop = $('#d_emoji_picker').scrollTop();
		};
		
		// handle some keypresses in dialog
		app.dialog.onKeyDown = this.onDialogKeyDown.bind(this);
		
		// click on emoji
		$('#d_emoji_picker').on('mousedown', function(event) {
			event.preventDefault();
			var $target = $(event.target);
			if ($target.hasClass('ep_emoji')) {
				var key = $target.data('emoji');
				var emoji = self.names[key];
				self.pickEmoji(key);
			}
		});
		
		// make sure a text field is focused
		if (!app.tff) $('#d_footer_textfield').focus();
	},
	
	pickEmoji: function(key) {
		// pick emoji to insert into text area
		var self = this;
		var text_to_insert = ':' + key + ':';
		
		var sel = window.getSelection();
		if (sel.rangeCount) {
			var range = sel.getRangeAt(0);
			
			if (range && range.collapsed && range.endContainer && (range.endContainer.nodeValue !== null) && range.endContainer.nodeValue.substring) {
				// caret is inside a text node
				var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
				var after_str = range.endContainer.nodeValue.substring(range.endOffset);
				
				// remove user's search query, if present
				before_str = before_str.replace(/\:[\w\+\-]+\s*$/, '');
				
				// emoji prefer spaces around them
				if (before_str.length && !before_str.match(/\s$/)) before_str += ' ';
				
				range.endContainer.nodeValue = before_str + text_to_insert + after_str;
				range.setEnd( range.endContainer, before_str.length + text_to_insert.length );
				range.collapse(false);
				
				sel.removeAllRanges();
				sel.addRange( range );
				
				document.execCommand("insertText", false, " ");
			} // in text node
			else {
				// caret is outside a text node, OR has a selection highlighted
				document.execCommand("insertText", false, text_to_insert + ' ');
			}
			
			// update recent emoji list
			this.updateUserRecentList('recent_emoji', key, 18);
			
			// rebuild recent category for dialog
			this.categories.recent = [];
			var recent = this.categories.recent;
			this.getSortedRecentList('recent_emoji').forEach( function(key) {
				if (self.names[key]) recent.push( self.names[key] );
			} );
		} // caret is in dom
		
		app.dialog.hide();
	},
	
	getSortedRecentList: function(prefs_key, dir) {
		// sort recent hash into list by score
		// dir should be 1 (asc) or -1 (desc)
		var recent_emoji = app.config.get(prefs_key);
		if (!dir) dir = -1; // default to descending
		
		return hashKeysToArray(recent_emoji).sort( function(a, b) {
			return ((recent_emoji[a] < recent_emoji[b]) ? -1 : 1) * dir;
		} );
	},
	
	updateUserRecentList: function(prefs_key, emoji_key, max_entries) {
		// maintain user prefs list of recent emoji, either 'recent_emoji' or 'recent_statuses'
		// emoji_key is the key to "promote" or add to list
		var recent_emoji = app.config.get(prefs_key);
		
		if (recent_emoji[emoji_key]) {
			// emoji already in list, just increase its score
			recent_emoji[emoji_key] = Math.floor( recent_emoji[emoji_key] + 1 );
		}
		else {
			// emoji not in list, add to bottom
			var num_keys = numKeys(recent_emoji);
			
			// possibly remove lowest scoring item(s) if full
			while (num_keys >= max_entries) {
				var lowest_score = -1;
				var lowest_key = '';
				for (var key in recent_emoji) {
					if ((lowest_score == -1) || (recent_emoji[key] < lowest_score)) {
						lowest_score = recent_emoji[key];
						lowest_key = key;
					}
				}
				delete recent_emoji[lowest_key];
				num_keys--;
			}
			
			recent_emoji[emoji_key] = 1;
		}
		
		app.config.set( prefs_key, recent_emoji );
	},
	
	onDialogKeyDown: function(event) {
		// handle keydown while emoji dialog is active
		var emoji_per_row = 9;
		
		if (this.dialogMode == 'filter') {
			// we only care if showing filtered results
			switch (event.keyCode) {
				case 37: // left arrow
					event.preventDefault();
					event.stopPropagation();
					var $sel = $('#d_emoji_picker').find('.ep_emoji.selected');
					var $prev = $sel.prev('.ep_emoji');
					if ($prev.length) {
						$sel.removeClass('selected');
						$prev.addClass('selected');
					}
					this.autoScrollFilterPicker();
				break;
				
				case 39: // right arrow
					event.preventDefault();
					event.stopPropagation();
					var $sel = $('#d_emoji_picker').find('.ep_emoji.selected');
					var $next = $sel.next('.ep_emoji');
					if ($next.length) {
						$sel.removeClass('selected');
						$next.addClass('selected');
					}
					this.autoScrollFilterPicker();
				break;
				
				case 38: // up arrow
					// navigate up through search results
					event.preventDefault();
					event.stopPropagation();
					var $sel = $('#d_emoji_picker').find('.ep_emoji.selected');
					var $prev = $sel.prev('.ep_emoji');
					while ($prev.prev('.ep_emoji').length && (emoji_per_row-- > 1)) {
						$prev = $prev.prev('.ep_emoji');
					}
					if ($prev.length) {
						$sel.removeClass('selected');
						$prev.addClass('selected');
					}
					this.autoScrollFilterPicker();
				break;
				
				case 40: // down arrow
					// navigate down through search results
					event.preventDefault();
					event.stopPropagation();
					var $sel = $('#d_emoji_picker').find('.ep_emoji.selected');
					var $next = $sel.next('.ep_emoji');
					while ($next.next('.ep_emoji').length && (emoji_per_row-- > 1)) {
						$next = $next.next('.ep_emoji');
					}
					if ($next.length) {
						$sel.removeClass('selected');
						$next.addClass('selected');
					}
					this.autoScrollFilterPicker();
				break;
				
				case 9: // tab
				case 13: // enter
					// pick selected emoji
					event.preventDefault();
					event.stopPropagation();
					
					// find selected emoji in dialog
					var key = $('#d_emoji_picker').find('.ep_emoji.selected').data('emoji');
					if (key) this.pickEmoji(key);
					else app.dialog.hide();
				break;
			} // switch keyCode
		} // filter
	},
	
	autoScrollFilterPicker: function() {
		// auto scroll selected emoji into view
		var $picker = $('#d_emoji_picker');
		var $sel = $picker.find('.ep_emoji.selected');
		var scroll_top = $picker.scrollTop();
		
		if ($sel.length) {
			// var pos = $sel.position();
			var top = $sel[0].offsetTop;
			scroll_top = Math.floor( (top + ($sel.height() / 2)) - ($picker.height() / 2) );
			scroll_top -= 6;
			if (scroll_top < 20) scroll_top = 0;
			$picker.scrollTop( scroll_top );
		}
	},
	
	updateFilterPicker: function(filter) {
		// update list of emoji based on filter
		var self = this;
		var html = '';
		var num_matches = 0;
		var matched_names = {};
		var regex = new RegExp( escapeRegExp(filter), 'i');
		
		html += '<div class="ep_cat_title">Results for &ldquo;' + filter + '&rdquo;</div>';
		
		this.cat_order.forEach( function(cat_name) {
			var cat = self.categories[cat_name];
			if (cat) {
				for (var idx = 0, len = cat.length; idx < len; idx++) {
					var emoji = cat[idx];
					if (emoji._search.match(regex) && !matched_names[emoji.short_name]) {
						matched_names[emoji.short_name] = 1;
						num_matches++;
						html += self.getEmojiHTML(emoji, 28, 'ep_emoji' + ((num_matches == 1) ? ' selected' : ''), app.user.emoji_skin_tone);
					}
				}
			}
		} );
		
		if (!num_matches) {
			html = '<div class="ep_cat_title">(No matches found)</div>';
		}
		
		$('#d_emoji_picker').html( html );
		this.dialogMode = 'filter';
		
		app.dialog.popper.update();
	},
	
	getPickerCategoryHTML: function(cat_name) {
		// get html for single category of emoji for picker
		var html = '';
		var cat = this.categories[cat_name];
		var cat_title = this.cat_titles[cat_name];
		
		if (!cat || !cat.length) return '';
		
		html += '<div class="ep_cat_title">' + cat_title + '</div>';
		html += '<div class="ep_cat_list">';
		
		for (var idx = 0, len = cat.length; idx < len; idx++) {
			var emoji = cat[idx];
			html += this.getEmojiHTML(emoji, 28, 'ep_emoji', app.user.emoji_skin_tone);
		}
		
		html += '</div>';
		return html;
	},
	
	updatePicker: function(filter) {
		// update list of emoji based on filter (or lack thereof)
		if (filter) return this.updateFilterPicker(filter);
		
		var self = this;
		$('#d_emoji_picker').html(
			this.cat_order.map( function(cat) { return self.getPickerCategoryHTML(cat); } ).join('')
		).scrollTop( this.lastScrollTop || 0 );
		
		this.dialogMode = 'standard';
		return;
	},
	
	doAutoSearch: function() {
		// auto-search emoji based on current selection text input
		var filter = null;
		if (!app.current_channel_id) return;
		
		var sel = window.getSelection();
		if (sel.rangeCount) {
			var range = sel.getRangeAt(0);
			if (range && range.collapsed && range.endContainer && (range.endContainer.nodeValue !== null) && range.endContainer.nodeValue.substring) {
				// caret is inside a text node
				var before_str = range.endContainer.nodeValue.substring(0, range.endOffset);
				if (before_str.match(/(^|\s)\:([\w\-\+]{2,})$/)) {
					filter = RegExp.$2;
				}
			}
		} // caret is in dom
		
		if (filter && !this.dialogMode) {
			this.showPicker(filter);
		}
		else if (filter && this.dialogMode) {
			this.updatePicker(filter);
		}
		else if (!filter && this.dialogMode) {
			app.dialog.hide();
		}
	},
	
	getEmojiHTML: function(emoji, size, class_names, skin_tone, title) {
		// get HTML for single emoji at any size
		if (typeof(emoji) == 'string') emoji = this.names[emoji];
		if (!emoji) return '';
		if (!size) size = 25;
		if (!class_names) class_names = 'emoji';
		if (!title) {
			title = '';
			if (emoji.name) title = toTitleCase(emoji.name) + " ";
			title += "(:" + emoji.short_name + ":)";
		}
		
		if (emoji.url) {
			// custom emoji from server
			var url = emoji.url;
			if (emoji.modified) url += '?mod=' + emoji.modified;
			return '<img src="'+url+'" width="'+size+'" height="'+size+'" class="'+class_names+'" style="background-image:none;" data-emoji="'+emoji.short_name+'" title="'+title+'"/>';
		}
		
		var sheet_size = Math.round( this.img.width * (size / 66) );
		var sheet_x = emoji.sheet_x;
		var sheet_y = emoji.sheet_y;
		
		if (skin_tone && emoji.skin_variations && emoji.skin_variations[skin_tone]) {
			sheet_x = emoji.skin_variations[skin_tone].sheet_x;
			sheet_y = emoji.skin_variations[skin_tone].sheet_y;
		}
		
		var x = Math.round( (0 - (sheet_x * 66)) * (size / 66) );
		var y = Math.round( (0 - (sheet_y * 66)) * (size / 66) );
		
		return '<img src="images/2x2.gif" width="'+size+'" height="'+size+'" class="'+class_names+'" style="background-size:'+sheet_size+'px '+sheet_size+'px; background-position:'+x+'px '+y+'px;" data-emoji="'+emoji.short_name+'" title="'+title+'"/>';
	},
	
	expandShortcuts: function(html) {
		// expand user shortcuts in block of text/html :)
		this.shortcut_cache.forEach( function(pair) {
			html = html.replace( pair[0], '$1' + pair[1] );
		} );
		return html;
	},
	
	renderEmoji: function(html, chat, size) {
		// convert emoji shortcodes (:imp:) and unicode to sprites
		var self = this;
		if (!chat) chat = { username: "__NOBODY__", channel_id: "__NOWHERE__", history: 1 };
		if (!size) size = 25;
		
		var username = chat.username;
		var has_emoji = false;
		var sounds_to_play = {};
		
		// expand user shortcuts :)
		html = this.expandShortcuts(html);
		
		// lookup user record to get emoji skin tone
		var user = app.users[username] || {};
		
		if (html.match(emoji_fast_name_regex)) {
			// convert shortcodes to unicode
			// has_emoji = true;
			html = html.replace(emoji_full_name_regex, function(m_all, m_g1) {
				var emoji = self.names[ m_g1.toLowerCase() ];
				if (!emoji) {
					m_g1 = crammify(m_g1);
					if (self.words[m_g1]) emoji = self.words[m_g1];
				}
				if (emoji && emoji.sound) sounds_to_play[ emoji.short_name ] = 1;
				return emoji ? self.getEmojiHTML(emoji, size, '', user.emoji_skin_tone) : m_all;
			});
		}
		
		if (has_emoji || html.match(emoji_skin_tone_regex)) {
			// first try to find skin-tone-augmented double-wide emoji
			html = html.replace(emoji_skin_tone_regex, function(m_all) {
				
				var unified = [...m_all].map( function(pt) { return pt.codePointAt(0).toString(16).toUpperCase(); } ).join('-');
				var obj = self.skin_tone_dict[ unified ];
				if (!obj) return '';
				
				var emoji = obj.emoji;
				var skin_tone = obj.skin_tone;
				
				if (emoji && emoji.sound) sounds_to_play[ emoji.short_name ] = 1;
				return emoji ? self.getEmojiHTML(emoji, size, '', skin_tone) : '';
			});
		}
		
		if (has_emoji || html.match(emoji_full_code_regex)) {
			// wrap emoji unicode in imgs
			
			// remove previous wrapping (i.e. re-saving edited chat)
			// html = html.replace(/\<span\s+class\=\"emoji\"[^>]*\>(.+?)\<\/span\>/ig, '$1');
			
			// now try to find normal emoji
			html = html.replace(emoji_full_code_regex, function(m_all) {
				var emoji = self.unicode[ m_all ];
				if (emoji && emoji.sound) sounds_to_play[ emoji.short_name ] = 1;
				return emoji ? self.getEmojiHTML(emoji, size, '', user.emoji_skin_tone) : m_all;
				// return '<span class="emoji" contenteditable="false">' + m_all + '</span>';
			});
		}
		
		if (numKeys(sounds_to_play) && !chat.history && !chat.replace && !chat.quiet && app.getChannelPref(chat.channel_id, 'emoji_sounds')) {
			// play emoji sounds!
			for (var sound_name in sounds_to_play) {
				if (sound_name == 'camera') {
					if (username != app.username) {
						app.sound.play('snapshot'); // SPECIAL override
						chat.sound = 1;
					}
				}
				else if (sound_name == 'floppy_disk') {
					app.sound.play('upload'); // SPECIAL override
					chat.sound = 1;
				}
				else if (!app.prefCache.mute_emoji[sound_name]) {
					app.sound.play( 'emoji/' + sound_name );
					chat.sound = 1;
				}
			}
		}
		
		return html;
	},
	
	renderUnicodeEmoji: function(html, chat) {
		// convert emoji shortcodes (:imp:) into unicode
		var self = this;
		if (!chat) chat = { username: "__NOBODY__", channel_id: "__NOWHERE__", history: 1 };
		var username = chat.username;
		var user = app.users[username] || {};
		var skin_tone = user.emoji_skin_tone || '';
		
		// expand user shortcuts :)
		html = this.expandShortcuts(html);
		
		if (html.match(emoji_fast_name_regex)) {
			// convert shortcodes to unicode
			html = html.replace(emoji_full_name_regex, function(m_all, m_g1) {
				var emoji = self.names[ m_g1.toLowerCase() ];
				if (emoji && emoji.skin_variations && emoji.skin_variations[skin_tone]) return emoji.skin_variations[skin_tone].emoji;
				return (emoji && emoji.emoji) ? emoji.emoji : m_all;
			});
		}
		
		return html;
	}
	
};
