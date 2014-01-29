//TODO: trigger loading of places, loading IMG in map section, hide tab button, generate checkboxes
//TODO: timeout check for new notifications every X seconds, change icon to mail_open and add to notification list
//TODO: fix window call for iOS vs Android see: http://stackoverflow.com/questions/17887348/phonegap-open-link-in-browser

jQuery(document).ready(function() {
	jQuery('#right_tabs').click(function() {

		if (jQuery('#right_menu_content').css('display') === 'none') {
			jQuery('#right_menu_content').show();
			jQuery('#right_tabs').css('right', '100%');
		} else {
			jQuery('#right_menu_content').hide();
			jQuery('#right_tabs').css('right', '0');
		}

	});
});


function open_page(id_prefix) {

	jQuery('.active_page').hide('slide', { direction: 'left' }).removeClass('active_page');
	jQuery('#' + id_prefix + '_page').show('slide', { direction: 'right' }).addClass('active_page');

	if (id_prefix !== 'home') {
		jQuery('#nav_bar').show('slide', { direction: 'down' });
	} else {
		jQuery('#nav_bar').hide('slide', { direction: 'down' });
	}

	if (id_prefix === 'map') {
		jQuery('#right_menu_container').show();
	} else {
		jQuery('#right_menu_container').hide();
	}
}

function getLocation() {
	navigator.geolocation.getCurrentPosition(positionSuccess, onError);
}

function positionSuccess(position) {
	var longitude = position.coords.longitude;
	var latitude = position.coords.latitude;
	var srcString = "http://maps.googleapis.com/maps/api/staticmap?center=" + latitude + "," + longitude + "&zoom=11&size=200x200&sensor=false";
	srcString += "&markers=color:red%7Clabel:A%7C" + latitude + "," + longitude;
	try {
		$('#myMap').attr({
			src : srcString,
			height : 200,
			width : 200
		});
	} catch(ex) {
		alert('Error: ' + ex);
	}
}

function onError(error) {
	alert('code: ' + error.code + '\n' + 'message: ' + error.message + '\n');
}

function resizeIframe(id) {
	alert('test height: ' + jQuery('#' + id).contents().height());
	jQuery('#' + id).css('height', jQuery('#' + id).contents().height() + 'px');
}
