(function(window) {

    var initialized = false,
        Location = Parse.Object.extend({
            className: 'Location',
            initialize: function() {
                this.on('change', function() {
                    this.save();
                }, this);
            }
        });

    var LocationsCellEditor = ModelCellEditor.extend({
        columnModel: Location
    });

    var LocationsCell = Backgrid.Extension.ArrayObjectCell.extend({
        formatter: {
            fromRaw: function(array) {
                var filteredArray = _.filter(array, function(object) { return object != null;});
                return _.map(filteredArray, function(object) {
                    return object.get('name')
                }).join(", ");
            }
        },
        gridOptions: {
            className: "backgrid table-bordered",
            columns: [
                {name: "name", label: "Name", cell: "string"},
                {name: "id", label: "", cell: ModalDeleteCell, editable: false, sortable: false}
            ]
        },
        editor: LocationsCellEditor
    });

    var clients = function() {};

    clients.prototype = {
        init: function() {
            if (!initialized) {
                initialized = true;
                $('#activity').activity();
                var columns = [{
                    name: "name",
                    label: "Name",
                    cell: "string"
                }, {
                    name: "locations",
                    label: "Locations",
                    cell: LocationsCell,
                    sortable: false
                }, {
                    label: "",
                    sortable: false,
                    editable: false,
                    cell: DeleteCell
                }];

                var grid = new Backgrid.Grid({
                    columns: columns,
                    collection: clientsCollection,
                    className: "backgrid table-bordered"
                });

                $('#clients-table').append(grid.render().el);

                function finished() {
                    $('#add-client').click(function () {
                        clientsCollection.comparator = null;
                        clientsCollection.add(new Client(), {
                            at: 0
                        });
                    });

                    $('#activity').activity(false);
                };

                if (clientsCollection.length == 0) {
                    clientsCollection.fetch({
                        success: finished
                    });
                } else {
                    finished();
                }
            }
        }
    };

    window.clients = new clients;

})(window);