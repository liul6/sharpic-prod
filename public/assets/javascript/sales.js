(function(window) {

    var collection = null,
        grid = null,
        saleclientSelect = null,
        auditSelect = null,
        client = null,
        audit = null,
        $activity = $('#activity'),
        $auditSelect = $('#sale-audit-date-select'),
        $salesTable = $('#sales-table'),
        $addAudit = $('#sale-add-audit'),
        $deleteAudit = $('#sale-delete-audit'),
        $addSale = $('#add-sale'),
        $fileInput = $('#sale-audits-file-input'),
        $successAlert = $('#sales-upload-success'),
        $errorAlert = $('#sales-upload-error'),
        $auditNotes = $('#sales-audit-notes');
        
        var Recipe = Parse.Object.extend('Recipe');
    
        var Sale = Parse.Object.extend({
            className: 'Sale',
            initialize: function() {
                this.on('change', function() {
                    this.save().then(function () {
                        $.growl({
                            message: 'Sale saved'
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
        });
        
       
    var NumberCell = Backgrid.Cell.extend({
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

    function getRecipeDescription(recipe) {
        var recipeDescription = recipe.get('name');
        if(!recipeDescription) {
            recipeDescription = "";
        }
        
        recipeDescription = recipeDescription + "(";
        var recipeItems = recipe.get('recipeItems');
            
        if(recipe && recipeItems && recipeItems.length>0) {
             for( var i=0; i<recipeItems.length; i++){
                var recipeItem = recipeItems[i];
                if(recipeItem.get('product')) {
                    var size = (recipeItem.get('product') && recipeItem.get('product').get('size') ? recipeItem.get('product').get('size').get('name') : "");
                    var ounces = (recipeItem.get('ounces') ? ' ' + recipeItem.get('ounces') + ' ounces' : '');
                    var fulls = (recipeItem.get('fulls') ? ' ' + recipeItem.get('fulls') + ' fulls' : '');
                    var recipeItemDescription = recipeItem.get('product').get('name') + ' ' + size + ounces + fulls;
                    recipeDescription = recipeDescription + recipeItemDescription;
                    if(i!=(recipeItems.length-1)){
                        recipeDescription = recipeDescription + ",";
                    }
                }
            } 
        }
        
        recipeDescription = recipeDescription + ")";
        
        return recipeDescription;
    }
    
    var recipesCollection = null;
    var RecipeSelect2CellEditor = Backgrid.Extension.Select2CellEditor.extend({
        tagName: "input",
        attributes: {
            type: 'hidden'
        },
        self: null,
        render: function () {
            this.$el.select2(this.select2Options);
            return this;
        },
        initialize: function () {
            self = this;
            Backgrid.SelectCellEditor.prototype.initialize.apply(this, arguments);
            if (this.model.get('recipe')) {
                this.$el.attr('id', this.model.get('recipe').id);
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
        close: function(e) {
            Backgrid.SelectCellEditor.prototype.close.apply(self, arguments);
        },
        save: function (e) {
            var model = this.model;
            var column = this.column;
            var val = this.$el.val();
            if (val) {
                model.set(column.get("name"), this.formatter.toRaw(val, model));
            }
        }
    });

    window.RecipeSelect2Cell = Backgrid.Extension.Select2Cell.extend({
        optionValues: function() {
            return [];
        },
        formatter: {
            fromRaw: function(recipe) {
                return recipe ? [recipe.id] : [];
            },
            toRaw: function(id) {
                return _.find(recipesCollection.models, function(recipe) { return recipe.id == id; });
            }
        },
        render: function () {
            this.$el.empty();
            var model = this.model;
            if (model.get('recipe')) {
//                this.$el.append(model.get('recipe').get('name'));
                this.$el.append(getRecipeDescription(model.get('recipe')));
            }
            this.delegateEvents();
            return this;
        },
        select2Options: {
            initSelection : function (element, callback) {
                var recipesQuery = new Parse.Query(Recipe);
                recipesQuery.include('size');
                recipesQuery.get(element.context.id).then(function(recipe) {
                    var data = {
                        id: recipe.id,
                        text: getRecipeDescription(recipe)
//                        text: recipe.get('name')
                    };
                    callback(data);
                });
            },
            minimumInputLength: 1,
            query: function (query) {
                var recipesQuery = new Parse.Query(Recipe);
                recipesQuery.include('recipeItems.product.size');
                recipesQuery.equalTo(this.client);
                recipesQuery.equalTo('ignore', false);
                recipesQuery.limit('1000');
                recipesQuery.descending('updatedAt');
                recipesCollection = recipesQuery.collection();
                recipesCollection.fetch().then(function(recipes) {
                    query.callback({results: _.map(recipes.models, function (recipe) {
//                        return {id: recipe.id, text: recipe.get('name')};
                        return {id: recipe.id, text: getRecipeDescription(recipe)};
                    })});
                });
            }
        },
        editor: RecipeSelect2CellEditor
    });
    
    var columns = [{
        name: "recipe",
        label: "Recipe",
        cell: RecipeSelect2Cell
    }, {
        name: "amount",
        label: "Amount",
        cell: "number"
    }, {
        name: "price",
        label: "Price",
        cell: "number"
    }, {
        label: "",
        sortable: false,
        editable: false,
        cell: DeleteCell
    }];

    var sales = function() {};

    var clientSelectChange = function() {
        hideAll();
        audit = null;
        client = clientsCollection.at(saleclientSelect.el.selectedIndex - 1);
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
            $fileInput.show();
            $addSale.hide();
            $salesTable.hide();

            $activity.activity();
            var query = new Parse.Query(Sale);
            var objectIds = [];
            
            objectIds = audit.get('saleIds')

            if(!objectIds || objectIds.length<=0) {
                if(audit.get('sales')) {
                    objectIds = audit.get('sales').map(function(sale) { return sale.id; });
                }
                else {
                    objectIds = [];
                }
            }
            
            query.containedIn('objectId', objectIds);
            query.include('recipe.recipeItems');
            query.limit('1000');

            if (!collection) {
                collection = query.collection();
            } else {
                collection.query = query;
            }
            
            collection.comparator = function (sale) {
                if (sale.get('recipe')) {
                    return sale.get('recipe').get('name');
                } else {
                    return "";
                }
            };
            
            collection.fetch().then(function () {
                if (!grid) {
                    grid = new Backgrid.Grid({
                        columns: columns,
                        collection: collection,
                        className: "backgrid table-bordered"
                    });
                    $salesTable.append(grid.render().el);
                }
                $addSale.show();
                $salesTable.show();
                $activity.activity(false);
            });

            if (audit.get('notes')) {
                $auditNotes.find('span').text(audit.get('notes'));
                $auditNotes.show();
            }
        }
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
            $salesTable.hide();
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
            $modal.modal('hide');
        });
    });
    
    $addSale.click(function() {
        var sale = new Sale({
        });
        var acl = new Parse.ACL();
        acl.setRoleWriteAccess('Administrator', true);
        acl.setRoleReadAccess(client.get('name'), true);
        sale.setACL(acl);
        collection.comparator = null;
        collection.add(sale, {
            at: 0
        });
    });

    $fileInput.find(':file').change(function() {
        $salesTable.hide();
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
                    var Recipe = Parse.Object.extend('Recipe');
                    var Sale = Parse.Object.extend('Sale');
                    var query = new Parse.Query(Recipe);
                    query.equalTo('client', client);
                    query.exists('recipeItems');
                    query.descending('updatedAt');
                    query.limit('1000');
                    var recipes;
                    var start = 1;
                    if (type == "TouchBistro") {
                        start = 3;
                    }
                    var end = values.length - 1;
                    if (type == "TouchBistro") {
                        end = values.length;
                    }
                    query.find().then(function (newRecipes) {
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
                            } else if (type == "Cibo") {
                                name = values[i][2];
                                amount = parseInt(values[i][3]);
                                gross = parseFloat(values[i][5].replace(/[^0-9\.]+/g, ""));
                            }
                            for (var j = 0; j < newRecipes.length; j++) {
                                var aRecipe = newRecipes[j];
                                if (aRecipe.get('name') == name) {
                                    recipe = aRecipe;
                                    if (!recipe.get('name')) {
                                        recipe.set('name', name);
                                    }
                                    break;
                                }
                            }
                            if (!recipe) {
                                recipe = new Recipe({
                                    name: name,
                                    client: client,
                                    ignore: false
                                });
                                var acl = new Parse.ACL();
                                acl.setRoleWriteAccess('Administrator', true);
                                acl.setRoleReadAccess(client.get('name'), true);
                                recipe.setACL(acl);
                                recipesToSave.push(recipe);
                            }
                        }
                        recipes = _.union(recipesToSave, newRecipes);
                        return Parse.Object.saveAll(recipesToSave);
                    }).then(function() {
                        var origsalesQuery = new Parse.Query(Sale);
                        var objectIds = audit.get('saleIds'); 
                        if(!objectIds || objectIds.length<=0) { 
                            if(audit.get('sales')) {
                                objectIds = audit.get('sales').map(function(sale) { return sale.id; }); 
                            }
                            else {
                                objectIds = [];
                            }
                        } 
                        
                        origsalesQuery.containedIn('objectId', objectIds);
                        origsalesQuery.limit('1000');
                        
                        return origsalesQuery.find();
                    }).then(function(origsales) {
                        return Parse.Object.destroyAll(origsales);                       
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
                                sale.setACL(acl);
                                sales.push(sale);
                            }
                        }

                       return Parse.Object.saveAll(sales);
                    }).then(function(sales) {
//                        audit.set('sales',sales);
                        
                        var saleIds = [];
                        for(var i=0; i<sales.length; i++) {
                            saleIds.push(sales[i].id);
                        }
                        
                        audit.set('saleIds',saleIds);
//                      audit.set('sales',[]);
                        return audit.save();
                    }).then(function(sale) {
                        auditSelectChange();
                        $salesTable.show();
                        $activity.activity(false);
                        $successAlert.show();
                    }, function(error) {
                        audit.set('sales', []);
                        audit.save();
                        auditSelectChange();
                        $salesTable.show();
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
        $addAudit.hide();
        $deleteAudit.hide();
        $auditSelect.hide();
        $salesTable.hide();
        $addSale.hide();
        $fileInput.hide();
        $successAlert.hide();
        $errorAlert.hide();
    }

    sales.prototype = {
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

                    if (!saleclientSelect) {
                        saleclientSelect = new ClientSelect({id: 'sale-audit-client-select-picker'});
                        $('#sale-audit-client-select').append(saleclientSelect.render().el);
                        $('#sale-audit-client-select-picker').selectpicker();
                    }
                    saleclientSelect.el.onchange = clientSelectChange;
                });
            }
        }
    };

    window.sales = new sales;

})(window);
