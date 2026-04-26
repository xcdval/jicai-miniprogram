const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    searchKeyword: '',
    depositList: [],
    allDeposits: [],
    totalAmount: '¥ 0',
    depositCount: 0,
    avgRate: 0,
    yearlyIncome: '¥ 0'
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.loadDeposits();
  },

  onShow() {
    this.loadDeposits();
  },

  loadDeposits() {
    const deposits = assetService.getEnrichedAssetsByType('DEPOSIT');
    if (deposits.length === 0) {
      this.setData({
        allDeposits: [],
        depositList: [],
        totalAmount: '¥ 0',
        depositCount: 0,
        avgRate: 0,
        yearlyIncome: '¥ 0'
      });
      return;
    }
    this.setData({
      allDeposits: deposits,
      depositList: deposits
    });
    this.calculateSummary(deposits);
  },

  calculateSummary(deposits) {
    let total = 0;
    let totalRate = 0;
    let yearlyIncomeTotal = 0;

    deposits.forEach(deposit => {
      const amount = deposit.amount || 0;
      const rate = deposit.annualRate || 0;
      total += amount;
      totalRate += rate;
      yearlyIncomeTotal += deposit.dailyIncome * 365;
    });

    const avgRate = deposits.length > 0 ? (totalRate / deposits.length).toFixed(2) : 0;

    this.setData({
      totalAmount: format.formatAmount(total),
      depositCount: deposits.length,
      avgRate: avgRate,
      yearlyIncome: format.formatAmount(yearlyIncomeTotal)
    });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.filterDeposits(keyword);
  },

  filterDeposits(keyword) {
    let filtered = this.data.allDeposits;

    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(kw) ||
        (d.platform && d.platform.toLowerCase().includes(kw))
      );
    }

    this.setData({ depositList: filtered });
  },

  viewDepositDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/asset-edit/asset-edit?id=${id}&type=DEPOSIT`
    });
  },

  addDeposit() {
    wx.showActionSheet({
      itemList: ['手动录入', '截图导入(OCR)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: '/pages/asset-edit/asset-edit?type=DEPOSIT'
          });
        } else {
          wx.navigateTo({
            url: '/pages/asset-ocr/asset-ocr?platform=other'
          });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
