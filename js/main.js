//DONE: on navigate, if current page = new page, dont navigate
//DONE: trigger loading of places, loading IMG in map section, hide tab button, generate checkboxes
//DONE: GPS positioning on map
//DONE: need to get some sort of JS scrolling technology, overflow:scroll just doesnt cut it (details on map, notification, layers), automatic overflow y scroll implemented
//DONE: need to handle errors for all AJAX calls, possibly no internet?
//DONE: timeout check for new notifications every X seconds, change icon to mail_open and add to notification list, recreate notification list each timeout
//DONE: timeout check for changes in DB, update layers accordingly (async), add date modified to DB, store date in js var, check against that var
//TODO: for deployment: fix window call for iOS vs Android see: http://stackoverflow.com/questions/17887348/phonegap-open-link-in-browser
//DONE: for deployment: lock device orientation to portrait

var map;
var grabbed_notifications = false;
var grabbed_styles = false;
var grabbed_layers = false;
var grabbed_places = false;
var grabbed_gps = false;
var places = {}; // layer => 0 => new google.Maps.Marker
var styles = {}; // style_id => { 'icon_href' = }
var layers = {}; // layer_id => { 'icon_href' = }
var info_window = new google.maps.InfoWindow();
var bounds = new google.maps.LatLngBounds();

google.maps.event.addDomListener(window, 'load', initialize_gmap);

jQuery(document).ready(function() {

	//fix heights/widths
	var window_height = jQuery(window).height();
	var window_width = jQuery(window).width();
	jQuery('#right_menu_container').css('height', (window_height - 67));
	jQuery('#map_page').css('height', (window_height - 52));
	jQuery('#notification_page, #report_page').css('height', (window_height - 52) - (window_height * 0.075)); //52 for nav bar, 7% for top bar
	jQuery('#notification_page, #report_page').css('padding-top', window_height * 0.07);
	jQuery('#report_page textarea').css('height', ((window_height - 52) - (window_height * 0.075)) * 0.5); //50% page height
	jQuery('#right_menu_content').css('width', (window_width * 0.4)); //40%
	jQuery('#page_header_content').css('margin-top', (window_height * 0.1 * 0.1)); //10% * 1/10 = margin-top/bottom
	jQuery('#page_header_content').css('font-size', ((window_height * 0.1) - (window_height * 0.1 * 0.2)) * 0.35); //10% - margin-top + bot

	//bind clicking on tab to toggle
	jQuery('#right_tabs').click(function() {

		if (jQuery('#right_menu_content').css('display') === 'none') {
			jQuery('#right_menu_content').show();
			jQuery('#right_tabs').css('right', '100%');
			check_scrolling('#right_menu_content');
		} else {
			jQuery('#right_menu_content').hide();
			jQuery('#right_tabs').css('right', '0');
		}

	});

	jQuery('#right_menu_content #toggle_on').on('click', function() {
		if (jQuery('#right_menu_content ul li input:checkbox').prop('checked') == false) {
			jQuery('#right_menu_content ul li input:checkbox').click();
		}
	});

	jQuery('#right_menu_content #toggle_off').on('click', function() {
		if (jQuery('#right_menu_content ul li input:checkbox').prop('checked') == true) {
			jQuery('#right_menu_content ul li input:checkbox').click();
		}
	});

	grab_notifications();

	//timeouts (check init gmap code for more)
	var notification_timeout = setTimeout(grab_notifications(), 60000 * 5); //60 seconds * 5 = 5 mins

});

function initialize_gmap() {
	var mapOptions = {
		mapTypeId : google.maps.MapTypeId.HYBRID,
		zoom: 12,
		center: new google.maps.LatLng(35.4769, -83.3206) //cherokee
	};

	// Display a map on the page
	map = new google.maps.Map(document.getElementById("map_container"), mapOptions);
	map.setTilt(45);

	grab_layers();
	load_places();

	//check gps
	navigator.geolocation.getCurrentPosition(on_gps_success, on_gps_error);
	var watch_gps_id = navigator.geolocation.watchPosition(update_current_pos);

	var map_grab_timeout = setTimeout(function() {
		grab_layers();
		load_places();
	}, 60000 * 60); //60 seconds * 60 = 1 hr
}

function open_link(link) {
	//navigator.app.loadUrl(link, {openExternal : true});
	window.open(link, '_blank', 'location=yes');
}

function submit_report() {

	var i = 1;

	loading_text('Verifying...');

	var submit_text_interval = setInterval(function() {
		switch (i) {
			case 1:
				loading_text('Uploading...');
			break;

			case 2:
				loading_text('Submitting...');
			break;

			default:
				clearInterval(submit_text_interval);
			break;
		}

		i++;

	}, 5000);

	show_loading();

	var formData = new FormData(jQuery('#report_form')[0]);

	jQuery.ajax({
		url : 'http://riverlink.org/app/php/submit_report.php', //Server script to process data
		type : 'POST',
		xhr : function() {// Custom XMLHttpRequest
			var myXhr = jQuery.ajaxSettings.xhr();
			if (myXhr.upload) {// Check if upload property exists
				//myXhr.upload.addEventListener('progress', progressHandlingFunction, false);
				// For handling the progress of the upload
			}
			return myXhr;
		},
		//Ajax events
		//beforeSend : beforeSendHandler,
		success : function(data) {

			//console.log(data);

			if (data === 'true') {
				loading_text('Report submitted successfully.');
			} else {
				loading_text(data);
			}

			clearInterval(submit_text_interval);

			setTimeout(hide_loading, 5000);
			//loading_text('Loading...');

		},
		error : function(xhr, ajaxOptions, thrownError) {
			loading_text('There was an error uploading your file. Please verify internet connectivity and try again.');
			console.log('error: '+thrownError);

			clearInterval(submit_text_interval);
			setTimeout(hide_loading, 5000);
			//loading_text('Loading...');
		},
		// Form data
		data : formData,
		//Options to tell jQuery not to process data or worry about content-type.
		cache : false,
		contentType : false,
		processData : false
	});

}

function grab_notifications() {
	jQuery.ajax({
		type: "POST",
		url: "http://riverlink.org/app/php/grab_notifications.php",
		data: { token: "KH<R^.3jV>Tj$iFZ8L@t16$(" },
		success: function( response ) {

			grabbed_notifications = true;

			var decoded_response = jQuery.parseJSON(response);

			if (typeof decoded_response[0].urgency != "undefined") {
				jQuery('#notifications_list').html(''); //clear it first
				jQuery('.notification_img_toggle').attr('src', 'img/mail_open.png');//change img to mail open

				jQuery.each(decoded_response, function(key, value) {
					jQuery('#notifications_list').append('<li class="urgency_' + value.urgency + '">' +
																'<div class="notification_img"></div>' +
																'<div class="notification_content">' + value.message + '</div>' +
															'</li>');
				});

			} else {
				//show no new notifications
				jQuery('#notifications_list').html('<li style="text-align:center;line-height:52px;">No new notifications.</li>');
				jQuery('.notification_img_toggle').attr('src', 'img/mail_closed.png');//change img to mail closed
			}
		},
		error: function() {
			/*if (grabbed_notifications === false) {
				loading_text('There was an error pulling notifications. Please verify internet connectivity and try again.');
			}*/
		}
	});
}

function toggle_layer_visibility(toggle, layer){
	jQuery.each(places, function(layer_name, markers_arr) {

		if (layer == layer_name) {
			jQuery.each(markers_arr, function(ai, marker_obj) {
				marker_obj.setVisible(toggle);
			});

			return true;
		}

	});
}

function open_map_popup(layer, ai_id) {
	/*console.log('layer: '+layer);
	console.log('ai_id: '+ai_id);
	console.log(places[layer][ai_id]);*/

	var popup_description = places[layer][ai_id].description;
	jQuery('#map_popup_content').html(popup_description);
	jQuery('#map_popup_container').show('slide');

	check_scrolling('#map_popup_content');

}

function grab_places() {
	jQuery.ajax({
		type: "POST",
		url: "http://riverlink.org/app/php/grab_places.php",
		data: { token: "KH<R^.3jV>Tj$iFZ8L@t16$(" },
		success: function( response ) {

			grabbed_places = true;

			var decoded_response = jQuery.parseJSON(response);

			var ai = 0;
			jQuery.each(decoded_response, function(key, value) {

				var decoded_coordinates = jQuery.parseJSON(value.coordinates);

				if (value.type === 'point') {
					//grabs first set of coords
					var marker_position = new google.maps.LatLng(decoded_coordinates[0][0], decoded_coordinates[0][1]);
				} else {
					//TODO: handle different types
					var marker_position = new google.maps.LatLng(decoded_coordinates[0][0], decoded_coordinates[0][1]);
				}

				//add lat long to bounds so map can auto zoom
				bounds.extend(marker_position);

				//init object
				if (typeof places[value.layer] == 'undefined') {
					places[value.layer] = {};
				}

				//add marker
				places[value.layer][ai] = new google.maps.Marker({
					position : marker_position,
					map : map,
					title : value.title,
					visible : true,
					icon : styles[value.layer]['icon_href'],
				});

				places[value.layer][ai].description = '<h3>'+value.title+'</h3>'+value.description;

				//scope work around
				places[value.layer][ai].set('ai', ai);

				//add event listener
				google.maps.event.addListener(places[value.layer][ai], 'click', function() {
					info_window.setContent('<div style="text-align:center;max-width:200px">' +
											'<h3>'+value.title+'</h3>'+
											'<button onclick="open_map_popup(\''+value.layer+'\',\''+this.get('ai')+'\')">Details</button>'+
											'</div>');
					info_window.open(map, this);
					map.setCenter(marker_position);
				});

				ai++;
			});
		},
		error: function() {
			if (grabbed_places === false) {
				loading_text('There was an error loading the map layers. Please verify internet connectivity and try again.');
				show_loading();
				setTimeout(hide_loading, 5000);
			}
		}

	});
}

function load_places() {
	jQuery.ajax({
		type: "POST",
		url: "http://riverlink.org/app/php/grab_styles.php",
		data: { token: "KH<R^.3jV>Tj$iFZ8L@t16$(" },
		success: function( response ) {

			grabbed_styles = true;

			var decoded_response = jQuery.parseJSON(response);

			jQuery.each(decoded_response, function(key, value) {
				styles[value.id] = {
					'icon_href' : value.icon_href,
				};
			});

			grab_places();
		},
		error: function() {
			if (grabbed_styles === false) {
				loading_text('There was an error loading the map styles. Please verify internet connectivity and try again.');
				show_loading();
				setTimeout(hide_loading, 5000);
			}
		}
	});
}

function grab_layers() {
	jQuery.ajax({
		type: "POST",
		url: "http://riverlink.org/app/php/grab_layers.php",
		data: { token: "KH<R^.3jV>Tj$iFZ8L@t16$(" },
		success: function( response ) {

			grabbed_layers = true;

			var decoded_response = jQuery.parseJSON(response);

			jQuery.each(decoded_response, function(key, value) {
				layers[value.id] = {
					'icon_href' : value.icon_href,
				};
			});

			//console.log(layers);
			inject_layer_toggles();
		},
		error: function() {
			if (grabbed_layers === false) {
				loading_text('There was an error loading the map layers. Please verify internet connectivity and try again.');
				show_loading();
				setTimeout(hide_loading, 5000);
			}
		}

	});
}

function inject_layer_toggles() {

	//console.log( 'inject: ' + layers );

	jQuery.each(layers, function(key, value) {

		//this uppers every first letter of word and lowercases others (not needed since we UC all in this text)
		/*var new_layer_title = key.toLowerCase().replace(/\b[a-z]/g, function(letter) {
			return letter.toUpperCase();
		});*/
		var new_layer_title = key.replace('_', ' ');

		var new_layer_li = '<li><img style="float:left;" src="'+ value.icon_href +'" />' +
								'<input type="checkbox" checked="true" onclick="toggle_layer_visibility(this.checked, \''+key+'\')"/><br />' +
								'<span class="button_text">'+ new_layer_title +'</span>' +
							'</li>';

		jQuery('#right_menu_content ul').append(new_layer_li);
	});
}

function open_page(page) {

	//grab current active id
	var current_active_id = jQuery('.active_page').get(0).id;

	//only do stuff if the new id is different from current active
	if (current_active_id !== (page + '_page')) {
		jQuery('.active_page').hide('slide', { direction: 'left' }).removeClass('active_page');
		jQuery('#' + page + '_page').show('slide', { direction: 'right' }).addClass('active_page');

		switch (page) {
			case 'home':
				jQuery('#nav_bar').hide('slide', { direction: 'down' });
				jQuery('#right_menu_container').hide();
				jQuery('#page_header_title').hide('slide', { direction: 'up' });
			break;

			case 'map':
				jQuery('#right_menu_container').show();
				google.maps.event.trigger(map, 'resize');
				map.fitBounds(bounds);
				jQuery('#nav_bar').show('slide', { direction: 'down' });
				jQuery('#page_header_title').hide('slide', { direction: 'up' });
			break;

			case 'notification':
				jQuery('#right_menu_container').hide();
				jQuery('#page_header_content').html('Notifications');
				jQuery('#page_header_title').show('slide', { direction: 'up' });
				jQuery('#nav_bar').show('slide', { direction: 'down' });
				check_scrolling('#notification_page');
			break;

			case 'report':
				jQuery('#right_menu_container').hide();
				jQuery('#page_header_content').html('Report An Incident');
				jQuery('#page_header_title').show('slide', { direction: 'up' });
				jQuery('#nav_bar').show('slide', { direction: 'down' });
			break;

			default:
			break;
		}
	}
}

function on_gps_error() {
	if (grabbed_gps === false) {
		loading_text('Riverlink can not access your location. If you would like to have your location represented on the map, please enable geolocation services.');
		show_loading();
		setTimeout(hide_loading, 5000);
	}
}

function on_gps_success() {
	grabbed_gps = true;
}

function update_current_pos(location) {
	var myLatlng = new google.maps.LatLng(location.coords.latitude, location.coords.longitude);
	/*map.setCenter(myLatlng);
	map.setZoom(15);
	$("#lat").text("Latitude : " + location.coords.latitude);
	$("#lon").text("Longitude : " + location.coords.longitude);*/
	//show current location on map
	marker = new google.maps.Marker({
		position : myLatlng,
		icon: 'https://s3.amazonaws.com/hiltonheadmls/gps_marker.png',
		map : map,
		title: 'You are here.',
		zIndex: google.maps.Marker.MAX_ZINDEX + 1
	});

	google.maps.event.addListener(marker, 'click', function() {
		info_window.setContent('<div style="text-align:center;max-width:200px">' +
								'<h3>'+marker.title+'</h3>'+
								'</div>');
		info_window.open(map, this);

		map.setCenter(marker.position);
	});


	//navigator.geolocation.clearWatch(watch_gps_id);

}

function resizeIframe(id) {
	alert('test height: ' + jQuery('#' + id).contents().height());
	jQuery('#' + id).css('height', jQuery('#' + id).contents().height() + 'px');
}

function show_loading() {
	jQuery('#loading_bg, #loading_div').show();
}

function hide_loading() {
	jQuery('#loading_bg, #loading_div').hide();
}

function loading_text(text) {
	jQuery('#loading_div').html(text);
}

function check_scrolling(id) {
	var content_height_check = document.querySelector(id);

	//console.log('offsetHeight/scroll: '+content_height_check.offsetHeight+' < '+content_height_check.scrollHeight);
	//console.log('jqueryidheight/childrenheight: '+jQuery(id).height() + '<' + jQuery(id).wrapInner('<div>').children().outerHeight());

	if (content_height_check.offsetHeight < content_height_check.scrollHeight ||
		jQuery(id).height() < jQuery(id).wrapInner('<div>').children().outerHeight()) {
		//element has overflow
		jQuery(id).css('overflow-y', 'scroll');
	} else {
		//element doesnt have overflow
		jQuery(id).css('overflow-y', 'hidden');
	}
}
