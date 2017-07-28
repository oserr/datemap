const MAX_4SQUARE_PICS = 5;


function DatePlace(marker) {
  /**
   * Initializes the object with a Google Maps API Marker.
   *
   * @param {Marker} marker - A Google Maps API marker that contains the
   * latitude and longitude coordinates of a given place.
   */
  this.className = 'DatePlace';
  this.marker = marker;
  this.streetViewNode = null;
  this.venue = null;

  let self = this;

  /**
   * Initializes the street view, a raw Element node that contains the
   * HTML/javascript for the panorama street view.
   *
   * @param {StreetViewService} streetViewService - A Google Maps API street
   * view service to convert obtain the panoramic street view of a given
   * location.
   * @return {Promise} A promise that is resovled with this DatePlace on
   * success, or an Error on failure.
   */
  this.initStreetView = function(streetViewService) {

    return new Promise((resolve, reject) => {
      console.log('initStreetView()');

      if (self.streetViewNode !== null) {
        return resolve(self);
      }

      streetViewService.getPanoramaByLocation(
        self.marker.position,
        50, // radius
        function(data, status) {
          if (status === google.maps.StreetViewStatus.OK) {
            console.log(`panorama is OK for ${self.marker.title}`);

            const heading = google.maps.geometry.spherical.computeHeading(
              data.location.latLng,
              self.marker.position
            );

            const opts = {
              position: data.location.latLng,
              pov: {
                heading: heading,
                pitch: 30,
              }
            };

            // Create the element container for the panorama
            self.streetViewNode = document.createElement('div');
            self.streetViewNode.id = 'street-view-node';

            // Attach the panorama in the container
            new google.maps.StreetViewPanorama(self.streetViewNode, opts);

            // Grab the street view container so we can center it now and again
            // any time the window size changes.
            // TODO: move this to view model initializer
            var modalDiv = $('#modal-info');
            centerModal(modalDiv);
            $(window).on('resize', () => {
              centerModal(modalDiv);
            });

            return resolve(self);
          } else {
            return reject(
              new Error(`panorama is not OK for ${self.marker.title}`)
            );
          }
        }
      );
    });
  };
}


/**
 * Creates a Venue object cotaining multiple pieces of information about a
 * venue.
 * @param {Object} venue - A JSON object response from the Foursquare API
 * containing information about a venue.
 */
function Venue(venue) {
  this.className = 'Venue';
  this.name = venue.name;
  this.url = venue.url;
  this.formattedPhone = venue.contact.formattedPhone;
  this.formattedAddress = venue.location.formattedAddress;
  this.rating = venue.rating;
  this.ratingColor = venue.ratingColor;
  this.photoLinks = [];

  let total = 0;
  const totalItems = venue.photos.groups.count;
  for (let i = 0; i < totalItems && total < MAX_4SQUARE_PICS; ++i) {
    item = venue.photos.groups.items[i];
    if (item.visibility === 'public') {
      this.photoLinks.push({
        prefix: item.prefix,
        suffix: item.suffix,
      });
      ++total;
    }
  }
}


function ViewModel(cityCenter, locationNames) {
  /**
   * Initializes multiple pieces of the ViewModel, including the geocoder, a
   * couple of icons for the Google Maps API markers, a map centered on
   * cityCenter, and the set of markers corresponding to date locations.
   *
   * @param {string} cityCenter - A name of a place to center the map.
   * @param {Array} locationNames - A list of date places to display on the
   * map.
   */
  this.className = 'ViewModel';
  this.map = null;
  this.datePlaces = [];
  this.geocoder = new google.maps.Geocoder();
  this.defaultIcon = makeMarkerIcon('0091ff');
  this.highlightedIcon = makeMarkerIcon('FFFF24');
  this.showInfo = ko.observable(false);
  this.streetViewService = new google.maps.StreetViewService();

  let self = this;

  geocodePlaceName(cityCenter, self.geocoder)
  .then(locationInfo => {
    self.map = new google.maps.Map(document.getElementById('map'), {
      center: locationInfo.location,
      zoom: 13,
    });
  })
  .then(() => {
    return locationNames.reduce((seq, locationName) => {
      return seq.then(() => geocodePlaceName(locationName, self.geocoder))
      .then(createDatePlace.bind(self))
      .then(datePlace => self.datePlaces.push(datePlace))
      .catch(err => reportError(err));
    }, Promise.resolve());
  })
  .then(() => {
    const bounds = new google.maps.LatLngBounds();
    self.datePlaces.forEach(datePlace => {
      datePlace.marker.setMap(self.map);
      bounds.extend(datePlace.marker.position);
    });
    self.map.fitBounds(bounds);
  })
  .catch(err => reportError(err));

  /**
   * Sets the current date place when a user clicks on a marker.
   * @param {DatePlace} datePlace - The date place containing the marker, venue,
   * and the street view node.
   */
  this.setShowInfo = function() {
    self.showInfo(true);
  };

  /**
   * Sets the current date place to null.
   */
  this.removeShowInfo = function() {
    self.showInfo(false);
  };
}


/**
 * Logs an error to the console and the view port.
 * @param {Error} err - An error object.
 */
function reportError(err) {
  errMsg = `Error: ${err.message}`;
  console.log(errMsg);
  alert(errMsg);
}


function initViewModel() {
  var locationNames = [
    'Choux Bakery', 'Top of the Mark', 'Nob Hill Spa',
    'Telegraph Hill, Filbert Stairs', 'B. Patisserie',
    'Mason Pacific', 'Shakespeare Garden', 'Golden Gate Bridge',
    /*
    'Palace of Fine Arts', 'Press Club', 'Saison',
    'Exploratorium', 'Stow Lake', 'Crissy Field', 'Waterbar'
    */
  ]
  ko.applyBindings(new ViewModel('Twin Peaks', locationNames));
}


/**
 * Geocodes a place in San Francisco, CA.
 * @param {string} placeName - The name of a place in San Francisco, e.g.,
 * Twin Peaks.
 * @param {Geocoder} geocoder - A Google Maps API geocoder.
 * @return A Promise, which is resolved with an object on success, or rejected
 * with an error on failure. On success, the object contains the fields name
 * and location, representing the name of the place searched for, and the
 * latitude and longitude coordinates, respectively.
 */
function geocodePlaceName(placeName, geocoder) {
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
 * Creates a new DatePlace object with a Google Maps Marker and attaches
 * some listeners on the marker.
 * @param {object} locationInfo - The location information for the marker.
 * Contains fields name and location, representing the name of the location,
 * and the latitude and longitude coordinates.
 */
function createDatePlace(locationInfo) {

  const self = this;

  const marker = new google.maps.Marker({
    position: locationInfo.location,
    title: locationInfo.name,
    icon: self.defaultIcon,
    animation: google.maps.Animation.DROP,
  });

  let datePlace = new DatePlace(marker);

  marker.addListener('click', function() {
    datePlace.initStreetView(self.streetViewService)
    .then(() => self.setCurrentDatePlace(datePlace))
    .catch(err => reportError(err));
  });

  marker.addListener('mouseover', function() {
    this.setIcon(self.highlightedIcon);
  });

  marker.addListener('mouseout', function() {
    this.setIcon(self.defaultIcon);
  });

  return datePlace;
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


function makeMarkerIcon(markerColor) {
  return new google.maps.MarkerImage(
    `http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|${markerColor}|40|_|%E2%80%A2`,
    new google.maps.Size(21, 34),
    new google.maps.Point(0, 0),
    new google.maps.Point(10, 34),
    new google.maps.Size(21, 34)
  );
}
