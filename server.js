var app = require('./app')
  , http = require('http')
  , config = require('./config/config')

app.init(function() {
  http.createServer(app).listen(config.server.port, function() {
    console.log('Listening on port', config.server.port)
  })
})
