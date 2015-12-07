var express = require('express')
  , fs = require('fs')
  , dates = require('../data/dates.json')
  , _ = require('underscore')

var router = express.Router()

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    dates: dates
  })
})

router.get('/dates', function(req, res, next) {
  res.json(dates)
})

router.get('/calls/:date', function(req, res, next) {
  if (_.pluck(dates, 'date').indexOf(req.params.date) >= 0) {
    fs.readFile('./data/cfs' + req.params.date + '.geojson', function(err, data) {
      res.json(JSON.parse(data))
    })
  } else {
    res.json([])
  }
})

module.exports = router
