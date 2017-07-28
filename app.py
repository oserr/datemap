#!/usr/bin/env python
# app.py
import flask
import sys


def app_err(msg):
    '''Prints an error message to sys.stderr and terminates the program.'''
    print('Error: %s' % msg , file=sys.stderr)
    sys.exit(1)


# Fetch the foursquare API client ID and secret
fs_dict = {}
fs = open('foursquare-api.txt').readlines()
for line in fs:
    if not line:
        # Ignore blank lines
        continue
    key_value = line.split('=')
    if len(key_value) != 2:
        app_err('line does not contain key=value pair')
    key_value = [x.strip() for x in key_value]
    k, v = key_value
    if not k:
        app_err('Line does not contain key, but expecting key=value pairs')
    if not v:
        app_err('Line does not contain key value, but expecting key=value pairs')
    fs_dict[k] = v

client_id = fs_dict.get('client_id')
if not client_id:
    app_err('Unable to find client_id')

client_secret = fs_dict.get('client_secret')
if not client_secret:
    app_err('Unable to find client_secret')

# Fetch the Google Maps API key
api_key = open('google-maps-api-key.txt').read()
if not api_key:
    app_err('Unable to find Google Maps API key')

# Create the Flask application
app = flask.Flask(__name__, template_folder='.')

@app.route('/')
def index():
    '''Allows a user to get all the items.'''
    return flask.render_template(
        'index.html',
        key=api_key,
        client_id=client_id,
        client_secret=client_secret)

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=5000)
