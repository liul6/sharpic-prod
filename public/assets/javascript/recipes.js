(function(window) {

    var collection = null,
        ignoredCollection = null,
        client = null,
        clientSelect = null,
        $activity = $('#activity'),
        $recipesTable = $('#recipes-table'),
        $successAlert = $('#recipes-success'),
        $errorAlert = $('#recipes-error'),
        $toggleIgnored = $('#toggle-ignored'),
        $ignoredTable = $('#recipes-ignored-table'),
        Recipe = Parse.Object.extend({
            className: 'Recipe',
            initialize: function() {
                this.on('change', function() {
                    this.save().then(function () {
                        $.growl({
                            message: 'Recipe saved'
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
        RecipeItem = Parse.Object.extend({
        className: 'RecipeItem',
        initialize: function() {
            this.on('change', function() {
                this.save();
            }, this);
        }
        });

    var IgnoreCell = Backgrid.Cell.extend({
        template: _.template('<button type="button" class="btn btn-warning"><span class="glyphicon glyphicon-minus"></span></button>'),
        events: {
            "click": "ignoreRow"
        },
        className: "ignore-cell",
        ignoreRow: function (e) {
            e.preventDefault();

            this.model.set('ignore', true);
            this.model.collection.remove(this.model);
        },
        render: function () {
            this.$el.html(this.template());
            this.delegateEvents();
            return this;
        }
    });

    var UnignoreCell = Backgrid.Cell.extend({
        template: _.template('<button type="button" class="btn btn-info"><span class="glyphicon glyphicon-plus"></span></button>'),
        events: {
            "click": "unignoreRow"
        },
        className: "ignore-cell",
        unignoreRow: function (e) {
            e.preventDefault();
            this.model.set('ignore', false);
            this.model.collection.remove(this.model);
            collection.add(this.model);
        },
        render: function () {
            this.$el.html(this.template());
            this.delegateEvents();
            return this;
        }
    });

    var RecipeItemsCellEditor = ModelCellEditor.extend({
        columnModel: RecipeItem
    });

    var RecipeItemsCell = Backgrid.Extension.ArrayObjectCell.extend({
        formatter: {
            fromRaw: function(array) {
                var filteredArray = _.filter(array, function(object) { return object != null;});
                return _.map(filteredArray, function(object) {
                    if (object.get('product')) {
                        var size = (object.get('product') && object.get('product').get('size') ? object.get('product').get('size').get('name') : "");
                        var ounces = (object.get('ounces') ? ' ' + object.get('ounces') + ' ounces' : '');
                        var fulls = (object.get('fulls') ? ' ' + object.get('fulls') + ' fulls' : '');
                        var retailPrice = (object.get('retailPrice') ? ' ' + object.get('retailPrice') + ' retail$' : '');
                        return object.get('product').get('name') + ' ' + size + ounces + fulls;
                    } else {
                        return "";
                    }
                }).join(", ");
            }
        },
        gridOptions: {
            className: "backgrid table-bordered",
            columns: [
                {name: "product", label: "Product", cell: ProductSelect2Cell.extend({
                    initialize: function () {
                        ProductSelect2Cell.prototype.initialize.apply(this, arguments);
                        this.select2Options.client = client;
                    }
                })},
                {name: "ounces", label: "Ounces", cell: "number"},
                {name: "fulls", label: "Fulls", cell: "integer"},
                {name: "retailPrice", label: "Retail Price", cell: "number"},
                {name: "id", label: "", cell: ModalDeleteCell, editable: false, sortable: false}
            ]
        },
        editor: RecipeItemsCellEditor
    });

    var columns = [{
            name: "name",
            label: "Name",
            cell: "string",
            editable: false
        }, {
            name: "recipeItems",
            label: "Items",
            cell: RecipeItemsCell,
            sortable: false
        }, {
            label: "",
            sortable: false,
            editable: false,
            cell: IgnoreCell
        }],
        grid = null,
        ignoredColumns = [{
            name: "name",
            label: "Name",
            cell: "string",
            editable: false
        }, {
            label: "",
            sortable: false,
            editable: false,
            cell: UnignoreCell
        }],
        ignoredGrid = null;

    var clientSelectChange = function() {
        $errorAlert.hide();
        $successAlert.hide();
        $recipesTable.hide();
        $ignoredTable.hide();
        $toggleIgnored.hide();
        $('#recipes-file-input').hide();
        client = clientsCollection.at(clientSelect.el.selectedIndex - 1);
        if (client) {
            $activity.activity();
            var query = new Parse.Query(Recipe);
            query.include('recipeItems.product.size');
            query.equalTo('client', client);
            query.equalTo('ignore', false);
            query.limit('1000');
            if (!collection) {
                collection = query.collection();
            } else {
                collection.query = query;
            }
            collection.comparator = function(recipe1, recipe2) {
                if (recipe1.get('recipeItems') && recipe1.get('recipeItems').length > 0 && (!recipe2.get('recipeItems') || recipe2.get('recipeItems').length == 0)) {
                    return 1;
                } else if ((!recipe1.get('recipeItems') || recipe1.get('recipeItems').length == 0) && recipe2.get('recipeItems') && recipe2.get('recipeItems').length > 0) {
                    return -1;
                } else {
                    return 0;
                }
            };
            collection.fetch().then(function() {
                if (!grid) {
                    grid = new Backgrid.Grid({
                        columns: columns,
                        collection: collection,
                        className: "backgrid table-bordered"
                    });
                    $recipesTable.append(grid.render().el);
                }
                $recipesTable.show();
                $('#recipes-file-input').show();
                $activity.activity(false);
            });
            query.equalTo('ignore', true);
            if (!ignoredCollection) {
                ignoredCollection = query.collection();
            } else {
                ignoredCollection.query = query;
            }
            ignoredCollection.fetch().then(function() {
                if (!ignoredGrid) {
                    ignoredGrid = new Backgrid.Grid({
                        columns: ignoredColumns,
                        collection: ignoredCollection,
                        className: "backgrid table-bordered"
                    });
                    $ignoredTable.append(ignoredGrid.render().el);
                }
                $toggleIgnored.show().click(function () {
                    $ignoredTable.toggle();
                });
            });
        }
    };

    $('#recipes-file-input').find(':file').change(function() {
        $recipesTable.hide();
        $successAlert.hide();
        $errorAlert.hide();
        $activity.activity();
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
                    var recipesResult = null;
                    var query = new Parse.Query(Recipe);
                    query.equalTo('client', client);
                    query.limit('1000');
                    query.find().then(function (recipes) {
                        var recipesResult = recipes;
                        var toSave = [];
                        for (var i = (type != "TouchBistro" ? 1 : 3); i < (type != "TouchBistro" ? values.length - 1 : values.length); i++) {
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
                            }
                            var found = false;
                            for (var j = 0; j < recipes.length; j++) {
                                var recipe = recipes[j];
                                if (recipe.get('name') == name) {
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                var recipe = new Recipe({
                                    name: name,
                                    client: client,
                                    ignore: false
                                });
                                var acl = new Parse.ACL();
                                acl.setRoleWriteAccess('Administrator', true);
                                acl.setRoleReadAccess(client.get('name'), true);
                                recipe.setACL(acl);
                                toSave.push(recipe);
                                recipesResult.push(recipe);
                            }
                        }
                        return Parse.Object.saveAll(toSave);
                    }).then(function () {
                        collection.reset(recipesResult);
                        $recipesTable.show();
                        $activity.activity(false);
                        $successAlert.show();
                    }, function() {
                        $recipesTable.show();
                        $activity.activity(false);
                        $errorAlert.show();
                    });
                } else {
                    $recipesTable.show();
                    $activity.activity(false);
                    $errorAlert.show();
                }
            }
        });
    });

    var recipes = function() {};

    recipes.prototype = {
        init: function() {
            if (!client) {
                $activity.activity();
                var queries = [];
                if (clientsCollection.length == 0) {
                    queries.push(clientsCollection.fetch());
                }
                Parse.Promise.when(queries).then(function () {
                    if (!clientSelect) {
                        clientSelect = new ClientSelect({id: 'recipe-client-select-picker'});
                        $('#recipe-client-select').append(clientSelect.render().el);
                        $('#recipe-client-select-picker').selectpicker();
                    }
                    clientSelect.el.onchange = clientSelectChange;
                    $activity.activity(false);
                });
            }
        }
    };

    window.recipes = new recipes;

})(window);
