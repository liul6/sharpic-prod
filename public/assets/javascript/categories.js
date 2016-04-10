(function() {
    var collection = null,
        grid = null,
        $modal = $('#categories-modal'),
        $grid = $('#categories-table');

    var Category = Parse.Object.extend({
            className: 'Category',
            initialize: function () {
                var self = this;
                this.on('change', function () {
                    this.save();
                }, this);
            }
        });

    var CategoryDeleteCell = DeleteCell.extend({
        deleteRow: function (e) {
            e.preventDefault();
            var model = this.model;
            var $alert = $('#category-delete-alert');
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

    var CategorySelect2CellEditor = Backgrid.Extension.Select2CellEditor.extend({
        tagName: "input",
        attributes: {
            type: 'hidden'
        },
        self: null,
        multiple: true,
        render: function () {
            this.$el.select2({ tags: this.model.get('tags')});
            this.$el.select2('val', this.model.get('tags'));
            return this;
        },
        postRender: function () {
            var self = this;
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
        initialize: function () {
            self = this;
            Backgrid.SelectCellEditor.prototype.initialize.apply(this, arguments);
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

    var CategorySelect2Cell = Backgrid.Extension.Select2Cell.extend({
        optionValues: function() {
            return [];
        },
        formatter: {
            toRaw: function(categories) {
                return categories.split(',');
            }
        },
        render: function () {
            this.$el.empty();
            var model = this.model;
            if (model.get('tags')) {
                this.$el.append(model.get('tags').join());
            }
            this.delegateEvents();
            return this;
        },
        editor: CategorySelect2CellEditor
    });

    var columns = [
        {name: "name", label: "Name", cell: "string"},
        {name: "tags", label: "Tags", cell: CategorySelect2Cell },
        {name: "id", label: "", cell: CategoryDeleteCell, editable: false, sortable: false}
    ];

    var categories = function() {};
    categories.prototype = {
        show: function () {
            if (!collection) {
                var query = new Parse.Query(Category);
                collection = query.collection();
                if (!grid) {
                    grid = new Backgrid.Grid({
                        columns: columns,
                        collection: collection,
                        className: "backgrid table-bordered"
                    });
                    $grid.append(grid.render().el);
                    $('#add-category').click(function() {
                        collection.add(new Category({
                            tags: []
                        }), {
                            at: 0
                        });
                    });
                }
                collection.fetch();
            }
            $modal.modal('show');
        }
    };

    window.categories = new categories;
})();