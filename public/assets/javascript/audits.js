(function(window) {

    var collection = null,
        grid = null,
        clientSelect = null,
        auditSelect = null,
        locationSelect = null,
        client = null,
        audit = null,
        location = null,
        newRecipes = null,
	recipesWithoutRecipeItems = null,
        $activity = $('#activity'),
        $auditSelect = $('#audit-date-select'),
        $auditsTable = $('#audits-table'),
        $addAudit = $('#add-audit'),
        $deleteAudit = $('#delete-audit'),
        $locationSelect = $('#audit-location-select'),
        $addEntry = $('#add-entry'),
        $fileInput = $('#audits-file-input'),
        $successAlert = $('#audits-success'),
        $errorAlert = $('#audits-error'),
        $auditNotes = $('#audit-notes'),
        $modifiers = $('#add-modifiers'),
        Entry = Parse.Object.extend({
            className: 'Entry',
            initialize: function() {
                this.on('change', function() {
                    this.save().then(function () {
                        $.growl({
                            message: 'Entry saved'
                        },{
                            type: 'success',
                            allow_dismiss: false,
                            delay: 2000
                        });
                    }, function (error) {
                        $.growl({
                            message: error.message
                        },{
                            type: 'danger',
                            allow_dismiss: false,
                            delay: 2000
                        });
                    });
                }, this);
            }
        }),
        Location = Parse.Object.extend('Location'),
        LocationCollection = Parse.Collection.extend({ model: Location });

    var WeightsCell = Backgrid.Cell.extend({
        formatter: {
            fromRaw: function(array) {
                if (array) {
                    array = _.map(_.filter(array, function(number) {
                        return number;
                    }), function (number) {
                        if (typeof number === 'string') {
                            number = parseFloat(number);
                        }
                        return number.toFixed(2);
                    });
                    return array.join(", ");
                } else {
                    return "";
                }
            }, toRaw: function(string) {
                return string.split(',').map(function(number) { return parseFloat(number).toFixed(2); });
            }
        }
    });

    var ModifierSelect2CellEditor = Backgrid.Extension.Select2CellEditor.extend({
        tagName: "input",
        attributes: {
            type: 'hidden'
        },
        render: function () {
            this.$el.select2(this.select2Options);
            return this;
        },
        initialize: function () {
            Backgrid.SelectCellEditor.prototype.initialize.apply(this, arguments);
            if (this.model.get('name')) {
                this.$el.attr('id', this.model.get('name'));
            }
        },
        postRender: function () {
            var self = this;
            if (self.multiple) self.$el.select2("container").keydown(self.close);
            else if (self.$el.data("select2")) self.$el.data("select2").focusser.keydown(self.close);

            self.$el.on("select2-blur", function (e) {
                if (!self.multiple) {
                    e.type = "blur";
                    self.close(e);
                }
                else {
                    // HACK to get around https://github.com/ivaynberg/select2/issues/2011
                    // select2-blur is triggered from blur and is fired repeatibly under
                    // multiple select. Since blue is fired before everything, but focus
                    // is set in focus and click, we need to wait for a while so other
                    // event handlers may have a chance to run.
                    var id = root.setTimeout(function () {
                        root.clearTimeout(id);
                        if (!self.$el.select2("isFocused")) {
                            e.type = "blur";
                            self.close(e);
                        }
                    }, 200);
                }
            }).select2("focus");
        },
        save: function (e) {
            var model = this.model;
            var column = this.column;
            var val = this.$el.val();
            if (val) {
                model.set('name', val);
            }
        }
    });

    var ModifierSelect2Cell = Backgrid.Extension.Select2Cell.extend({
        optionValues: function() {
            return [];
        },
        formatter: {
            fromRaw: function(modifier) {
                return product ? [modifier.get('name')] : [];
            },
            toRaw: function(id) {
                return id;
            }
        },
        render: function () {
            this.$el.empty();
            var model = this.model;
            if (model.get('name')) {
                this.$el.append(model.get('name'));
            }
            this.delegateEvents();
            return this;
        },
        select2Options: {
            initSelection : function (element, callback) {
                callback({id: element.context.id, text: element.context.id});
            },
            minimumInputLength: 1,
            query: function (query) {
                var modifierQuery = new Parse.Query(Parse.Object.extend('Modifier'));
                modifierQuery.limit('10');
                modifierQuery.contains('name', query.term);
                modifierQuery.find().then(function(modifiers) {
                    var results = _.map(modifiers, function (modifier) {
                        return {id: modifier.get('name'), text: modifier.get('name')};
                    });
                    results.unshift({id: query.term, text: query.term});
                    query.callback({results: results});
                });
            }
        },
        editor: ModifierSelect2CellEditor
    });

    var ModifiersCellEditor = Backgrid.Extension.ArrayObjectCellEditor.extend({
        postRender: function () {
            var view = this,
                model = this.model,
                column = this.column,
                gridOptions = this.gridOptions;

            // Extract the object, and create a Backbone model from it.
            var array = _.map(model.get(column.get("name")), function(object) {return _.clone(object);}),
                objectCollection = this.objectCollection = new Backbone.Collection(array);

            // Create our Bootstrap modal dialog
            var $dialog = this.createDialog();

            // Add the Backgrid Grid
            var grid = new this.backgrid(_.extend({collection: objectCollection}, gridOptions)),
                $grid = grid.render().$el;
            $dialog.find('div.modal-body').append($grid);

            $dialog.find('.btn-success').click(function() {
                objectCollection.add(new Backbone.Model(), {
                    at: 0
                });
            });

            return this;
        },
        save: function() {
            var model = this.model,
                column = this.column,
                objectCollection = this.objectCollection;

            model.set(column.get("name"), objectCollection.toJSON());
            model.trigger("backgrid:edited", model, column, new Backgrid.Command({keyCode:13}));

            $('body').removeClass('modal-open');

            return this;
        }
    });

    var ModifierDeleteCell = DeleteCell.extend({
        deleteRow: function (e) {
            e.preventDefault();
            var model = this.model;
            var $alert = $('#delete-alert');
            $alert.find('strong').text(model.get('name'));
            $alert.show().find('.btn-danger').unbind('click').click(function () {
                model.collection.remove(model);
                $alert.hide();
            });
            $alert.find('.btn-default').click(function () {
                $alert.hide();
            });
        }
    });

    var ModifiersCell = Backgrid.Extension.ArrayObjectCell.extend({
        formatter: {
            fromRaw: function(array) {
                var filteredArray = _.filter(array, function(object) { return object != null;});
                return _.map(filteredArray, function(object) {
                    if (object.name) {
                        var fulls = object.fulls ? ' ' + object.fulls + ' fulls' : '';
                        var ounces = object.ounces ? ' ' + object.ounces + ' ounces' : '';
                        return object.name + fulls + ounces;
                    } else {
                        return "";
                    }
                }).join(", ");
            }
        },
        gridOptions: {
            className: "backgrid table-bordered",
            columns: [
                {name: "name", label: "Name", cell: ModifierSelect2Cell},
                {name: "ounces", label: "Ounces", cell: "number"},
                {name: "fulls", label: "Fulls", cell: "integer"},
                {name: "id", label: "", cell: ModifierDeleteCell, editable: false, sortable: false}
            ]
        },
        editor: ModifiersCellEditor
    });

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

    var columns = [{
        name: "product",
        label: "Product",
        cell: ProductSelect2Cell,
        sortValue: function(model, sortKey) {
            return model.get(sortKey).get('name');
        }
    }, {
        name: "weights",
        label: "Partials",
        cell: WeightsCell,
        sortable: false
    }, {
        name: "amount",
        label: "Fulls",
        cell: "integer"
    }, {
        name: "incoming",
        label: "Incoming",
        cell: "integer"
    }, {
        name: "bin",
        label: "Bin #",
        cell: "string"
    }, {
        name: "location",
        label: "Location",
        cell: Backgrid.Cell.extend({
            formatter: {
                fromRaw: function (obj) {
                    return obj.get('name');
                }
            }
        }),
        sortValue: function(model, sortKey) {
            return model.get(sortKey).get('name');
        }
    }, {
        label: "",
        sortable: false,
        editable: false,
        cell: DeleteCell
    }];

    var audits = function() {};

    var clientSelectChange = function() {
        hideAll();
        audit = null;
        client = clientsCollection.at(clientSelect.el.selectedIndex - 1);
        if (client) {
            $addAudit.show();
            if (!auditSelect) {
                auditSelect = new AuditSelect({ collection: new AuditCollection(client.get('audits'))});
                $auditSelect.append(auditSelect.render().el);
                auditSelect.$el.selectpicker();
            } else {
                auditSelect.collection.reset(client.get('audits'));
                auditSelect.render();
                auditSelect.$el.selectpicker('refresh');
            }
            $auditSelect.show();
            auditSelect.el.onchange = auditSelectChange;
        }
        auditSelectChange();
    };

    var auditSelectChange = function() {
        hideAll();
        $auditSelect.show();
        $addAudit.show();
        audit = auditSelect.collection.at(auditSelect.el.selectedIndex);
        if (audit) {
            $deleteAudit.show();
            $locationSelect.show();
            $fileInput.show();
            if (!locationSelect) {
                locationSelect = new LocationSelect({ collection: new LocationCollection(client.get('locations'))});
                $locationSelect.append(locationSelect.render().el);
                locationSelect.$el.selectpicker();
            } else {
                locationSelect.collection.reset(client.get('locations'));
                locationSelect.render();
                locationSelect.$el.selectpicker('refresh');
            }
            locationSelect.el.onchange = locationSelectChange;
            locationSelectChange();
            if (audit.get('notes')) {
                $auditNotes.find('span').text(audit.get('notes'));
                $auditNotes.show();
            }
            $modifiers.show();
        }
    };

    var locationSelectChange = function() {
        $addEntry.hide();
        $auditsTable.hide();
        location = locationSelect.collection.at(locationSelect.el.selectedIndex - 1);
        $activity.activity();
        var query = new Parse.Query(Entry);
        query.equalTo('audit', audit);
        if (location) {
            query.equalTo('location', location);
        }
        query.include('product.size');
        query.include('location');
        query.limit(1000);
        if (!collection) {
            collection = query.collection();
        } else {
            collection.query = query;
        }
        collection.comparator = function (entry) {
            if (entry.get('product')) {
                return entry.get('product').get('name');
            } else {
                return "zzz";
            }
        };
        collection.fetch().then(function () {
            if (!grid) {
                grid = new Backgrid.Grid({
                    columns: columns,
                    collection: collection,
                    className: "backgrid table-bordered"
                });
                $auditsTable.append(grid.render().el);
            }
            $addEntry.show();
            $auditsTable.show();
            $activity.activity(false);
        });
    };

    $addAudit.click(function() {
        var newAudit = new Audit();
        var acl = new Parse.ACL();
        acl.setRoleWriteAccess('Administrator', true);
        acl.setRoleReadAccess(client.get('name'), true);
        newAudit.setACL(acl);
        newAudit.save().then(function() {
            var audits = client.get('audits');
            audits.push(newAudit);
            client.set('audits', audits);
            auditSelect.collection.add(newAudit);
            auditSelect.render();
            auditSelect.$el.selectpicker('refresh');
            auditSelect.$el.selectpicker('val', newAudit.id);
            auditSelect.el.onchange();
        });
    });

    $deleteAudit.click(function() {
        var $modal = $('#delete-modal');
        $modal.find('strong').text(audit.createdAt.toDateString());
        $modal.modal().find('.btn-danger').unbind('click').click(function () {
            $activity.activity();
            $auditsTable.hide();
            var SaleO = Parse.Object.extend('Sale');
	    var saleQueryO = new Parse.Query(SaleO);
	    saleQueryO.equalTo('audit', audit);
	    saleQueryO.limit(1000);
	    saleQueryO.find().then(function(saleso) {
		Parse.Object.destroyAll(saleso);
	    }).then(function(success) {
            	audit.destroy().then(function() {
	                var client = clientsCollection.at(clientSelect.el.selectedIndex - 1);
	                var audits = client.get('audits');
	                var index = audits.indexOf(audit);
	                audits.splice(index, 1);
	                client.set('audits', audits);
	                auditSelect.render();
	                auditSelect.$el.selectpicker('refresh');
	                auditSelect.$el.selectpicker('val', '');
	                auditSelect.el.onchange();
	                audit = null;
	                $activity.activity(false);
	            });
	    });
	            
            $modal.modal('hide');
        });
    });

    $addEntry.click(function() {
        var entry = new Entry({
            audit: audit,
            location: location
        });
        var acl = new Parse.ACL();
        acl.setRoleWriteAccess('Administrator', true);
        acl.setRoleReadAccess(client.get('name'), true);
        entry.setACL(acl);
        collection.comparator = null;
        collection.add(entry, {
            at: 0
        });
    });

    $modifiers.click(function() {
        modifiers.show(client, audit);
    });

    $fileInput.find(':file').change(function() {
        $auditsTable.hide();
        $errorAlert.hide();
        $successAlert.hide();
        $activity.activity();
        var file = this.files[0];
        var type = "Valante";
		
        Papa.parse(file, {
            complete: function (results) {
                var validated = false;
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
                    if (!validated) {
                      titles = ["Item Name", "Purchase Count", "Purchase Total", "Return Count", "Return Total", "Net Total"];
                      if (values[2].length == 6) {
                          validated = true;
                          for (var i = 0; i < 6; i++) {
                              if (values[2][i] != titles[i]) {
                                  validated = false;
                                  break;
                              }
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
                if (!validated) {
                    titles = ["Class", "Item", "Net Sales", "Disc", "Sales", "Qty"];
                    if (values[0].length == 6) {
                        validated = true;
                        for (var i = 0; i < 6; i++) {
                            if (values[0][i] != titles[i]) {
                                validated = false;
                                break;
                            }
                        }
                    }
                    if (validated) {
                        type = "SilverWare2";
                    }
                }
                if (!validated) {
                    titles = ["Rank", "Num", "Item Name", "Sold", "Sold", "Amount", "Cost", "Profit", "Cost %", "Sales"];
                    if (values[0].length = titles.length) {
                        validated = true;
                        for (var i = 0; i < titles.length; i++) {
                            if (values[0][i] != titles[i]) {
                                validated = false;
                                break;
                            }
                        }
                    }
                    if (validated) {
                        type = "Cibo";
                    }
                }
                if (validated) {
                    var Sale = Parse.Object.extend('Sale');

                    var Recipe = Parse.Object.extend('Recipe');

                    var query = new Parse.Query(Recipe);
                    query.equalTo('client', client);
                    query.equalTo('ignore', false);
		    query.exists('recipeItems');
		    query.descending('updatedAt');
                    query.limit(1000);
                    newRecipes = query.collection();

                    var recipes = [];
                    var query1 = new Parse.Query(Recipe);
                    query1.equalTo('client', client);
                    query1.equalTo('ignore', false);
		    query1.doesNotExist('recipeItems');
		    query1.descending('updatedAt');
                    query1.limit(1000);
                    recipesWithoutRecipeItems=query1.collection();

		    var allValidRecipes = [];
		    var allInvalidRecipes = [];
                    
                    var start = 1;
                    if (type == "TouchBistro") {
                        start = 3;
                    }
                    var end = values.length - 1;
                    if (type == "TouchBistro") {
                        end = values.length;
                    }
                    
		    Parse.Promise.when([newRecipes.fetch(), recipesWithoutRecipeItems.fetch()]).then(function () {
//                    query.find().then(function (newRecipes) {
		    	
	                newRecipes.forEach(function(aRecipe) {
                    	    allValidRecipes.push(aRecipe);
                        });
                        
	                recipesWithoutRecipeItems.forEach(function(aRecipe1) {
                    	    allInvalidRecipes.push(aRecipe1);
                        });

                        var recipesToSave = [];
                        for (var i = start; i < end; i++) {
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
                                gross = parseFloat(values[i][2].replace(/[^0-9\.]+/g, ""));
                            } else if (type == "SilverWare") {
                                name = values[i][3];
                                amount = values[i][4];
                                gross = values[i][5];
                            } else if (type == "SilverWare2") {
                                name = values[i][1];
                                amount = values[i][5];
                                gross = values[i][4];
                            } else if (type == "Cibo") 
                            
                             if ( amount < 0.1 )
                                 continue;
                            
                            for (var j = 0; j < allValidRecipes.length; j++) {
                                var bRecipe = allValidRecipes[j];
                                if (bRecipe.get('name') == name) {
                                    recipe = bRecipe;
                                    if (!recipe.get('name')) {
                                        recipe.set('name', name);
                                    }
                                    recipes.push(recipe);
                                    break;
                                }
                            }

                            for (var p = 0; p < allInvalidRecipes.length; p++) {
                                var bRecipe1 = allInvalidRecipes[p];
                                if (bRecipe1.get('name') == name) {
                                    recipe = bRecipe1;
                                    if (!recipe.get('name')) {
                                        recipe.set('name', name);
                                    }
                                    recipes.push(recipe);
                                    break;
                                }
                            }

                            if (!recipe) {
                                recipe = new Recipe({
                                    name: name,
                                    client: client,
                                    ignore: false,
				    food: false
                                });
                                var acl = new Parse.ACL();
                                acl.setRoleWriteAccess('Administrator', true);
                                acl.setRoleReadAccess(client.get('name'), true);
                                recipe.setACL(acl);
                                recipesToSave.push(recipe);
                                recipes.push(recipe);
                            }
							
                        }
                        //recipes = _.union(recipesToSave, newRecipes);
						
			var tempRecipes = [];
			var countRecipe = 0;
			
			for ( var z = 0; z < recipesToSave.length; z++){
				countRecipe++;
				tempRecipes.push(recipesToSave[z]);
				if(countRecipe>50){
					Parse.Object.saveAll(tempRecipes);
					tempRecipes = [];
					countRecipe=0;
				}             														
			}
			
//			if(countRecipe > 0) {
				return Parse.Object.saveAll(tempRecipes);
//			}
                    }).then(function() {
                        var sales = [];
                        Parse.Object.destroyAll(audit.get('sales'));
                        for (var i = start; i < end; i++) {
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
                                amount = parseInt(values[i][4]);
                                gross = parseFloat(values[i][5]);
                            } else if (type == "SilverWare2") {
                                name = values[i][1];
                                amount = parseInt(values[i][5]);
                                gross = parseFloat(values[i][4]);
                            } else if (type == "Cibo") {
                                name = values[i][2];
                                amount = parseInt(values[i][3]);
                                gross = parseFloat(values[i][5].replace(/[^0-9\.]+/g, ""));
                            }
                            for (var j = 0; j < recipes.length; j++) {
                                var aRecipe = recipes[j];
                                if (aRecipe.get('name') == name) {
                                    recipe = aRecipe;
                                    if (!recipe.get('name')) {
                                        recipe.set('name', name);
                                    }
                                    break;
                                }
                            }
                            if (amount && recipe && !recipe.get('ignore')) {
                                var sale = new Sale({
                                    recipe: recipe,
                                    amount: amount,
                                    price: parseFloat((gross / amount).toFixed(2))
                                });
                                var acl = new Parse.ACL();
                                acl.setRoleWriteAccess('Administrator', true);
                                acl.setRoleReadAccess(client.get('name'), true);
  								sale.set("audit", audit);
                                sale.setACL(acl);
                                sales.push(sale);
                            }
                        }
                        audit.set('sales', []);
			audit.save();
			
			var SaleO = Parse.Object.extend('Sale');
			var saleQueryO = new Parse.Query(SaleO);
			saleQueryO.equalTo('audit', audit);
			saleQueryO.limit(1000);
			saleQueryO.find().then(function(saleso) {
				Parse.Object.destroyAll(saleso);
			}).then(function(success) {
				var tempSales = [];
				var countSales = 0;
				var y = 0;
				
				for (y = 0; y < sales.length; y++) {
					countSales++;
					tempSales.push(sales[y]);
					if(countSales>50){
						Parse.Object.saveAll(tempSales);
						tempSales = [];
						countSales = 0;
					}             														
				}
				if(tempSales.length>0) {
					return Parse.Object.saveAll(tempSales);
				}
			});
						
						
 //                       return Parse.Object.saveAll(sales);
						
                    }).then(function(sales) {
//                        audit.set('sales', sales);
//                       audit.save();
                        $auditsTable.show();
                        $activity.activity(false);

                        $successAlert.show();
                    }, function(error) {
                        audit.set('sales', []);
                        audit.save();
                        $auditsTable.show();
                        $activity.activity(false);
                        $errorAlert.show();
                    });
                } else {
                    $activity.activity(false);
                    $errorAlert.show();
                }
            }
        });
    });

    function hideAll() {
        $auditNotes.hide();
        $locationSelect.hide();
        $addAudit.hide();
        $deleteAudit.hide();
        $auditSelect.hide();
        $auditsTable.hide();
        $addEntry.hide();
        $fileInput.hide();
        $successAlert.hide();
        $errorAlert.hide();
        $modifiers.hide();
    }

    audits.prototype = {
        init: function() {
            if (!client) {
                hideAll();
                $activity.activity();
                var queries = [];
                if (clientsCollection.length == 0) {
                    queries.push(clientsCollection.fetch());
                }
                Parse.Promise.when(queries).then(function () {
                    $activity.activity(false);

                    if (!clientSelect) {
                        clientSelect = new ClientSelect({id: 'audit-client-select-picker'});
                        $('#audit-client-select').append(clientSelect.render().el);
                        $('#audit-client-select-picker').selectpicker();
                    }
                    clientSelect.el.onchange = clientSelectChange;
                });
            }
        }
    };

    window.audits = new audits;

})(window);
