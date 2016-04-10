(function(window) {

    var SalesReport = Backbone.View.extend({
      tagName: 'div',
      initialize: function (options) {
        this.tag = options.tag;
        this.nowAudit = options.nowAudit;
        this.beforeAudit = options.beforeAudit;
      },
      template: _.template(['<table class="table table-striped table-bordered" cellspacing="0" width="100%">',
			'<thead>',
			'   <tr>',
			'       <th><%= tag %> Sales Margin Analysis</th>',
			'       <th>Without Variance</th>',
			'       <th>With Variance</th>',
			'   </tr>',
			'</thead>',
			'<tfoot>',
			'   <tr>',
			'       <th>Cost of Variance:</th>',
			'       <th class="variance-cost-total" colspan="2"></th>',
			'   </tr>',
			'   </tfoot>',
			'</table>',
                          ].join("\n")),
    render: function () {
        var $el = this.$el;
        $el.html(this.template({ tag: this.tag.get('tag')}));
        var $table = $el.find('.table');
        $table.DataTable().destroy();
		var grossPercentage = this.tag.get('totalSales') > 0 ? ((this.tag.get('totalSales') - this.tag.get('totalSalesCost')) / this.tag.get('totalSales')).toFixed(2) : 0;
		var grossVariancePercentage = this.tag.get('totalSales') > 0 ? ((this.tag.get('totalSales') - this.tag.get('totalSalesCost') - this.tag.get('totalCostVariance')) / this.tag.get('totalSales')).toFixed(2) : 0;
        var salesPercentage = this.tag.get('totalSalesCost') / this.tag.get('totalSales');
        var salesVariancePercentage = this.tag.get('totalSales') > 0 ? (this.tag.get('totalSalesCost') + this.tag.get('totalCostVariance')) / this.tag.get('totalSales') : 0;
		var tableData = [
			['Total Sales', formatMoney(this.tag.get('totalSales')), formatMoney(this.tag.get('totalSales'))],
			['Cost of Sales', formatMoney(this.tag.get('totalSalesCost')), formatMoney(this.tag.get('totalSalesCost') + this.tag.get('totalCostVariance'))],
            ['Cost of Sales %', (isNaN(salesPercentage) ? '-' : (salesPercentage * 100).toFixed(0) + '%'), (isNaN(salesVariancePercentage) ? '-' : (salesVariancePercentage * 100).toFixed(0) + '%')],
			['Gross Profit', formatMoney(this.tag.get('totalSales') - this.tag.get('totalSalesCost')), formatMoney(this.tag.get('totalSales') - this.tag.get('totalSalesCost') - this.tag.get('totalCostVariance'))],
			['Gross Profit %', (isNaN(grossPercentage) ? '-' : (grossPercentage * 100).toFixed(0) + '%'), (isNaN(grossVariancePercentage) ? '-' : (grossVariancePercentage * 100).toFixed(0) + '%')]
		];
		$table.DataTable({
			data: tableData,
			ordering: false,
			searching: false,
			paging: false,
			info: false,
			'columns': [
				{'title': this.tag.get('tag') + ' Sales Margin Analysis', defaultContent: '-', width: '33%'},
				{'title': 'Without Variance', 'defaultContent': '-', width: '33%'},
				{'title': 'With Variance', 'defaultContent': '-', width: '33%'}
			]
		});
		$el.find('.variance-cost-total').text(formatMoney(-this.tag.get('totalCostVariance')));

        return this;
    }
  });

  window.SalesReport = SalesReport;

})(window);
