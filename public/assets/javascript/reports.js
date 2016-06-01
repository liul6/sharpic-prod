(function(window) {

    var reports = function() {};

    var client = null,
        beforeAudit = null,
        nowAudit = null,
        location = null,
        clientSelect = null,
        beforeAuditSelect = null,
        nowAuditSelect = null,
        locationSelect = null,
        sales = null,
        currentSales = [],
        beforeEntries = null,
        beforeEntriesNext = null,
        nowEntries = null,
        nowEntriesNext = null,
        modifierItems = null,
        categories = null,
        $activity = $('#activity'),
        $usageReportTable = $('#usage-report-table'),
        $salesChart = $('#sales-chart'),
        $dateSelectsContainer = $('#date-selects-container'),
        $beforeAuditSelect = $('#report-before-date-select'),
        $nowAuditSelect = $('#report-now-date-select'),
        $locationSelect = $('#report-location-select'),
        $reportSelect = $('#report-select'),
        $downloadButton = $('#download-report'),
        $summaryModal = $('#summary-modal'),
        $summaryBefore = $('#summary-before'),
        $summaryNow = $('#summary-after'),
        $summaryIncoming = $('#summary-incoming'),
        $summarySales = $('#summary-sales'),
        $tagSelect = $('#tag-select'),
        $stockReportTable = $('#stock-report-table'),
        $stockInput = $('#stock-file-input'),
        Entry = Parse.Object.extend('Entry'),
        Sale = Parse.Object.extend('Sale');

    var Item = Backbone.Model.extend({
          defaults: function () {
              return {
                  className: 'Item',
                  beforeFulls: 0,
                  beforePartials: 0,
                  beforeWeight: 0,
                  nowFulls: 0,
                  nowPartials: 0,
                  nowWeight: 0,
                  incoming: 0,
                  salesOunces: 0,
                  salesFulls: 0,
                  salesTotal: 0,
                  salesTotalOunces: 0,
                  salesTotalFulls: 0,
                  currentSalesOunces: 0,
                  currentSalesFulls: 0,
                  modifiers: [],
                  modifierOunces: 0,
                  modifierFulls: 0,
                  costVariance: 0,
                  bins: {}
                }
            }
        }),
        ItemCollection = Backbone.Collection.extend({
            model: Item,
            comparator: function(item) {
                return item.get('product').get('name');
            }
        }),
        Tag = Backbone.Model.extend({
            initialize: function (options) {
                this.set('tag', options.tag);
            },
            defaults: function () {
              return {
                className: 'Tag',
                items: {},
                itemsArray: [],
                totalSales: 0,
                totalSalesOunces: 0,
                totalSalesFulls: 0,
                totalSalesCost: 0,
                totalFullsVariance: 0,
                totalOuncesVariance: 0,
                totalDepletedOunces: 0,
                totalDepletedFulls: 0,
                totalCost: 0,
                totalRetailVariance: 0,
                totalCostVariance: 0,
                incomingCost: 0,
                modifiers: {}
              }
          }
        }),
        LocationCollection = Parse.Collection.extend({
            model: Location
        }),
        Category = Parse.Object.extend('Category');

    var LocationSelect = Backbone.View.extend({
        tagName: 'select',
        className: 'selectpicker',
        render: function() {
            var template = _.template([
                '  <option value="">Entire Venue</option>',
                '  <% _(locations).each(function(location) { %>',
                '    <option value="<%= location.objectId %>"><%= location.name %></option>',
                '  <% }); %>'
            ].join("\n"));
            var html = template({ locations: this.collection.toJSON() });
            this.$el.html(html);
            return this;
        }
    });

    var clientSelectChange = function() {
        $locationSelect.hide();
        $('#s2id_tag-select').hide();
        $dateSelectsContainer.hide();
        $reportSelect.selectpicker('hide');
        $downloadButton.hide();
        hideAllReports();
        if (clientsCollection.length > 1) {
            client = clientsCollection.at(clientSelect.el.selectedIndex - 1);
        } else {
            client = clientsCollection.at(0);
        }
        if (client) {
            if (!beforeAuditSelect) {
                beforeAuditSelect = new AuditSelect({
                    collection: new AuditCollection(client.get('audits')),
                    template: _.template([
                        '  <% _(audits).each(function(audit) { %>',
                        '    <option value="<%= audit.objectId %>"><%= audit.date %></option>',
                        '  <% }); %>'
                    ].join("\n"))
                });
                $beforeAuditSelect.append(beforeAuditSelect.render().el);
                beforeAuditSelect.$el.selectpicker();
                beforeAuditSelect.el.onchange = auditSelectChange;
            } else {
                beforeAuditSelect.collection.reset(client.get('audits'));
                beforeAuditSelect.render();
                beforeAuditSelect.$el.selectpicker('refresh');
            }
            if (client.get('audits').length > 1) {
                beforeAuditSelect.$el.selectpicker('val', beforeAuditSelect.collection.at(1).id);
            }
            if (!nowAuditSelect) {
                nowAuditSelect = new AuditSelect({
                    collection: new AuditCollection(client.get('audits'))
                });
                $nowAuditSelect.append(nowAuditSelect.render().el);
                nowAuditSelect.$el.selectpicker();
                nowAuditSelect.el.onchange = auditSelectChange;
            } else {
                nowAuditSelect.collection.reset(client.get('audits'));
                nowAuditSelect.render();
                nowAuditSelect.$el.selectpicker('refresh');
            }
            $dateSelectsContainer.show();

            auditSelectChange();
        }
    };

    var auditSelectChange = function() {
        $locationSelect.hide();
        $('#s2id_tag-select').hide();
        beforeAudit = beforeAuditSelect.collection.at(beforeAuditSelect.el.selectedIndex);
        nowAudit = beforeAuditSelect.collection.at(nowAuditSelect.el.selectedIndex);
        $reportSelect.selectpicker('hide');
        $downloadButton.hide();
        hideAllReports();
        if (beforeAudit && nowAudit) {
            if (!locationSelect) {
                locationSelect = new LocationSelect({collection: new LocationCollection(client.get('locations'))});
                $locationSelect.append(locationSelect.render().el);
                locationSelect.$el.selectpicker();
                locationSelect.el.onchange = generateReport;
            } else {
                locationSelect.collection.reset(client.get('locations'));
                locationSelect.render();
                locationSelect.$el.selectpicker('refresh');
            }
            location = null;
            tag = null;

            $activity.activity();
            var salesQuery = new Parse.Query(Sale);
            var objectIds = [];
            
            if(nowAudit.get('sales')) {
                objectIds = nowAudit.get('sales').map(function(sale) { return sale.id; });
            }
            else if(!objectIds || objectIds.length<=0) {
                objectIds = nowAudit.get('saleIds')
            }
            
            salesQuery.containedIn('objectId', objectIds);
            salesQuery.include('recipe.recipeItems');
            salesQuery.limit('1000');
            var beforeEntriesQuery = new Parse.Query(Entry);
            beforeEntriesQuery.equalTo('audit', beforeAudit);
            beforeEntriesQuery.limit('1000');
            beforeEntriesQuery.include('location');
            beforeEntriesQuery.include('product.size');
            beforeEntriesQuery.include('product.serving');
            var beforeEntriesNextQuery = new Parse.Query(Entry);
            beforeEntriesNextQuery.equalTo('audit', beforeAudit);
            beforeEntriesNextQuery.skip('1000');
            beforeEntriesNextQuery.limit('1000');
            beforeEntriesNextQuery.include('location');
            beforeEntriesNextQuery.include('product.size');
            beforeEntriesNextQuery.include('product.serving');
            var nowEntriesQuery = new Parse.Query(Entry);
            nowEntriesQuery.equalTo('audit', nowAudit);
            nowEntriesQuery.include('product.size');
            nowEntriesQuery.include('product.serving');
            nowEntriesQuery.include('location');
            nowEntriesQuery.limit('1000');
            var nowEntriesNextQuery = new Parse.Query(Entry);
            nowEntriesNextQuery.equalTo('audit', nowAudit);
            nowEntriesNextQuery.include('product.size');
            nowEntriesNextQuery.include('product.serving');
            nowEntriesNextQuery.include('location');
            nowEntriesNextQuery.limit('1000');
            nowEntriesNextQuery.skip('1000');
            var ModifierItem = Parse.Object.extend('ModifierItem');
            var modifiersQuery = new Parse.Query(ModifierItem);
            modifiersQuery.equalTo('audit', nowAudit);
            modifiersQuery.include('product.size');
            modifiersQuery.include('modifier');

            sales = salesQuery.collection();
            beforeEntries = beforeEntriesQuery.collection();
            beforeEntriesNext = beforeEntriesNextQuery.collection();
            nowEntries = nowEntriesQuery.collection();
            nowEntriesNext = nowEntriesNextQuery.collection();
            modifierItems = modifiersQuery.collection();

            var test1 = [sales.fetch()];
            var test2 = [beforeEntries.fetch()];
            var test3 = [beforeEntriesNext.fetch()];
            var test4 = [nowEntries.fetch()];
            var test5 = [nowEntriesNext.fetch()];
            var test6 = [modifierItems.fetch()];
            
            Parse.Promise.when([sales.fetch(), beforeEntries.fetch(), beforeEntriesNext.fetch(), nowEntries.fetch(), nowEntriesNext.fetch(), modifierItems.fetch()]).then(generateReport);
        }
    };

    var allTag = new Tag({ tag: 'All' }),
        // These are all the items tags, including those by category children
        // Each tag points to an array of Tag objects
        itemsByTag = {},
        // These are the items tag that the user actually selected
        // Each tag points to a Tag object
        actualItemsByTag = {},
        // These are all the filter tags, including those that are category children
        allFilterTags,
        tags = {};

    var generateReport = function() {
        allTag = new Tag({ tag: 'All' }),
        itemsByTag = {},
        actualItemsByTag = {},
        tags = {};

        beforeEntries.add(beforeEntriesNext.models);
        beforeEntriesNext.models = [];
        nowEntries.add(nowEntriesNext.models);
        nowEntriesNext.models = [];

        if (locationSelect) {
            if (locationSelect.el.selectedIndex > 0) {
                location = locationSelect.collection.at(locationSelect.el.selectedIndex - 1);
            } else {
                location = null;
            }
        }

        var filterTags = $tagSelect.select2('val');
        if (Object.prototype.toString.call( filterTags ) !== '[object Array]') {
            filterTags = [];
            allFilterTags = [];
        } else {
            var categoryTags = [];
            var names = _.map(categories.models, function(model) {
                return model.get('name');
            });
            _.each(filterTags, function(tagString) {
                var tag = new Tag({tag: tagString});
                if (_.contains(names, tagString)) {
                    var category;
                    for (var i = 0; i < categories.models.length; i++) {
                        var model = categories.models[i];
                        if (model.get('name') == tagString) {
                            category = model;
                            break;
                        }
                    }
                    if (category) {
                        _.each(category.get('tags'), function (categoryTag) {
                            if (categoryTag == tagString) {
                                return;
                            }
                            if (itemsByTag[categoryTag]) {
                                itemsByTag[categoryTag].push(tag);
                            } else {
                                itemsByTag[categoryTag] = [tag];
                            }
                        });
                        categoryTags = _.union(categoryTags, category.get('tags'));
                    }
                }
                if (itemsByTag[tagString]) {
                    itemsByTag[tagString].push(tag);
                } else {
                    itemsByTag[tagString] = [tag];
                }
                actualItemsByTag[tagString] = tag;
            });
            allFilterTags = _.union(filterTags, categoryTags);
        }

        function addNowEntry(tags, entry) {
            _.each(tags, function (tag) {
                var item = tag.get('items')[entry.get('product').id];
                if (!item) {
                    item = new Item({
                        product: entry.get('product')
                    });
                    tag.get('itemsArray').push(item);
                    tag.get('items')[entry.get('product').id] = item;
                }
                item.set('nowFulls', item.get('nowFulls') + entry.get('amount'));
                item.set('nowPartials', item.get('nowPartials') + entry.get('weights').length);
                item.set('nowWeight', item.get('nowWeight') + entry.get('weight'));
                item.set('incoming', item.get('incoming') + entry.get('incoming'));
                if (entry.get('bin')) {
                    var bins = item.get('bins');
                    if (!bins[entry.get('bin')]) {
                        bins[entry.get('bin')] = 0;
                    }
                    bins[entry.get('bin')] += entry.get('amount');
                    item.set('bins', bins);
                }
            });
        }

        nowEntries.forEach(function(entry) {
            if (!entry.get('product')) {
                return;
            }
            if (location && entry.get('location').id != location.id) {
                return;
            }
            var found = allFilterTags.length == 0;
            entry.get('product').get('tags').forEach(function(aTag) {
                tags[aTag] = true;
                if (_.contains(allFilterTags, aTag)) {
                    found = true;
                    if (itemsByTag[aTag]) {
                        addNowEntry(itemsByTag[aTag], entry);
                    }
                }
            });
            if (found) {
                addNowEntry([allTag], entry);
            }
        });

        function addBeforeEntry(tags, entry) {
            _.each(tags, function (tag) {
                  var item = tag.get('items')[entry.get('product').id];
                  if (!item) {
                    item = new Item({
                        product: entry.get('product')
                    });
                    tag.get('itemsArray').push(item);
                    tag.get('items')[entry.get('product').id] = item;
                  }
                  item.set('beforeFulls', item.get('beforeFulls') + entry.get('amount'));
                  item.set('beforePartials', item.get('beforePartials') + entry.get('weights').length);
                  item.set('beforeWeight', item.get('beforeWeight') + entry.get('weight'));
            });
        }

        beforeEntries.forEach(function(entry) {
            if (!entry.get('product')) {
                return;
            }
            if (location && entry.get('location').id != location.id) {
                return;
            }
            var found = allFilterTags.length == 0;
            entry.get('product').get('tags').forEach(function(aTag) {
                tags[aTag] = true;
                if (_.contains(allFilterTags, aTag)) {
                    found = true;
                    addBeforeEntry(itemsByTag[aTag], entry);
                }
            });
            if (found) {
                addBeforeEntry([allTag], entry);
            }
        });

        filterTags.push('All');
        actualItemsByTag['All'] = allTag;
        _.each(filterTags, function (tagString) {

            var tag = actualItemsByTag[tagString];
            var items = tag.get('items');

            modifierItems.forEach(function(modifier) {
                if (modifier.get('product')) {
                    var item = items[modifier.get('product').id];
                    if (item) {
                        if (modifier.get('ounces')) {
                            item.set('modifierOunces', item.get('modifierOunces') + modifier.get('ounces'));
                        }
                        if (modifier.get('fulls')) {
                            item.set('modifierFulls', item.get('modifierFulls') + modifier.get('fulls'));
                        }
                        item.get('modifiers').push(modifier);
                    }
                }
            });

            sales.forEach(function(sale) {
                var recipeItems = sale.get('recipe').get('recipeItems'),
                    recipeOunces = null,
                    recipeFulls = null;

                if (recipeItems) {
                    recipeItems.forEach(function (recipeItem) {
                        if (!recipeItem) {
                            return;
                        }
                        var item = items[recipeItem.get('product').id];
                        if (item) {
                            item.set('salesOunces', item.get('salesOunces') + recipeItem.get('ounces') * sale.get('amount'));
                            item.set('salesFulls', item.get('salesFulls') + recipeItem.get('fulls') * sale.get('amount'));
                            if (!recipeOunces) {
                                recipeOunces = 0;
                                recipeFulls = 0;
                                recipeItems.forEach(function (recipeItem) {
                                    recipeOunces += recipeItem.get('ounces');
                                    recipeFulls += recipeItem.get('fulls');
                                });
                            }
                            // Assume recipe only has ounces and fulls
                            // Add to the total sales the amount times the price times the percentage of the recipe
                            if (recipeOunces > 0 && recipeOunces > recipeFulls) {
                                item.set('salesTotal', item.get('salesTotal') + sale.get('price') * sale.get('amount') * recipeItem.get('ounces') / recipeOunces);
                                item.set('salesTotalOunces', item.get('salesTotalOunces') + sale.get('price') * sale.get('amount') * recipeItem.get('ounces') / recipeOunces);
                                tag.set('totalSalesOunces', tag.get('totalSalesOunces') + sale.get('amount') * recipeItem.get('ounces'));
                            } else if (recipeFulls > 0) {
                                item.set('salesTotal', item.get('salesTotal') + sale.get('price') * sale.get('amount') * recipeItem.get('fulls') / recipeFulls);
                                item.set('salesTotalFulls', item.get('salesTotalFulls') + sale.get('price') * sale.get('amount') * recipeItem.get('fulls') / recipeFulls);
                                tag.set('totalSalesFulls', tag.get('totalSalesFulls') + sale.get('amount') * recipeItem.get('fulls'));
                            }
                        }
                    });
                }
            });

            currentSales.forEach(function(sale) {
                var recipeItems = sale.get('recipe').get('recipeItems');
                if (recipeItems) {
                    recipeItems.forEach(function (recipeItem) {
                        if (!recipeItem) {
                            return;
                        }
                        var item = items[recipeItem.get('product').id];
                        if (item) {
                            item.set('currentSalesOunces', item.get('currentSalesOunces') + recipeItem.get('ounces') * sale.get('amount'));
                            item.set('currentSalesFulls', item.get('currentSalesFulls') + recipeItem.get('fulls') * sale.get('amount'));
                        }
                    });
                }
            });

            var tableData = [];

            // Loop through each to calculate weights and sanitize input
            tag.get('itemsArray').forEach(function(item) {
                var product = item.get('product'),
                    serving = product.get('serving'),
                    ounces = product.get('size').get('ounces'),
                    caseAmount = product.get('case');

                tag.set('totalSales', Number(tag.get('totalSales')) + Number(item.get('salesTotal')));

                if (product.get('tare') == 0 && product.get('full') - ounces > 0) {
                    if (serving.get('name') == 'Pint') {
                        product.set('tare', product.get('full') - ounces);
                    } else {
                        product.set('tare', product.get('full') - ounces);
                    }
                    product.save();
                }

                item.set('beforeTotalWeight', item.get('beforeWeight') - item.get('product').get('tare') * item.get('beforePartials'));
                item.set('nowTotalWeight', item.get('nowWeight') - item.get('product').get('tare') * item.get('nowPartials'));

                if (serving.get('name') == 'Pint') {
                    item.set('beforeTotalWeight', item.get('beforeTotalWeight') * 16);
                    item.set('nowTotalWeight', item.get('nowTotalWeight') * 16);
                }

                if (serving.get('name') != 'Full') {
                    item.set('depleted', (item.get('beforeTotalWeight') + (item.get('beforeFulls') + item.get('incoming')) * ounces) - (item.get('nowTotalWeight') + item.get('nowFulls') * ounces));
                    tag.set('totalDepletedOunces', Number(tag.get('totalDepletedOunces')) + Number(item.get('depleted')));
                    var currentStock = (item.get('nowTotalWeight') + item.get('nowFulls') * ounces) - (item.get('currentSalesOunces') + item.get('currentSalesFulls') * ounces);
                    item.set('currentFulls', currentStock >= ounces ? Math.floor(currentStock / ounces) : 0);
                    item.set('currentTotalWeight', currentStock % ounces);
                    if (Math.abs(item.get('depleted')) < 0.05) {
                        item.set('depleted', 0);
                    }
                    item.set('sold', (item.get('salesOunces') + item.get('salesFulls') * ounces));
                    var ouncesVariance = item.get('sold') - item.get('depleted') + item.get('modifierFulls') * ounces + item.get('modifierOunces');
                    item.set('ouncesVariance', ouncesVariance);
                    if (ounces > 0 && ounces <= Math.abs(ouncesVariance)) {
                        function mod(n, m) {
                            return ((n % m) + m) % m;
                        }
                        item.set('ouncesVariance', (ouncesVariance < 0) ? -mod(ouncesVariance, ounces) : mod(ouncesVariance, ounces));
                        item.set('fullsVariance', (ouncesVariance < 0) ? Math.ceil(ouncesVariance / ounces) : Math.floor(ouncesVariance / ounces));
                    } else {
                        item.set('fullsVariance', 0);
                    }
                    tag.set('totalOuncesVariance', Number(tag.get('totalOuncesVariance')) + Number(ouncesVariance));
                    item.set('depletedCost', item.get('depleted') / ounces * item.get('product').get('cost'));
                } else {
                    item.set('depleted', item.get('beforeFulls') + item.get('incoming') - item.get('nowFulls'));
                    tag.set('totalDepletedFulls', Number(tag.get('totalDepletedFulls')) + Number(item.get('depleted')));
                    item.set('currentFulls', item.get('nowFulls') - item.get('currentSalesFulls'));
                    item.set('currentTotalWeight', 0);
                    item.set('sold', item.get('salesFulls'));
                    item.set('fullsVariance', item.get('sold') - item.get('depleted') + item.get('modifierFulls'));
                    tag.set('totalFullsVariance', Number(tag.get('totalFullsVariance')) + Number(item.get('fullsVariance')));
                    item.set('ouncesVariance', 0);
                    item.set('depletedCost', item.get('depleted') * item.get('product').get('cost'));
                }

                var fulls = item.get('nowFulls'),
                    totalWeight = item.get('nowTotalWeight'),
                    stock = fulls + (ounces > 0 ? totalWeight / ounces : 0),
                    variance = item.get('fullsVariance') + (ounces > 0 ? item.get('ouncesVariance') / ounces : 0),
                    totalSold = item.get('salesFulls') + (ounces > 0 ? item.get('salesOunces') / ounces : 0);
                if (product.get('cost')) {
                    tag.set('totalSalesCost', Number(tag.get('totalSalesCost')) + Number(totalSold * product.get('cost')));
                    item.set('stockCost', formatMoney(stock * product.get('cost')));
                    item.set('incomingCost', formatMoney(item.get('incoming') * product.get('cost')));
                    item.set('costVariance', variance * product.get('cost'));
                    tag.set('totalCostVariance', Number(tag.get('totalCostVariance')) + Number(item.get('costVariance')));
                    tag.set('totalCost', Number(tag.get('totalCost')) + stock * Number(product.get('cost')));
                    tag.set('incomingCost', Number(tag.get('incomingCost')) + Number(item.get('incoming')) * Number(product.get('cost')));
                }
                if (item.get('sold') > 0) {
                    var retailTotalFulls = item.get('salesFulls') > 0 ? item.get('salesTotalFulls') / item.get('salesFulls') * item.get('salesFulls') / item.get('sold') : 0;
                    var retailTotalOunces = item.get('salesOunces') > 0 ? item.get('salesTotalOunces') / item.get('salesOunces') * item.get('salesOunces') / item.get('sold') : 0;
                    item.set('retailVariance', (retailTotalFulls + retailTotalOunces) * (ounces > 0 && serving.get('name') != 'Full' ? ounces : 1) * variance);
                    item.set('percentageVariance', item.get('retailVariance') / item.get('salesTotal') * 100);
                } else {
                    item.set('retailVariance', 0);
                    item.set('percentageVariance', '-');
                }
                tag.set('totalRetailVariance', Number(tag.get('totalRetailVariance')) + Number(item.get('retailVariance')));

                [['beforeFulls', 'beforeCases'], ['incoming', 'incomingCases'], ['nowFulls', 'nowCases']].forEach(function(array) {
                    if (false && item.get(array[0]) >= caseAmount) {
                        item.set(array[1], Math.floor(item.get(array[0]) / caseAmount));
                        item.set(array[0], item.get(array[0]) % caseAmount);
                    } else {
                        item.set(array[1], 0);
                    }
                });

                ['beforePartials', 'beforeFulls', 'beforeCases', 'incoming', 'incomingCases', 'nowPartials', 'nowFulls', 'nowCases', 'fullsVariance', 'currentSalesFulls', 'currentFulls'].forEach(function(field) {
                    sanitize(field, 0);
                });

                sanitize('percentageVariance', 2);
                addSuffix('percentageVariance', '%');

                if (serving.get('name') == 'Full') {
                    ['beforeTotalWeight', 'nowTotalWeight', 'currentTotalWeight', 'depleted', 'sold', 'currentSalesOunces', 'ouncesVariance'].forEach(function(field) {
                        sanitize(field, 0);
                    });
                } else {
                    ['beforeTotalWeight', 'nowTotalWeight', 'currentTotalWeight', 'depleted', 'sold', 'currentSalesOunces', 'ouncesVariance'].forEach(function(field) {
                        sanitize(field, 2);
                    });
                }

                if (serving.get('name') == 'Pint') {
                    ['beforeTotalWeight', 'nowTotalWeight', 'currentTotalWeight', 'ouncesVariance', 'depleted', 'sold', 'currentSalesOunces'].forEach(function(field) { 
                        pintify(field); 
                    });
                }

                function addSuffix(field, suffix) {
                    if (item.get(field) != '-') {
                        item.set(field, item.get(field) + suffix);
                    }
                }

                function sanitize(field, precision) {
                    if (!item.get(field) || item.get(field) == 0 || isNaN(item.get(field))) {
                        item.set(field, '-');
                    } else {
                        item.set(field, Number(item.get(field)).toFixed(precision));
                    }
                }

                function pintify(field) {
                    if (item.get(field) != '-') {
                        item.set(field, (parseFloat(item.get(field)) / 20).toFixed(2));
                        addSuffix(field, '');
                    }
                }

                var rowData = [];
                rowData.push(item.get('product').get('name') + ' ' + item.get('product').get('size').get('name'));
                if ($reportSelect.val() == 'variance') {
                    rowData.push(item.get('beforeTotalWeight'));
                    rowData.push(item.get('beforeFulls'));
                    rowData.push(item.get('incoming'));
                    rowData.push(item.get('nowTotalWeight'));
                    rowData.push(item.get('nowFulls'));
                    rowData.push(item.get('depleted'));
                    rowData.push(item.get('sold'));
                    rowData.push(item.get('fullsVariance'));
                    rowData.push(item.get('ouncesVariance'));
                    rowData.push(formatMoney(item.get('costVariance')));
                    rowData.push(formatMoney(item.get('retailVariance')));
                    rowData.push(item.get('percentageVariance'));
                } else if ($reportSelect.val() == 'cost') {
                    rowData.push(item.get('nowTotalWeight'));
                    rowData.push(item.get('nowFulls'));
                    rowData.push(item.get('stockCost'));
                    rowData.push(item.get('incoming'));
                    rowData.push(item.get('incomingCost'));
                } else if ($reportSelect.val() == 'stock') {
                    rowData.push(item.get('nowTotalWeight'));
                    rowData.push(item.get('nowFulls'));
                    rowData.push(item.get('currentSalesOunces'));
                    rowData.push(item.get('currentSalesFulls'));
                    rowData.push(item.get('currentTotalWeight'));
                    rowData.push(item.get('currentFulls'));
                    var bins = _.pairs(item.get('bins'));
                    if (bins.length == 0) {
                        rowData.push('-');
                    }
                    _.each(bins, function(pair) {
                        rowData.push('Bin #' + pair[0] + ' - ' + pair[1]);
                    });
                }
                rowData.push(item);
                tableData.push(rowData);
            });

            tag.set('tableData', tableData);

            modifierItems.forEach(function(modifier) {
                if (!modifier.get('modifier')) return;
                var modifiers = tag.get('modifiers');
                var name = modifier.get('modifier').get('name');
                if (!modifiers[name]) {
                    modifiers[name] = 0;
                }
                if (modifier.get('product')) {
                    var item = items[modifier.get('product').id];
                    if (item) {
                        var ounces = item.get('product').get('size').get('ounces');
                        var retail = item.get('salesTotal') / item.get('sold');
                        if (!retail) {
                            retail = item.get('product').get('cost');
                            if (retail && ounces > 0 && modifier.get('ounces')) {
                                retail = retail / ounces;
                            }
                        }
                        if (!retail) {
                            retail = 0;
                        }
                        if (ounces > 0 && modifier.get('ounces')) {
                            modifiers[name] += modifier.get('ounces') * retail;
                            if (modifier.get('fulls')) {
                                modifiers[name] += modifier.get('fulls') * ounces * retail;
                            }
                        } else if (modifier.get('fulls')) {
                            modifiers[name] += modifier.get('fulls') * retail;
                        }
                    }
                }
                if (modifier.get('cost')) {
                    modifiers[name] += modifier.get('cost');
                    allTag.set('totalSales', allTag.get('totalSales') - modifier.get('cost'));
                }
            });
        });

        $downloadButton.unbind('click').click(function () {
            var tableData = allTag.get('tableData');
            var title;
            var newData = $.extend(true, [], tableData);
            newData.sort();
            _.each(newData, function(data) {
                data.pop();
            });
            if ($reportSelect.val() == 'variance') {
                title = client.get('name') + ' Variance Report ' + nowAudit.createdAt.toDateString() + '.csv';
                newData.unshift(['Product', 'Partials', 'Fulls', 'Fulls', 'Partials', 'Fulls', 'Depleted', 'Sold', 'Fulls', 'Ounces', 'Cost', 'Retail', 'Percentage']);
                newData.unshift(['', beforeAudit.createdAt.toDateString(), '', 'Incoming', nowAudit.createdAt.toDateString(), '', '', '', 'Variance', '', '', '', '']);
            } else if ($reportSelect.val() == 'cost') {
                title = client.get('name') + ' Cost Report ' + nowAudit.createdAt.toDateString() + '.csv';
                newData.unshift(['Product', 'Partials', 'Fulls', 'Cost', 'Fulls', 'Cost']);
                newData.push(['', '', '', formatMoney(allTag.get('totalCost')), '', formatMoney(allTag.get('incomingCost'))]);
                newData.unshift(['', 'Stock', '', '', 'Incoming', '']);
            } else if ($reportSelect.val() == 'stock') {
                title = client.get('name') + ' Stock Report ' + nowAudit.createdAt.toDateString() + '.csv';
                newData.unshift(['Product', 'Partials', 'Fulls', 'Ounces', 'Fulls', 'Partials', 'Fulls', 'Bins']);
                newData.unshift(['', nowAudit.createdAt.toDateString(), '', 'Sales', '', 'Current', '']);
            }
            var csv = Papa.unparse(newData);
            var a = document.createElement('a');
            a.download = title;
            a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csv);
            a.click();
        });

        hideAllReports();
        $downloadButton.show();

        if ($reportSelect.val() === 'variance') {
            var itemCollection = new ItemCollection(allTag.get('itemsArray'));
            itemCollection.comparator = function(item) {
                return item.get('retailVariance');
            };
            itemCollection.sort();
            itemCollection.reset(_.first(itemCollection.models, 10));
            $salesChart.show();
            AmCharts.makeChart("sales-chart", {
                "theme": "none",
                "type": "serial",
                "dataProvider": _.map(itemCollection.models, function(item) {
                    return {
                        name: item.get('product').get('name').trim().split(' ').join('\n') + '\n' + item.get('product').get('size').get('name'),
                        sales: -item.get('retailVariance').toFixed(2),
                        cost: -item.get('costVariance').toFixed(2)
                    }
                }),
                "valueAxes": [{
                    "stackType": "3d",
                    "unit": "$",
                    "position": "left",
                    "title": "Top 10 Variance by Retail",
                }],
                "startDuration": 1,
                "graphs": [
                    {
                        "balloonText": "[[category]]\nCost Variance:\n<b>$[[value]]</b>",
                        "fillAlphas": 0.9,
                        "lineAlpha": 0.2,
                        "title": "Cost",
                        "type": "column",
                        "valueField": "cost"
                    }, {
                    "balloonText": "[[category]]\nRetail Variance:\n<b>$[[value]]</b>",
                    "fillAlphas": 0.9,
                    "lineAlpha": 0.2,
                    "title": "Retail",
                    "lineColor": "#86b25f",
                    "type": "column",
                    "valueField": "sales"
                }],
                "plotAreaFillAlphas": 0.1,
                "depth3D": 60,
                "angle": 30,
                "categoryField": "name",
                "categoryAxis": {
                    "gridPosition": "start"
                },
                "exportConfig":{
                    "menuTop":"20px",
                    "menuRight":"20px",
                    "menuItems": [{
                    "icon": '/lib/3/images/export.png',
                    "format": 'png'
                    }]
                }
            });

            if (filterTags.length > 1) {
                _.each(filterTags, function (tagString) {
                    if (tagString == 'All') {
                        return;
                    }
                    if (actualItemsByTag[tagString].get('itemsArray').length > 0) {
                        $('#tables').append(new VarianceReport({
                            tag: actualItemsByTag[tagString],
                            nowAudit: nowAudit,
                            beforeAudit: beforeAudit
                        }).render().el);
                    }
                });
            } else {
                $('#tables').append(new VarianceReport({
                  tag: allTag,
                  nowAudit: nowAudit,
                  beforeAudit: beforeAudit
                }).render().el);
            }
        } else if ($reportSelect.val() === 'variance_by_tag') {
            $downloadButton.hide();
            $salesChart.hide();
            var tagsToReport = [];
            _.each(filterTags, function (tagString) {
                if (tagString != 'All' && actualItemsByTag[tagString].get('itemsArray').length > 0) {
                    tagsToReport.push(actualItemsByTag[tagString]);
                }
            });
            $('#tables').append(new VarianceByTagReport({
                tags: tagsToReport
            }).render().el);
        } else if ($reportSelect.val() === 'cost') {
            if (filterTags.length > 1) {
                _.each(filterTags, function (tagString) {
                    if (tagString == 'All') {
                        return;
                    }
                    if (actualItemsByTag[tagString].get('itemsArray').length > 0) {
                        $('#tables').append(new CostReport({
                            tag: actualItemsByTag[tagString]
                        }).render().el);
                    }
                });
            } else {
                $('#tables').append(new CostReport({
                  tag: allTag
                }).render().el);
            }
        } else if ($reportSelect.val() === 'stock') {
            $stockInput.show();
            $('#stock-now').text(nowAudit.createdAt.toDateString());
            $stockReportTable.DataTable().destroy();
            var table = $stockReportTable.DataTable({
                'data': allTag.get('tableData'),
                'pageLength': 100,
                'columns': [
                    {'title': 'Product', 'width': '250px', className: 'right-border'},
                    {'title': 'Partials', 'defaultContent': '-'},
                    {'title': 'Fulls', 'defaultContent': '-', className: 'right-border'},
                    {'title': 'Ounces', 'defaultContent': '-'},
                    {'title': 'Fulls', 'defaultContent': '-', className: 'right-border'},
                    {'title': 'Partials', 'defaultContent': '-'},
                    {'title': 'Fulls', 'defaultContent': '-'}
                ],
                columnDefs: [
                    {type: 'pints', targets: 3}
                ]
            });
            $('#stock-report-table_wrapper').show();
            $stockReportTable.show();
            $stockReportTable.unbind('click').on( 'click', 'td', function () {
                var product = _.last(allTag.get('tableData')[table.cell( this ).index().row]).get('product');
                presentModal(product, items[product.id]);
            });
        } else if ($reportSelect.val() == 'usage') {
            $downloadButton.hide();
            var data = _.pairs(allTag.get('modifiers'));
            for (var i = 0; i < data.length; i++) {
                var pair = data[i];
                for (var j = 0; j < modifierItems.length; j++) {
                    var item = modifierItems.models[j];
                    if (item.get('modifier') && item.get('modifier').get('name') == pair[0]) {
                        var itemPercentage = item.get('modifier').get('percentage');
                        data[i].push(itemPercentage ? itemPercentage : 0);
                        break;
                    }
                }
            }
            data.unshift(['Sales', allTag.get('totalSales'), 100]);
            data.push(['Unexplained Variance', -allTag.get('totalRetailVariance'), 2]);
            $salesChart.show();
            var chartData = _.map(data, function(data) {
                return {
                    title: data[0],
                    amount: data[1].toFixed(2)
                }
            });
            AmCharts.makeChart("sales-chart", {
                "type": "pie",
                "theme": "none",
                "dataProvider": chartData,
                "valueField": "amount",
                "titleField": "title",
                "balloonText": "[[title]]<br><span style='font-size:14px'><b>$[[value]]</b> ([[percents]]%)</span>",
                "outlineAlpha": 0.4,
                "depth3D": 20,
                "angle": 50,
                "colors": ["#86b25f", "#FF0F00", "#FF6600", "#FF9E01", "#FCD202", "#F8FF01", "#B0DE09", "#04D215", "#0D8ECF", "#0D52D1", "#2A0CD0", "#8A0CCF", "#CD0D74", "#754DEB", "#DDDDDD", "#999999", "#333333", "#000000", "#57032A", "#CA9726", "#990000", "#4B0C25"],
                "exportConfig": {
                    "menuTop":"0px",
                    "menuItems": [{
                        "icon": '/lib/3/images/export.png',
                        "format": 'png'
                    }]
                }
            });
            var total = _.reduce(data, function(memo, pair) {
                return memo + pair[1];
            }, 0);
            var tableData = _.map(data, function(pair) {
                var actualPercentage = (pair[1] / total).toFixed(2) * 100;
                return [pair[0], formatMoney(pair[1]), pair[2].toFixed(1) + '%', (isNaN(actualPercentage) ? '-' : actualPercentage.toFixed(1) + '%'), (isNaN(actualPercentage) || actualPercentage < pair[2]) ? 'BUDGET' : 'ALERT'];
            });
            $usageReportTable.DataTable().destroy();
            $usageReportTable.DataTable({
                data: tableData,
                ordering: false,
                searching: false,
                paging: false,
                info: false,
                'columns': [
                    {'title': 'Sales', defaultContent: '-'},
                    {'title': 'Value', 'defaultContent': '-'},
                    {'title': 'Budget %', 'defaultContent': '-'},
                    {'title': 'Actual %', 'defaultContent': '-'},
                    {'title': 'Status', 'defaultContent': '-'}
                ]
            });
            $('#retail-total').text(formatMoney(total));
            $usageReportTable.show();
            $('#usage-report-table_wrapper').show();
        } else if ($reportSelect.val() == 'sales') {
            $downloadButton.hide();
            var itemCollection = new ItemCollection(allTag.get('itemsArray'));
            itemCollection.comparator = function(item) {
                return item.get('salesTotal');
            };
            itemCollection.sort();
            itemCollection.reset(_.last(itemCollection.models, 10));
            $salesChart.show();

            AmCharts.makeChart("sales-chart", {
                "theme": "none",
                "type": "serial",
                "dataProvider": _.map(itemCollection.models, function(item) {
                    return {
                        name: item.get('product').get('name').trim().split(' ').join('\n') + '\n' + item.get('product').get('size').get('name'),
                        sales: item.get('salesTotal').toFixed(2),
                        cost: item.get('depletedCost').toFixed(2)
                    }
                }).reverse(),
                "valueAxes": [{
                    "stackType": "3d",
                    "unit": "$",
                    "position": "left",
                    "title": "Top 10 Sellers",
                }],
                "startDuration": 1,
                "graphs": [
                    {
                        "balloonText": "[[category]] Cost:\n<b>$[[value]]</b>",
                        "fillAlphas": 0.9,
                        "lineAlpha": 0.2,
                        "title": "Cost",
                        "type": "column",
                        "valueField": "cost"
                    }, {
                    "balloonText": "[[category]] Sales:\n<b>$[[value]]</b>",
                    "fillAlphas": 0.9,
                    "lineAlpha": 0.2,
                    "title": "Retail",
                    "lineColor": "#86b25f",
                    "type": "column",
                    "valueField": "sales"
                }],
                "plotAreaFillAlphas": 0.1,
                "depth3D": 60,
                "angle": 30,
                "categoryField": "name",
                "categoryAxis": {
                    "gridPosition": "start"
                },
                "exportConfig":{
                    "menuTop":"20px",
                    "menuRight":"20px",
                    "menuItems": [{
                    "icon": '/lib/3/images/export.png',
                    "format": 'png'
                    }]
                }
            });

            if (filterTags.length > 1) {
                _.each(filterTags, function (tagString) {
                    if (tagString == 'All') {
                        return;
                    }
                    if (actualItemsByTag[tagString].get('itemsArray').length > 0) {
                        $('#tables').append(new SalesReport({
                            tag: actualItemsByTag[tagString]
                        }).render().el);
                    }
                });
            } else {
                $('#tables').append(new SalesReport({
                  tag: allTag
                }).render().el);
            }
        }

        _.each(categories.models, function(category) {
            tags[category.get('name')] = true;
        });
        $tagSelect.select2({
            data: _.map(Object.keys(tags).sort(), function(tag) {
                return { id: tag, text: tag };
            }),
            placeholder: "Tags",
            multiple: true
        });
        $('#s2id_tag-select').show();
        $locationSelect.show();
        $reportSelect.selectpicker('show');

        $activity.activity(false);
    };

    function hideAllReports() {
        $('#tables .table').DataTable().destroy();
        $('#tables').empty();
        $('#stock-report-table_wrapper').hide();
        $('#usage-report-table_wrapper').hide();
        $stockInput.hide();
        $salesChart.hide();
    }

    $stockInput.find(':file').change(function() {
        var file = this.files[0];
        Papa.parse(file, {
            complete: function (results) {
                var validated = false;
                var type = "Valante";
                var values = results.data;
                var titles = ["PLU", "Menu Item", "Gross($) ", "#Voids", "Voids($)", "#Refunds", "Refunds($)", "Discounts($)", "Price Levels($)", "Options($)", "Quantity", "Net($)"];
                if (values[0].length == 12) {
                    validated = true;
                    for (var i = 0; i < 12; i++) {
                        if (values[0][i] != titles[i]) {
                            validated = false;
                            break;
                        }
                    }
                }
                if (!validated) {
                    titles = ["Menu Item", "Quantity", "Sales", "Cost", "Percentage"];
                    if (values[2].length == 5) {
                        validated = true;
                        for (var i = 0; i < 5; i++) {
                            if (values[2][i] != titles[i]) {
                                validated = false;
                                break;
                            }
                        }
                    }
                    if (validated) {
                        type = "TouchBistro";
                    }
                }
                if (!validated) {
                    titles = ["class_code", "desc_a", "code", "desc_b", "sum_qnty", "sum_price", "type"];
                    if (values[0].length == 7) {
                        validated = true;
                        for (var i = 0; i < 7; i++) {
                            if (values[0][i] != titles[i]) {
                                validated = false;
                                break;
                            }
                        }
                    }
                    if (validated) {
                        type = "SilverWare";
                    }
                }
                if (validated) {
                    var Recipe = Parse.Object.extend('Recipe');
                    var Sale = Parse.Object.extend('Sale');
                    var query = new Parse.Query(Recipe);
                    query.include('recipeItems.product');
                    query.equalTo('client', client);
                    query.limit('1000');
                    query.find().then(function (recipes) {
                        var sales = [];
                        for (var i = (type != "TouchBistro" ? 1 : 3); i < (type != "TouchBistro" ? values.length - 1 : values.length); i++) {
                            var recipe = null;
                            var name = "",
                                amount = 0,
                                gross = 0;
                            if (type == "Valante") {
                                name = values[i][1];
                                amount = parseInt(values[i][10]);
                                gross = parseFloat(values[i][2]);
                            } else if (type == "TouchBistro") {
                                name = values[i][0];
                                amount = parseInt(values[i][1]);
                                gross = parseFloat(values[i][2].replace(/[^0-9\.]+/g,""));
                            } else if (type == "SilverWare") {
                                name = values[i][3];
                                amount = values[i][4];
                                gross = values[i][5];
                            }
                            for (var j = 0; j < recipes.length; j++) {
                                var aRecipe = recipes[j];
                                if (aRecipe.get('name') == name) {
                                    recipe = aRecipe;
                                    break;
                                }
                            }
                            if (recipe && !recipe.get('ignore')) {
                                var amount = parseInt(values[i][10]);
                                if (amount) {
                                    var sale = new Sale({
                                        recipe: recipe,
                                        amount: amount,
                                        price: parseFloat((parseFloat(values[i][2]) / parseFloat(values[i][10])).toFixed(2))
                                    });
                                    sales.push(sale);
                                }
                            }
                        }
                        currentSales = sales;
                        generateReport();
                    });
                }
            }
        });
    });

    reports.prototype = {
        init: function() {
            if (!client) {
                $activity.activity();
                $reportSelect.selectpicker();
                $reportSelect.selectpicker('hide');
                $reportSelect.get(0).onchange = generateReport;
                categories = new Parse.Query(Category).collection();
                var queries = [categories.fetch()];
                var louisclients=[clientsCollection.fetch()];

                var louisClients = new Parse.Query(Client).collection();
                var louisQueries = [louisClients.fetch()];

                if (clientsCollection.length == 0) {
                    queries.push(clientsCollection.fetch());
                }
                Parse.Promise.when(queries).then(function () {
                    $activity.activity(false);
                    if (clientsCollection.length > 1) {
                        if (!clientSelect) {
                            clientSelect = new ClientSelect({id: 'report-client-select-picker'});
                            $('#report-client-select').append(clientSelect.render().el);
                            $('#report-client-select-picker').selectpicker();
                        }
                        clientSelect.el.onchange = clientSelectChange;
                    } else {
                        $('.page-header').text(clientsCollection.at(0).get('name'));
                        clientSelectChange();
                    }
                });
                $tagSelect.on('change', function(e) {
                    setTimeout(generateReport, 1);
                });
            }
        }
    };

    $.extend( $.fn.dataTableExt.oSort, {
        "pints-pre": function ( a ) {
            var val = a;
            if (val.substr(val.length - 4) === ' pts') {
                val = val.substr(0, val.length - 4);
            } else if (val === '-') {
                val = '0';
            }
            return parseFloat(val);
        },

        "pints-asc": function ( a, b ) {
            return ((a < b) ? -1 : ((a > b) ? 1 : 0));
        },

        "pints-desc": function ( a, b ) {
            return ((a < b) ? 1 : ((a > b) ? -1 : 0));
        }
    } );

    reports.prototype.presentModal = function (product) {
      var item = allTag.get('items')[product.id];
        var UnorderedList = Backbone.View.extend({
            initialize: function(options) {
                this.list = options.list;
            },
            template: _.template([
                '  <% _(items).each(function(item) { %>',
                '    <li class="list-group-item"><%= item %></li>',
                '  <% }); %>'
            ].join("\n")),
            render: function() {
                var html = this.template({ items: this.list });
                this.$el.html(html);
                return this;
            }
        });

        $summaryModal.find('.modal-title').text(product.get('name') + ' ' + product.get('size').get('name') + ' - Cost: ' + formatMoney(item.get('depletedCost')) + ', Retail: ' + formatMoney(item.get('salesTotal')) + ', Variance: ' + formatMoney(item.get('retailVariance')));
        var before = [],
            beforeBins = {},
            now = [],
            nowBins = {},
            itemIncoming = [],
            itemSales = [];
        beforeEntries.forEach(function(entry) {
            if (entry.get('product').id == product.id) {
                var location = entry.get('location').get('name'),
                    subitems = [],
                    fulls = entry.get('amount');
                if (fulls > 1) {
                    subitems.push(fulls + ' fulls');
                } else if (fulls == 1) {
                    subitems.push('1 full');
                }
                _.each(entry.get('weights'), function(weight) {
                    if (product.get('serving').get('name') == 'Pint') {
                        subitems.push(weight.toFixed(2) + ' lbs');
                    } else {
                        subitems.push(weight.toFixed(2) + ' oz');
                    }
                });
                before.push(location + ' - ' + subitems.join(', '));
                if (entry.get('bin')) {
                    var bins = beforeBins;
                    if (!bins[entry.get('bin')]) {
                        bins[entry.get('bin')] = 0;
                    }
                    bins[entry.get('bin')] += entry.get('amount');
                }
            }
        });
        _.each(_.pairs(beforeBins), function(pair) {
            before.push('Bin # ' + pair[0] + ' - ' + pair[1]);
        });
        nowEntries.forEach(function(entry) {
            if (entry.get('product').id == product.id) {
                var location = entry.get('location').get('name'),
                    subitems = [],
                    fulls = entry.get('amount'),
                    incoming = entry.get('incoming');
                if (fulls > 1) {
                    subitems.push(fulls + ' fulls');
                } else if (fulls == 1) {
                    subitems.push('1 full');
                }
                _.each(entry.get('weights'), function(weight) {
                    if (product.get('serving').get('name') == 'Pint') {
                        subitems.push(weight.toFixed(2) + ' lbs');
                    } else {
                        subitems.push(weight.toFixed(2) + ' oz');
                    }
                });
                if (incoming > 0) {
                    itemIncoming.push(location + ' - ' + incoming);
                }
                now.push(location + ' - ' + subitems.join(', '));
                if (entry.get('bin')) {
                    var bins = nowBins;
                    if (!bins[entry.get('bin')]) {
                        bins[entry.get('bin')] = 0;
                    }
                    bins[entry.get('bin')] += entry.get('amount');
                }
            }
        });
        item.get('modifiers').forEach(function(modifier) {
            if (!modifier.get('modifier')) return;
            var name = modifier.get('modifier').get('name');
            var ounces = product.get('size').get('ounces');
            var retail = item.get('salesTotal') / item.get('sold');
            if (!retail) {
                retail = item.get('product').get('cost');
                if (retail && ounces > 0 && modifier.get('ounces')) {
                    retail = retail / ounces;
                }
            }
            if (!retail) {
                retail = 0;
            }
            var total = 0;
            if (ounces > 0 && modifier.get('ounces')) {
                total += modifier.get('ounces') * retail;
                if (modifier.get('fulls')) {
                    total += modifier.get('fulls') * ounces * retail;
                }
            } else if (modifier.get('fulls')) {
                total += modifier.get('fulls') * retail;
            }
            itemSales.push(name + ' - ' + formatMoney(total));

        });
        _.each(_.pairs(nowBins), function(pair) {
            now.push('Bin # ' + pair[0] + ' - ' + pair[1]);
        });
        sales.forEach(function(sale) {
            var recipeItems = sale.get('recipe').get('recipeItems'),
                recipeOunces = null,
                recipeFulls = null;

            if (recipeItems) {
                recipeItems.forEach(function (recipeItem) {
                    if (!recipeItem) {
                        return;
                    }
                    if (recipeItem.get('product').id == product.id) {
                        if (!recipeOunces) {
                            recipeOunces = 0;
                            recipeFulls = 0;
                            recipeItems.forEach(function (recipeItem) {
                                recipeOunces += recipeItem.get('ounces');
                                recipeFulls += recipeItem.get('fulls');
                            });
                        }
                        // Assume recipe only has ounces and sales
                        if (recipeOunces > 0 && recipeOunces > recipeFulls) {
                            itemSales.push(sale.get('amount') + ' ' + sale.get('recipe').get('name') + ' - ' + formatMoney(sale.get('price') * sale.get('amount') * recipeItem.get('ounces') / recipeOunces));
                        } else if (recipeFulls > 0) {
                            itemSales.push(sale.get('amount') + ' ' + sale.get('recipe').get('name') + ' - ' + formatMoney(sale.get('price') * sale.get('amount') * recipeItem.get('fulls') / recipeFulls));
                        }
                    }
                });
            }
        });
        var summaryBefore = new UnorderedList({
            list: before
        });
        $summaryBefore.html(summaryBefore.render().el);
        var summaryNow = new UnorderedList({
            list: now
        });
        $summaryNow.html(summaryNow.render().el);
        var summaryIncoming = new UnorderedList({
            list: itemIncoming
        });
        $summaryIncoming.html(summaryIncoming.render().el);
        var summarySales = new UnorderedList({
            list: itemSales
        });
        $summarySales.html(summarySales.render().el);
        $summaryModal.modal('show');
    }

    window.formatMoney = function (amount) {
        if (!amount || amount == 0 || amount == '-') {
            return '-';
        }
        var isNegative = false;
        if (amount < 0) {
            isNegative = true;
            amount = Math.abs(amount);
        }
        var DecimalSeparator = Number("1.2").toLocaleString().substr(1,1);

        var AmountWithCommas = amount.toLocaleString();
        var arParts = String(AmountWithCommas).split(DecimalSeparator);
        var intPart = arParts[0];
        var decPart = (arParts.length > 1 ? arParts[1] : '');
        decPart = (decPart + '00').substr(0,2);

        return (isNegative ? '(' : '') + '$' + intPart + DecimalSeparator + decPart + (isNegative ? ')' : '');
    }

    window.reports = new reports;

})(window);
