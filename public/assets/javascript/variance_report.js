(function(window) {

  var VarianceReport = Backbone.View.extend({
      tagName: 'div',
      initialize: function (options) {
        this.tag = options.tag;
        this.nowAudit = options.nowAudit;
        this.beforeAudit = options.beforeAudit;
      },
      template: _.template(['<table class="table table-striped table-bordered" cellspacing="0" width="100%">',
                '<thead>',
                    '<tr>',
                    '    <th colspan="1" class="right-border"><%= tag %></th>',
                    '    <th colspan="2" id="before" class="right-border">Before</th>',
                    '    <th class="right-border">Inc.</th>',
                    '    <th colspan="2" id="now" class="right-border">Now</th>',
                    '    <th colspan="2" class="right-border"></th>',
                    '    <th colspan="5" class="right-border">Variance</th>',
                    '</tr>',
                    '<tr>',
                    '    <th>Product</th>',
                    '    <th>Partials</th>',
                    '    <th>Fulls</th>',
                    '    <th>Fulls</th>',
                    '    <th>Partials</th>',
                    '    <th>Fulls</th>',
                    '    <th>Sold</th>',
                    '    <th>Depleted</th>',
                    '    <th>Fulls</th>',
                    '    <th>Ounces</th>',
                    '    <th>Cost $</th>',
                    '    <th>Retail $</th>',
                    '    <th>%</th>',
                    '</tr>',
                '</thead>',
                '<tfoot>',
                    '<tr>',
                    '    <th colspan="6"></th>',
                    '    <th class="depleted-total"></th>',
                    '    <th class="sales-total"></th>',
                    '    <th class="variance-fulls-total"></th>',
                    '    <th class="variance-ounces-total"></th>',
                    '    <th class="variance-cost-total"></th>',
                    '    <th class="variance-retail-total"></th>',
                    '    <th></th>',
                    '</tr>',
                '</tfoot>',
            '</table>',
            ].join("\n")),
      render: function () {
        var $el = this.$el;
        $el.html(this.template({ tag: this.tag.get('tag')}));
        var $table = $el.find('.table');
        $el.find('.before').text(this.beforeAudit.createdAt.toDateString());
        $el.find('.now').text(this.nowAudit.createdAt.toDateString());
        $table.DataTable().destroy();
        var table = $table.DataTable({
            'data': this.tag.get('tableData'),
            'pageLength': 25,
            'columns': [
                {'title': 'Product', 'width': '250px', className: 'right-border'},
                {'title': 'Partials', 'defaultContent': '-'},
                {'title': 'Fulls', 'defaultContent': '-', className: 'right-border'},
                {'title': '', 'width': '30px', 'defaultContent': '-', className: 'right-border'},
                {'title': 'Partials', 'defaultContent': '-'},
                {'title': 'Fulls', 'defaultContent': '-', className: 'right-border'},
                {'title': 'Depleted', 'defaultContent': '-'},
                {'title': 'Sold', 'defaultContent': '-', className: 'right-border'},
                {'title': 'Fulls', 'defaultContent': '-'},
                {'title': 'Oz', 'defaultContent': '-'},
                {'title': 'Cost $', 'defaultContent': '-'},
                {'title': 'Retail $', 'defaultContent': '-'},
                {'title': '%', 'defaultContent': '-'}
            ],
            columnDefs: [
                {type: 'pints', targets: [6, 7]}
            ]
        });

        $el.find('.variance-cost-total').text(formatMoney(-this.tag.get('totalCostVariance')));
        $el.find('.variance-retail-total').text(formatMoney(-this.tag.get('totalRetailVariance')));
        $el.find('.variance-fulls-total').text(this.tag.get('totalFullsVariance'));
        $el.find('.variance-ounces-total').text(this.tag.get('totalOuncesVariance').toFixed(2));
        var salesTotal = this.tag.get('totalSalesFulls') == 0 ? this.tag.get('totalSalesOunces').toFixed(2) : this.tag.get('totalSalesFulls');
        if (this.tag.get('totalSalesFulls') != 0 && this.tag.get('totalSalesOunces') != 0) {
            salesTotal = '-';
        }
        $el.find('.sales-total').text(salesTotal);
        var depletedTotal = this.tag.get('totalDepletedFulls') == 0 ? this.tag.get('totalDepletedOunces').toFixed(2) : this.tag.get('totalDepletedFulls');
        if (this.tag.get('totalDepletedFulls') != 0 && this.tag.get('totalDepletedOunces') != 0) {
            depletedTotal = '-';
        }
        $el.find('.depleted-total').text(depletedTotal);
        var _this = this;
        $table.unbind('click').on( 'click', 'td', function () {
            var product = _.last(_this.tag.get('tableData')[table.cell( this ).index().row]).get('product');
            reports.presentModal(product);
        });

        return this;
      }
  });

  window.VarianceReport = VarianceReport;

})(window);
