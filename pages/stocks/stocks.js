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
    todayProfit: 0,
    isLoading: false,
    lastUpdateTime: ''
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

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshStocks().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadStocks() {
    const stocks = assetService.getEnrichedAssetsByType('STOCK');
    if (stocks.length === 0) {
      this.setData({
        allStocks: [],
        stockList: [],
        totalMarketValue: '¥ 0',
        totalProfit: 0,
        todayProfit: 0
      });
      return;
    }
    this.setData({
      allStocks: stocks,
      stockList: stocks
    });
    this.calculateSummary(stocks);
  },

  // 刷新股票数据（带行情）
  async refreshStocks() {
    this.setData({ isLoading: true });
    try {
      await assetService.refreshAssetPrices();
      this.loadStocks();
      this.setData({
        lastUpdateTime: format.formatTime(new Date())
      });
      wx.showToast({ title: '刷新成功', icon: 'success' });
    } catch (e) {
      console.error('刷新失败:', e);
      wx.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  calculateSummary(stocks) {
    let totalValue = 0;
    let totalCost = 0;
    let todayProfit = 0;

    stocks.forEach(stock => {
      const value = stock.marketValue || 0;
      const cost = stock.costValue || 0;
      totalValue += value;
      totalCost += cost;
      todayProfit += stock.todayProfit || 0;
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
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(kw) ||
        (s.code && s.code.toLowerCase().includes(kw))
      );
    }

    this.setData({ stockList: filtered });
  },

  viewStockDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/asset-edit/asset-edit?id=${id}&type=STOCK`
    });
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
