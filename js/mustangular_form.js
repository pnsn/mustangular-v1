//Mustangular Form 
var formApp = angular.module('formApp', ['ngMaterial']);

//Gets the list of metrics from mustang/metrics for metric dropdown
formApp.provider('metricsProvider', function(){
  //Array of possible metrics for form
  var _metrics = []; 

  //Make http request
  var findMetrics = function($http){
    $http.jsonp("http://service.iris.edu/mustang/metrics/1/query?output=jsonp&callback=angular.callbacks._0", {cache:true})
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
          "title" : data.metrics[i].title
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
    }
  }
});

formApp.controller('FormCtrl', ['$scope', '$window', '$httpParamSerializer', '$location', '$http', '$filter', 'metricsProvider', function($scope, $window, $httpParamSerializer, $location, $http, $filter, metricsProvider){
  //Force datetimepickers to not exceed current date
  $scope.maxDate = new Date();

  $scope.metrics = metricsProvider.getMetrics();
  
  $scope.master = {};
  
  //Form submits successfully
  $scope.submit = function(params) {
    $scope.master = angular.copy(params);
    
    //Combine start and stop times from form into timewindow param for mustang
    $scope.master.timewindow = params.timewindow.start && params.timewindow.stop ? 
    $filter('date')(params.timewindow.start, 'yyyy-MM-ddTHH:mm:ss') + "," + $filter('date')(params.timewindow.stop, 'yyyy-MM-ddTHH:mm:ss') : null;
    
    //Redirect
    $window.location.href = "/mustangular/mustangular_map.html?" + $httpParamSerializer($scope.master);
  }
  
  //Force UTC, change default times to start at beginning of day and end at end of day
  $scope.fixTime = function(){
    var time = $scope.snclq.timewindow;
    if(time.stop && time.stop.getHours() == "00" && time.stop.getMinutes()=="00"){
      time.stop = new Date(time.stop.setHours(23,59,59));
    }
  }
  
  function addMinutes(date, minutes) {
      return new Date(date.getTime() + minutes*60000);
  }
  
  //Populate form if there are parameters in the URL
  var params = $location.search();
  if(params){
    var time = {
      start: params.timewindow? new Date(params.timewindow.split(",")[0]) : null,
      stop: params.timewindow? new Date(params.timewindow.split(",")[1]) : null,
    }

    //Spoof UTC in datetime input because js converts from UTC to local automatically
    time.start = time.start ? addMinutes(time.start, time.start.getTimezoneOffset()) : null;
    time.stop = time.stop ?  addMinutes(time.stop, time.stop.getTimezoneOffset()) : null;

    $scope.snclq = {
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
    };
  }
});

formApp.config(['$locationProvider',function($locationProvider) {
  $locationProvider.html5Mode({
    enabled:true,
    requireBase: false
  });
}]);