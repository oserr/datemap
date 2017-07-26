var map;
var markers = [];
var placeMarkers = [];
var largeInfoWindow;
var defaultIcon;
var highlightedIcon;
var geocoder;

function initMap() {
    var locationNames = [
        'Choux Bakery', 'Top of the Mark', 'Nob Hill Spa',
        'Telegraph Hill, Filbert Stairs', 'B. Patisserie',
        'Mason Pacific', 'Shakespeare Garden', 'Golden Gate Bridge',
        /*
        'Palace of Fine Arts', 'Press Club', 'Saison',
        'Exploratorium', 'Stow Lake', 'Crissy Field', 'Waterbar'
        */
    ]

    initGlobalVars();

    geocodePlaceName('Twin Peaks')
    .then(locationInfo => {
        map = new google.maps.Map(document.getElementById('map'), {
            center: locationInfo.location,
            zoom: 13,
        });
        return map;
    }).then(() => {
        return locationNames.reduce((seq, locationName) => {
            return seq.then(() => {
                return geocodePlaceName(locationName);
            }).then(createMarker)
            .catch(err => {
                errMsg = `Error: ${err.message}`;
                console.log(errMsg);
                alert(errMsg);
            });
        }, Promise.resolve());
    }).catch(err => {
        alert(`Error: ${err.message}`);
    });

    $('#show-listings').on('click', showListings);
    $('#hide-listings').on('click', hideMarkers);
    $('#close-modal-btn').on('click', () => {
        $('#street-view').empty();
        modal = $('#modal-info');
        modal.addClass('hidden');
    });
}

/**
 * Initialize a set of global variables.
 */
function initGlobalVars() {
    largeInfoWindow = new google.maps.InfoWindow();
    defaultIcon = makeMarkerIcon('0091ff');
    highlightedIcon = makeMarkerIcon('FFFF24');
    geocoder = new google.maps.Geocoder();
}

/**
 * Geocodes a place in San Francisco, CA.
 * @param {string} placeName - The name of a place in San Francisco, e.g.,
 * Twin Peaks.
 * @return A Promise, which is resolved with an object on success, or rejected
 * with an error on failure. On success, the object contains the fields name
 * and location, representing the name of the place searched for, and the
 * latitude and longitude coordinates, respectively.
 */
function geocodePlaceName(placeName) {
    return new Promise((resolve, reject) => {
        const loc = { address: `${placeName}, San Francisco, CA`};
        geocoder.geocode(loc, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                resolve({
                    name: placeName,
                    location: results[0].geometry.location
                });
            } else {
                const err = `failed to geocode ${placeName}`;
                console.log(err);
                reject(new Error(err));
            }
        });
    });
}

/**
 * Creates a new marker and pushes the marker into the markers array.
 * @param {object} locationInfo - The location information for the marker.
 * Contains fields name and location, representing the name of the location,
 * and the latitude and longitude coordinates.
 */
function createMarker(locationInfo) {
    let marker = new google.maps.Marker({
        position: locationInfo.location,
        title: locationInfo.name,
        icon: defaultIcon,
        animation: google.maps.Animation.DROP,
        id: markers.length,
    });

    markers.push(marker);

    marker.addListener('click', function() {
        showModal(this);
    });

    marker.addListener('mouseover', function() {
        this.setIcon(highlightedIcon);
    });

    marker.addListener('mouseout', function() {
        this.setIcon(defaultIcon);
    });
}

function populateInfoWindow(marker, infoWindow) {
    if (infoWindow.marker != marker) {
        infoWindow.setContent('');
        infoWindow.marker = marker;
        //infoWindow.open(map, marker);
        infoWindow.addListener('closeclick', function() {
            infoWindow.marker = null;
        });
        var streetViewService = new google.maps.StreetViewService();
        const radius = 50;

        function getStreetView(data, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                console.log('status == OK in getStreetView');
                const nearStreetViewLocation = data.location.latLng;
                const heading = google.maps.geometry.spherical.computeHeading(
                     nearStreetViewLocation,
                     marker.position
                );
                infoWindow.setContent('<div>' + marker.title + '</div><div id="pano"></div>');
                const panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 30,
                    }
                };
                const panorama = new google.maps.StreetViewPanorama(
                    document.getElementById('pano'),
                    panoramaOptions
                );
            } else {
                console.log('status == NOT OK in getStreetView');
                infoWindow.setContent(`<div>${marker.title}</div><div>No Street View Found</div>`);
            }
        }

        streetViewService.getPanoramaByLocation(
            marker.position,
            radius,
            getStreetView
        );
        infoWindow.open(map, marker);
    }
}

/**
 * Shows a Google Maps street view in a modal window.
 * @param {Marker} marker - The Google Maps Marker reprsenting the location
 * to be seen in a street view.
 */
function showModal(marker) {
    console.log('called showModal');
    var streetViewService = new google.maps.StreetViewService();
    const radius = 50;
    var streetViewDiv = $('#street-view');
    streetViewService.getPanoramaByLocation(
        marker.position,
        radius,
        function(data, status) {
            if (status === google.maps.StreetViewStatus.OK) {
                console.log('StreetViewStatus is OK');
                const nearLocation = data.location.latLng;
                const heading = google.maps.geometry.spherical.computeHeading(
                     nearLocation,
                     marker.position
                );
                const opts = {
                    position: nearLocation,
                    pov: {
                        heading: heading,
                        pitch: 30,
                    }
                };
                var modalDiv = $('#modal-info');
                modalDiv.removeClass('hidden');
                new google.maps.StreetViewPanorama($('#street-view')[0], opts);
                centerModal(modalDiv);
                $(window).on('resize', () => {
                    centerModal(modalDiv);
                });
            } else {
                console.log('Unable to get street view');
            }
        }
    );
}

/**
 * Centers a modal div on a window.
 * @param {jQuery object} modalDiv - The div representing the modal window.
 */
function centerModal(modalDiv) {
    // The following logic to center modal window is taken from Javascript and
    // Jquery: interactive front-end web development, by Jon Duckett.
    const jqWindow = $(window);

    const windowHeight = jqWindow.height();
    console.log(`computed wHeight=${windowHeight} in pixels`);
    const windowWidth = jqWindow.width();
    console.log(`computed wWidth=${windowWidth} in pixels`);
    const modalHeight = windowHeight * .7;
    const modalWidth = windowWidth * .7;

    const top = Math.max(windowHeight - modalDiv.outerHeight(), 0) / 2;
    const left = Math.max(windowWidth - modalDiv.outerWidth(), 0) / 2;

    modalDiv.css({
        top: top + jqWindow.scrollTop(),
        left: left + jqWindow.scrollLeft(),
        height: modalHeight,
        width: modalWidth,
        padding: 20,
        background: 'black'
    });

    $('#street-view').css({
        height: modalHeight * .5,
        width: 'auto',
    });

    $('#foursquare').css({
        height: modalHeight * .5,
        width: 'auto',
    });
}

function showListings() {
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => {
        marker.setMap(map);
        bounds.extend(marker.position);
    });
    map.fitBounds(bounds);
}

function hideMarkers() {
    markers.forEach(marker => { marker.setMap(null); });
}

function makeMarkerIcon(markerColor) {
    return new google.maps.MarkerImage(
        `http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|${markerColor}|40|_|%E2%80%A2`,
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34)
    );
}
