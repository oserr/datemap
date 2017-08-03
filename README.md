# San Francisco Date Map

A Udacity project to create a single page web app that uses [KnockoutJS][1], and the [Google Maps][2] and [Foursquare][3] APIs. The map displays a partial list of romantic locations recommended [here][4].

## Developer API keys

### Getting a key
To access the Google Maps and Foursquare developer APIs you need to obtain client keys that need to be embedded in the HTML/Javascript. Obtaining keys from them is straight forward, but it is a little more complicated for Google simply because they have a ton of other developer APIs. To get started with Google, follow their [Get API Key][5] instructions. To get started with Foursquare, follow the instructions in the [developer site][3].

### Embedding the keys in the application
The last few lines of _index.html_ contain a few template parameters indicating where the API keys need to go:

```html
<script type="application/javascript">
  var CLIENT_ID = '{{ client_id }}';
  var CLIENT_SECRET = '{{ client_secret }}';
</script>
<script src="static/app.js"></script>
<script async defer
  src="https://maps.googleapis.com/maps/api/js?libraries=places,geometry,drawing&key={{ key }}&v=3&callback=initViewModel">
</script>
```

*CLIENT_ID* refers to the Foursquare client ID, *CLIENT_SECRET* refers to the Foursquare client secret, and  *key* refers to the Google Maps API key. Therefore, to embed your keys in the application, simply replace the brackets containg the key words with your API keys, i.e.,

```
{{ client_id }}      =>  Foursquare client ID
{{ client_secret }}  =>  Foursquare client secret
{{ key }}            =>  Google Maps key
```

For production, the keys should be embedded in the application, however, it may be safer and more convenient to store the API keys separately and to use a template engine or automation tool to automatically configure the application files with the desired API keys. Besides the obvious benefit of reducing the exposure of the API keys and thus making it less likely that other people will use your keys in their own applications, automating the configuration makes it easier to switch between keys, for example, if you want to use different keys for production, development, and/or testing environments. This is the approach I've taken, configuring the keys via [Flask][6] because it uses [Jinja][7] as its default templating engine. If you want to follow this same approach, then you'll need to put your Foursquare API keys in _foursquare-api.txt_, in the root directory,  with the following format

```
client_id=YOUR_FOURSQUARE_CLIENT_ID_HERE
client_secret=YOUR_FOURSQUARE_CLIENT_SECRET_HERE
```

And put your Google Maps API key in _google-maps-api-key.txt_, like this

```
YOUR_GOOGLE_MAPS_KEY_HERE
```

This is not the only way of automating the keys. For example, you might also use something like [GulpJs][8] to put together the template, simply spitting out the end-result once instead of using Flask to put it together on every request. Or you can simply copy the keys into the file manually. What's important is that the keys need to be embedded in the application.

## Testing the application
Assuming that you are using my setup with Flask, and this root folder is your current working directory, do the following to get started

1. Install Anaconda if you don't have it. See these [instructions][conda].
2. Save your Foursquare API client key and secret in *foursquare-api.txt*.
3. Save your Google Maps API key in *google-maps-api-key.txt*.
4. Create the conda environment
    * in global environment: `conda env create -n datemap`. Or replace `datemap` with your desired environment name.
    * in project directory: `conda env create -p env`. Or replace `env` with your desired environment name.
4. Activate the environment
    * if environment was created globally: `source activate datemap`.
    * if environment was created locally: `source activate env`. If this is not the current working directory, then you nee to specify the path to `env`.
5. Launch flask: `python app.py`.
6. Browse the app by opening a browser and fetching `localhost:500`.

## The application

The application does the following:

* Geocodes the location of [Twin Peaks][9] in San Francisco
* Creates a Google map centered on Twin Peaks
* Geocodes about 10 venue locations in San Francisco
* Creates a marker for each of the venue locations in the map
* Searches for each of the venues in Foursquare using their [search end point][10]
* Fetches the venue info using Foursquare's [venues endpoint][11]
* Wires the HTML views with the Javascript models with KnockoutJS and renders a single page app allowing users to see information about the different venues, which contains the following:
    * map
    * venue info
    * pictures of the venue
    * a street view of the location
    * a search box allowing users to filter the date locations
    * a list of the date locations which users can use instead of the markers to display information about the venue in the venue info box, the venue photos box, and the street view

### Geocoding locations
For detailed information about Google's Geocoding API, refer to their [Getting Started][12] guide. My use case was pretty simple, as manifested by the simple function I created to geocode place names:

```javascript
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
```

If you have a `Geocoder`, then all you need to do is pass in an object literal with an `address` field (see [Geocoder reference][13] for other `GeocoderRequest` options), and a callback to process the results -- an array which may contain more than one coordinate, with the very first one being the best guess. When using the Geocoder, it is important to note that requests are rate-limited to about 10 per second.

### Creating a Google Map
For detailed information about constructing a map with different options, refer to the reference for the [Map][14] and [MapOptions][15]. In my case, I was perfectly fine with the default map, so it was easy to create one and then to add a listener to the map in order to re-center it on window resizes:

```javascript
self.map = new google.maps.Map(document.getElementById('map'), {
  center: locationInfo.location,
  zoom: 13,
});
google.maps.event.addDomListener(window, "resize", () => {
    var center = self.map.getCenter();
    google.maps.event.trigger(self.map, "resize");
    self.map.setCenter(center);
});
```

### Creating a marker for each venue location
For detailed information about markers, refer to the [Marker][16] reference, but the essential part is creating a marker with a position, icon, and a map. E.g.,

```javascript
const marker = new google.maps.Marker({
  map: map,
  position: locationInfo.location,
  title: locationInfo.name,
  icon: self.defaultIcon,
  animation: google.maps.Animation.DROP,
});
```

### Using Foursquare's API search endpoint
For detailed information about searching for venues in Foursquare, refer to their [search endpoint documentation][10], but the gist of it is making a GET request with 5 parameters: the API version number, a _near_ location, query, and the client ID and secret. Although not necessary, I decided to use [Axios][17] for the Foursquare API requests because I wanted to try Axios, but in production it would make more sense to simply use [fetch][18] or [JQuery][19], thus avoiding an extra dependency and download.

```javascript
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
```

Assuming that at least one venue is found, and that the JSON response is `Response`, then the results put in an array of venues in `Response.response.venues`, and each venue object has an `id` field that can be used to fetch all the venue information from Foursquare.

### Using Foursquare's API venues endpoint
For detailed information about fecthing data for a venue in Foursquare, refer to their [venues endpoint documentation][11], but the gist of it is making a GET request for a specific venue with the venue ID and supplying 3 parameters in the request: the API version number, and the client ID and secret, like this

```javascript
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
```

### Wires the app with KnockoutJS
The view model bound to KO is `ViewModel`, and the main benefit of using KO is that it makes it easir to allow the user to cycle through the date locations without having to resort to [callback hell][20]. For example, to display the contact info for a venue when a user selects a different venue, it is not necessary to attach a bunch of listeners on different DOM elements to update them manually, but rather we can bind the data we want to display, i.e., the model, with the HTML, i.e., the view, and add some logic for KO to observe the data so that the data is updated automatically when it changes.

#### The model
To allow KO to observe which date location is selected, I added a variable, `selectedDatePlace`, that is assigned the date location a user selects. By making it a `ko.observable`, KO is notifed anytime the state of `selectedDatePlace` changes.

```javascript
function ViewModel(cityCenter, locationNames) {
  this.map = null;
  this.datePlaces = ko.observableArray([]);
  this.geocoder = new google.maps.Geocoder();
  this.defaultIcon = makeMarkerIcon('0091ff');
  this.highlightedIcon = makeMarkerIcon('FFFF24');
  this.shouldShowInfo = ko.observable(false);
  this.streetViewService = new google.maps.StreetViewService();
  this.selectedDatePlace = ko.observable(null);
  this.searchText = ko.observable('');
```

#### The view
Without KnockoutJS, I would have had to add logic to fetch the HTML elements displaying venue information, however, with KnockoutJS it is simply a matter of binding via `data-bind` the data with the tag, and KO takes care of updating the DOM nodes when the data changes.

```html
<!-- the venue info -->
<div class="col-xs-12 col-sm-12 col-lg-4 placeholder" data-bind="with: selectedDatePlace()">
  <div data-bind="with: venue()" class="text-left">
    <table class="table table-responsive">
      <thead>
        <tr>
          <th><img id="fs-logo" src="/static/fs.png"></th>
          <th><h2><a class="venue-link" data-bind="text: name, attr: { href: fsUrl}"></a></h2></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Rating</th>
          <td data-bind="text: rating"></td>
        </tr>
        <tr>
          <th scope="row">URL</th>
          <td data-bind="html: url"></td>
        </tr>
        <tr>
          <th scope="row">Phone</th>
          <td data-bind="text: formattedPhone"></td>
        </tr>
        <tr>
          <th scope="row">Address</th>
          <td data-bind="foreach: formattedAddress">
            <p data-bind="text: $data"></p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

[1]: http://knockoutjs.com/
[2]: https://developers.google.com/maps/
[3]: https://developer.foursquare.com/
[4]: https://www.wheretraveler.com/san-francisco/20-most-romantic-things-do-san-francisco
[5]: https://developers.google.com/maps/documentation/javascript/get-api-key
[6]: http://flask.pocoo.org/
[7]: http://jinja.pocoo.org/
[8]: https://gulpjs.com/
[9]: https://en.wikipedia.org/wiki/Twin_Peaks_(San_Francisco)
[10]: https://developer.foursquare.com/docs/venues/search
[11]: https://developer.foursquare.com/docs/venues/venues
[12]: https://developers.google.com/maps/documentation/geocoding/start
[13]: https://developers.google.com/maps/documentation/javascript/3.exp/reference#Geocoder
[14]: https://developers.google.com/maps/documentation/javascript/3.exp/reference#Map
[15]: https://developers.google.com/maps/documentation/javascript/3.exp/reference#MapOptions
[16]: https://developers.google.com/maps/documentation/javascript/3.exp/reference#Marker
[17]: https://github.com/mzabriskie/axios
[18]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[19]: https://jquery.com/
[20]: http://callbackhell.com/
[conda]: https://www.continuum.io/downloads
