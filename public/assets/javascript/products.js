(function(window) {

    var collection = null,
        client = null,
        clientSelect = null;

    var TagsCell = Backgrid.Cell.extend({
        formatter: {
            fromRaw: function(array) {
                return array ? array.join(", ") : "";
            }, toRaw: function(string) {
                return string.split(',').map(function(string) { return string.trim(); });
            }
        }
    });

    var ProductCollection = Backbone.PageableCollection.extend({
        model: Product,
        state: {
            pageSize: 100,
            firstPage: 0,
            sortKey: 'name',
            sortOrder: 1
        },
        _prepareModel: function(attrs, options) {
            if (attrs instanceof Parse.Object) return attrs;
            options = options ? _.clone(options) : {};
            options.collection = this;
            var model = new this.model(attrs, options);
            if (!model.validationError) return model;
            this.trigger('invalid', this, model.validationError, options);
            return false;
        },
        set: function(models, options) {
            options = _.defaults({}, options);
            if (options.parse) models = this.parse(models, options);
            var singular = !_.isArray(models);
            models = singular ? (models ? [models] : []) : _.clone(models);
            var i, l, id, model, attrs, existing, sort;
            var at = options.at;
            var targetModel = this.model;
            var sortable = this.comparator && (at == null) && options.sort !== false;
            var sortAttr = _.isString(this.comparator) ? this.comparator : null;
            var toAdd = [], toRemove = [], modelMap = {};
            var add = options.add, merge = options.merge, remove = options.remove;
            var order = !sortable && add && remove ? [] : false;

            // Turn bare objects into model references, and prevent invalid models
            // from being added.
            for (i = 0, l = models.length; i < l; i++) {
                attrs = models[i] || {};
                if (attrs instanceof Parse.Object) {
                    id = model = attrs;
                } else {
                    id = attrs[targetModel.prototype.idAttribute || 'id'];
                }

                // If a duplicate is found, prevent it from being added and
                // optionally merge it into the existing model.
                if (existing = this.get(id)) {
                    if (remove) modelMap[existing.cid] = true;
                    if (merge) {
                        attrs = attrs === model ? model.attributes : attrs;
                        if (options.parse) attrs = existing.parse(attrs, options);
                        existing.set(attrs, options);
                        if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
                    }
                    models[i] = existing;

                    // If this is a new, valid model, push it to the `toAdd` list.
                } else if (add) {
                    model = models[i] = this._prepareModel(attrs, options);
                    if (!model) continue;
                    toAdd.push(model);
                    this._addReference(model, options);
                }

                // Do not add multiple models with the same `id`.
                model = existing || model;
                if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
                modelMap[model.id] = true;
            }

            // Remove nonexistent models if appropriate.
            if (remove) {
                for (i = 0, l = this.length; i < l; ++i) {
                    if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
                }
                if (toRemove.length) this.remove(toRemove, options);
            }

            // See if sorting is needed, update `length` and splice in new models.
            if (toAdd.length || (order && order.length)) {
                if (sortable) sort = true;
                this.length += toAdd.length;
                if (at != null) {
                    for (i = 0, l = toAdd.length; i < l; i++) {
                        this.models.splice(at + i, 0, toAdd[i]);
                    }
                } else {
                    if (order) this.models.length = 0;
                    var orderedModels = order || toAdd;
                    for (i = 0, l = orderedModels.length; i < l; i++) {
                        this.models.push(orderedModels[i]);
                    }
                }
            }

            // Silently sort the collection if appropriate.
            if (sort) this.sort({silent: true});

            // Unless silenced, it's time to fire all appropriate add/sort events.
            if (!options.silent) {
                for (i = 0, l = toAdd.length; i < l; i++) {
                    (model = toAdd[i]).trigger('add', model, this, options);
                }
                if (sort || (order && order.length)) this.trigger('sort', this, options);
            }

            // Return the added (or merged) model (or models).
            return singular ? models[0] : models;
        },
        mode: "infinite",
        _checkState: function(state) {
            return state;
        },
        hasPreviousPage: function () {
            var state = this.state;
            var currentPage = state.currentPage;
            return currentPage > state.firstPage;
        },
        hasNextPage: function () {
            return this.models.length == 0 || this.models.length == this.state.pageSize;
        },
        goBackFirstOnSort: false,
        setSorting: function (sortKey, order) {
            this.state.sortKey = sortKey || 'name';
            this.state.order = order || -1;
            this.getFirstPage({reset: true});
        },
        fetch: function (options) {
            var state = this._checkState(this.state);
            if (!this.query) {
                this.query = new Parse.Query(Product);
            }
            var query = this.query;
            query.limit(state.pageSize);
            query.skip(state.pageSize * state.currentPage);
            if (state.order < 0) {
                query.ascending(state.sortKey);
            } else {
                query.descending(state.sortKey);
            }
            if (options && options.data && options.data.q) {
                query.contains('searchName', options.data.q.toLowerCase());
            } else {
                query.contains('searchName', '');
            }
            if (client) {
                query.contains('clientSearchString', client.get('name').toLowerCase());
            } else {
                query.contains('clientSearchString', '');
            }
            var collection = this;
            query.find().then(function(products) {
                collection.reset(products, {silent: true});
                collection.trigger('reset');
            });
        }
    });

    function clientSelectChange() {
        client = clientsCollection.at(clientSelect.el.selectedIndex - 1);
        collection.fetch();
    }

    var products = function() {};

    products.prototype = {
        init: function() {
            if (!collection) {
                $('#activity').activity();
                var Serving = Parse.Object.extend('Serving');
                var servingQuery = new Parse.Query(Serving);
                var Size = Parse.Object.extend('Size');
                var query = new Parse.Query(Size);
                collection = new ProductCollection();
                var queries = [query.find(), servingQuery.find(), collection.fetch()];
                if (clientsCollection.length == 0) {
                    queries.push(clientsCollection.fetch());
                }
                Parse.Promise.when(queries).then(function(sizes, servings) {
                    var sizeOptions = _.map(sizes, function(size) {
                        return [size.get('name'), size.id];
                    });

                    var servingOptions = _.map(servings, function(serving) {
                        return [serving.get('name'), serving.id];
                    });

                    var columns = [{
                        name: "name",
                        label: "Brand",
                        cell: "string"
                    }, {
                        name: "size",
                        label: "Size",
                        cell: Backgrid.SelectCell.extend({
                            optionValues: sizeOptions,
                            formatter: {
                                fromRaw: function(size) {
                                    return size ? [size.id] : [];
                                },
                                toRaw: function(id) {
                                    return _.find(sizes, function(size) { return size.id == id; });
                                }
                            }
                        }),
                        sortable: false
                    }, {
                        name: "serving",
                        label: "Serving",
                        cell: Backgrid.SelectCell.extend({
                            optionValues: servingOptions,
                            formatter: {
                                fromRaw: function(serving) {
                                    return serving ? [serving.id] : [];
                                },
                                toRaw: function(id) {
                                    return _.find(servings, function(serving) { return serving.id == id; });
                                }
                            }
                        }),
                        sortable: false
                    }, {
                        name: "full",
                        label: "Full",
                        cell: "number"
                    }, {
                        name: "tare",
                        label: "Tare",
                        cell: "number"
                    }, {
                        name: "cost",
                        label: "Cost",
                        cell: CostCell
                    }, {
                        name: "case",
                        label: "Case",
                        cell: "integer"
                    }, {
                        name: "UPC",
                        label: "UPC",
                        cell: "string"
                    }, {
                        name: "tags",
                        label: "Tags",
                        cell: TagsCell
                    }, {
                        label: "",
                        sortable: false,
                        editable: false,
                        cell: DeleteCell
                    }];

                    var grid = new Backgrid.Grid({
                        columns: columns,
                        collection: collection,
                        className: "backgrid table-bordered"
                    });

                    var paginator = new Backgrid.Extension.Paginator({
                        renderIndexedPageHandles: false,
                        collection: collection,
                        controls: {
                            rewind: null,
                            fastForward: null
                        }
                    });

                    var filter = new Backgrid.Extension.ServerSideFilter({
                        collection: collection,
                        fields: ['name']
                    });

                    $('#products-table').append(grid.render().el).after(paginator.render().el).before(filter.render().el);
                    $(filter.el).css({float: "right", margin: "20px"});

                    $('#add-product').click(function() {
                        var product = new Product();
                        var acl = new Parse.ACL();
                        acl.setRoleWriteAccess('Administrator', true);
                        acl.setPublicReadAccess(true);
                        product.setACL(acl);
                        collection.comparator = null;
                        collection.add(product, {
                            at: 0
                        });
                    });

                    $('#manage-categories').click(categories.show);

                    if (!clientSelect) {
                        clientSelect = new ClientSelect({id: 'product-client-select-picker'});
                        $('#product-client-select').append(clientSelect.render().el);
                        $('#product-client-select-picker').selectpicker();
                    }
                    clientSelect.el.onchange = clientSelectChange;

                    $('#activity').activity(false);
                });
            }
        }
    };

    window.products = new products;

})(window);