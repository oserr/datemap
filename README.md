# San Francisco Date Map

A Udacity project to create a single page web app that uses [KnockoutJS][1], and the [Google Maps][2] and [Foursquare][3] APIs. The map displays a partial list of romantic locations recommended here [article][4].

# Developer API keys

## Getting a key
To access the Google Maps and Foursquare developer APIs you need to obtain client keys that need to be embedded in the HTML/Javascript. Obtaining keys from them is straight forward, but it is a little more complicated for Google simply because they have a ton of other developer APIs. To get started with Google, follow their [Get API Key][5] instructions. To get started with Foursquare, follow the instructions in the [developer site][3].

## Embedding the keys in the application
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

# The application

The application does the following:

1. Geocodes the location of [Twin Peaks][9] in San Francisco
2. Creates a Google map centered on Twin Peaks
3. Geocodes about 10 venue locations in San Francisco
4. Creates a marker for each of the venue locations in the map
5. Searches for each of the venues in Foursquare using their [search end point][10]
6. Fetches the venue info using Foursquare's [venues endpoint][11]
7. Wires the HTML views with the Javascript models with KnockoutJS and renders a single page app allowing users to see information about the different venues, which contains the following:
    * map
    * venue info
    * pictures of the venue
    * a street view of the location
    * a search box allowing users to filter the date locations
    * a list of the date locations which users can use instead of the markers to display information about the venue in the venue info box, the venue photos box, and the street view

## Geocoding locations
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

## Creating a Google Map
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

## Creating a marker for each venue location
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

## Using Foursquare's API search endpoint
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

## Using Foursquare's API venues endpoint
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
