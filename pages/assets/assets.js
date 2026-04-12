const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    activeGroup: 'all',
    groups: [{id:'all',name:'全部'},{id:'group1',name:'稳健型'},{id:'group2',name:'成长型'},{id:'group3',name:'高收益'}],
    showAmount: true, totalAmount: '¥ 370,579.00', totalProfit: 12580, todayProfit: 1240,
    categoryList: [
      {type:'fund',name:'基金',icon:'📊',count:3,amount:'¥ 154,617',change:2.3},
      {type:'stock',name:'股票',icon:'📈',count:5,amount:'¥ 115,962',change:1.8},
      {type:'deposit',name:'存款',icon:'💰',count:1,amount:'¥ 100,000',change:0}
    ]
  },
  onLoad() {
    const sys = wx.getSystemInfoSync(); const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({ statusBarHeight: sys.statusBarHeight, navBarHeight: (menu.top-sys.statusBarHeight)*2+menu.height });
    this.refreshData();
  },
  onShow() { this.refreshData(); },
  async refreshData() {
    try {
      // 刷新行情
      await assetService.refreshAssetPrices();
    } catch (e) {
      console.error('刷新行情失败:', e);
    }

    const stats = assetService.calculateStatistics();
    const show = assetService.getAmountVisibility();

    // 更新分类统计
    const categoryList = this.data.categoryList.map(cat => {
      const typeKey = cat.type.toUpperCase();
      const typeStat = stats.categoryStats[typeKey];
      if (typeStat) {
        return {
          ...cat,
          amount: format.formatAmount(typeStat.value),
          count: typeStat.count
        };
      }
      return cat;
    });

    this.setData({
      showAmount: show,
      totalAmount: format.formatAmount(stats.totalValue),
      totalProfit: stats.totalProfit,
      todayProfit: stats.todayProfit,
      categoryList: categoryList
    });
  },
  switchGroup(e) { this.setData({ activeGroup: e.currentTarget.dataset.id }); },
  toggleAmount() { assetService.toggleAmountVisibility(); this.refreshData(); },
  showAddOptions() {
    wx.showActionSheet({
      itemList: ['手动录入', '截图导入(OCR)', '导入持仓'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: '/pages/asset-edit/asset-edit?type=FUND'
          });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({
            url: '/pages/asset-ocr/asset-ocr'
          });
        } else {
          wx.showToast({ title: '功能开发中', icon: 'none' });
        }
      }
    });
  },
  gotoCategory(e) {
    const type = e.currentTarget.dataset.type;
    const pages = {
      'fund': '/pages/funds/funds',
      'stock': '/pages/stocks/stocks',
      'deposit': '/pages/deposits/deposits'
    };
    const url = pages[type];
    if (url) {
      wx.navigateTo({ url });
    }
  },
  goBack() { wx.switchTab({ url: '/pages/index/index' }); },
  addGroup() { wx.showToast({ title: '添加分组功能开发中', icon: 'none' }); }
});