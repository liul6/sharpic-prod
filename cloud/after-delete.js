Parse.Cloud.afterDelete('Entry', function(request) {
    var query = new Parse.Query(Parse.Installation);
    query.equalTo('channels', 'A' + request.object.get('audit').id + request.object.get('location').id);
    Parse.Push.send({
        where: query,
        data: {
            objectId: request.object.id,
            delete: true
        }
    });
});

Parse.Cloud.afterDelete('Audit', function(request) {
    Parse.Object.destroyAll(request.object.get('sales'));

    var Entry = Parse.Object.extend('Entry');
    var entryQuery = new Parse.Query(Entry);
    entryQuery.equalTo('audit', request.object);
    entryQuery.limit(1000);
    entryQuery.find().then(function(entries) {
        Parse.Object.destroyAll(entries);
    });
    var Client = Parse.Object.extend('Client');
    var clientQuery = new Parse.Query(Client);
    clientQuery.include('audits');
    clientQuery.find().then(function(clients) {
        clients.forEach(function(client) {
            var audits = client.get('audits');
            audits.forEach(function(audit) {
                if (!audit) {
                    var index = audits.indexOf(audit);
                    audits.splice(index, 1);
                    client.set('audits', audits);
                    client.save();
                }
            });
        });
    });
});

Parse.Cloud.afterDelete('Recipe', function(request) {
    Parse.Object.destroyAll(request.object.get('recipeItems'));
});

Parse.Cloud.afterDelete('Client', function(request) {
    Parse.Object.destroyAll(request.object.get('locations'));
    Parse.Object.destroyAll(request.object.get('audits'));
    var Recipe = Parse.Object.extend('Recipe');
    var query = new Parse.Query(Recipe);
    query.equalTo('client', request.object);
    query.limit(1000);
    query.find().then(function(recipes) {
        Parse.Object.destroyAll(recipes);
    });
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', request.object.get('name'));
    query.first().then(function(role) {
        role.destroy();
    });
});

Parse.Cloud.afterDelete('RecipeItem', function(request) {
    var Recipe = Parse.Object.extend('Recipe');
    var query = new Parse.Query(Recipe);
    query.include('recipeItems');
    query.limit(1000);
    query.find().then(function(recipes) {
        recipes.forEach(function(recipe) {
            var items = recipe.get('recipeItems');
            if (items) {
                items.forEach(function (item) {
                    if (!item) {
                        var index = items.indexOf(item);
                        items.splice(index, 1);
                        recipe.set('recipeItems', items);
                        recipe.save();
                    }
                });
            }
        });
    });
});

Parse.Cloud.afterDelete('Location', function(request) {
    var Entry = Parse.Object.extend('Entry');
    var query = new Parse.Query(Entry);
    query.equalTo('location', request.object);
    query.limit(1000);
    query.find().then(function(entries) {
        return Parse.Object.destroyAll(entries);
    });
    var Client = Parse.Object.extend('Client');
    var clientQuery = new Parse.Query(Client);
    clientQuery.include('locations');
    clientQuery.find().then(function(clients) {
        clients.forEach(function(client) {
            var locations = client.get('locations');
            locations.forEach(function(location) {
                if (!location) {
                    var index = locations.indexOf(location);
                    locations.splice(index, 1);
                    client.set('locations', locations);
                    client.save();
                }
            });
        });
    });
});

Parse.Cloud.afterDelete('Product', function(request) {
    var Entry = Parse.Object.extend('Entry');
    var RecipeItem = Parse.Object.extend('RecipeItem');
    var entryQuery = new Parse.Query(Entry);
    entryQuery.limit(1000);
    entryQuery.equalTo('product', request.object);
    entryQuery.find().then(function(entries) {
        Parse.Object.destroyAll(entries);
    });
    var recipeItemQuery = new Parse.Query(RecipeItem);
    recipeItemQuery.equalTo('product', request.object);
    recipeItemQuery.limit(1000);
    recipeItemQuery.find().then(function(items) {
         Parse.Object.destroyAll(items);
    });
});