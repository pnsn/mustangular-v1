//Form 
var app = angular.module('myApp', []);
app.controller('formCtrl', function($scope, $window, $httpParamSerializer, $location){
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
.service('metricsList', function($filter){
  var _metrics = [];
  var _stations = [];
  var _combined = [];
  // this.metrics = _metrics;


  //
  // var filterStations = function(){
  //   console.log("wheee");
  //   for(var i = 0; i < _metrics.length; i++){
  //     console.log($filter('filter')(_stations, {station: _metrics[i].sta}, true)[0]);
  //   }
  // }
  
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
    setStations: function(i, value){
      _stations[i] = value;
    },
    getStations: function(){
      return _stations;
    },
    combineLists: function(){
      // console.log("combine")
      

        for(var i = 0; i < _metrics.length; i++){
          // console.log(i)
          var sta = $filter('filter')(_stations, {station: _metrics[i].sta}, true)[0];
          var metric = _metrics[i];
          metric.lat = sta.latitude;
          metric.lng = sta.longitude;
          metric.elev = sta.elevation;
          if(_combined[metric.sta]){
            var message = _combined[metric.sta].message;
            if(message.indexOf(metric.chan)> -1){
              // message = message.split(" ");
              // var place = message.indexOf(metric.chan )> -1
              // message.indexOf(metric.chan)> -1
              // console.log(place)
              var chan = metric.chan;
              var re = new RegExp(chan + ":\\s{1}\\d{1,4}", 'g');
              var s = message.match(re);
              var max = 0;
              for(var k = 0; k < s.length; k++){
                var f = parseFloat(s[k].split(" ")[1]);
                max = Math.max(max, f);
              }
              // Replace old value with higher value for the channel
              // _combined[metric.sta].message 
              console.log(max)
              
            } else {
              _combined[metric.sta].message = message + "\n " + metric.chan + ": " + metric.value
            }
            
          } else{
            _combined[metric.sta] = { //+"_"+_metrics[i].chan
              lat: parseFloat(metric.lat),
              lng: parseFloat(metric.lng),
              message: metric.chan + ": " + metric.value
            }
          }
        }
      
    },
    getCombined: function(){
      return _combined;
    }
  }
});
// add service to allow sharing of stations between controllers

app2.controller("SimpleMapController", [ '$scope', '$window', '$http', 'metricsList', function($scope, $window, $http, metricsList) {
  angular.extend($scope, {
      markers: {
        
      },
      defaults: {
          scrollWheelZoom: false
      }
  });
  // $scope.layers = {
  //   baselayers: {},
  //   overlays: {}
  // }
  var params = $window.location.search;
  var url = 'http://service.iris.edu/mustang/measurements/1/query';
  var configs = '&timewindow=2016-05-30,2016-05-31' + '&metric=data_latency&output=jsonp&callback=angular.callbacks._0';
  
  $http.jsonp(url + params + configs).success(function(data, status, headers, config){
    // data.measurments
    // console.log(data.measurements.data_latency)
    metricsList.setMetrics(data.measurements.data_latency);
    // metricsList.setMetrics(data.measurements);
    // console.log(metricsList.getMetrics()[0]);
    metricsList.combineLists();
    // console.log(metricsList.getProperty())
    var markers1 = metricsList.getCombined();
    console.log(markers1);
    $scope.markers = markers1;

  }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty
    // console.log(data + " : " + status)
  });
  
  $scope.stations=[];
  var data;
  //net, sta, loc, chan, start, end, 
  $http.get('http://service.iris.edu/fdsnws/station/1/query?network=UW&format=text').then(function success(response){
    // console.log(response.data);
    data = response.data.split('\n'); //Oth is the header
    
    var headers = data[0].split("#");
    headers = headers[1].split(" | ");
    
    for (var i = 1; i < data.length; i++){
      var station = data[i].split("|");
      var staObj = {};   
      for (var j = 0; j < station.length; j++){
        staObj[headers[j].trim().toLowerCase()]=station[j];
      }
      $scope.stations.push(staObj);
      metricsList.setStations(i-1, staObj);
    }    
    metricsList.combineLists();
    // console.log(metricsList.getStations());
    
  }, function error(response){
    // console.log(response);
  });


  
  
}]);

//Disable default debugging output on leaflet
app2.config(function($logProvider){
  $logProvider.debugEnabled(false);
});
