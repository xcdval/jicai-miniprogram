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
    const deposits = assetService.getAssetsByType('DEPOSIT') || this.getMockDeposits();
    this.setData({
      allDeposits: deposits,
      depositList: deposits
    });
    this.calculateSummary(deposits);
  },

  getMockDeposits() {
    return [
      {
        id: 1,
        name: '招商银行定期存款',
        bank: '招商银行',
        rate: 2.8,
        term: '3年',
        amount: '¥ 50,000',
        dueDate: '2027-03-15',
        dailyIncome: '¥ 3.84'
      },
      {
        id: 2,
        name: '工商银行活期存款',
        bank: '工商银行',
        rate: 1.5,
        term: '活期',
        amount: '¥ 50,000',
        dueDate: '随时可取',
        dailyIncome: '¥ 2.05'
      }
    ];
  },

  calculateSummary(deposits) {
    let total = 0;
    let totalRate = 0;

    deposits.forEach(deposit => {
      const amount = parseFloat(deposit.amount.replace(/[¥,]/g, ''));
      total += amount;
      totalRate += deposit.rate;
    });

    const avgRate = deposits.length > 0 ? (totalRate / deposits.length).toFixed(2) : 0;
    const yearlyIncome = total * avgRate / 100;

    this.setData({
      totalAmount: format.formatAmount(total),
      depositCount: deposits.length,
      avgRate: avgRate,
      yearlyIncome: format.formatAmount(yearlyIncome)
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
      filtered = filtered.filter(d =>
        d.name.includes(keyword) || d.bank.includes(keyword)
      );
    }

    this.setData({ depositList: filtered });
  },

  viewDepositDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '查看详情开发中', icon: 'none' });
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
