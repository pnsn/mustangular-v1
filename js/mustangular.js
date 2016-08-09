//Form 
var app = angular.module('myApp', ['ngMaterial']);

app.config(['$locationProvider', function($locationProvider) {
        $locationProvider.html5Mode({
          enabled:true,
          requireBase: false
        });
    }]);


app.controller('formCtrl', function($scope, $window, $httpParamSerializer, $location, $http, $filter){
  $scope.maxDate = new Date();
  $scope.metrics = [];
  $http.jsonp("http://service.iris.edu/mustang/metrics/1/query?output=jsonp&callback=angular.callbacks._0", {cache:true}).success(function(data, status, headers, config){ 
          // console.log(data.metrics)
    for(var i = 0; i<data.metrics.length; i++){
      // console.log(data.metrics[i].name)
      // console.log(data.metrics[i].tables[0].columns[0])
      var keys = Object.keys(data.metrics[i].tables[0].columns[0])
      // console.log(data.metrics[i].tables[0].columns[0]["name"])
      if(data.metrics[i].tables[0].columns[0]["name"] == "value" && data.metrics[i].tables[0].columns[0]["sqlType"] != "TEXT" ){
        $scope.metrics.push( {
          "metric" : data.metrics[i].name,
          "title" : data.metrics[i].title
        });
      }

    } 
    // console.log($scope.metrics)
    
  }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error
    // console.log(data + " : " + status)
  });

  $scope.master = {};
  $scope.dateChange = function(){
    console.log($scope.myDate)
  };
  $scope.submit = function(params) {
    $scope.master = angular.copy(params);
    // console.log(params.timewindow)
    $scope.master.timewindow = params.timewindow.start && params.timewindow.stop ? $filter('date')(params.timewindow.start, 'yyyy-MM-ddTHH:mm:ss')+","+$filter('date')(params.timewindow.stop, 'yyyy-MM-ddTHH:mm:ss') : null
    var par = $httpParamSerializer($scope.master);
    // console.log("par" + par)
    $window.location.href = "/mustangular/mustangular_map.html?" + par;
  }
  
  function addMinutes(date, minutes) {
      return new Date(date.getTime() + minutes*60000);
  }
  
  $scope.fixTime = function(){
    var time = $scope.a.timewindow
    if(time.stop && time.stop.getHours() == "00" && time.stop.getMinutes()=="00"){
      time.stop = new Date(time.stop.setHours(23,59,59));
    }
  }
  
  var params = $location.search();
  if(params){
    var time = {
      start: params.timewindow? new Date(params.timewindow.split(",")[0]) : null,
      stop: params.timewindow? new Date(params.timewindow.split(",")[1]) : null,
    }
    // console.log(time.stop)
    //Spoof UTC in datetime input because js converts from UTC to local automatically
    time.start = time.start ? addMinutes(time.start, time.start.getTimezoneOffset()) : null;
    time.stop = time.stop ?  addMinutes(time.stop, time.stop.getTimezoneOffset()) : null;

    $scope.a = {
      net: params.net,
      chan: params.chan,
      sta: params.sta,
      loc: params.loc,
      qual: params.qual,
      timewindow: {
        start: time.start,
        stop: time.stop
      },
      metric: params.metric
    }
  }
});

//Map
var app2 = angular.module('myApp2', ['leaflet-directive', 'ngSanitize', 'ngMessages', 'ngMaterial'], function($locationProvider){
  $locationProvider.html5Mode({
    enabled:true,
    requireBase: false
  });
  
})
.factory('medianFinder', function($filter){
  var _channels = {};
  var _values = {
    max: -1000,
    min: 1000,
    values: [],
    count: 0
  };
    return {
      findValues: function(metric){       
        var keys = Object.keys(metric);
        // console.log(metric)
        // console.log(metric)
        for (var i = 0; i < keys.length; i++){
          var max = -1000;
          // console.log(metric[keys[i]].chans)
          var chans = metric[keys[i]].chans;
          var chanKeys = Object.keys(chans);
          // console.log(chanKeys)
          for(var j = 0; j < chanKeys.length; j++){
            var array = $filter('orderBy')(chans[chanKeys[j]]);
            var mid = array.length/2-.5;
            var median;
            if(mid % 1 == 0){ //whole number  
              median = array[mid];
            } else {
              median = (array[mid-.5]+array[mid-.5])/2;
            }
            if(!median){
              median = 0;
            }
            var first = chanKeys[j].charAt(0);
            if(first == "B" || first == "E" || first == "H"){ //for now: only allow B*, H*, and E* channels
              max = Math.max(max, median);
            }
            // console.log(max)
            // console.log(chans[chanKeys[j]])
            chans[chanKeys[j]].median = median;
            
          }
          metric[keys[i]].value = max;
          _values.values.push(max);
          _channels[metric[keys[i]].sta] = chans;
          _channels[metric[keys[i]].sta].max = max;
          metric[keys[i]].chans = chans;

        }
        _values.values = $filter('orderBy')(_values.values);
        _values = {
          max: _values.values[_values.values.length-1],
          min: _values.values[0],
          count: _values.values.length,
          values: _values.values
        }
        // console.log(_values)
        return metric;
        
      },
      getChannels: function(){
        return _channels;
      },
      getValues: function(){
        return _values;
      }
    }

  // }
})
.service('iconColoring', function($filter){
  var _edges = {max:-1000, min: 1000, count:0, values: []}
  var _binning = {max:10, count:3, min: 0, width: 2};
  var _bins;
  var _layers ={};
  // var _icons = [];
  
  this.updateMarkers = function(markers, stations){
    for(var i = 0; i < Object.keys(markers).length; i++) {     
      var m = markers[Object.keys(markers)[i]];
      var io = this.getIcon(stations[Object.keys(markers)[i]].max);
      m.icon.html = io.icon;
      m.layer = io.layer;
      markers[Object.keys(markers)[i]] = m;
    }
    return markers;
  }
  
  this.intitalBinning = function(percentile){
    var val;
    var max;
    var min;
    if(_edges.count>1){
      var val = Math.round((percentile/100.00 * _edges.count));
      // console.log(val)
      min = _edges.min > 0 ? _edges.min : 0;
      max = _edges.values[val]
    } else {
      min = _edges.values[0];
      max = _edges.values[0] + 1;
    }
    var count = _edges.max - _edges.min > _binning.count ? _binning.count : 1; //within 5 of eachother just make 1 bin
    this.setBinning({max:max, min: min, count: count});

    // console.log(_binning)
  }
  
  this.makeBins = function(){ 
    _bins = []; 
    var min =  _binning.min;
    var rainbow = new Rainbow();
    _bins.push({max:min, min: _edges.min, color:"000", count:0, position:-1, class:"icon-group-0"})
    if(_binning.count > 1){
      rainbow.setNumberRange(0, _binning.count-1);
      rainbow.setSpectrum("1fd00a","E3EA00", "DD0000");
      var max;
      
      for (var i = 0; i < _binning.count; i++){

        max = min + _binning.width;
      
        if(i == _binning.count - 1){
          // console.log(i)
          _bins.push({max:_binning.max, min: min, color:rainbow.colorAt(i), count:0, position: 0,  class:"icon-group-" + (i + 1)});
        } else {
          // console.log(i)
          _bins.push({max:max, min: min, color:rainbow.colorAt(i), count:0, position: 0, class:"icon-group-" + (i + 1)});;
        }
        min = max;
      }

    
    } else {
      
      _bins.push({max: _binning.max, min:_binning.min, color: "1fd00a", count: 0, position:0, class:"icon-group-1"})
      
    }
    _bins.push({max:_edges.max, min: _binning.max, color:"7D26CD", count: 0, position: 1, class:"icon-group-" + (_binning.count+1)})
    makeLayers();
  }
  
  this.getBins = function() {
    return _bins;
  }
  
  function makeLayers(){
    for(var i = 0; i < _bins.length; i++){
      _layers[_bins[i].class] = {
        type: 'group',
        name: _bins[i].class,
        visible: true
      }
    }
  }
  
  this.getLayers = function() {
    return _layers;
  }
  
  this.getIcon = function(value){
      for (var i = 0; i < _bins.length; i++){
        if(value >= _bins[i].min && value < _bins[i].max || ((i == _bins.length - 1 || i == _bins.length - 2) && value == _bins[i].max)){
          _bins[i].count++;
          return {icon:"<div class='icon' style='background-color:#" + _bins[i].color + "'></div>", layer:_bins[i].class};
        }
      }

    }
    
  this.getMessage = function(station, channels){
    //TODO: figure out why I have this channels array when the station already has that info
    var string = "<ul>"
    string += "<li> Station: " + station.sta + "</li>" 
    + "<li> Displayed value: " + station.value 
    + "</li>" + "<li> Network: " + station.net + "</li>"
    + "<li> Channel (median value): <ul>";
    
    for(var i = 0; i < Object.keys(channels).length; i++) {
      if(Object.keys(channels)[i] != "max"){
        var first = Object.keys(channels)[i].charAt(0);
        string += "<li";
        if(first == "B" || first == "E" || first == "H"){ //TODO: figure out why REGEX not working
          string += " class='included' >"
        } else {
          string += ">";
        }
        string += Object.keys(channels)[i]+": "+ channels[Object.keys(channels)[i]].median+ "</li>"
      } 
    }
    string += "</ul></li>"  
    return string+"</ul>"   
  }
  
  this.setEdges = function(max, min){
    _edges = {
      max: Math.max(max, _edges.max),
      min: Math.min(min, _edges.min)
    }
  }
  
  this.setValues = function(values){
    _edges = values; 
  }

  this.getEdges = function(){
    return _edges;
  }
  
  this.setBinning = function(binning){
    // console.log("before " + binning.min)
    _binning = {
      max: binning.max || binning.max == 0? binning.max : _binning.max,
      min: binning.min || binning.min == 0? binning.min : _binning.min,
      count: binning.count? binning.count : _binning.count
    }
    
    // console.log("after: "+ _binning.min)
    _binning.width = (_binning.max - _binning.min) / _binning.count;
    this.makeBins();
    // console.log(_binning)
  }

  this.Binning = function(){
    return _binning;
  }
})

.factory('metricsList', function($filter){
  var _metrics = [];
  var _stations = [];
  var _combined = [];
  var _latlons = [];
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
    getLatLngs: function(){
      return _latlons;
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
              
              _latlons.push([parseFloat(metric.lat), parseFloat(metric.lng)])
              // console.log(_latlons)
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

  
//TODO: split the current controller into a map controller and a controls controller for simplification
app2.controller("SimpleMapController", function($scope, $window, $http, metricsList, iconColoring, medianFinder, leafletBoundsHelpers, leafletData, $mdDialog) {
  $scope.Math = window.Math;
  angular.extend($scope, {
      markers: {
        
      },
      defaults: {
          scrollWheelZoom: false
      },
      layers: {
        baselayers: {
          osm: {
              name: 'OpenStreetMap',
              url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              type: 'xyz'
          }
        },
        overlays: {
          
        }
      },
      toggleLayer: function(type)
      {
          $scope.layers.overlays[type].visible = !$scope.layers.overlays[type].visible;
      },
      layerVisibility: function(type, count){
        return $scope.layers.overlays[type].visible && count > 0;
      },
  });
  $scope.whatsMyName = function(klass){
    console.log(klass)
  }
  $scope.binning={
    min: 0,
    max: 10
  }

  var params = $window.location.search.replace(/&\w*=&/g, '&');
  params=params.replace(/&\w*=$/gm, ""); //strip out empty params
  params=params.replace(/\?\w*=&/gm, "?");
  var url = 'http://service.iris.edu/mustang/measurements/1/query';
  var configs ='&output=jsonp&callback=JSON_CALLBACK';

  $scope.error = {
    data: false,
    noData: "Waiting for data.",
    inProgress: true
  }

  $scope.status = '  ';
  // $scope.customFullscreen = $mdMedia('xs') || $mdMedia('sm');

  
  $scope.showAlert = function(ev){
    $mdDialog.show({
      controller: DialogController,
      contentElement: '#moreInfo',
      parent: "#controls",
      targetEvent: ev,
      clickOutsideToClose: true
    });
  }

  $http.jsonp(url + params + configs, {cache:true}).success(function(data, status, headers, config){ //TODO: don't do this caching in prod
    console.log(url+params + configs);
    if(Object.keys(data.measurements)[0] != "error" && data.measurements[Object.keys(data.measurements)[0]].length > 0){

      $scope.error.noData ="Processing data."
      metricsList.setMetrics(data.measurements[Object.keys(data.measurements)[0]]); //TODO: allow other metrics by having a selector & multiple layers
      
      //Prettify the metric name
      var name = Object.keys(data.measurements)[0];
      $http.jsonp("http://service.iris.edu/mustang/metrics/1/query?metric="+name+"&output=jsonp&callback=JSON_CALLBACK", {cache:true})
        .success(function(data, status, headers, config){
          $scope.metric = data.metrics[0];
          // console.log(data.metrics);
      }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error
        // console.log(data + " : " + status);
      });

      $scope.stations=[];
      // console.log(metricsList.getMetrics());
      var data;
      //net, sta, loc, chan, start, end,
      params = params.replace(/(timewindow|metric|qual)=[^&]*&?/ig,'')
      params = params.replace(/chan/ig,'cha')
      params = params.replace(/qual=[^&]*/ig, '')
      // params = params.replace(/timewindow=*/ig,'')
      // console.log(params)
      $http.get('http://service.iris.edu/fdsnws/station/1/query'+params+'&format=text').then(function success(response){
        // console.log(response.data);
        data = response.data.split('\n'); //Oth is the header

        $scope.error.data = data[0].length > 0;

        if($scope.error.data){
          var headers = data[0].split("#");
          headers = headers[1].split(" | ");

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

          // console.log("combine");
          metricsList.combineLists();
          var metric = metricsList.getCombined();
          // console.log(metric)
          var markers = [];

          metric = medianFinder.findValues(metric);
          iconColoring.setValues(medianFinder.getValues());

          iconColoring.intitalBinning(95);

          var metricKeys = Object.keys(metric);

          for(var i = 0; i< metricKeys.length; i++){
            var m =  metric[metricKeys[i]];
            var symbol = iconColoring.getIcon(m.value);
            markers[metricKeys[i]]={
              layer: symbol.layer,
              lat: m.lat,
              lng: m.lng,
              message: iconColoring.getMessage(m, medianFinder.getChannels()[m.sta]),
              icon: {
                type:'div',
                className: 'icon-plain',
                // iconUrl: iconColoring.getIcon(m.value),
                iconSize: null,
                html: symbol.icon
              }

            }
          }

          $scope.icons = iconColoring.getBins();
          $scope.binning = iconColoring.Binning();
          $scope.edges = iconColoring.getEdges();
          $scope.markers = markers;
          
          $scope.layers.overlays = iconColoring.getLayers();
          // console.log($scope.binning.width)
          leafletData.getMap();

          var latlngs = metricsList.getLatLngs();
          
          var bounds = L.latLngBounds(latlngs);
          
          // var lMap = leafletData.getMap();
          
           leafletData.getMap().then(function(map) {
            map.fitBounds(bounds, {padding: [1,1]});
            setTimeout(function(){
              map.invalidateSize(); //Leaflet rechecks map size after load for proper centering
            }, 20)
          });
          
          setTimeout(function(){
                  $scope.$broadcast('reCalcViewDimensions');
                  // map.invalidateSize()
              }, 10);
        $scope.error.inProgress = false;
        } else {
          //no data appears
          console.log("oops")

        }

      }, function error(response){
      // console.log(response);
      $scope.error.inProgress = false;
        $scope.error.noData = "Error: Bad request. Please check URL parameters.";
      });
      
    } else if (Object.keys(data.measurements)[0] == "error") {
      $scope.error.inProgress = false;
      $scope.error.noData = "Error: " + data.measurements[Object.keys(data.measurements)[0]][0].message;
    } else {
      $scope.error.inProgress = false;
      $scope.error.noData = "Error: No data received."
    }
  }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error
    console.log(data + " : " + status);
    $scope.error.inProgress = false;
    $scope.error.noData = "error: Bad request. Please check URL parameters.";
  });
  

  $scope.updateBinningValues = function(){
    iconColoring.setBinning($scope.binning);
    $scope.markers = iconColoring.updateMarkers($scope.markers, medianFinder.getChannels());
    $scope.icons = iconColoring.getBins();
    $scope.layers.overlays = iconColoring.getLayers();
    // console.log($scope.binning)
  }

  $scope.goBack = function(){
    //grab edited params
    var params = $window.location.search.replace(/&\w*=&/g, '&');
    params=params.replace(/&\w*=$/gm, ""); //strip out empty params
    params=params.replace(/\?\w*=&/gm, "?");
    window.location = "/mustangular" + params;
  }

});

function DialogController($scope, $mdDialog) {
  $scope.hide = function() {
    $mdDialog.hide();
  };
  $scope.cancel = function() {
    $mdDialog.cancel();
  };
  $scope.answer = function(answer) {
    $mdDialog.hide(answer);
  };
}

//Disable default debugging output on leaflet
app2.config(function($logProvider){
  $logProvider.debugEnabled(false);
});
