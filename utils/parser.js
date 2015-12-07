var nodeUtil = require("util")
  , fs = require('fs')
  , PDFParser = require("pdf2json/pdfparser")
  , qs = require('querystring')
  , _ = require('underscore')
  , async = require('async')
  , config = require('../config/config')
  , dates = require('../data/dates.json')

var geocoderProvider = 'google';
var httpAdapter = 'https';
var extra = {
  apiKey: config.googleGeocodeKey,
  bounds: '38.248965760244644,-75.80772399902342|38.53366456019077,-75.41770935058592'
}
var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter, extra);


function Parser() {
  this.pdfId = ''
  this.date = ''
}

Parser.prototype = {
  parse: function(date) {
    var self = this
    this.date = date
    this.pdfId = 'cfs' + date
    var pdfFilePath = __dirname + "/../data/" + this.pdfId + ".pdf";
    var pdfParser = new PDFParser()
    pdfParser.on("pdfParser_dataReady", function(data) {
      var pages = data.data.Pages
      var result = []
      pages.forEach(function(page) {
        var r = self.readPage(page)
        result = result.concat(r)
      })
      fs.writeFileSync(__dirname + "/../data/" + self.pdfId + '.json', JSON.stringify(result))
      //self.geocode(_.first(result, 3))
      self.geocode(result)
    })

    pdfParser.on("pdfParser_dataError", function(err) {
      console.log('err', err)
    })

    pdfParser.loadPDF(pdfFilePath)
  },
  readPage: function(page) {
    var startIndex = 0
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
      } else if (text.x < 25) {
        row.location = value
      } else if (text.x < 50) {
        if (value !== 'www.salisburypd.com'
          && value !== 'SALISBURY POLICE DEPARTMENT'
          && value !== '699 W Salisbury Pkwy'
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
  },
  geocode: function(rows) {
    async.map(rows, this.geocodeRow.bind(this), this.save.bind(this))
  },
  toGeoJson: function(rows) {
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
  },
  geocodeRow: function(row, next) {
    if (row.location) {
      var address = row.location + ', Salisbury, MD'
      geocoder.geocode(address, function(address, err, res) {
        if (!err && res.length) {
          row.coordinates = [res[0].longitude,res[0].latitude]
        } else {
          console.log(address);
          console.log('coords not found');
        }
        next(false, row)
      }.bind(this, address))
    } else {
      next(false, row)
    }
  },
  save: function(err, result) {
    var gj = this.toGeoJson(result)
    console.log('geocoded', gj.features.length, 'out of', result.length);
    fs.unlinkSync(__dirname + "/../data/" + this.pdfId + '.pdf')
    fs.writeFileSync(__dirname + "/../data/" + this.pdfId + '.geojson', JSON.stringify(gj))
    dates.push({
      date: this.date,
      count: gj.features.length
    })
    fs.writeFileSync(__dirname + '/../data/dates.json', JSON.stringify(dates))
  }

}

module.exports = new Parser()
