var downloader = require('./downloader')
var parser = require('./parser')
var moment = require('moment')

var date = '120615'

downloader.download(date, function(err) {
  if (!err) {
    parser.parse(date)
  }
})
