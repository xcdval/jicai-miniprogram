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
    this.loadFunds();
  },

  onShow() {
    this.loadFunds();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshFunds().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadFunds() {
    const funds = assetService.getEnrichedAssetsByType('FUND');
    if (funds.length === 0) {
      // 无数据时显示空状态
      this.setData({
        allFunds: [],
        fundList: [],
        totalMarketValue: '¥ 0',
        totalProfit: 0,
        todayProfit: 0
      });
      return;
    }
    this.setData({
      allFunds: funds,
      fundList: funds
    });
    this.calculateSummary(funds);
  },

  // 刷新基金数据（带行情）
  async refreshFunds() {
    this.setData({ isLoading: true });
    try {
      // 刷新行情
      await assetService.refreshAssetPrices();
      // 重新加载数据
      this.loadFunds();
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

  calculateSummary(funds) {
    let totalValue = 0;
    let totalCost = 0;
    let todayProfit = 0;

    funds.forEach(fund => {
      const value = fund.marketValue || 0;
      const cost = fund.costValue || 0;
      totalValue += value;
      totalCost += cost;
      todayProfit += fund.todayProfit || 0;
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
      filtered = filtered.filter(f => f.holdings > 0);
    } else if (tab === 'sold') {
      filtered = filtered.filter(f => f.holdings === 0);
    }

    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(kw) ||
        (f.code && f.code.toLowerCase().includes(kw))
      );
    }

    this.setData({ fundList: filtered });
  },

  viewFundDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/asset-edit/asset-edit?id=${id}&type=FUND`
    });
  },

  addFund() {
    wx.showActionSheet({
      itemList: ['手动录入', '截图导入(OCR)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: '/pages/asset-edit/asset-edit?type=FUND'
          });
        } else {
          wx.navigateTo({
            url: '/pages/asset-ocr/asset-ocr?platform=alipay'
          });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
