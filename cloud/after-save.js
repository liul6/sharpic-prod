Parse.Cloud.afterSave('Entry', function(request) {
    var query = new Parse.Query(Parse.Installation);
    query.notEqualTo('installationId', request.object.get('installationId'));
    query.equalTo('channels', 'A' + request.object.get('audit').id + request.object.get('location').id);
    Parse.Push.send({
        where: query,
        data: {
            objectId: request.object.id
        }
    });
    if (request.object.get('modifiers')) {
        var Modifier = Parse.Object.extend('Modifier');
        request.object.get('modifiers').forEach(function(mod) {
            var modifier = new Modifier();
            modifier.set('name', mod.name);
            modifier.save();
        });
    }
    var Client = Parse.Object.extend('Client');
    query = new Parse.Query(Client);
    query.find().then(function(clients) {
        var entry = request.object;
        var product = entry.get('product');
        product.fetch().then(function() {
            if (!product.get('clientSearchString')) {
                product.set('clientSearchString', '');
            }
            for (var i = 0; i < clients.length; i++) {
                var client = clients[i];
                for (var j = 0; j < client.get('locations').length; j++) {
                    var location = client.get('locations')[j];
                    if (location.id == entry.get('location').id) {
                        if (product.get('clientSearchString').indexOf(client.get('name').toLowerCase()) == -1) {
                            product.set('clientSearchString', product.get('clientSearchString') + client.get('name').toLowerCase());
                            product.save();
                            return;
                        }
                    }
                }
            }
        });
    });
});

Parse.Cloud.afterSave('Product', function(request) {
    var query = new Parse.Query(Parse.Installation);
    query.equalTo('deviceType', 'ios');
    Parse.Push.send({
        where: query,
        data: {
            productId: request.object.id
        }
    });
});

Parse.Cloud.afterSave('Sale', function(request) {
    var sale = request.object;
    var audit = sale.get('audit');

//	if(sale){
//		if(audit){
//			audit.add('sales', sale);
//			audit.save();
//		}
//	}
	
//	sale.unset('audit');
//	sale.save();
});
