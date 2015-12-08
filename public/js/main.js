$(document).ready(function() {
  new CallsMap()
})

var CallsMap = function() {
  this.init()
}

CallsMap.prototype.init = function() {
  var self = this

  this.map = new L.Map('map').setView(new L.LatLng(38.35, -75.6), 12)
  this.map.attributionControl.addAttribution('Call Data: <a href="http://www.salisburypd.com/daily-calls-for-service.aspx">SPD</a>')

  this.selectedColor = 'rgba(255, 120, 0, 0.7)'

  L.tileLayer('http://{s}.tiles.mapbox.com/v3/fsrw.obbc2ii1/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(this.map)

  var geojsonMarkerOptions = {
      radius: 6,
      fillColor: "#ff7800",
      color: "#000",
      weight: 0.3,
      opacity: 1,
      fillOpacity: 0.5
  }

  this.callsLayer = L.geoJson(null, {
    onEachFeature: function(feature, layer) {
      if (feature.properties) {
        layer.bindPopup(self.makePopup(feature.properties))
      }
    },
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, geojsonMarkerOptions);
    }
  }).addTo(this.map)

  $.getJSON('dates', function(data) {
    self.dates = data
    var f = self.dates[self.dates.length-1].date
    self.activeDates = [f]
    self.getCalls(f)
    self.makeCalendar()
  })

  this.activeCallTypes = []
  $('#call-types .list').on('click', '.activity', function() {
    var a = $(this).find('.value').text()
    if (self.activeCallTypes.indexOf(a) >= 0) {
      self.activeCallTypes = _.without(self.activeCallTypes, a)
      $(this).parent().css('color', '')
      $(this).parent().find('i').removeClass('fa-circle').addClass('fa-circle-thin')
    } else {
      self.activeCallTypes.push(a)
      $(this).parent().css('color', 'red')
      $(this).parent().find('i').removeClass('fa-circle-thin').addClass('fa-circle')
    }
    self.filterCallTypes()
  })

  $('#calendar').on('click', '.fc-prev-button', this.showActiveDays.bind(this))
  $('#calendar').on('click', '.fc-next-button', this.showActiveDays.bind(this))
  $('#calendar').on('click', '.fc-today-button', this.showActiveDays.bind(this))

}

CallsMap.prototype.showActiveDays = function() {
  var self = this
  console.log('ads');
  this.activeDates.forEach(function(date) {
    var selector = moment(date, 'MMDDYY').format('YYYY-MM-DD')
    $('td.fc-day[data-date="' + selector + '"]').css('background-color', self.selectedColor)
  })
}

CallsMap.prototype.filterCallTypes = function() {
  var self = this
  self.callsLayer.clearLayers()
  if (self.activeCallTypes.length) {
    this.currentData.features.forEach(function(feature) {
      var a = feature.properties.activity
      if (self.activeCallTypes.indexOf(a) >= 0) {
        self.callsLayer.addData(feature)
      }
    })
  } else {
    self.callsLayer.addData(self.currentData)
  }
}

CallsMap.prototype.makeEvents = function() {
  var events = []
  this.dates.forEach(function(date) {
    events.push({
      title: date.count,
      start: moment(date.date, 'MMDDYY'),
      allDay: true
    })
  })
  return events
}

CallsMap.prototype.makeCalendar = function() {
  var self = this
  var firstDate = moment(self.dates[self.dates.length-1].date, 'MMDDYY')
  $('#calendar').fullCalendar({
    defaultDate: firstDate,
    events: self.makeEvents(),
    dayClick: function(date, event, view) {
      var dateFormatted = date.format('MMDDYY')
      if (self.activeDates.indexOf(dateFormatted) >= 0) {
        $(this).css('background-color', '')
        self.activeDates = _.without(self.activeDates, dateFormatted)
        self.removeCalls(dateFormatted)
      } else {
        $(this).css('background-color', self.selectedColor)
        self.activeDates.push(dateFormatted)
        self.getCalls(dateFormatted)
      }
    }
  })

  $('.fc-today-button').hide()
  var selector = firstDate.format('YYYY-MM-DD')
  $('td.fc-day[data-date="' + selector + '"]').css('background-color', self.selectedColor)
  var button = $('<button type="button" class="fc-button fc-state-default fc-corner-left fc-corner-right">Hide Calendar</button>')
  button.on('click', function(e) {
    $('#calendar').hide()
    $('#showCalendar').show()
  })
  $('.fc-right').prepend(button)
  $('#showCalendar').click(function() {
    $(this).hide()
    $('#calendar').show()
  })

}

CallsMap.prototype.getCalls = function(date) {
  var self = this
  $.getJSON('calls/' + date, function(data) {
    self.addCalls(data)
    self.addCallTypes()
  })
}

CallsMap.prototype.addCalls = function(data) {
  this.callsLayer.addData(data)
  this.currentData = this.callsLayer.toGeoJSON()
}

CallsMap.prototype.removeCalls = function(date) {
  var self = this
  this.callsLayer.eachLayer(function(layer) {
    var d = moment(layer.feature.properties.date).format('MMDDYY')
    if (d === date) {
      self.callsLayer.removeLayer(layer)
    }
  })
  this.addCallTypes()
}

CallsMap.prototype.addCallTypes = function() {
  var data = this.callsLayer.toGeoJSON()
  var activities = {}
  this.callsLayer.eachLayer(function(layer) {
    var a = layer.feature.properties.activity || ''
    if (activities[a]) {
      activities[a] = activities[a] + 1
    } else {
      activities[a] = 1
    }
  })
  var _a = []
  for (var key in activities) {
    _a.push({
      activity: key,
      count: activities[key]
    })
  }
  _a = _.sortBy(_a, 'count').reverse()
  this.displayCallTypes(_a)
}

CallsMap.prototype.displayCallTypes = function(activities) {
  var html = '<table>'
  html += '<tr class="count"><td>Mapped Calls</td><td class="number">' + this.callsLayer.getLayers().length + '</td></tr>'
  activities.forEach(function(a) {
    html += '<tr><td class="activity"><i class="fa fa-circle-thin"></i> '
    html +='<span class="value">' +a.activity + '</span></td>'
    html += '<td class="number">' + a.count + '</td></tr>'
  })
  html += '</table>'
  $('#call-types .list').html(html)
}

CallsMap.prototype.makePopup = function(properties) {
  properties = _.omit(properties, 'incident_number')
  var html = '<table class="table table-bordered table-condensed popup">'
  for (var key in properties) {
    html += '<tr>'
    html += '<td>' + key + '</td><td>' + properties[key] + '</td>'
    html += '</tr>'
  }
  html += '</table>'
  return html
}
