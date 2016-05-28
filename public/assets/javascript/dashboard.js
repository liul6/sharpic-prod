(function() {

    window.DeleteCell = Backgrid.Cell.extend({
        template: _.template('<button type="button" class="btn btn-danger"><span class="glyphicon glyphicon-remove"></span></button>'),
        events: {
            "click": "deleteRow"
        },
        className: "delete-cell",
        deleteRow: function (e) {
            e.preventDefault();
            var model = this.model;
            var $modal = $('#delete-modal');
            if (model.get('name')) {
                $modal.find('strong').text(model.get('name'));
            } else {
                $modal.find('strong').text('entry');
            }
            $modal.modal().find('.btn-danger').unbind('click').click(function () {
                model.destroy();
                $modal.modal('hide');
            });
        },
        render: function () {
            this.$el.html(this.template());
            this.delegateEvents();
            return this;
        }
    });

    window.ModalDeleteCell = DeleteCell.extend({
        deleteRow: function (e) {
            e.preventDefault();
            var model = this.model;
            var $alert = $('#delete-alert');
            $alert.find('strong').text(model.get('name'));
            $alert.show().find('.btn-danger').unbind('click').click(function () {
                model.destroy();
                $alert.hide();
            });
            $alert.find('.btn-default').click(function () {
                $alert.hide();
            });
        }
    });

    window.ClientSelect = Backbone.View.extend({
        initialize: function() {
            var _this = this;
            this.listenTo(clientsCollection, 'add', this.renderChange);
            this.listenTo(clientsCollection, 'remove', this.renderChange);
            this.listenTo(clientsCollection, 'sync', function() {
                var value = _this.$el.val();
                _this.render();
                _this.$el.selectpicker('val', value);
            });
        },
        tagName: 'select',
        className: 'selectpicker',
        renderChange: function() {
            this.render();
            this.el.onchange();
        },
        template: _.template([
            '  <option value="">Select Client</option>',
            '  <% _(clients).each(function(client) { %>',
            '    <option value="<%= client.objectId %>"><%= client.name %></option>',
            '  <% }); %>'
        ].join("\n")),
        render: function() {
            var html = this.template({ clients: clientsCollection.toJSON() });
            this.$el.html(html);
            $('#' + this.id).selectpicker('refresh');
            return this;
        }
    });

    window.ModelCellEditor = Backgrid.Extension.ArrayObjectCellEditor.extend({
        postRender: function () {
            var view = this,
                model = this.model,
                column = this.column,
                gridOptions = this.gridOptions,
                columnModel = this.columnModel;

            var NewCollection = Parse.Collection.extend({
                model: columnModel
            });
            // Extract the object, and create a Backbone model from it.
            var objectCollection = this.objectCollection = new NewCollection(model.get(column.get("name")));

            // Create our Bootstrap modal dialog
            var $dialog = this.createDialog();

            $dialog.find('.btn-success').click(function() {
                objectCollection.add(new columnModel(), {
                    at: 0
                });
            });

            if (objectCollection.models.length == 0) {
                objectCollection.add(new columnModel());
            }

            // Add the Backgrid Grid
            var grid = new this.backgrid(_.extend({collection: objectCollection}, gridOptions)),
                $grid = grid.render().$el;
            $dialog.find('div.modal-body').append($grid);

            return this;
        },
        save: function() {
            var model = this.model,
                column = this.column,
                objectCollection = this.objectCollection;

            model.set(column.get("name"), objectCollection.models);
            model.trigger("backgrid:edited", model, column, new Backgrid.Command({keyCode:13}));

            $('body').removeClass('modal-open');

            return this;
        }
    });


    window.Audit = Parse.Object.extend('Audit');

    window.AuditCollection = Parse.Collection.extend({
        model: Audit,
        comparator: function(audit1, audit2) {
            if (audit1.createdAt < audit2.createdAt) {
                return 1;
            } else if (audit1.createdAt > audit2.createdAt) {
                return -1;
            } else {
                return 0;
            }
        }
    });

    window.AuditSelect = Backbone.View.extend({
        initialize: function(options) {
            if (options.template) {
                this.template = options.template;
            }
        },
        tagName: 'select',
        className: 'selectpicker',
        template: _.template([
            '  <% _(audits).each(function(audit) { %>',
            '    <option value="<%= audit.objectId %>"><%= audit.date %></option>',
            '  <% }); %>'
        ].join("\n")),
        render: function() {
            this.collection.sort();
            var html = this.template({ audits: this.collection.map(function(audit) { return { objectId: audit.id, date: audit.createdAt.toDateString() } }) });
            this.$el.html(html);
            return this;
        }
    });

    window.Client = Parse.Object.extend({
        className: 'Client',
        initialize: function () {
            this.on('change', function () {
                this.save();
            }, this);
        }
    });


    var query = new Parse.Query(Client);
    query.include('locations');
    query.include('modifiers');
    query.include('audits');
    window.clientsCollection = query.collection();
    clientsCollection.comparator = function (client) {
        return client.get('name');
    };
    window.Product = Parse.Object.extend({
        className: 'Product',
        initialize: function () {
            this.on('change', function () {
                this.save().then(function () {
                    $.growl({
                        message: 'Product saved'
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

    var productsCollection = null;

    var ProductSelect2CellEditor = Backgrid.Extension.Select2CellEditor.extend({
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
            if (this.model.get('product')) {
                this.$el.attr('id', this.model.get('product').id);
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

    window.ProductSelect2Cell = Backgrid.Extension.Select2Cell.extend({
        optionValues: function() {
            return [];
        },
        formatter: {
            fromRaw: function(product) {
                return product ? [product.id] : [];
            },
            toRaw: function(id) {
                return _.find(productsCollection.models, function(product) { return product.id == id; });
            }
        },
        render: function () {
            this.$el.empty();
            var model = this.model;
            if (model.get('product')) {
                this.$el.append(model.get('product').get('name') + ' ' + model.get('product').get('size').get('name'));
            }
            this.delegateEvents();
            return this;
        },
        select2Options: {
            initSelection : function (element, callback) {
                var productsQuery = new Parse.Query(Product);
                productsQuery.include('size');
                productsQuery.get(element.context.id).then(function(product) {
                    var data = {
                        id: product.id,
                        text: product.get('name') + ' ' + product.get('size').get('name')
                    };
                    callback(data);
                });
            },
            minimumInputLength: 1,
            query: function (query) {
                var productsQuery = new Parse.Query(Product);
                productsQuery.limit('50');
                productsQuery.contains('searchName', query.term.toLowerCase());
                productsQuery.include('size');
                if (this.client) {
                    productsQuery.contains('clientSearchString', this.client.get('name').toLowerCase());
                }
                productsCollection = productsQuery.collection();
                productsCollection.fetch().then(function(products) {
                    query.callback({results: _.map(products.models, function (product) {
                        return {id: product.id, text: product.get('name') + ' ' + product.get('size').get('name')};
                    })});
                });
            }
        },
        editor: ProductSelect2CellEditor
    });

    var DollarFormatter = function (options) {
        _.extend(this, this.defaults, options || {});

        if (this.decimals < 0 || this.decimals > 20) {
            throw new RangeError("decimals must be between 0 and 20");
        }
    };

    DollarFormatter.prototype = new Backgrid.CellFormatter();
    _.extend(DollarFormatter.prototype, {
        defaults: {
            decimals: 2,
            decimalSeparator: '.',
            orderSeparator: ','
        },

        HUMANIZED_NUM_RE: /(\d)(?=(?:\d{3})+$)/g,

        fromRaw: function (number, model) {
            if (_.isNull(number) || _.isUndefined(number)) return '';

            number = number.toFixed(~~this.decimals);

            var parts = number.split('.');
            var integerPart = parts[0];
            var decimalPart = parts[1] ? (this.decimalSeparator || '.') + parts[1] : '';

            return '$' + integerPart.replace(this.HUMANIZED_NUM_RE, '$1' + this.orderSeparator) + decimalPart;
        },
        toRaw: function (formattedData, model) {
            if (formattedData[0] === '$') {
                formattedData = formattedData.substr(1).trim();
            }

            if (formattedData === '') return null;

            var rawData = '';

            var thousands = formattedData.split(this.orderSeparator);
            for (var i = 0; i < thousands.length; i++) {
                rawData += thousands[i];
            }

            var decimalParts = rawData.split(this.decimalSeparator);
            rawData = '';
            for (var i = 0; i < decimalParts.length; i++) {
                rawData = rawData + decimalParts[i] + '.';
            }

            if (rawData[rawData.length - 1] === '.') {
                rawData = rawData.slice(0, rawData.length - 1);
            }

            var result = (rawData * 1).toFixed(~~this.decimals) * 1;
            if (_.isNumber(result) && !_.isNaN(result)) return result;
        }
    });

    window.CostCell = Backgrid.NumberCell.extend({
        formatter: DollarFormatter
    });

})();

$(document).ready(function() {
    // QA
    // Parse.initialize('K7fyN6B9ZtxDclYlxyCVQxVl1uE8PD1xavzWA2Fa', 'FWt5YkJ6OYgsOFyUcGyprS7BWCaMTE0x2CgJVQC7');
    // Prod
//    Parse.initialize('y8oJBBFlfGwzpDwS9W2YvoSJyyrX67HWeYzFQizV', 'xXnw9ymvBx9QR776qwhwCrVg08Pbn8IIJ74Nv0Eb');
    Parse.initialize('hTNcUCXxaxgNLUR6vhLoUliLnadu3shkNUUCsnTX', 'I7HJPTMofOAiG66s0EXKAShUOPyK0mN7z9qyaggY');
    Parse.serverURL = 'https://sharpic-dev.herokuapp.com/parse'
    
    var sessionToken = $('#session').text();
    if (!Parse.User.current() || Parse.User.current().getSessionToken() != sessionToken) {
        Parse.User.become(sessionToken).then(function() {
            finishInit();
        });
    } else {
        finishInit();
    }

    function finishInit() {

        $('a').click(function () {

            function hideAll() {
                ['users', 'clients', 'products', 'recipes', 'audits', 'reports'].forEach(function (field) {
                    $('#' + field).hide();
                });
                $('#sidebar').children().removeClass('active');
            }

            switch ($(this).attr('href')) {
                case '#users':
                    hideAll();
                    $(this).parent().addClass('active');
                    $('#users').show();
                    users.init();
                    break;
                case '#clients':
                    hideAll();
                    $(this).parent().addClass('active');
                    $('#clients').show();
                    clients.init();
                    break;
                case '#products':
                    hideAll();
                    $(this).parent().addClass('active');
                    $('#products').show();
                    products.init();
                    break;
                case '#recipes':
                    hideAll();
                    $(this).parent().addClass('active');
                    $('#recipes').show();
                    recipes.init();
                    break;
                case '#audits':
                    hideAll();
                    $(this).parent().addClass('active');
                    $('#audits').show();
                    audits.init();
                    break;
                case '#reports':
                    hideAll();
                    $(this).parent().addClass('active');
                    $('#reports').show();
                    reports.init();
                    break;
                case 'logout':
                    Parse.User.logOut();
                    break;
            }
        });

        if (window.audits) {
            audits.init();
        } else {
            reports.init();
        }
    }
});
