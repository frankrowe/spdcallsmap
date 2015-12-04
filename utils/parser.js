var nodeUtil = require("util")
  , fs = require('fs')
  , PDFParser = require("pdf2json/pdfparser")
  , qs = require('querystring')
  , _ = require('underscore')
  , async = require('async')
  , config = require('./config/config')

var geocoderProvider = 'google';
var httpAdapter = 'https';
var extra = {
    apiKey: config.googleGeocodeKey
}

var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter, extra);

var pdfParser = new PDFParser()

function readPage(page) {
  var startIndex = 0
  var COLUMN_LENGTH = 5
  var texts = page.Texts
  texts.forEach(function(text, idx) {
    text.R.forEach(function(run) {
      var value = qs.unescape(run.T)
      if (value === 'Disposition') {
        startIndex = idx + 1
      }
    })
  })
  var result = []
  var y = 0
  var row = {}
  for (var i = startIndex; i < texts.length; i++) {
    var text = texts[i]

    //check for new row
    if (y !== text.y) {
      y = text.y
      if (_.keys(row).length > 0) {
        result.push(row)
      }
      row = {}
    }
    var value = qs.unescape(text.R[0].T)
    if (text.x < 5) {
      row.date = value
    } else if (text.x < 20) {
      row.location = value
    } else if (text.x < 50) {
      if (value !== 'www.salisburypd.com'
        && value != 'SALISBURY POLICE DEPARTMENT'
        && value != '699 W Salisbury Pkwy'
        && value !== 'Salisbury, MD 21801'
        && value !== '410.548.3165') {
          row.activity = value
        }
    } else if (text.x < 75) {
      row.incident_number = value
    } else if (text.x >= 75) {
      row.disposition = value
    }
  }
  return result
}

function geocode(rows) {
  console.log(rows.length, 'geocode');
  async.map(rows, geocodeRow, function(err, result) {
    fs.writeFileSync('./' + pdfId + '.json', JSON.stringify(result))
    fs.writeFileSync('./' + pdfId + '.geojson', JSON.stringify(toGeoJson(result)))
  })
}

function toGeoJson(rows) {
  var gj = {
    "type": "FeatureCollection",
    "features": []
  }
  rows.forEach(function(row) {
    if (row.coordinates) {
      var feature = {
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "Point",
          "coordinates": []
        }
      }
      feature.properties = _.omit(row, 'coordinates')
      feature.geometry.coordinates = row.coordinates
      gj.features.push(feature)
    }
  })
  return gj
}

function geocodeRow(row, next) {
  if (row.location) {
    var address = row.location + ', Salisbury MD 21801'
    geocoder.geocode(address, function(err, res) {
      if (!err && res.length) {
        row.coordinates = [res[0].longitude,res[0].latitude]
      }
      next(false, row)
    })
  } else {
    next(false, row)
  }
}

pdfParser.on("pdfParser_dataReady", function(data) {
  var pages = data.data.Pages
  var result = []
  pages.forEach(function(page) {
    result = result.concat(readPage(page))
  })
  geocode(result)
});

pdfParser.on("pdfParser_dataError", function(err) {
  console.log('err', err);
});
// 
// var pdfId = 'cfs120315'
//
// var pdfFilePath = "./" + pdfId + ".pdf";
//
// pdfParser.loadPDF(pdfFilePath)
