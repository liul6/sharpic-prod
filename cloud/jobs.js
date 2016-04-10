Parse.Cloud.job("saveProducts", function(request, status) {
    Parse.Cloud.useMasterKey();
    var counter = 0;
    var Product = Parse.Object.extend('Product');
    var query = new Parse.Query(Product);
    query.each(function(product) {
        // Update to plan value passed in
        var tags = [];
        for (var i = 0; i < product.get('tags').length; i++) {
            var tag = product.get('tags')[i];
            tags.push(tag.trim());
        }
        product.set('tags', tags);
        if (counter % 100 === 0) {
            // Set the  job's progress status
            status.message(counter + " products processed.");
        }
        counter += 1;
        return product.save();
    }).then(function() {
        // Set the job's success status
        status.success("Migration completed successfully.");
    }, function(error) {
        // Set the job's error status
        status.error("Uh oh, something went wrong.");
    });
});

Parse.Cloud.job("updateEntries", function(request, status) {
    Parse.Cloud.useMasterKey();
    var counter = 0,
        locations = {};
    var Entry = Parse.Object.extend('Entry');
    var Client = Parse.Object.extend('Client');
    var query = new Parse.Query(Client);
    query.find({ success: function(clients) {
        var entryQuery = new Parse.Query(Entry);
        entryQuery.include('product');
        entryQuery.each(function(entry) {
            var product = entry.get('product');
            if (!product) {
                return null;
            }
            if (!product.get('clientSearchString')) {
                product.set('clientSearchString', '');
            }
            var client = locations[entry.get('location').id];
            if (!client) {
                for (var i = 0; i < clients.length; i++) {
                    if (client) {
                        break;
                    }
                    var tempClient = clients[i];
                    for (var j = 0; j < tempClient.get('locations').length; j++) {
                        var location = tempClient.get('locations')[j];
                        if (location.id == entry.get('location').id) {
                            locations[location.id] = tempClient;
                            client = tempClient;
                            break;
                        }
                    }
                }
            }
            if (!client) {
                return null;
            }
            var dirty = false;
            if (product.get('clientSearchString').indexOf(client.get('name').toLowerCase()) == -1) {
                dirty = true;
                product.set('clientSearchString', product.get('clientSearchString') + client.get('name').toLowerCase());
            }
            if (counter % 100 === 0) {
                // Set the  job's progress status
                status.message(counter + " entries processed.");
            }
            counter += 1;
            if (dirty) {
                return product.save();
            } else {
                return null;
            }
        }).then(function() {
            // Set the job's success status
            status.success("Migration completed successfully.");
        }, function(error) {
            // Set the job's error status
            status.error(error.message);
        });
    }
    });
});

Parse.Cloud.job("updateAudit", function(request, status) {
    Parse.Cloud.useMasterKey();
    var Audit = Parse.Object.extend('Audit');
    var Entry = Parse.Object.extend('Entry');
    var query = new Parse.Query(Entry);
    var auditQuery = new Parse.Query(Audit);
    var audit;
    auditQuery.get('P6LofsaHlW').then(function(theAudit) {
        audit = theAudit;
        return auditQuery.get('hdBX6kqLFZ');
    }).then(function(oldAudit) {
        query.equalTo('audit', oldAudit);
        return query.find();
    }).then(function(entries) {
        var toSave = [];
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            entry.set('audit', audit);
            console.log('Set entry');
            toSave.push(entry);
        }
        console.log('Saving');
        return Parse.Object.saveAll(toSave);
    }).then(function() {
        // Set the job's success status
        status.success("Entries saved");
    }, function(error) {
        // Set the job's error status
        status.error(error.message);
    });
});
