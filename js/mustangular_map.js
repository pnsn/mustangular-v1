// Mustangular map 
var mapApp = angular.module('mapApp', ['leaflet-directive', 'ngSanitize', 'ngMessages', 'ngMaterial']);

//Finds the median of all the channels for each station and the max value for each station
//in the metric and adds it to the station object
mapApp.factory('medianFactory', function($filter){
  //Object
  var _channels = {};
  
  //Max and min values on map, all of the values on the map, count of the values on the map.
  var _values = {
    max: Number.MIN_SAFE_INTEGER,
    min: Number.MAX_SAFE_INTEGER,
    values: [],
    count: 0
  };
  return {
    //Finds the median for each channel in a station and the max for each station
    findValues: function(metric){       
      var keys = Object.keys(metric);
      
      //Go through each station in the metric
      for (var i = 0; i < keys.length; i++){
        var max = _values.max;
        var chans = metric[keys[i]].chans;
        var chanKeys = Object.keys(chans);
        
        //Go through each channel in a station
        for(var j = 0; j < chanKeys.length; j++){
          
          //Order the values in the channel
          var array = $filter('orderBy')(chans[chanKeys[j]]); 
          
          //Find the middle index value
          var mid = array.length/2-.5;
          
          //Default to 0
          var median = 0;
          
          //Check if it is a whole number, grab appropriate middle value from array
          if(mid % 1 == 0){
            median = array[mid];
          } else {
            median = (array[mid-.5]+array[mid-.5])/2;
          }
          
          //For display purposes: only find and show max of the E*, H*, and B* channels
          var first = chanKeys[j].charAt(0);
          if(first == "B" || first == "E" || first == "H"){ 
            max = Math.max(max, median);
          }
          
          //Add median to the channel object
          chans[chanKeys[j]].median = median;
          
        }
        
        //Add max of medians (this will be displayed value) to the station object
        metric[keys[i]].value = max;
        
        //Add the station's max to the values
        _values.values.push(max);
        
        //Add station's channels to channels object
        _channels[metric[keys[i]].sta] = chans;
        
        //Add station's max to channels object
        _channels[metric[keys[i]].sta].max = max;
        
        //Override the station's channels with updated information
        metric[keys[i]].chans = chans;
      }
      
      //Sort all of the values 
      _values.values = $filter('orderBy')(_values.values);
      
      //Update the values
      _values = {
        max: _values.values[_values.values.length-1],
        min: _values.values[0],
        count: _values.values.length,
        values: _values.values
      }
      return metric;
    },
    getChannels: function(){
      return _channels;
    },
    getValues: function(){
      return _values;
    }
  }
});

mapApp.service('iconColoring', function($filter){
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
    
  this.getMessage = function(station){
    //TODO: figure out why I have this channels array when the station already has that info
    var string = "<ul>"
    string += "<li> Station: " + station.sta + "</li>" 
    + "<li> Displayed value: " + station.value 
    + "</li>" + "<li> Network: " + station.net + "</li>"
    + "<li> Channel (median value): <ul>";
    var channels = station.chans;
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
});

mapApp.factory('metricFactory', function($filter){
  var _metrics = [];
  var _stations = [];
  var _combined = [];
  var _latlngs = [];
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
      return _latlngs;
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
              
              _latlngs.push([parseFloat(metric.lat), parseFloat(metric.lng)])
              // console.log(_latlngs)
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
});
// add service to allow sharing of stations between controllers

  
//TODO: split the current controller into a map controller and a controls controller for simplification
mapApp.controller("MapCtrl", function($scope, $window, $http, metricFactory, iconColoring, medianFactory, leafletBoundsHelpers, leafletData, $mdDialog, $timeout) {
  $scope.Math = $window.Math;
  angular.extend($scope, {
      markers: {},
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
        overlays: { }
      },
      toggleLayer: function(type) {
          $scope.layers.overlays[type].visible = !$scope.layers.overlays[type].visible;
      },
      layerVisibility: function(type, count){
        return $scope.layers.overlays[type].visible && count > 0;
      },
  });
  $scope.binning={
    min: 0,
    max: 10
  }

  $scope.status = {
    data: false,
    inProgress: true,
    message: "Waiting for data."
  }

  $scope.showAlert = function(ev){
    $mdDialog.show({
      controller: DialogController,
      contentElement: '#moreInfo',
      parent: "#controls",
      targetEvent: ev,
      clickOutsideToClose: true
    });
  }

  //Strip out empty params
  $scope.params = $window.location.search
    .replace(/&\w*=&/g, '&')
    .replace(/&\w*=$/gm, "")
    .replace(/\?\w*=&/gm, "?");

  var url = 'http://service.iris.edu/mustang/measurements/1/query';
  var configs ='&output=jsonp&callback=JSON_CALLBACK';

  $http.jsonp(url + $scope.params + configs, {cache:true})
  .success(function(data, status, headers, config){ //TODO: don't do this caching in prod
    console.log(url+$scope.params + configs);
    
    if(Object.keys(data.measurements)[0] != "error" && data.measurements[Object.keys(data.measurements)[0]].length > 0){
      $scope.status.message ="Processing data."
      metricFactory.setMetrics(data.measurements[Object.keys(data.measurements)[0]]); //TODO: allow other metrics by having a selector & multiple layers
      
      //Prettify the metric name
      var name = Object.keys(data.measurements)[0];
      $http.jsonp("http://service.iris.edu/mustang/metrics/1/query?metric="+name+"&output=jsonp&callback=JSON_CALLBACK", {cache:true})
        .success(function(data, status, headers, config){
          $scope.metric = data.metrics[0];
      }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error

      });

      $scope.stations=[];

      var data;
      
      //net, sta, loc, chan, start, end,
      var params = $scope.params.replace(/(timewindow|metric|qual)=[^&]*&?/ig,'')
        .replace(/chan/ig,'cha')
        .replace(/qual=[^&]*/ig, '');

      $http.get('http://service.iris.edu/fdsnws/station/1/query'+params+'&format=text').then(function success(response){
        data = response.data.split('\n'); //Oth is the header

        $scope.status.data = data[0].length > 0;

        if($scope.status.data){
          var headers = data[0].split("#");
          headers = headers[1].split(" | ");

          for (var i = 1; i < data.length; i++){
            var station = data[i].split("|");
            var staObj = {};
            for (var j = 0; j < station.length; j++){
              staObj[headers[j].trim().toLowerCase()]=station[j];
            }
            $scope.stations.push(staObj);
            metricFactory.setStations(staObj, station[1]+"_"+station[0]);
          }
          
          metricFactory.combineLists();
          var metric = metricFactory.getCombined();
          var markers = [];

          metric = medianFactory.findValues(metric);
          iconColoring.setValues(medianFactory.getValues());

          iconColoring.intitalBinning(95);

          var metricKeys = Object.keys(metric);
          
          //Go through all the keys in the metric and create markers 
          for(var i = 0; i< metricKeys.length; i++){
            var m =  metric[metricKeys[i]];
            var symbol = iconColoring.getIcon(m.value);
            markers[metricKeys[i]]={
              layer: symbol.layer,
              lat: m.lat,
              lng: m.lng,
              message: iconColoring.getMessage(m),
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

          leafletData.getMap();

          var latlngs = metricFactory.getLatLngs();
          
          var bounds = L.latLngBounds(latlngs);
          
           leafletData.getMap().then(function(map) {
            map.fitBounds(bounds, {padding: [1,1]});
            $timeout(function(){
              map.invalidateSize(); //Leaflet rechecks map size after load for proper centering
            }, 20)
          });
          
        $scope.status.inProgress = false;
        } else {

          console.log("oops")

        }

      }, function error(response){
      $scope.status.inProgress = false;
        $scope.status.message = "Error: Bad request. Please check URL parameters.";
      });
      
    } else if (Object.keys(data.measurements)[0] == "error") {
      $scope.status.inProgress = false;
      $scope.status.message = "Error: " + data.measurements[Object.keys(data.measurements)[0]][0].message;
    } else {
      $scope.status.inProgress = false;
      $scope.status.message = "Error: No data received."
    }
  }).error(function(data, status, headers, config){ //Doesn't get triggered if the metric array is empty or an error
    $scope.status.inProgress = false;
    $scope.status.message = "error: Bad request. Please check URL parameters.";
  });
  

  $scope.updateBinningValues = function(){
    iconColoring.setBinning($scope.binning);
    $scope.markers = iconColoring.updateMarkers($scope.markers, medianFactory.getChannels());
    $scope.icons = iconColoring.getBins();
    $scope.layers.overlays = iconColoring.getLayers();
  }

  $scope.goBack = function(){
    $window.location = "/mustangular" + $scope.params;
  }

});


//Required for angular material dialog 
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

//Disables default debugging output on angular leaflet
mapApp.config(['$logProvider', '$locationProvider',function($logProvider, $locationProvider){
  $logProvider.debugEnabled(false);
  
  $locationProvider.html5Mode({
    enabled:true,
    requireBase: false
  });
}]);
