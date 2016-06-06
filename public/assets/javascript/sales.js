(function(window) {

    var collection = null,
        grid = null,
        clientSelect = null,
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

    var sales = function() {};
    
    sales.prototype = {
        init: function() {
            if (!client) {
                hideAll();
                $activity.activity();
                var queries = [];
            }
        }
    };

    window.sales = new sales;

})(window);
