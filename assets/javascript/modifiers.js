(function() {
    var client = null,
        audit = null,
        select = null,
        modifier = null,
        grid = null,
        collection = null,
        $deleteButton = $('#delete-modifier'),
        $name = $('#modifier-name'),
        $percentage = $('#modifier-percentage'),
        $modal = $('#modifiers-modal'),
        $select = $('#modifiers-select'),
        $grid = $('#modifiers-table');

    var Modifier = Parse.Object.extend({
            className: 'Modifier',
            initialize: function () {
                var self = this;
                this.on('change', function () {
                    this.save().then(function() {
                        select.collection.reset(client.get('modifiers'));
                        select.render();
                        select.$el.selectpicker('refresh');
                        select.$el.selectpicker('val', self.id);
                    });
                }, this);
            }
        }),
        ModifierItem = Parse.Object.extend({
            className: 'ModifierItem',
            initialize: function () {
                this.on('change', function () {
                    this.save();
                }, this);
            }
        }),
        ModifierCollection = Parse.Collection.extend({
            model: Modifier
        }),
        ModifierItemCollection = Parse.Collection.extend({
            model: ModifierItem
        });

    var ModifierDeleteCell = DeleteCell.extend({
        deleteRow: function (e) {
            e.preventDefault();
            var model = this.model;
            var $alert = $('#modifier-delete-alert');
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

    var ModifierSelect = Backbone.View.extend({
        tagName: 'select',
        className: 'selectpicker',
        render: function() {
            var template = _.template([
                '  <option value="">New Modifier</option>',
                '  <% _(modifiers).each(function(modifier) { %>',
                '    <option value="<%= modifier.objectId %>"><%= modifier.name %></option>',
                '  <% }); %>'
            ].join("\n"));
            var html = template({ modifiers: this.collection.toJSON() });
            this.$el.html(html);
            return this;
        }
    });

    var columns = [
        {name: "product", label: "Product", cell: ProductSelect2Cell.extend({
            initialize: function () {
                ProductSelect2Cell.prototype.initialize.apply(this, arguments);
                this.select2Options.client = client;
            }
        })},
        {name: "ounces", label: "Ounces", cell: "number"},
        {name: "fulls", label: "Fulls", cell: "integer"},
        {name: "cost", label: "Dollar Amount", cell: CostCell},
        {name: "id", label: "", cell: ModifierDeleteCell, editable: false, sortable: false}
    ];


    var selectModifier = function() {
        if (!collection) {
            collection = new ModifierItemCollection();
        }
        if (!grid) {
            grid = new Backgrid.Grid({
                columns: columns,
                collection: collection,
                className: "backgrid table-bordered"
            });
            $grid.append(grid.render().el);
            $('#add-modifier-item').click(function() {
                collection.add(new ModifierItem({
                    audit: audit,
                    modifier: modifier
                }), {
                    at: 0
                });
            });
        }
        if (select.el.selectedIndex > 0) {
            modifier = client.get('modifiers')[select.el.selectedIndex - 1];
            $name.val(modifier.get('name'));
            $percentage.val(modifier.get('percentage'));
            var query = new Parse.Query(ModifierItem);
            query.equalTo('modifier', modifier);
            query.equalTo('audit', audit);
            query.include('product.size');
            query.find().then(function(items) {
                collection.reset(items);
                collection.add(new ModifierItem({
                    audit: audit,
                    modifier: modifier
                }), {
                    at: 0
                });
            });
        } else {
            modifier = new Modifier();
            $name.val('');
            $percentage.val('');
            collection.reset();
            collection.add(new ModifierItem({
                audit: audit,
                modifier: modifier
            }), {
                at: 0
            });
        }
    };

    $name.on('focusout', function () {
        var isNew = false;
        if (!modifier.id) {
            isNew = true;
            var modifiers = client.get('modifiers');
            modifiers.push(modifier);
            client.set('modifiers', modifiers);
        }
        modifier.set('name', $name.val());
        if (isNew) {
            client.save();
        }
    });

    $percentage.on('focusout', function () {
        modifier.set('percentage', parseFloat($percentage.val()));
    });

    $deleteButton.click(function() {
        if (modifier) {
            var $alert = $('#modifier-delete-alert');
            $alert.find('strong').text(modifier.get('name'));
            $alert.show().find('.btn-danger').unbind('click').click(function () {
                var modifiers = client.get('modifiers');
                modifiers = modifiers.filter(function (obj) {
                    return obj != modifier;
                });
                modifier.destroy();
                modifier = null;
                client.set('modifiers', modifiers);
                client.save();
                select.collection.reset(client.get('modifiers'));
                select.render();
                select.$el.selectpicker('refresh');
                selectModifier();
                $alert.hide();
            });
            $alert.find('.btn-default').click(function () {
                $alert.hide();
            });
        }
    });

    var modifiers = function() {};
    modifiers.prototype = {
        show: function (aClient, aAudit) {
            client = aClient;
            audit = aAudit;
            $modal.modal('show');
            if (!select) {
                select = new ModifierSelect({collection: new ModifierCollection(client.get('modifiers'))});
                $select.append(select.render().el);
                select.$el.selectpicker();
                select.el.onchange = selectModifier;
            } else {
                select.collection.reset(client.get('modifiers'));
                select.render();
                select.$el.selectpicker('refresh');
            }
            selectModifier();
        }
    };

    window.modifiers = new modifiers;
})();
