(function(window) {

    var CostReport = Backbone.View.extend({
      tagName: 'div',
      initialize: function (options) {
        this.tag = options.tag;
        this.nowAudit = options.nowAudit;
        this.beforeAudit = options.beforeAudit;
      },
      template: _.template(['<table class="table table-striped table-bordered" cellspacing="0" width="100%">',
                              '<thead>',
                              '  <tr>',
                              '      <th class="right-border"><%= tag %></th>',
                              '      <th colspan="3" class="right-border">Stock</th>',
                              '      <th colspan="2" class="right-border">Incoming</th>',
                              '  </tr>',
                              '  <tr>',
                              '      <th>Product</th>',
                              '      <th>Partials</th>',
                              '      <th>Fulls</th>',
                              '      <th>Cost</th>',
                              '      <th>Fulls</th>',
                              '      <th>Cost</th>',
                              '  </tr>',
                              '  </thead>',
                              '  <tfoot>',
                              '  <tr>',
                              '      <th></th>',
                              '      <th class="cost-total" colspan="3" style="text-align:right">Total:</th>',
                              '      <th class="incoming-total" colspan="2" style="text-align:right">Total:</th>',
                              '  </tr>',
                              '  </tfoot>',
                              '</table>',
                          ].join("\n")),
    render: function () {
        var $el = this.$el;
        $el.html(this.template({ tag: this.tag.get('tag')}));
        var $table = $el.find('.table');
        $table.DataTable().destroy();
        var table = $table.DataTable({
            'data': this.tag.get('tableData'),
            'pageLength': 25,
            'columns': [
                {'title': 'Product', 'width': '250px', defaultContent: '-', className: 'right-border'},
                {'title': 'Partials', 'defaultContent': '-'},
                {'title': 'Fulls', 'defaultContent': '-'},
                {'title': 'Cost', 'defaultContent': '-', className: 'right-border'},
                {'title': 'Fulls', 'defaultContent': '-'},
                {'title': 'Cost', 'defaultContent': '-'}
            ]
        });
        $el.find('.cost-total').html('Total cost: ' + formatMoney(this.tag.get('totalCost')));
        $el.find('.incoming-total').html('Total cost: ' + formatMoney(this.tag.get('incomingCost')));
        var _this = this;
        $table.unbind('click').on( 'click', 'td', function () {
            var product = _.last(_this.tag.get('tableData')[table.cell( this ).index().row]).get('product');
            reports.presentModal(product);
        });

        return this;
    }
  });

  window.CostReport = CostReport;

})(window);
