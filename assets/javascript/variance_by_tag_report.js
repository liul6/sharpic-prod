(function(window) {

  var VarianceByTagReport = Backbone.View.extend({
      tagName: 'div',
      initialize: function (options) {
        this.tags = options.tags;
        this.nowAudit = options.nowAudit;
        this.beforeAudit = options.beforeAudit;
      },
      template: _.template(['<table class="table table-striped table-bordered" cellspacing="0" width="100%">',
                '<thead>',
                    '<tr>',
                    '    <th colspan="3" class="right-border"></th>',
                    '    <th colspan="4" class="right-border">Variance</th>',
                    '</tr>',
                    '<tr>',
                    '    <th>Product</th>',
                    '    <th>Sold</th>',
                    '    <th>Depleted</th>',
                    '    <th>Fulls</th>',
                    '    <th>Ounces</th>',
                    '    <th>Cost $</th>',
                    '    <th>Retail $</th>',
                    '</tr>',
                '</thead>',
            '</table>',
            ].join("\n")),
      render: function () {
        var $el = this.$el;
        $el.html(this.template());
        var $table = $el.find('.table');
        var tableData = [];
        _.each(this.tags, function (tag) {
            var salesTotal = tag.get('totalSalesFulls') == 0 ? tag.get('totalSalesOunces').toFixed(2) : tag.get('totalSalesFulls');
            if (tag.get('totalSalesFulls') != 0 && tag.get('totalSalesOunces') != 0) {
                salesTotal = '-';
            }
            var depletedTotal = tag.get('totalDepletedFulls') == 0 ? tag.get('totalDepletedOunces').toFixed(2) : tag.get('totalDepletedFulls');
            if (tag.get('totalDepletedFulls') != 0 && tag.get('totalDepletedOunces') != 0) {
                depletedTotal = '-';
            }
            tableData.push([tag.get('tag'),
            depletedTotal,
            salesTotal,
            tag.get('totalFullsVariance'),
            tag.get('totalOuncesVariance').toFixed(2),
            formatMoney(-tag.get('totalCostVariance')),
            formatMoney(-tag.get('totalRetailVariance'))]);
        });
        $table.DataTable().destroy();
        var table = $table.DataTable({
            'data': tableData,
            'pageLength': 100,
            'columns': [
                {'title': 'Product', className: 'right-border'},
                {'title': 'Depleted', 'defaultContent': '-'},
                {'title': 'Sold', 'defaultContent': '-', className: 'right-border'},
                {'title': 'Fulls', 'defaultContent': '-'},
                {'title': 'Oz', 'defaultContent': '-'},
                {'title': 'Cost $', 'defaultContent': '-'},
                {'title': 'Retail $', 'defaultContent': '-'}
            ]
        });

        return this;
      }
  });

  window.VarianceByTagReport = VarianceByTagReport;

})(window);
