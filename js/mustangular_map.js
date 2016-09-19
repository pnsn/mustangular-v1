// Mustangular map
var mapApp = angular.module('mapApp', ['leaflet-directive', 'ngSanitize', 'ngMessages', 'ngMaterial']);

//Gets the list of metrics from mustang/metrics for metric dropdown
mapApp.service('DataFinder', ["$http", "$q", function($http, $q){
  var _metricName = "";
  
  //Returns promise with MUSTANG data or error information
  this.getMetricData = function(query){
    var deferred = $q.defer();
    $http.jsonp(query).success(function(response){
      var responseText = Object.keys(response.measurements)[0];
      var responseData = response.measurements[responseText];
      if(responseText == "error"){
        deferred.reject({
          message:responseData[0].message,
          inProgress:false
        });           
      } else if(responseData.length > 0){
        _metricName = responseText;
        deferred.resolve( {
          data:responseData,
          message:"Processing Data."
        });
      }
    }).error(function(response){
      deferred.reject({
        message: response.data ? response.data : "Unknown error.",
        inProgress: false
      });
    });
    return deferred.promise;
  };  
  
  //Returns info about metric from MUSTANG
  this.getMetricInfo = function(query){
    return $http.jsonp(query + _metricName)
      .then(function(response){
        response.data.metrics[0].title = response.data.metrics[0].title ? response.data.metrics[0].title.replace(/[ ]Metric$/, "") : "";
         return response.data.metrics ? response.data.metrics[0] : "";
       },
       function(response){
         return "";
       });
  };
  
  this.getStationData = function(query){
  //net, sta, loc, chan, start, end,
    var _query = query.replace(/(timewindow|metric|qual)=[^&]*&?/ig,'')
    .replace(/chan/ig,'cha');
    
    var deferred = $q.defer();
    $http.get(_query).success(function(response){
      var status = response.status;

      if(status > 300){
        deferred.reject({
          message:response,
          inProgress:false
        });           
      } else {
        deferred.resolve({
          data:response,
          hasData: true,
        });
      }
    }).error(function(response){
      deferred.reject({
        message: response.split('\n')[0],
        inProgress: false
      });
    });
    return deferred.promise;
  }
  
}]);

mapApp.service('DataProcessor', ["$filter", function($filter){
  var _stationData = [];
  var _latlngs = [];
  var _combinedData = {};
  var _data = {};
  
  this.getStations = function(stationData, metricData){
    stationProcessor(stationData);
    metricProcessor(metricData);
    return medianFinder(_combinedData);
  };
  
  this.getLatLngs = function() {
    return _latlngs;
  };
  
  this.getData = function( ){
    return _data;
  }
  
  var stationProcessor = function(stations){
    stations = stations.split('\n');
    var headers = stations[0].split("#");
    headers = headers[1].split(" | ");

    for (var i = 1; i < stations.length; i++){
      if(stations[i].length > 1) {
        var station = stations[i].split("|");
        var staObj = {};
        for (var j = 0; j < station.length; j++){
          staObj[headers[j].trim().toLowerCase()]=station[j];
        }
        _stationData[station[0]+"_"+station[1]] = staObj;
      }
    }
  };
  
  var metricProcessor = function(data){
    for(var i = 0; i < data.length; i++){
      var key = data[i].net+"_"+data[i].sta;
      var sta = _stationData[key]
      if(sta && sta.latitude && sta.longitude){ //only plot if it has a latitude and a longitude
        var metric = data[i];
        metric.lat = sta.latitude; //print out table of failed stations --> no data
        metric.lng = sta.longitude;
        metric.elev = sta.elevation;

        if(_combinedData[key]){
          if(_combinedData[key].chans[metric.chan]){
            _combinedData[key].chans[metric.chan].push(metric.value); //need the median value
          } else {
            _combinedData[key].chans[metric.chan] = [metric.value];
          }
        } else{
          _combinedData[key] = { 
            sta: metric.sta,
            lat: parseFloat(metric.lat),
            lng: parseFloat(metric.lng),
            net: metric.net,
            chans:{}
          }
          
          _latlngs.push([parseFloat(metric.lat), parseFloat(metric.lng)])
          _combinedData[key].chans[metric.chan] = [metric.value];
        }
      } else {
        //put it in a table
      }
    }
  };

  var medianFinder = function(stations){
    var values = [];
    angular.forEach(stations, function(station, key){
      var maxValue = Number.MIN_SAFE_INTEGER;
      angular.forEach(station.chans, function(channel, key){
        var orderedChans = $filter('orderBy')(channel); 
        
        //Find the middle index value
        var mid = orderedChans.length/2-.5;
        
        //Default to 0
        var median = 0;
        
        //Check if it is a whole number, grab appropriate middle value from array
        if(mid % 1 == 0){
          median = orderedChans[mid];
        } else {
          median = (orderedChans[mid-.5]+orderedChans[mid-.5])/2;
        }
        
        //For display purposes: only find and show max of the E*, H*, and B* channels
        var first = key.charAt(0);
        if(first == "B" || first == "E" || first == "H"){
          maxValue = Math.max(maxValue, median);
        }

        channel.median = median;
      });
      
      station.maxValue = maxValue;
      values.push(maxValue);
    });
    
    values = $filter('orderBy')(values);
    
    _data = {
      values: values,
      max: values[values.length - 1],
      min: values[0],
      count: values.length
    }
    return stations;
  };
    
}]);

mapApp.service('MarkerMaker', function(){
  var _data = {};
  var _binning = {
    bins: []
  };
  var _markers = [];
  var _overlays = {};
  var _stations;
  
  this.setData = function(data){
    _data = data;
  }
  
  this.getMarkers = function(){
    return _markers;
  }  
       
  this.getOverlays = function(){
    return _overlays;
  }
  
  this.getBinning = function(){
    return _binning;
  };
  
  this.setStations = function(stations){
    _stations = stations;
  };
  
  this.setBinning = function(binning){
    var newBinning = findBinning();
      _binning.max = binning.max || binning.max == 0 ? binning.max : newBinning.max; 
      _binning.min = binning.min || binning.min == 0 ? binning.min : newBinning.min;
      _binning.count =binning.count &&  _data.count > binning.count ? binning.count : _data.count;
    _binning.width = (_binning.max - _binning.min) / _binning.count;
    
    makeBins();
    makeOverlays();
    makeMarkers();
  };    
          
  var findBinning = function() {
    var max, min;
    if(_data.count > 1){
      // //console.log(_data)
      var val = Math.round(.95 * _data.count);
      min = _data.min > 0 ? _data.min : 0;
      max = val > 1 ? _data.values[val - 1] : _data.values[val];
    } else {
      min = _data.min;
      max = _data.max;
    }
    return {max:max, min:min}
  };
  
  var makeBins = function(){ 
    var _bins = []; 
    var min =  _binning.min;
    var rainbow = new Rainbow();
    _bins.push({max:min, min: _data.min, color:"000", count:0, position:-1, class:"icon-group-0"})
    if(_binning.count > 1){
      rainbow.setNumberRange(0, _binning.count-1);
      rainbow.setSpectrum("1fd00a","E3EA00", "DD0000");
      var max;
      
      for (var i = 0; i < _binning.count; i++){

        max = min + _binning.width;
      
        if(i == _binning.count - 1){
          _bins.push({max:_binning.max, min: min, color:rainbow.colorAt(i), count:0, position: 0,  class:"icon-group-" + (i + 1)});
        } else {
          _bins.push({max:max, min: min, color:rainbow.colorAt(i), count:0, position: 0, class:"icon-group-" + (i + 1)});;
        }
        min = max;
      }

    
    } else {
      
      _bins.push({max: _binning.max, min:_binning.min, color: "1fd00a", count: 0, position:0, class:"icon-group-1"})
      
    }
    _bins.push({max:_data.max, min: _binning.max, color:"808080", count: 0, position: 1, class:"icon-group-" + (_binning.count+1)})
    _binning.bins = _bins;
  };
  
  var makeOverlays = function(){
    for(var i = 0; i < _binning.bins.length; i++){
      _overlays[_binning.bins[i].class] = {
        type: 'group',
        name: _binning.bins[i].class,
        visible: true
      }
    }
  };
  
  var makeMarkers = function(){
    angular.forEach(_stations, function(station, key){
      var symbol = makeIcon(station.maxValue);
      _markers[key]={
        layer: symbol.layer,
        lat: station.lat,
        lng: station.lng,
        message: makeMessage(station),
        icon: {
          type:'div',
          className: 'icon-plain',
          iconSize: null,
          html: symbol.icon,
          iconAnchor: [5, 5],
          popupAnchor:  [-1, -5] 
        }
       } 
    });
  } 
      
  var makeIcon = function(value){
      for (var i = 0; i < _binning.bins.length; i++){
        if(value >= _binning.bins[i].min && value < _binning.bins[i].max || ((i == _binning.bins.length - 1 || i == _binning.bins.length - 2) && value == _binning.bins[i].max)){
          _binning.bins[i].count++;
          return {icon:"<div class='icon' style='background-color:#" + _binning.bins[i].color + "'></div>", layer:_binning.bins[i].class};
        }
      }

    }
    
  var makeMessage = function(station){
    var string = "<ul>"
    string += "<li> Station: " + station.sta + "</li>" 
    + "<li> Displayed value: " + station.maxValue 
    + "</li>" + "<li> Network: " + station.net + "</li>"
    + "<li> Channel (median value): <ul>";
    var channels = station.chans;
    angular.forEach(channels, function(channel, key){
      if(key != "maxValue"){
        var first = key.charAt(0);
        string += "<li";
        if(first == "B" || first == "E" || first == "H"){ //TODO: figure out why REGEX not working
          string += " class='included' >"
        } else {
          string += ">";
        }
        string += key+": "+ channel.median+ "</li>"
      } 
    });

    string += "</ul></li>"  
    return string+"</ul>"   
  }
  
});

//TODO: split the current controller into a map controller and a controls controller for simplification
mapApp.controller("MainCtrl", ["$scope", "$window", "$mdDialog", "DataFinder", "DataProcessor", "MarkerMaker", "leafletData", "DataProcessor", "$timeout", function($scope, $window, $mdDialog, DataFinder, DataProcessor, MarkerMaker, leafletData, DataProcessor, $timeout) {
  
  //Strip out empty params
  var params = $window.location.search
    .replace(/&\w*=&/g, '&')
    .replace(/&\w*=$/gm, "")
    .replace(/\?\w*=&/gm, "?");
  
  $scope.goBack = function(){
    $window.location.href="/mustangular/" + params;
  };
  
  angular.extend($scope, {
    binning: {
      count: 3,
      bins: {}
    },
    data: {},
    status: { 
      hasData: false,
      inProgress: true,
      message:"Waiting for data."
    },
    defaults: {
      scrollWheelZoom: false
    },
    markers: {},
    layers: {
      baselayers: {
        osm: {
            name: 'OpenStreetMap',
            url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            type: 'xyz'
        }
      },
      overlays: {}
    },
    toggleLayer: function(type){
      $scope.layers.overlays[type].visible = !$scope.layers.overlays[type].visible;
    },
    layerVisibility: function(type, count){
      return $scope.layers.overlays[type].visible && count > 0;
    },
    allLayersVisible: true,
    toggleAllLayers:function(){
      console.log("toggle")
      angular.forEach($scope.layers.overlays, function(overlay){
        overlay.visible = !$scope.allLayersVisible;
      });
      $scope.allLayersVisible = !$scope.allLayersVisible;
    }
  });
  
  var errorHandler = function(response) {
    $scope.status.message = response.message;
    $scope.status.inProgress = response.inProgress;
  }
  
  DataFinder.getMetricData("http://service.iris.edu/mustang/measurements/1/query"+ params +"&output=jsonp&callback=JSON_CALLBACK")
    .then(function(metricData){
      $scope.status.message = metricData.message;
      $scope.status.inProgress = metricData.inProgress ? metricData.inProgress : $scope.status.inProgress;    
      
      DataFinder.getMetricInfo("http://service.iris.edu/mustang/metrics/1/query?output=jsonp&callback=JSON_CALLBACK&metric=").then(function(metricInfo){
        $scope.metricInfo = metricInfo;
        //console.log($scope.metricInfo)
      });
    
      DataFinder.getStationData("http://service.iris.edu/fdsnws/station/1/query"+params+"&format=text")
        .then(function(stationData){
          $scope.status.hasData = stationData.hasData;
          var stations = DataProcessor.getStations(stationData.data, metricData.data);
          $scope.data = DataProcessor.getData();
          
          MarkerMaker.setData($scope.data);
          MarkerMaker.setStations(stations);
          MarkerMaker.setBinning($scope.binning)
          
          $scope.binning = MarkerMaker.getBinning();
          $scope.layers.overlays = MarkerMaker.getOverlays();
          $scope.markers = MarkerMaker.getMarkers();

          $scope.status.inProgress = false;

          var bounds = L.latLngBounds(DataProcessor.getLatLngs());
          
           leafletData.getMap().then(function(map) {
            map.fitBounds(bounds, {padding: [1,1]});
            $timeout(function(){
              map.invalidateSize(); //Leaflet rechecks map size after load for proper centering
            }, 20)
          });
          
        }, errorHandler);
    }, errorHandler);
  

  $scope.showAlert = function(e){
    $mdDialog.show({
      controller: DialogController,
      contentElement: '#moreInfo',
      parent: "#controls",
      targetEvent: e, 
      clickOutsideToClose: true
    });
  }
  
  $scope.updateBinningValues = function(){
    MarkerMaker.setBinning($scope.binning);
    $scope.binning = MarkerMaker.getBinning();
    $scope.layers.overlays = MarkerMaker.getOverlays();
    $scope.markers = MarkerMaker.getMarkers();
  }

}]);

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
