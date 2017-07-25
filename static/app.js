var map;

var markers = [];

var placeMarkers = [];

var dateLocations = [];

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

    var largeInfoWindow = new google.maps.InfoWindow();

    var defaultIcon = makeMarkerIcon('0091ff');

    var highlightedIcon = makeMarkerIcon('FFFF24');

    var geocoder = new google.maps.Geocoder();

    let twinPeaks = { address: 'Twin Peaks, San Francisco, CA' };

    geocoder.geocode(twinPeaks, function(cityResults, cityStatus) {
        if (cityStatus == google.maps.GeocoderStatus.OK) {
            console.log(`-> geocoded San Francisco, CA location=${cityResults[0].geometry.location}`);
            map = new google.maps.Map(document.getElementById('map'), {
                center: cityResults[0].geometry.location,
                zoom: 13,
            });
            locationNames.forEach((dateLocationName, i) => {
                let loc = {
                    address: dateLocationName,
                };
                geocoder.geocode(loc, function(dateLocResults, dateLocStatus) {
                    if (dateLocStatus == google.maps.GeocoderStatus.OK) {
                        console.log(`--> results for ${loc.address}`);
                        dateLocResults.forEach((r, j) => {
                            console.log(`--> result ${j} location=${r.geometry.location}`);
                        });

                        let marker = new google.maps.Marker({
                            position: dateLocResults[0].geometry.location,
                            title: loc.address,
                            icon: defaultIcon,
                            animation: google.maps.Animation.DROP,
                            id: i,
                        });

                        markers.push(marker);

                        marker.addListener('click', function() {
                            populateInfoWindow(this, largeInfoWindow);
                        });

                        marker.addListener('mouseover', function() {
                            this.setIcon(highlightedIcon);
                        });

                        marker.addListener('mouseout', function() {
                            this.setIcon(defaultIcon);
                        });
                    } else {
                        console.log(`-xxx Unable to find ${loc.address} status=${status}`);
                        window.alert(`Unable to find ${loc.address} in San Francisco, CA`)
                    }
                });
            });
        } else {
            window.alert('Unable to find map for San Francisco, CA')
        }
    });

    document.getElementById('show-listings').addEventListener('click', showListings);
    document.getElementById('hide-listings').addEventListener('click', hideMarkers);
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
        let loc = { address: `${placeName}, San Francisco, CA`};
        geocoder.geocode(loc, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                resolve({
                    name: placeName,
                    location: results[0].geometry.location
                });
            } else {
                var err = `failed to geocode ${placeName}`;
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
        populateInfoWindow(this, largeInfoWindow);
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
        var radius = 50;

        function getStreetView(data, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                console.log('status == OK in getStreetView');
                var nearStreetViewLocation = data.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                     nearStreetViewLocation,
                     marker.position
                );
                infoWindow.setContent('<div>' + marker.title + '</div><div id="pano"></div>');
                var panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 30,
                    }
                };
                var panorama = new google.maps.StreetViewPanorama(
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

function showListings() {
    var bounds = new google.maps.LatLngBounds();
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
    var markerImage = new google.maps.MarkerImage(
        `http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|${markerColor}|40|_|%E2%80%A2`,
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34)
    );
    return markerImage;
}
