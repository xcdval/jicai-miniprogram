const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    activeTab: 'all',
    searchKeyword: '',
    stockList: [],
    allStocks: [],
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
    this.loadStocks();
  },

  onShow() {
    this.loadStocks();
  },

  loadStocks() {
    const stocks = assetService.getAssetsByType('STOCK') || this.getMockStocks();
    this.setData({
      allStocks: stocks,
      stockList: stocks
    });
    this.calculateSummary(stocks);
  },

  getMockStocks() {
    return [
      {
        id: 1,
        name: '贵州茅台',
        code: '600519',
        platform: '华泰证券',
        costPrice: '1,520.00',
        currentPrice: '1,568.00',
        marketValue: '¥ 78,400',
        holdings: '50',
        profit: 2400,
        profitPercent: 3.16,
        todayChange: 1.5
      },
      {
        id: 2,
        name: '宁德时代',
        code: '300750',
        platform: '华泰证券',
        costPrice: '205.00',
        currentPrice: '198.50',
        marketValue: '¥ 19,850',
        holdings: '100',
        profit: -650,
        profitPercent: -3.17,
        todayChange: -0.8
      },
      {
        id: 3,
        name: '比亚迪',
        code: '002594',
        platform: '东方财富',
        costPrice: '245.00',
        currentPrice: '262.50',
        marketValue: '¥ 26,250',
        holdings: '100',
        profit: 1750,
        profitPercent: 7.14,
        todayChange: 2.3
      }
    ];
  },

  calculateSummary(stocks) {
    let totalValue = 0;
    let totalCost = 0;
    let todayProfit = 0;

    stocks.forEach(stock => {
      const value = parseFloat(stock.marketValue.replace(/[¥,]/g, ''));
      const holdings = parseFloat(stock.holdings);
      const cost = parseFloat(stock.costPrice.replace(/,/g, '')) * holdings;
      totalValue += value;
      totalCost += cost;
      todayProfit += value * stock.todayChange / 100;
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
    this.filterStocks(tab, this.data.searchKeyword);
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.filterStocks(this.data.activeTab, keyword);
  },

  filterStocks(tab, keyword) {
    let filtered = this.data.allStocks;

    if (tab === 'holding') {
      filtered = filtered.filter(s => s.holdings > 0);
    } else if (tab === 'sold') {
      filtered = filtered.filter(s => s.holdings === 0);
    }

    if (keyword) {
      filtered = filtered.filter(s =>
        s.name.includes(keyword) || s.code.includes(keyword)
      );
    }

    this.setData({ stockList: filtered });
  },

  viewStockDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '查看详情开发中', icon: 'none' });
  },

  addStock() {
    wx.showActionSheet({
      itemList: ['手动录入', '截图导入(OCR)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: '/pages/asset-edit/asset-edit?type=STOCK'
          });
        } else {
          wx.navigateTo({
            url: '/pages/asset-ocr/asset-ocr?platform=eastmoney'
          });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
