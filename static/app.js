const UNKNOWN_OR_NA = 'Unknown or n/a';


/**
 * onerror callback for Google Maps API script.
 */
function onError() {
  alert('Unable to initialize App');
}


/**
 * Initializes a DatePlace with a Google Maps API Marker.
 *
 * @param {Marker} marker - A Google Maps API marker that contains the
 * latitude and longitude coordinates of a given place.
 * @param {Number} id - The ID for this DateLocation.
 */
function DatePlace(marker, id) {
  this.marker = marker;
  this.venue = ko.observable(null);
  this.isVisible = ko.observable(true);
  this.map = marker.getMap();
  this.isSelected = ko.observable(false);
  this.id = id;

  let self = this;

  /**
   * Initializes the street view, a raw Element node that contains the
   * HTML for the panorama street view.
   *
   * @param {StreetViewService} streetViewService - A Google Maps API street
   * view service to convert obtain the panoramic street view of a given
   * location.
   * @return {Promise} A promise that is resovled with this DatePlace on
   * success, or rejected with an Error on failure.
   */
  this.initStreetView = function(streetViewService) {

    return new Promise((resolve, reject) => {

      streetViewService.getPanoramaByLocation(
        self.marker.position,
        50, // radius
        function(data, status) {
          if (status === google.maps.StreetViewStatus.OK) {

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

            // Attach the panorama in the container and center it in viewport
            new google.maps.StreetViewPanorama($('#street-view')[0], opts);
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

      if (self.venue() !== null) {
        return resolve(self);
      }

      return searchVenue(self.marker.getTitle())
        .then(getVenueInfo)
        .then(venue => {
          self.venue(new Venue(venue));
          return self;
        })
        .catch(err => reportError(err));
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
   * Applies a search by either setting itself to visible if it matches the
   * search, or hiding itself if it doesn't.
   */
  this.applySearch = function(text) {
    text = text.trim().toLowerCase();
    if (text === '' || self.marker.getTitle().toLowerCase().includes(text)) {
      self.marker.setVisible(true);
      self.isVisible(true);
    } else {
      self.marker.setVisible(false);
      self.isVisible(false);
    }
  };
}


/**
 * Creates a Venue object cotaining multiple pieces of information about a
 * venue.
 *
 * @param {Object} venue - A JSON object response from the Foursquare API
 * containing information about a venue.
 */
function Venue(venue) {
  this.name = venue.name;
  this.formattedPhone = venue.contact.formattedPhone || UNKNOWN_OR_NA;
  this.formattedAddress = venue.location.formattedAddress || UNKNOWN_OR_NA;
  this.rating = venue.rating || UNKNOWN_OR_NA;
  this.photoLinks = [];
  this.selectedPhoto = ko.observable(null);
  this.selectedPhotoIndex = ko.observable(null);
  this.fsUrl = venue.canonicalUrl;
  this.url = venue.url ? `<a class="venue-link" href="${venue.url}">${venue.url}</a>`
                       : UNKNOWN_OR_NA;

  // The current Foursquare API requires that a size be wedged between the
  // prefix and suffix of the URL, e.g., XXxYY, original, capXX, etc.
  const photosArr = venue.photos.groups[0].items;
  photosArr.forEach(item => {
    if (item.visibility === 'public') {
      this.photoLinks.push(`${item.prefix}original${item.suffix}`);
    }
  });

  // If we find photos, then select the first one to display once the page
  // loads.
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


/**
 * Initializes a KnockoutJS view model for the web page.
 *
 * Several things happen at initialization:
 * - Multiple date locations are geocoded via Google's APIs.
 * - The first date location is selected to display on the page when it loads.
 * - Fetch the venue information for each date location via Fousquare API.
 *
 * @param {String} cityCenter - The center of a city where Google Map should be
 * centered.
 * @param {Array} locationNames - An array of strings representing date
 * locations.
 */
function ViewModel(cityCenter, locationNames) {
  this.map = null;
  this.datePlaces = ko.observableArray([]);
  this.geocoder = new google.maps.Geocoder();
  this.defaultIcon = makeMarkerIcon('0091ff');
  this.highlightedIcon = makeMarkerIcon('FFFF24');
  this.selectedIcon = makeMarkerIcon('A70830');
  this.shouldShowInfo = ko.observable(false);
  this.streetViewService = new google.maps.StreetViewService();
  this.selectedDatePlace = ko.observable(null);
  this.searchText = ko.observable('');
  this.bounds = null;

  let self = this;

  geocodePlaceName(cityCenter, self.geocoder)
  .then(locationInfo => {
    self.map = new google.maps.Map(document.getElementById('map'), {
      center: locationInfo.location,
      zoom: 13,
    });
    self.bounds = new google.maps.LatLngBounds();
    google.maps.event.addDomListener(window, "resize", () => {
        var center = self.map.getCenter();
        google.maps.event.trigger(self.map, "resize");
        self.map.setCenter(center);
        self.map.fitBounds(self.bounds);
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
    const dp = createDatePlace.bind(self)(latLongs[0], 0, self.map);
    self.datePlaces.push(dp);
    google.maps.event.trigger(dp.marker, 'click');
    return latLongs;
  })
  // Now proceed to initialize the other DatePlaces
  .then(latLongs => {
    const otherLatLng = latLongs.slice(1);
    otherLatLng.forEach(latLng => {
      const id = self.datePlaces().length;
      const dp = createDatePlace.bind(self)(latLng, id, self.map);
      self.datePlaces.push(dp);
    });
  })
  // Now compute the bounds of the map and initialize the venue info for each
  // item so page can respond more quickly when user selects a different date
  // location.
  .then(() => {
    const arr = self.datePlaces();
    arr.forEach(dp => {
      self.bounds.extend(dp.marker.position);
      dp.initVenue();
    });
    self.map.fitBounds(self.bounds);
  })
  .catch(err => reportError(err));

  /**
   * Displays the street view and date place information for a date place.
   */
  this.showInfo = function(datePlace) {
    self.shouldShowInfo(true);
    dp = self.selectedDatePlace();
    if (dp !== null) {
      if (dp.id === datePlace.id) {
        // If user clicks on a place that is already selected then don't do
        // anything.
        return;
      }
      dp.isSelected(false);
      dp.marker.setIcon(self.defaultIcon);
    }
    self.selectedDatePlace(datePlace);
    datePlace.isSelected(true);
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

  /**
   * Selects the next date location relative to what is currently selected in
   * the list.
   */
  this.nextDate = function() {
    const dp = self.selectedDatePlace();
    if (dp !== null) {
      const dpArr = self.datePlaces();
      const nextDp = dpArr[(dp.id + 1) % dpArr.length];
      self.triggerClickOnMarker(nextDp);
    }
  };

  /**
   * Selects the previous date location relative to what is currently selected
   * in the list.
   */
  this.prevDate = function() {
    const dp = self.selectedDatePlace();
    if (dp !== null) {
      const dpArr = self.datePlaces();
      const prevDp = dpArr[(dp.id - 1 + dpArr.length) % dpArr.length];
      self.triggerClickOnMarker(prevDp);
    }
  };
}


/**
 * Logs an error to the console and the view port.
 * @param {Error} err - An error object.
 */
function reportError(err) {
  errMsg = `Error: ${err.message}`;
  alert(errMsg);
}


/**
 * Initializes the view model with center of Twin Peaks in San Francisco, and
 * an array of date locations.
 */
function initViewModel() {
  const locationNames = [
    'Choux Bakery', 'Top of the Mark', 'Nob Hill Spa',
    'B. Patisserie','Palace of Fine Arts',
    'Press Club', 'Saison',
    'Mason Pacific', 'Shakespeare Garden', 'Golden Gate Bridge',
  ];
  ko.applyBindings(new ViewModel('Twin Peaks', locationNames));
}


/**
 * Geocodes a place in San Francisco, CA.
 *
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
        reject(new Error(err));
      }
    });
  });
}


/**
 * Creates a new DatePlace object with a Google Maps Marker and attaches
 * some listeners on the marker.
 *
 * @param {object} locationInfo - The location information for the marker.
 * Contains fields name and location, representing the name of the location,
 * and the latitude and longitude coordinates.
 * @param {Number} id - The ID for the DateLocation.
 * @param {Map} map - The map for the marker.
 * @return {DatePlace} The DatePlace containing the marker.
 */
function createDatePlace(locationInfo, id, map) {

  const self = this;

  const marker = new google.maps.Marker({
    map: map,
    position: locationInfo.location,
    title: locationInfo.name,
    icon: self.defaultIcon,
    animation: google.maps.Animation.DROP,
  });

  let datePlace = new DatePlace(marker, id);

  marker.addListener('click', function() {
    self.showInfo(datePlace);
    datePlace.initStreetView(self.streetViewService)
    .then(dp => dp.initVenue())
    .then(dp => {
      dp.venue().rewindPhotos();
      dp.marker.setIcon(self.selectedIcon);
    })
    .catch(err => reportError(err));
  });

  marker.addListener('mouseover', function() {
    if (!datePlace.isSelected()) {
      this.setIcon(self.highlightedIcon);
    }
  });

  marker.addListener('mouseout', function() {
    if (!datePlace.isSelected()) {
      this.setIcon(self.defaultIcon);
    }
  });

  return datePlace;
}


/**
 * Creates a Google Maps marker icon with a given color.
 *
 * @param {String} markerColor - A hex code representing a color.
 */
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
