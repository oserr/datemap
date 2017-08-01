const MAX_4SQUARE_PICS = 5;
const UNKNOWN_OR_NA = 'Unknown or n/a';


function DatePlace(marker) {
  /**
   * Initializes the object with a Google Maps API Marker.
   *
   * @param {Marker} marker - A Google Maps API marker that contains the
   * latitude and longitude coordinates of a given place.
   */
  this.className = 'DatePlace';
  this.marker = marker;
  this.venue = ko.observable(null);
  this.isVisible = ko.observable(true);
  this.map = null;
  this.isSelected = ko.observable(false);
  this.id = null;

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

            // Clean street-view container before attaching street view
            const streetViewDiv = $('#street-view');
            streetViewDiv.empty();

            // Attach the panorama in the container and center it in viewport
            new google.maps.StreetViewPanorama(streetViewDiv[0], opts);
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

  /**
   * Initializes the Venue, an object with information about a venue from
   * Foursquare.
   *
   * @return {Promise} A promise that is resovled with this DatePlace on
   * success. Errors are bubbled up the promise chain.
   */
  this.initVenue = function() {

    return new Promise((resolve, reject) => {
      console.log('initVenue()');

      if (self.venue() !== null) {
        return resolve(self);
      }

      return searchVenue(self.marker.getTitle())
        .then(getVenueInfo)
        .then(venue => {
          self.venue(new Venue(venue));
          return self;
        });
    });
  };

  /**
   * Highlights the marker icon.
   */
  this.doMouseOver = function() {
    google.maps.event.trigger(self.marker, 'mouseover');
  };

  /**
   * Sets the marker icon to the default marker icon.
   */
  this.doMouseOut = function() {
    google.maps.event.trigger(self.marker, 'mouseout');
  };

  /**
   * Sets the marker icon to the default marker icon.
   */
  this.applySearch = function(text) {
    text = text.trim().toLowerCase();
    if (text === ''
      || self.marker.getTitle().toLowerCase().includes(text))  {
      self.marker.setMap(self.map);
      self.isVisible(true);
    } else {
      self.marker.setMap(null);
      self.isVisible(false);
    }
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
  this.url = venue.url || UNKNOWN_OR_NA;
  this.formattedPhone = venue.contact.formattedPhone || UNKNOWN_OR_NA;
  this.formattedAddress = venue.location.formattedAddress || UNKNOWN_OR_NA;
  this.rating = venue.rating || UNKNOWN_OR_NA;
  this.photoLinks = [];
  this.selectedPhoto = ko.observable(null);
  this.selectedPhotoIndex = ko.observable(null);

  // Search for at most MAX_4SQUARE_PICS photos and build the links for them.
  // The current Foursquare API requires that a size be wedged between the
  // prefix and suffix of the URL, e.g., XXxYY, original, capXX, etc.
  const totalItems = venue.photos.groups[0].count;
  for (let i = 0; i < totalItems &&
       this.photoLinks.length < MAX_4SQUARE_PICS; ++i) {
    item = venue.photos.groups[0].items[i];
    if (item.visibility === 'public') {
      this.photoLinks.push(`${item.prefix}original${item.suffix}`);
    }
  }

  // If we find photos, then select the first one to display on window
  if (this.photoLinks.length) {
    this.selectedPhoto(this.photoLinks[0]);
    this.selectedPhotoIndex(0);
  }

  let self = this;

  /**
   * Checks if there are more pictures for a user to see.
   */
  this.hasNextPhoto = function() {
    const index = self.selectedPhotoIndex();
    return index !== null && index < self.photoLinks.length - 1;
  };


  /**
   * Updates the current photo to the next photo in the list.
   */
  this.getNextPhoto = function() {
    if (self.hasNextPhoto()) {
      let index = self.selectedPhotoIndex() + 1;
      self.selectedPhoto(self.photoLinks[index]);
      self.selectedPhotoIndex(index);
    }
  };

  /**
   * Checks if there are previous pictures for a user to see.
   */
  this.hasPreviousPhoto = function() {
    const index = self.selectedPhotoIndex();
    return index !== null && index > 0;
  };

  /**
   * Updates the current photo to the previous photo in the list.
   */
  this.getPreviousPhoto = function() {
    if (self.hasPreviousPhoto()) {
      let index = self.selectedPhotoIndex() - 1;
      self.selectedPhoto(self.photoLinks[index]);
      self.selectedPhotoIndex(index);
    }
  };

  /**
   * Rewinds the selected photo to the first photo in photoLinks.
   */
  this.rewindPhotos = function() {
    if (self.hasPreviousPhoto()) {
      self.selectedPhoto(self.photoLinks[0]);
      self.selectedPhotoIndex(0);
    }
  };
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
  this.datePlaces = ko.observableArray([]);
  this.geocoder = new google.maps.Geocoder();
  this.defaultIcon = makeMarkerIcon('0091ff');
  this.highlightedIcon = makeMarkerIcon('FFFF24');
  this.shouldShowInfo = ko.observable(false);
  this.streetViewService = new google.maps.StreetViewService();
  this.selectedDatePlace = ko.observable(null);
  this.searchText = ko.observable('');

  let self = this;

  geocodePlaceName(cityCenter, self.geocoder)
  .then(locationInfo => {
    self.map = new google.maps.Map(document.getElementById('map'), {
      center: locationInfo.location,
      zoom: 13,
    });
  })
  .then(() => {
    const promiseArr = [];
    locationNames.forEach(loc => {
      promiseArr.push(geocodePlaceName(loc, self.geocoder));
    });
    return Promise.all(promiseArr);
  })
  // Initialize the venue for the first item in the array so we can render
  // everything in page more quickly.
  .then(latLongs => {
    const dp = createDatePlace.bind(self)(latLongs[0]);
    dp.id = 0;
    dp.map = self.map;
    dp.marker.setMap(self.map);
    self.datePlaces.push(dp);
    google.maps.event.trigger(dp.marker, 'click');
    return latLongs;
  })
  // Now proceed to initialize the other DatePlaces
  .then(latLongs => {
    const otherLatLng = latLongs.slice(1);
    otherLatLng.forEach(latLng => {
      const dp = createDatePlace.bind(self)(latLng);
      dp.id = self.datePlaces.length;
      dp.map = self.map;
      dp.marker.setMap(self.map);
      self.datePlaces.push(dp);
    });
  })
  // Now compute the bounds of the map and initialize the venue info for each
  // item so page can respond more quickly when user selects a different date location.
  .then(() => {
    const bounds = new google.maps.LatLngBounds();
    const arr = self.datePlaces();
    arr.forEach(dp => {
      bounds.extend(dp.marker.position);
      dp.initVenue();
    });
    self.map.fitBounds(bounds);
    console.log('debug 4');
  })
  .catch(err => reportError(err));

  /**
   * Displays the street view and date place information for a date place.
   */
  this.showInfo = function(datePlace) {
    self.shouldShowInfo(true);
    dp = self.selectedDatePlace();
    if (dp != null) {
      dp.isSelected(false);
    }
    self.selectedDatePlace(datePlace);
    datePlace.isSelected(true);
  };

  /**
   * Hides the window with the street view and information for a date place.
   */
  this.removeInfo = function() {
    self.shouldShowInfo(false);
    self.selectedDatePlace().isSelected(false);
    self.selectedDatePlace(null);
    $('#street-view').empty();
  };

  /**
   * Triggers the click event on the marker for a given DatePlace.
   * @param {DatePlace} datePlace - The date place selected by a user.
   */
  this.triggerClickOnMarker = function(datePlace) {
    google.maps.event.trigger(datePlace.marker, 'click');
  };

  /**
   * Apply a search function to changes on searchText.
   */
  this.searchText.subscribe(textValue => {
    const arr = self.datePlaces();
    arr.forEach(datePlace => datePlace.applySearch(textValue));
  });

  /**
   * Clears the searchText.
   */
  this.clearSearch = function() {
    if (self.searchText().length) {
      self.searchText('');
    }
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
    'B. Patisserie','Palace of Fine Arts',
    'Press Club', 'Saison',
    'Mason Pacific', 'Shakespeare Garden', 'Golden Gate Bridge',
    /*
     Telegraph Hill, Filbert Stairs',
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
    self.showInfo(datePlace);
    datePlace.initStreetView(self.streetViewService)
    .then(dp => dp.initVenue())
    .then(dp => dp.venue().rewindPhotos())
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


function makeMarkerIcon(markerColor) {
  return new google.maps.MarkerImage(
    `http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|${markerColor}|40|_|%E2%80%A2`,
    new google.maps.Size(21, 34),
    new google.maps.Point(0, 0),
    new google.maps.Point(10, 34),
    new google.maps.Size(21, 34)
  );
}

/**
 * Uses the Foursquare API to search for a venue.
 *
 * @param {String} locationName - the name of the location, which should omit
 * the name of the city, because it uses San Francisco by default.
 * @return {Promise} Upon success, it returns a promise that resolves with a
 * JSON object containing the first search result. On failure, it rejects with
 * an Error.
 */
function searchVenue(locationName) {
  console.log('searchVenue with locationName=' + locationName);
  return axios.get('https://api.foursquare.com/v2/venues/search', {
    params: {
      v: 20161016,
      near: 'San Francisco, CA',
      query: locationName,
      limit: 1,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }
  })
  .then(response => {
    const data = response.data;
    //console.log(JSON.stringify(response.data));
    if (!data.response.venues || !data.response.venues.length) {
      return Promise.reject(new Error('Search did not yield any venues'));
    }
    return data.response.venues[0];
  });
}

/**
 * Uses the Foursquare API to get the information for a given venue.
 *
 * @param {Object}  idObj - An object literal containing an id field with the
 * Foursquare ID for a given venue.
 * @return {Promise} A promise that resolves with a JSON object with the venue
 * information from Foursquare.
 */
function getVenueInfo(idObj) {
  return axios.get(`https://api.foursquare.com/v2/venues/${idObj.id}`, {
    params: {
      v: 20161016,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }
  })
  .then(response => response.data.response.venue);
}
