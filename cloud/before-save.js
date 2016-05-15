Parse.Cloud.beforeSave('Client', function(request, response) {
    if (!request.object.get('name')) {
        response.error('Name field is undefined.');
    } else {
        ['locations', 'modifiers', 'audits'].forEach(function(field) {
            if (!request.object.get(field)) {
                request.object.set(field, []);
            }
        });
        Parse.Cloud.useMasterKey();
        var query = new Parse.Query(Parse.Role);
        query.equalTo('name', request.object.get('name'));
        query.first().then(function(role) {
            if (!role) {
                query.equalTo('name', 'Administrator');
                return query.first();
            } else {
                var acl = new Parse.ACL();
                acl.setRoleReadAccess(request.object.get('name'), true);
                acl.setRoleWriteAccess('Administrator', true);
                request.object.get('locations').forEach(function (location) {
                    location.setACL(acl);
                });
                Parse.Object.saveAll(request.object.get('locations'));
                return null;
            }
        }).then(function(admin) {
            if (admin) {
                var roleACL = new Parse.ACL();
                roleACL.setRoleReadAccess('Administrator', true);
                roleACL.setRoleWriteAccess('Administrator', true);
                var role = new Parse.Role(request.object.get('name'), roleACL);
                role.getRoles().add(admin);
                return role.save();
            } else {
                return null;
            }
        }).then(function(role) {
            if (role) {
                var acl = new Parse.ACL();
                acl.setRoleReadAccess(role, true);
                acl.setRoleWriteAccess('Administrator', true);
                request.object.setACL(acl);
                if (request.object.get('locations')) {
                    request.object.get('locations').forEach(function (location) {
                        location.setACL(acl);
                    });
                }
            }
            response.success();
        });
    }
});

Parse.Cloud.beforeSave('Audit', function(request, response) {
//    if (!request.object.get('sales')) {
//        request.object.set('sales', []);

//		var Sale = Parse.Object.extend('Sale');
//		var saleQuery = new Parse.Query(Sale);
//		saleQuery.equalTo('audit', request.object);
//		saleQuery.limit(1000);
//		saleQuery.find().then(function(sales) {
//			Parse.Object.destroyAll(sales);
//		});
//	}	
	
    response.success();
});

Parse.Cloud.beforeSave('Entry', function(request, response) {
    if (!request.object.get('product')) {
        response.error('Product field is undefined.');
    } else if (!request.object.get('location')) {
        response.error('Location field is undefined.');
    } else {
        ['amount', 'weight', 'openBottles', 'incoming'].forEach(function(field) {
            if (!request.object.get(field) || request.object.get(field) < 0) {
                request.object.set(field, 0);
            }
        });
        if (!request.object.get('weights')) {
            request.object.set('weights', []);
        }
        var totalWeight = 0;
        var weights = request.object.get('weights').map(function(weight) {
            if (typeof weight === 'string') {
                weight = parseFloat(weight);
            }
            if (isNaN(weight)) {
                return 0;
            } else {
                totalWeight += weight;
                return parseFloat(weight.toFixed(2));
            }
        });
        request.object.set('weights', weights);
        request.object.set('weight', parseFloat(totalWeight.toFixed(2)));
        response.success();
    }
});

Parse.Cloud.beforeSave('Location', function(request, response) {
    if (!request.object.get('name')) {
        response.error('Name field is undefined.');
    } else {
        response.success();
    }
});

Parse.Cloud.beforeSave('Product', function(request, response) {
    if (!request.object.get('name')) {
        response.error('Name field is undefined.');
    } else if (!request.object.get('size')) {
        response.error('Size field is undefined.');
    } else {
        ['full', 'tare', 'cost'].forEach(function(field) {
            if (!request.object.get(field) || request.object.get(field) < 0) {
                request.object.set(field, 0);
            }
        });
        if (!request.object.get('case')) {
            request.object.set('case', 12);
        }
        if (!request.object.get('tags')) {
            request.object.set('tags', []);
        }
        var tags = [];
        for (var i = 0; i < request.object.get('tags').length; i++) {
            var tag = request.object.get('tags')[i];
            tags.push(tag.trim());
        }
        request.object.set('tags', tags);
        var lowerCase = request.object.get('name').toLowerCase();
        lowerCase += request.object.get('tags').join('').toLowerCase();
        request.object.set('searchName', lowerCase);
        if (!request.object.get('serving')) {
            var Serving = Parse.Object.extend('Serving');
            var query = new Parse.Query(Serving);
            query.equalTo('name', 'Ounce');
            query.first().then(function(serving) {
                request.object.set('serving', serving);
                response.success();
            });
        } else {
            response.success();
        }
    }
});

Parse.Cloud.beforeSave('Recipe', function(request, response) {
    if (request.object.get('recipeItems')) {
        Parse.Cloud.useMasterKey();
        request.object.get('client').fetch().then(function(client) {
            var acl = new Parse.ACL();
            acl.setRoleReadAccess(client.get('name'), true);
            acl.setRoleWriteAccess('Administrator', true);
            request.object.get('recipeItems').forEach(function (item) {
                item.setACL(acl);
            });
            return Parse.Object.saveAll(request.object.get('recipeItems'));
        }).then(function() {
            response.success();
        });
    } else {
        response.success();
    }
});

Parse.Cloud.beforeSave('RecipeItem', function(request, response) {
    if (!request.object.get('product')) {
        response.error('Product field is undefined.');
    } else {
        ['fulls', 'ounces'].forEach(function(field) {
            if (!request.object.get(field) || request.object.get(field) < 0) {
                request.object.set(field, 0);
            }
        });
        response.success();
    }
});

Parse.Cloud.beforeSave('Size', function(request, response) {
    if (!request.object.get('name')) {
        response.error('Name field is undefined.');
    } else {
        if (!request.object.get('ounces')) {
            request.object.set('ounces', 0);
        }
        response.success();
    }
});

Parse.Cloud.beforeSave('Modifier', function(request, response) {
    if (!request.object.get('name')) {
        response.error('Name field is undefined.');
    } else {
        response.success();
    }
});

Parse.Cloud.beforeSave('ModifierItem', function(request, response) {
    if (!request.object.get('modifier')) {
        response.error('Modifier is undefined.');
    } else if (!request.object.get('audit')) {
        response.error('Audit is undefined.');
    } else {
        response.success();
    }
});

Parse.Cloud.beforeSave('Category', function(request, response) {
    if (!request.object.get('name')) {
        response.error('Name is undefined.');
    } else {
        response.success();
    }
});
