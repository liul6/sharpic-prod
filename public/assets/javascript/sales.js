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
            $addSale.hide();
            $salesTable.hide();
            $activity.activity();
            var query = new Parse.Query(Sale);
            var objectIds = [];
            
            if(nowAudit.get('sales')) {
                objectIds = nowAudit.get('sales').map(function(sale) { return sale.id; });
            }
            
            if(!objectIds || objectIds.length<=0) {
                objectIds = nowAudit.get('saleIds')
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
                        saleclientSelect = new ClientSelect({id: 'audit-client-select-picker'});
                        $('#audit-client-select').append(saleclientSelect.render().el);
                        $('#audit-client-select-picker').selectpicker();
                    }
                    saleclientSelect.el.onchange = clientSelectChange;
                });
            }
        }
    };

    window.sales = new sales;

})(window);
