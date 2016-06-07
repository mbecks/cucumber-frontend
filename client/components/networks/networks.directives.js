'use strict';

var app = angular.module('myApp.networks.directives', []);

app.directive('listNetworks', ['Network', '$routeParams', '$mdDialog', 'showToast', 'showErrors', '$q', function(Network,$routeParams,$mdDialog,showToast,showErrors,$q) {

  var link = function(scope, el, attrs, controller) {

    scope.selected  = [];
    scope.location  = { slug: $routeParams.id };

    var createMenu = function() {

      // permissions //
      scope.menu = [];

      scope.menu.push({
        name: 'Edit Settings',
        icon: 'settings',
        type: 'settings'
      });

      scope.menu.push({
        name: 'Change SSID',
        icon: 'mode_edit',
        type: 'ssid'
      });

      scope.menu.push({
        name: 'Delete Network',
        icon: 'delete_forever',
        type: 'delete'
      });

    };

    scope.action = function(network,type) {
      switch(type) {
        case 'settings':
          editSettings(network);
          break;
        case 'ssid':
          editSsid(network);
          break;
        case 'delete':
          destroy(network);
          break;
      }
    };

    scope.options = {
      autoSelect: true,
      boundaryLinks: false,
      largeEditDialog: false,
      pageSelector: false,
      rowSelection: false
    };

    scope.query = {
      order:      '-created_at',
      limit:      $routeParams.per || 25,
      page:       $routeParams.page || 1,
      options:    [5,10,25,50,100],
    };

    var init = function() {
      var deferred = $q.defer();
      scope.promise = deferred.promise;
      Network.get({location_id: scope.location.slug}).$promise.then(function(results) {
        scope.networks = results;
        scope.loading = undefined;
        createMenu();
        deferred.resolve();
      }, function(error) {
        deferred.reject();
      });
    };

    scope.band = '';
    scope.updateBand = function(band) {
      switch(band) {
        case 'two':
          scope.band = '2.4Ghz';
          break;
        case 'five':
          scope.band = '5Ghz';
          break;
        default:
          scope.band = '';
          break;
      }
    };

    // scope.bands = [{key: 'All', value: ''}, {key: '2.4Ghz', value: 'two'}, { key: '5Ghz', value: 'five'}];

    var editSsid = function(network) {
      $mdDialog.show({
        templateUrl: 'components/networks/_edit_ssid.html',
        parent: angular.element(document.body),
        controller: DialogController,
        locals: {
          network: network
        }
      });
    };

    function DialogController($scope,network) {
      $scope.network = network;
      $scope.update = function() {
        network.state = 'processing';
        scope.update(network);
        $mdDialog.cancel();
      };
      $scope.close = function() {
        $mdDialog.cancel();
      };
    }
    DialogController.$inject = ['$scope', 'network'];

    var destroy = function(network) {
      var confirm = $mdDialog.confirm()
      .title('Delete Network')
      .textContent('Are you sure you want to delete this network?')
      .ariaLabel('Delete Network')
      .ok('Delete')
      .cancel('Cancel');
      $mdDialog.show(confirm).then(function() {
        scope.destroy(network);
      }, function() {
      });
    };

    scope.destroy = function(network) {
      Network.destroy({location_id: scope.location.slug, id: network.id}).$promise.then(function(results) {
        removeFromList(network);
      }, function(err) {
        showErrors(err);
      });
    };

    var removeFromList = function(network) {
      for (var i = 0, len = scope.networks.length; i < len; i++) {
        if (scope.networks[i].id === network.id) {
          scope.networks.splice(i, 1);
          showToast('Network successfully deleted.');
          break;
        }
      }
    };

    scope.update = function(network) {
      Network.update({location_id: scope.location.slug, id: network.id, network: { ssid: network.ssid }}).$promise.then(function(results) {
        showToast('SSID updated, your boxes will resync');
        network.state = undefined;
      }, function(error) {
        showErrors(error);
        network.state = undefined;
      });
    };

    var editSettings = function(network) {
      window.location.href = '/#/locations/' + scope.location.slug + '/networks/' + network.id;
    };

    init();

  };

  return {
    link: link,
    scope: {
      loading: '='
    },
    templateUrl: 'components/locations/networks/_index.html'
  };

}]);

app.directive('newNetwork', ['Network', 'Zone', '$routeParams', '$location', '$http', '$compile', '$mdDialog', 'showToast', 'showErrors', function(Network, Zone, $routeParams, $location, $http, $compile, $mdDialog, showToast, showErrors) {

  var link = function(scope, element, attrs) {

    scope.content_filters = ['Danger', 'Adult', 'Security', 'Family', 'Off'];
    scope.location = { slug: $routeParams.id };

    function buildNetwork () {
      var sub = Math.floor(Math.random() * 254) + 1;
      scope.network = {
        ssid: 'My Wi-Fi Network',
        access_type: 'password',
        encryption_type: 'psk2',
        band_steering: true,
        active: true,
        interface_ipaddr: '10.168.' + sub + '.1',
        dhcp_enabled: true,
        dns_1: '8.8.8.8',
        dns_2: '8.8.4.4',
        interface_netmask: 24,
        use_ps_radius: true,
        captive_portal_ps: true,
        content_filter: 'Security',
        highlight: true,
        captive_portal_enabled: false
      };
    }

    var createNewNetwork = function(network) {
      Network.create({location_id: scope.location.slug, network: network}).$promise.then(function(results) {
        network.id = results.id;
        scope.networks.push(network);
        showToast('Network created successfully');
      }, function(err) {
        showErrors(err);
      });
    };

    var openDialog = function(network) {
      $mdDialog.show({
        templateUrl: 'components/networks/_create.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        controller: DialogController,
        locals: {
          loading: scope.loading,
          network: scope.network
        }
      });
    };

    function DialogController($scope,loading,network) {
      $scope.loading = loading;
      $scope.network = network;

      Zone.get({location_id: scope.location.slug}).$promise.then(function(res) {
        $scope.zones = res.zones;
        if ($scope.zones.length === 1) {
          $scope.network.zone_id = $scope.zones[0].id;
        }
        $scope.loading = undefined;
      }, function(err) {
        console.log(err);
      });
      $scope.save = function() {
        $mdDialog.cancel();
        createNewNetwork($scope.network);
      };
      $scope.close = function() {
        $mdDialog.cancel();
      };
    }
    DialogController.$inject = ['$scope', 'loading', 'network'];

    scope.init = function() {
      buildNetwork();
      openDialog();
    };

  };

  return {
    link: link,
    scope: {
      networks: '='
    },
    template:
      '<span>' +
      '<md-button class="md-icon-button md-accent" ng-click="init()">'+
      '<md-icon>add_circle</md-icon>'+
      '</md-button>'+
      '</span>'
  };

}]);

app.directive('displayNetwork', ['Network', 'Location', '$routeParams', '$location', '$http', '$compile', '$rootScope', '$timeout', '$pusher', 'showToast', 'showErrors', 'menu', '$mdDialog', function(Network, Location, $routeParams, $location, $http, $compile, $rootScope, $timeout, $pusher, showToast, showErrors, menu, $mdDialog) {

  var link = function(scope, element, attrs) {

    scope.location = { slug: $routeParams.id };

    var displaySync = function() {
      // if (scope.network.job_id) {
      //   $('#location-banner').addClass('alert-banner');
      //   $('#location-banner-small').css({'margin-bottom': '50px'});
      //   var msg = 'Your boxes will sync in 1 minute..';
      //   $rootScope.error = msg;
      // }
    };

    scope.encryptions = {'None': 'none', 'WPA2': 'psk2'};
    scope.content_filters = ['Danger', 'Adult', 'Security', 'Family', 'Off'];
    scope.netmasks = [8,12,16,24,32];

    // User Permissions //
    var createMenu = function() {
      scope.menu = [];
      scope.menu.push({
        name: 'Delete Network',
        icon: 'delete_forever',
        type: 'delete'
      });
      scope.menu.push({
        name: 'View Zones',
        icon: 'layers',
        type: 'zones',
      });
      scope.menu.push({
        name: 'Test Radius',
        icon: 'network_check',
        type: 'radius',
        disabled: scope.network.access_type !== 'radius'
      });
    };

    scope.action = function(type) {
      switch(type) {
        case 'delete':
          destroy();
          break;
        case 'zones':
          zones();
          break;
        case 'radius':
          radtest();
          break;
      }
    };

    var init = function() {
      Network.query({location_id: scope.location.slug, id: $routeParams.network_id}).$promise.then(function(res) {
        scope.network = res;
        var ip = scope.network.interface_ipaddr || '10.168.210.1';
        scope.short_ip = ip.split('.').slice(0,3).join('.') + '.';
        scope.secondary_host = scope.network.radius_8021x_host_2 !== null;
        if (scope.ssid_hidden !== true) {
          scope.network.ssid_hidden = false;
        }
        if (scope.ssid_disabled !== true) {
          scope.network.ssid_disabled = false;
        }
        if (!scope.network_radio_mode) {
          scope.network.network_radio_mode = 'ap';
        }
        displaySync();
        createMenu();
        scope.loading = undefined;

      });
    };

    var destroy = function(network) {
      var confirm = $mdDialog.confirm()
      .title('Delete Network')
      .textContent('Are you sure you want to delete this network?')
      .ariaLabel('Delete Network')
      .ok('Delete')
      .cancel('Cancel');
      $mdDialog.show(confirm).then(function() {
        scope.destroy(network);
      }, function() {
      });
    };

    scope.destroy = function(slug) {
      Network.destroy({location_id: scope.location.slug, id: scope.network.id}).$promise.then(function(results) {
        $location.path('/locations/' + scope.location.slug + '/networks');
        showToast('Network successfully deleted.');
      }, function(err) {
        showErrors(err);
      });
    };

    scope.cancelJob = function() {
      scope.network.state = 'cancelling';
      Network.update({location_id: scope.locations.slug, id: scope.network.id, network: { cancel_sync: true }}).$promise.then(function(results) {
        scope.network.state     = undefined;
        scope.network.job_id    = undefined;
        $rootScope.banneralert  = undefined;
        $rootScope.error        = undefined;
      }, function(err) {
        scope.network.state     = 'failed';
        scope.network.job_id    = undefined;
        scope.network.errors    = err.base.message;
      });
    };

    scope.sync = function() {
      scope.network.state = 'syncing';
      var msg = 'This will cause a full re-sync of all your boxes, nothing bad will happen. Just sayin. \n\nYour users will be disconnected and the earth will stop spinning temporarily.\n\nBe safe, be seen.';
      if ( window.confirm(msg) ) {
        Network.update({location_id: $routeParams.location_id, id: scope.network.id, network: { sync: true }}).$promise.then(function(results) {
          scope.network.state     = undefined;
          scope.network.job_id    = results.job_id;
          displaySync();
        }, function(err) {
          scope.network.state     = 'failed';
          scope.network.job_id    = undefined;
          scope.network.errors    = err.base.message;
        });
      }
    };

    scope.update = function(form) {
      form.$setPristine();
      Network.update({location_id: scope.location.slug, id: scope.network.id, network: scope.network}).$promise.then(function(results) {
        showToast('Network successfully updated.');
      }, function(err) {
        showErrors(err);
      });
    };

    scope.secondHost = function() {
      scope.secondary_host = !scope.secondary_host;
    };

    var zones = function(network) {
      $mdDialog.show({
        templateUrl: 'components/networks/_zones.html',
        parent: angular.element(document.body),
        clickOutsideToClose: true,
        controller: zonesCtrl
      });
    };

    function zonesCtrl($scope) {
      $scope.view = function() {
        $mdDialog.cancel();
        window.location.href = '/#/locations/' + scope.location.slug + '/zones';
      };
      $scope.close = function() {
        $mdDialog.cancel();
      };
    }
    zonesCtrl.$inject = ['$scope'];

    scope.radtest = {};

    var radtest = function(network) {
      $mdDialog.show({
        templateUrl: 'components/networks/_radtest.html',
        clickOutsideToClose: true,
        parent: angular.element(document.body),
        controller: DialogController,
        locals: {
          radtest: scope.radtest
        }
      });
    };

    function DialogController($scope, radtest) {
      $scope.network = scope.network;
      $scope.radtest = radtest;

      $scope.close = function() {
        $mdDialog.cancel();
        scope.radtest = {};
      };

      $scope.test = function(form) {
        $scope.radtest.state = 'testing';
        form.$setPristine();
        var network = {
          radtest_username: radtest.username,
          radtest_password: radtest.password,
          radtest_host:     scope.network.radius_8021x_host_1,
          radtest_secret:   scope.network.radius_8021x_secret_1,
          radtest_port:     scope.network.radius_8021x_port_1 || 1812
        };
        runTest(network);
      };
    }
    DialogController.$inject = ['$scope', 'radtest'];

    var runTest = function(network) {
      return Network.radtest({id: scope.network.id, network: network}).$promise.then(function(results) {
        radiusNotifications();
      }, function(err) {
        $mdDialog.cancel();
        showErrors('There was a problem processing your request.');
        scope.radtest = {};
      });
    };

    var channel;
    var radiusNotifications = function() {
      if (typeof client !== 'undefined') {
        var pusher = $pusher(client);
        channel = pusher.subscribe($routeParams.network_id);
        channel.bind('radtest-complete', function(data) {
          scope.radtest.state = undefined;
          if (data.message.res === true) {
            scope.radtest.results = 'You authenticated successfully.';
          } else {
            scope.radtest.results = 'Your tests failed. Check your radius credentials and ensure you have added our IP ranges.';
          }
        });
      }
    };

    scope.toggle = function(section) {
      menu.toggleSelectSection(section);
    };

    scope.isOpen = function(section) {
      if (scope.network && scope.network.access_type === 'radius') {
        return true;
      } else {
        return menu.isSectionSelected(section);
      }
    };

    scope.disabled = function(network) {
      if (network) {
        if (network.make_part_of_lan === true) {
          return 'IP settings disabled because repeater mode is enabled.';
        } else if (network.network_radio_mode === 'sta') {
          return 'IP settings disabled because repeater mode is enabled.';
        } else if (network.captive_portal_enabled === true) {
          return 'IP settings disabled because splash page is activated.';
        } else if (network.content_filter !== 'Off') {
          return 'DNS settings disabled because content filtering is enabled.';
        } else {
          return 'Options may be unavailable when an incompatible feature is enabled.';
        }
      }
    };

    scope.back = function() {
      window.location.href = '/#/locations/' + scope.location.slug + '/networks';
    };

    $rootScope.$on('$routeChangeStart', function (event, next, current) {
      if (channel) {
        channel.unbind();
      }
    });

    init();
  };

  return {
    link: link,
    scope: {
      newRecord: '@',
      locationName: '@',
      loading: '='
    },
    templateUrl: 'components/locations/networks/_show.html'
  };

}]);