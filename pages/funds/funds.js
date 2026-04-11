const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    activeTab: 'all',
    searchKeyword: '',
    fundList: [],
    allFunds: [],
    totalMarketValue: '¥ 0',
    totalProfit: 0,
    todayProfit: 0
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.loadFunds();
  },

  onShow() {
    this.loadFunds();
  },

  loadFunds() {
    const funds = assetService.getFundsByCategory('fund') || this.getMockFunds();
    this.setData({
      allFunds: funds,
      fundList: funds
    });
    this.calculateSummary(funds);
  },

  getMockFunds() {
    return [
      {
        id: 1,
        name: '易方达蓝筹精选混合',
        code: '005827',
        platform: '支付宝',
        costPrice: '2.4567',
        nav: '2.5234',
        marketValue: '¥ 86,400',
        shares: '34,252',
        profit: 5840,
        profitPercent: 7.21,
        todayChange: 2.3
      },
      {
        id: 2,
        name: '招商中证白酒指数',
        code: '161725',
        platform: '天天基金',
        costPrice: '1.2345',
        nav: '1.1876',
        marketValue: '¥ 45,600',
        shares: '38,400',
        profit: -2340,
        profitPercent: -5.12,
        todayChange: -1.2
      },
      {
        id: 3,
        name: '华夏能源革新股票',
        code: '003834',
        platform: '支付宝',
        costPrice: '3.4567',
        nav: '3.7890',
        marketValue: '¥ 22,617',
        shares: '5,969',
        profit: 1860,
        profitPercent: 8.45,
        todayChange: 3.1
      }
    ];
  },

  calculateSummary(funds) {
    let totalValue = 0;
    let totalCost = 0;
    let todayProfit = 0;

    funds.forEach(fund => {
      const value = parseFloat(fund.marketValue.replace(/[¥,]/g, ''));
      const shares = parseFloat(fund.shares.replace(/,/g, ''));
      const cost = parseFloat(fund.costPrice) * shares;
      totalValue += value;
      totalCost += cost;
      todayProfit += value * fund.todayChange / 100;
    });

    this.setData({
      totalMarketValue: format.formatAmount(totalValue),
      totalProfit: totalValue - totalCost,
      todayProfit: todayProfit
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterFunds(tab, this.data.searchKeyword);
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.filterFunds(this.data.activeTab, keyword);
  },

  filterFunds(tab, keyword) {
    let filtered = this.data.allFunds;

    if (tab === 'holding') {
      filtered = filtered.filter(f => f.shares > 0);
    } else if (tab === 'sold') {
      filtered = filtered.filter(f => f.shares === 0);
    }

    if (keyword) {
      filtered = filtered.filter(f =>
        f.name.includes(keyword) || f.code.includes(keyword)
      );
    }

    this.setData({ fundList: filtered });
  },

  viewFundDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '查看详情开发中', icon: 'none' });
  },

  addFund() {
    wx.showActionSheet({
      itemList: ['手动录入', '截图导入(OCR)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showToast({ title: '手动录入开发中', icon: 'none' });
        } else {
          wx.showToast({ title: 'OCR识别开发中', icon: 'none' });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
