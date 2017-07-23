var map;

var markers = [];

var polygon = null;

var placeMarkers = [];

const COMPONENT_RESTRICTION = {locality: 'San Francisco, CA'};

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 40.7413549, lng: -73.9980244},
    zoom: 13,
  });

  var timeAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById('search-within-time-text')
  );

  var zoomAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById('zoom-to-area-text')
  );

  zoomAutocomplete.bindTo('bounds', map);

  var searchBox = new google.maps.places.SearchBox(
    document.getElementById('places-search')
  );
  searchBox.setBounds(map.getBounds());

  var locations = [
    {title: 'Park Ave Penthouse', location: {lat: 40.7713024, lng: -73.9632393}},
    {title: 'Chelsea Loft', location: {lat: 40.7448834, lng: -73.9949465}},
    {title: 'Union Square Open Floor Plan', location: {lat: 40.7347062, lng: -73.9895759}},
    {title: 'East Village Hp Studio', location: {lat: 40.7281777, lng: -73.984377}},
    {title: 'TriBeCa Artsy Bachelor Pad', location: {lat: 40.719624, lng: -74.0089934}},
    {title: 'Chinatown Homey Space', location: {lat: 40.7180628, lng: -73.9961237}},
  ];

  var dateLocations = [
    'Choux Bakery', 'Top of the Mark', 'Nob Hill Spa',
    'Telegraph Hill, Filbert Stairs', 'B. Patisserie',
    'Mason Pacific', 'Shakespeare Garden', 'Golden Gate Bridge',
    'Palace of Fine Arts', 'Press Club', 'Saison',
    'Exploratorium', 'Stow Lake', 'Crissy Field', 'Waterbar'
  ]


  var largeInfoWindow = new google.maps.InfoWindow();

  var drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYGON,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_LEFT,
      drawingModes: [
        google.maps.drawing.OverlayType.POLYGON
      ]
    }
  });

  var defaultIcon = makeMarkerIcon('0091ff');

  var highlightedIcon = makeMarkerIcon('FFFF24');

  locations.forEach((loc, i) => {
    let marker = new google.maps.Marker({
      position: loc.location,
      title: loc.title,
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
  });

  document.getElementById('show-listings').addEventListener('click', showListings);
  document.getElementById('hide-listings').addEventListener('click', hideMarkers);
  document.getElementById('toggle-drawing').addEventListener('click', () => {
    toggleDrawing(drawingManager);
  });

  drawingManager.addListener('overlaycomplete', function(event) {
    if (polygon) {
      polygon.setMap(null);
      hideMarkers();
    }
    drawingManager.setDrawingMode(null);
    polygon = event.overlay;
    polygon.setEditable(true);
    searchWithinPolygon();
    polygon.getPath().addListener('set_at', searchWithinPolygon);
    polygon.getPath().addListener('insert_at', searchWithinPolygon);
  });

  document.getElementById('zoom-to-area').addEventListener('click', () => {
    zoomToArea();
  });

  document.getElementById('search-within-time').addEventListener('click', () => {
    searchWithinTime();
  });

  searchBox.addListener('places_changed', function() {
    searchBoxPlaces(this);
  });

  document.getElementById('go-places').addEventListener('click', textSearchPlaces);
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

function hideMarkers(markers) {
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

function toggleDrawing(drawingManager) {
  if (drawingManager.map) {
    drawingManager.setMap(null);
    if (polygon) {
      polygon.setMap(null);
    }
  } else {
    drawingManager.setMap(map);
  }
}

function searchWithinPolygon() {
  markers.forEach(marker => {
    if (google.maps.geometry.poly.containsLocation(marker.position, polygon)) {
      marker.setMap(map);
    } else {
      marker.setMap(null);
    }
  });
}

function zoomToArea() {
  var geocoder = new google.maps.Geocoder();
  var address = document.getElementById('zoom-to-area-text').value;
  if (address == '') {
    window.alert('You must enter an area, or address.');
  } else {
    let loc = {
      address: address,
      componentRestrictions: {locality: 'New York'}
    };
    geocoder.geocode(loc, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        map.setCenter(results[0].geometry.location);
        map.setZoom(15);
      } else {
        window.alert('We could not find that location - try something else')
      }
    });
  }
}

function searchWithinTime() {
  var distanceMatrixService = new google.maps.DistanceMatrixService;
  var address = document.getElementById('search-within-time-text').value;
  if (!address) {
    window.alert('You must enter an address.');
  } else {
    hideMarkers();
    var origins = [];
    markers.forEach(marker => {
      origins.push(marker.position);
    });
    var destination = address;
    var mode = document.getElementById('mode').value;
    var opts = {
      origins: origins,
      destinations: [destination],
      travelMode: google.maps.TravelMode[mode],
      unitSystem: google.maps.UnitSystem.IMPERIAL
    }
    distanceMatrixService.getDistanceMatrix(opts, function(response, status) {
      if (status !== google.maps.DistanceMatrixStatus.OK) {
        window.alert(`Error was ${status}`);
      } else {
        displayMarkersWithinTime(response);
      }
    });
  }
}

function displayMarkersWithinTime(response) {
  var maxDuration = document.getElementById('max-duration').value;
  var origins = response.originAddresses;
  var destination = response.destinationAddresses;
  var atLeastOne = false;
  for (var i = 0; i < origins.length; ++i) {
    var results = response.rows[i].elements;
    for (var j = 0; j < results.length; ++j) {
      var element = results[j];
      if (element.status === 'OK') {
        var distanceText = element.distance.text;
        var duration = element.duration.value / 60;
        var durationText = element.duration.text;
        if (duration <= maxDuration) {
          markers[i].setMap(map);
          atLeastOne = true;
          var infowindow = new google.maps.InfoWindow({
            content: `${durationText} away, ${distanceText}` +
              '<div><input type="button" value="View Route" onclick=' +
              '"displayDirections(&quot;' + origins[i] + '&quot;);"></input></div>'
          });
          infowindow.open(map, markers[i]);
          markers[i].infowindow = infowindow;
          google.maps.event.addListener(markers[i], 'click', function() {
            this.infowindow.close();
          });
        }
      }
    }
  }
}

function displayDirections(origin) {
  hideMarkers();
  var directionsService = new google.maps.DirectionsService;
  var destinationAddress = document.getElementById('search-within-time-text').value;
  var mode = document.getElementById('mode').value;
  var opts = {
    origin: origin,
    destination: destinationAddress,
    travelMode: google.maps.TravelMode[mode]
  };
  directionsService.route(opts, function(response, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      var directionsDisplay = new google.maps.DirectionsRenderer({
        map: map,
        directions: response,
        draggable: true,
        polylineOptions: {
          strokeColor: 'green'
        }
      });
    } else {
      window.alert(`Directions request failed to ${status}`);
    }
  });
}

function searchBoxPlaces(searchBox) {
  hideMarkers(placeMarkers);
  var places = searchBox.getPlaces();
  createMarkersForPlaces(places);
  if (places.length === 0) {
    window.alert('No places found');
  }
}

function textSearchPlaces() {
  var bounds = map.getBounds();
  hideMarkers(placeMarkers);
  var placeService = new google.maps.places.PlacesService(map);
  placeService.textSearch({
    query: document.getElementById('places-search').value,
    bounds: bounds
  }, function(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      createMarkersForPlaces(results);
    }
  });
}

function createMarkersForPlaces(places) {
  var bounds = new google.maps.LatLngBounds();
  places.forEach(place => {
    var icon = {
      url: place.icon,
      size: new google.maps.Size(35, 35),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(15, 34),
      scaledSize: new google.maps.Size(25, 25),
    };
    var marker = new google.maps.Marker({
      map: map,
      icon: icon,
      title: place.name,
      position: place.geometry.location,
      id: place.place_id
    });
    var placeInfoWindow = new google.maps.InfoWindow();
    marker.addListener('click', function() {
      if (placeInfoWindow.marker == this) {
        console.log('This infowindow already is on a marker');
      } else {
        getPlacesDetails(this, placeInfoWindow);
      }
    });
    placeMarkers.push(marker);
    if (place.geometry.viewport) {
      bounds.union(place.geometry.viewport);
    } else {
      bounds.extend(place.geometry.location);
    }
  });
}

function getPlacesDetails(marker, infowindow) {
  var service = new google.maps.places.PlacesService(map);
  service.getDetails({
    placeId: marker.id
  }, function(place, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      infowindow.marker = marker;
      var innerHTML = '<div>';
      if (place.name) {
        innerHTML += '<strong>' + place.name + '</strong>';
      }
      if (place.formatted_address) {
        innerHTML += '<br>' + place.formatted_address;
      }
      if (place.formatted_phone_number) {
        innerHTML += '<br>' + place.formatted_phone_number;
      }
      if (place.opening_hours) {
        innerHTML += '<br><br><strong>Hours:</strong></br>' +
          place.opening_hours.weekday_text[0] + '<br>' +
          place.opening_hours.weekday_text[1] + '<br>' +
          place.opening_hours.weekday_text[2] + '<br>' +
          place.opening_hours.weekday_text[3] + '<br>' +
          place.opening_hours.weekday_text[4] + '<br>' +
          place.opening_hours.weekday_text[5] + '<br>' +
          place.opening_hours.weekday_text[6];
      }
      if (place.photos) {
        innerHTML += '<br><br><img src="' + place.photos[0].getUrl(
          {maxHeight: 100, maxWidth: 200}
        ) + '">';
      }
      innerHTML += '</div>';
      infowindow.setContent(innerHTML);
      infowindow.open(map, marker);
      infowindow.addListener('closeclick', function() {
        this.marker = null;
      });
    } else {
      window.alert('Unable to get place details');
    }
  });
}
