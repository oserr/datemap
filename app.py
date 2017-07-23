#!/usr/bin/env python
# app.py
from flask import Flask
from flask import render_template
from flask import send_from_directory

# Create the Flask application
app = flask.Flask(__name__, templates='.')

API_KEY = open('google-maps-api-key.txt').read()

@app.route('/')
def index():
    '''Allows a user to get all the items.'''
    return flask.render_template('index.html', key=API_KEY)

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=5000)
