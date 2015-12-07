var request = require('request')
  , dates = require('../data/dates.json')
  , http = require('http')
  , fs = require('fs')

var base_url = 'http://www.salisburypd.com/userfiles/files/cfs'

function download(date, next) {
  var url = base_url + date + '.pdf'
  var file = fs.createWriteStream(__dirname + '/../data/cfs' + date + '.pdf');
  var request = http.get(url, function(response) {
    if (response.statusCode == 200) {
      var s = response.pipe(file)
      s.on('finish', next)
    } else {
      next(response.statusCode)
    }
  })
}

module.exports = {
  download: download
}
