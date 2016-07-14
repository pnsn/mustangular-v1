//Form 
var app = angular.module('myApp', []);
app.controller('formCtrl', function($scope, $window, $httpParamSerializer, $location, $http){
  
  $scope.metrics = [];
  $http.jsonp("http://service.iris.edu/mustang/metrics/1/query?output=jsonp&callback=angular.callbacks._0", {cache:true}).success(function(data, status, headers, config){ 
    
    for(var i = 0; i<data.metrics.length; i++){
      $scope.metrics[i] = {
        "metric" : data.metrics[i].name,
        "title" : data.metrics[i].title
      } 
    } 
    
  }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error
    // console.log(data + " : " + status)
  });

  $scope.master = {};
  
  $scope.submit = function(params) {
    $scope.master = angular.copy(params);
    // console.log(params);
    var par = $httpParamSerializer(params);
    $window.location.href = "/Mustangular/mustangular_map.html?" + par;
  }
});


//Map
var app2 = angular.module('myApp2', ['leaflet-directive'], function($locationProvider){
  $locationProvider.html5Mode({
    enabled:true,
    requireBase: false
  });
  
})
.service('iconColoring', function($filter){
  var _max = -1000; //values get wiped out
  var _min = 1000;
  var _binCount = 3;
  var _binWidth = (_max - _min) / _binCount;
  
  var findBounds = function (){
    
  }
  
  this.getValue = function(chans){
    // console.log(station.chans)
    var max = 0;
    var count = Object.keys(chans).length;
    for(var i = 0; i < count; i++){ //find the median within the station and most extreme of the channels
      var array = $filter('orderBy')(chans[Object.keys(chans)[i]]);
      var mid = count/2+.5;
      if(mid % 1 == 0){
        max = Math.max(max, array[mid]);
      } else {
        max = Math.max(max, (array[mid-.5]+array[mid-.5])/2);
      }
      
    }
    console.log(max)
    return max;
  }
  
  this.getIcon = function(value){
    var icon;
    this.setMax(value);
    this.setMin(value);
    if(value > 100){
      icon = "images/red.png"
    } else if (value > 50){
      icon = "images/yellow.png"
    } else if (value){
      icon = "images/green.png"
    } else {
      icon = "images/dot.png"
    }
    
    return icon;
    
  }
  
  this.getMessage = function(station, value){
    // console.log(station.chans)
    
    return "<ul>" + "<li>" + value+ "</li>"+ "<li>" + station.net + "</li>"+"</ul>"   
  }
  
  this.setMax = function(max){
    _max = max;
  }
  this.setMin = function(min){
    _min = min;
  }
  this.getMax = function(){
    return _max;
  }
  this.getMin = function(){
    return _min;
  }
})

.factory('metricsList', function($filter){
  var _metrics = [];
  var _stations = [];
  var _combined = [];
  
  return{
    getMetrics: function(){
      return _metrics;
    },
    setProperty: function(i, value){
      _metrics[i] = value;
    },
    setMetrics: function(value){
      _metrics = value;
    },
    setStations: function(value, key){
      _stations[key] = value;
    },
    getStations: function(){
      return _stations;
    },
    combineLists: function(){
      // console.log("combine")
        for(var i = 0; i < _metrics.length; i++){
          var sta = _stations[_metrics[i].sta+"_"+_metrics[i].net]
          if(sta && sta.latitude && sta.longitude){ //only plot if it has a latitude and a longitude
            var metric = _metrics[i];
            metric.lat = sta.latitude; //print out table of failed stations --> no data
            metric.lng = sta.longitude;
            metric.elev = sta.elevation;
            
            if(_combined[metric.sta]){
              // _combined[metric.sta].value = Math.max(_combined[metric.sta].value, metric.value)
              if(_combined[metric.sta].chans[metric.chan]){
                _combined[metric.sta].chans[metric.chan].push(metric.value); //need the median value
              } else {
                _combined[metric.sta].chans[metric.chan] = [metric.value];
              }
            } else{
              _combined[metric.sta] = { //+"_"+_metrics[i].chan
                sta: metric.sta,
                lat: parseFloat(metric.lat),
                lng: parseFloat(metric.lng),
                net: metric.net,
                chans:{}
                // focus: true
              }
              // console.log(metric.chan)
              _combined[metric.sta].chans[metric.chan] = [metric.value];
              // console.log(_combined[metric.sta])
            }
          } else {
            //put it in a table
          }
      }
      
    },
    getCombined: function(){
      return _combined;
    }
  }
})
// add service to allow sharing of stations between controllers

  

app2.controller("SimpleMapController", function($scope, $window, $http, metricsList, iconColoring) {
  angular.extend($scope, {
      markers: {
        
      },
      defaults: {
          scrollWheelZoom: false
      }
  });
  var params = $window.location.search;
  var url = 'http://service.iris.edu/mustang/measurements/1/query';
  var configs = '&timewindow=2016-05-30,2016-05-31' + '&output=jsonp&callback=angular.callbacks._0';
  
  $http.jsonp(url + params + configs, {cache:true}).success(function(data, status, headers, config){ //TODO: don't do this caching in prod
    console.log(url + params + configs)
    metricsList.setMetrics(data.measurements.data_latency);

    $scope.stations=[];
    var data;
    //net, sta, loc, chan, start, end, 
    params = params.replace(/metric=\w*/ig,'')
    params = params.replace(/chan/ig,'cha')
    $http.get('http://service.iris.edu/fdsnws/station/1/query'+params+'&format=text').then(function success(response){
      // console.log(response.data);
      data = response.data.split('\n'); //Oth is the header
      if(data[0].length > 0){
        var headers = data[0].split("#");
        headers = headers[1].split(" | ");
        // console.log(headers);
        console.log("in get")
        for (var i = 1; i < data.length; i++){
         // console.log(data.length-i)
          var station = data[i].split("|");
          var staObj = {};   
          for (var j = 0; j < station.length; j++){
            staObj[headers[j].trim().toLowerCase()]=station[j];
          }
          $scope.stations.push(staObj);
          metricsList.setStations(staObj, station[1]+"_"+station[0]);
        }    
        console.log("combine")
        metricsList.combineLists();
        var markers1 = metricsList.getCombined();
        var markers2 = [];
      
        for(var i = 0; i < Object.keys(markers1).length; i++) {
          var m = markers1[Object.keys(markers1)[i]];
          var value = iconColoring.getValue(m.chans);
          markers2[i]={
            lat: m.lat,
            lng: m.lng,
            message: iconColoring.getMessage(m, value),
            icon: {
              iconUrl: iconColoring.getIcon(value),
              iconSize: [10, 10]
            }
          }

        }

        $scope.markers = markers2;
        $scope.maxValue = iconColoring.getMax;
        $scope.minValue = iconColoring.getMin;
      }
    }, function error(response){
      // console.log(response);
    });
  }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error
    // console.log(data + " : " + status)
  });



  
  
});

//Disable default debugging output on leaflet
app2.config(function($logProvider){
  $logProvider.debugEnabled(false);
});
