// API

app.api = {
	
	init: function() {
		// initialize api system
		// this is called on app init AND on every login
		app.base_url = '';
		app.base_api_url = '';
		
		if (app.config.get('ssl')) app.base_url = 'https://';
		else app.base_url = 'http://';
		
		app.base_url += app.config.get('hostname');
		app.base_api_url = app.base_url + '/api';
	},
	
	request: function(url, args, callback, errorCallback) {
		// send AJAX request to server using jQuery
		var headers = {};
		
		// inject session id into headers, unless app is using plain_text_post
		if (app.config.get('session_id') && !app.plain_text_post) {
			headers['X-Session-ID'] = app.config.get('session_id');
		}
		
		args.context = this;
		args.url = url;
		args.dataType = 'text'; // so we can parse the response json ourselves
		args.timeout = 1000 * 10; // 10 seconds
		args.headers = headers;
		
		$.ajax(args).done( function(text) {
			// parse JSON and fire callback
			Debug.trace( 'api', "Received response from server: " + text );
			var resp = null;
			try { resp = JSON.parse(text); }
			catch (e) {
				// JSON parse error
				var desc = "JSON Error: " + e.toString();
				if (errorCallback) errorCallback({ code: 500, description: desc });
				else app.doError(desc);
			}
			// success, but check json for server error code
			if (resp) {
				if (('code' in resp) && (resp.code != 0)) {
					// an error occurred within the JSON response
					// session errors are handled specially
					if ((resp.code == 'session') && app.doUserLogout) app.doUserLogout(true);
					else if (errorCallback) errorCallback(resp);
					else app.doError("Error: " + resp.description);
				}
				else if (callback) callback(resp);
			}
		} )
		.fail( function(xhr, status, err) {
			// XHR or HTTP error
			var code = xhr.status || 500;
			var desc = err.toString() || status.toString();
			switch (desc) {
				case 'timeout': desc = "The request timed out.  Please try again."; break;
				case 'error': desc = "An unknown network error occurred.  Please try again."; break;
			}
			Debug.trace( 'api', "Network Error: " + code + ": " + desc );
			if (errorCallback) errorCallback({ code: code, description: desc });
			else app.doError( "Network Error: " + code + ": " + desc );
		} );
	},
	
	post: function(cmd, params, callback, errorCallback) {
		// send AJAX POST request to server using jQuery
		var url = cmd;
		if (!url.match(/^(\w+\:\/\/|\/)/)) url = app.base_api_url + "/" + cmd;
		
		if (!params) params = {};
		
		// inject session in into json if submitting as plain text (cors preflight workaround)
		if (app.config.get('session_id') && app.plain_text_post) {
			params['session_id'] = app.config.get('session_id');
		}
		
		var json_raw = JSON.stringify(params);
		Debug.trace( 'api', "Sending HTTP POST to: " + url + ": " + json_raw );
		
		this.request(url, {
			type: "POST",
			data: json_raw,
			contentType: app.plain_text_post ? 'text/plain' : 'application/json'
		}, callback, errorCallback);
	},
	
	get: function(cmd, query, callback, errorCallback) {
		// send AJAX GET request to server using jQuery
		var url = cmd;
		if (!url.match(/^(\w+\:\/\/|\/)/)) url = app.base_api_url + "/" + cmd;
		
		if (!query) query = {};
		if (app.cacheBust) query.cachebust = app.cacheBust;
		url += composeQueryString(query);
		
		Debug.trace( 'api', "Sending HTTP GET to: " + url );
		
		this.request(url, {
			type: "GET"
		}, callback, errorCallback);
	}
	
};
