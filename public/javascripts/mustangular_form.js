//Mustangular Form 
var formApp = angular.module('formApp', ['ngMaterial']);

//Gets the list of metrics from mustang/metrics for metric dropdown
formApp.provider('metricsProvider', function(){
  //Array of possible metrics for form
  var _metrics = []; 

  //Make http request
  var findMetrics = function($http){
    $http.jsonp("http://service.iris.edu/mustang/metrics/1/query?output=jsonp&callback=angular.callbacks._0&nodata=200", {cache:true})
      .success(function(data, status, headers, config){
        parseMetrics(data);
      })
      .error(function(data, status, headers, config){
        //TODO: Handle error
      });
  };
  
  //Process recieved metrics
  var parseMetrics = function(data){
    for(var i = 0; i<data.metrics.length; i++){
      var keys = Object.keys(data.metrics[i].tables[0].columns[0]);
      if(data.metrics[i].tables[0].columns[0]["name"] == "value" && data.metrics[i].tables[0].columns[0]["sqlType"] != "TEXT" ){
        _metrics.push( {
          "metric" : data.metrics[i].name,
          "title" : data.metrics[i].title.replace(/[ ]Metric$/, "")
        });
      }
    } 
  };
  
  this.$get = function($http){
    return {
      getMetrics: function(){
        findMetrics($http);
        return _metrics;
      }
    };
  };
});

//Updates form with existing URL Parameters
formApp.service('UpdateParams', ['$location', function($location){
  var _snclq = {};
  
  //Populate form if there are parameters in the URL
  var params = $location.search();
  
  this.hasSettings = false;
  
  if(params){
    
    var time = {
      start: params.timewindow? new Date(params.timewindow.split(",")[0]) : null,
      stop: params.timewindow? new Date(params.timewindow.split(",")[1]) : null
    };
    
    _snclq = {
      net: params.net,
      chan: params.chan,
      sta: params.sta,
      loc: params.loc,
      qual: params.qual,
      timewindow: {
        start: time.start ? addMinutes(time.start, time.start.getTimezoneOffset()) : null,
        stop: time.stop ?  addMinutes(time.stop, time.stop.getTimezoneOffset()) : null
      },
      //preserve these values
      metric: params.metric,
      binmin: params.binmin,
      binmax: params.binmax,
      bincount: params.bincount,
      view: params.view,
      coloring: params.coloring    
    };
    
    if(params.bincount || params.binmin || params.binmax || params.view || params.coloring){
      this.hasSettings = true;
    }

  }
  
  //Spoof UTC in datetime input because js converts from UTC to local automatically
  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes*60000);
  };
  
  this.getParams = function(){
    return _snclq;
  };
  
  this.clearParams = function(){
    
    angular.extend(_snclq, {
      binmin: null,
      binmax: null,
      bincount: null,
      view: null,
      coloring: null    
    });
    
    this.hasSettings = false;
  };
  
}]);

//Prepares parameters for submission, modifies time to correct format
formApp.service('FinalizeParams', ['$httpParamSerializer', '$filter', '$window', '$location', function($httpParamSerializer, $filter, $window, $location){
  
  //Force UTC, change default times to start at beginning of day and end at end of day
  this.fixTime = function(timeStop){
    if(timeStop && timeStop.getHours() == "00" && timeStop.getMinutes()=="00"){
      timeStop = new Date(timeStop.setHours(23,59,59));
    }
    return timeStop;
  };
  
  //On submit, redirect to map with parameters in URL
  this.submit = function(params) {
    var master = angular.copy(params);
    
    //Combine start and stop times from form into timewindow param for mustang
    master.timewindow = params.timewindow.start && params.timewindow.stop ? 
    $filter('date')(params.timewindow.start, 'yyyy-MM-ddTHH:mm:ss') + "," + $filter('date')(params.timewindow.stop, 'yyyy-MM-ddTHH:mm:ss') : null;
    
    //Redirect
    $window.location.href = "mustangular_map.html?" + $httpParamSerializer(master);
  }; 
  
}]);

formApp.controller('FormCtrl', ['$scope', 'metricsProvider', 'UpdateParams', 'FinalizeParams', function($scope, metricsProvider, UpdateParams, FinalizeParams){
  //Force datetimepickers to not exceed current date
  $scope.maxDate = new Date();
  
  //Get metrics from IRIS
  $scope.metrics = metricsProvider.getMetrics();

  //Send parameters & redirect to map
  $scope.submit = FinalizeParams.submit;
  
  //Corrects end time from 00:00:00 to 23:59:59
  $scope.fixTime = FinalizeParams.fixTime;
  
  //Fills form in with URL parameters
  $scope.params = UpdateParams.getParams();
  
  $scope.hasSettings = UpdateParams.hasSettings;
  
  //Remove any settings passed in when returning from map
  $scope.clearSettings = function(){
    UpdateParams.clearParams();
    $scope.params = UpdateParams.getParams();
    $scope.hasSettings = UpdateParams.hasSettings;
    console.log($scope.hasSettings)
  };
  
}]);

//Remv
formApp.config(['$locationProvider',function($locationProvider) {
  $locationProvider.html5Mode({
    enabled:true,
    requireBase: false
  });
}]);