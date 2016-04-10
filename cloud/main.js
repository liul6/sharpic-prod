require('./app.js');
//require('./jobs.js');
require('./before-save.js');
require('./after-save.js');
require('./after-delete.js');

Parse.Cloud.define('saveUser', function(request, response) {
    if (!request.params.user) {
        response.error('Unsaved user');
        return;
    }
    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Administrator');
    query.first().then(function (adminRole) {
        return adminRole.relation('users').query().get(request.params.user);
    }, function (error) {
        response.error(error.message);
    }).then(function (user) {
        response.error('Cannot save an administrator');
    }, function (error) {
        query = new Parse.Query(Parse.User);
        query.get(request.params.user).then(function (user) {
            user.set('roles', request.params.roles);
            user.setUsername(request.params.username);
            Parse.Cloud.useMasterKey();
            return user.save();
        }).then(function () {
            response.success();
        }, function (error) {
            response.error(error.message);
        });
    });
});

Parse.Cloud.define('deleteUser', function(request, response) {
    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Administrator');
    query.first().then(function (adminRole) {
        return query.get(request.params.user);
    }, function (error) {
        response.error(error.message);
    }).then(function (user) {
        response.error('Cannot delete an administrator');
    }, function (error) {
        query = new Parse.Query(Parse.User);
        query.get(request.params.user).then(function (user) {
            Parse.Cloud.useMasterKey();
            return user.destroy();
        }).then(function () {
            response.success();
        }, function (error) {
            response.error(error.message);
        });
    });
});