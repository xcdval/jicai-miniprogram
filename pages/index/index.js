// pages/index/index.js
const assetService = require('../../services/assetService');
const format = require('../../utils/format');
const mock = require('../../utils/mock');

Page({
  data: {
    // 系统信息
    statusBarHeight: 44,
    navBarHeight: 44,

    // 金额显示
    showAmount: true,
    totalAmount: 370579.00,
    todayProfit: 1240.50,
    totalProfit: 12580.00,
    totalProfitPercent: 3.51,

    // 市场行情
    marketIndices: [
      { name: '上证指数', code: '000001.SH', price: '3,245.68', changePercent: 0.54 },
      { name: '恒生指数', code: 'HSI.HK', price: '16,832.45', changePercent: 1.23 },
      { name: '恒生科技', code: 'HSTECH.HK', price: '3,456.78', changePercent: -0.32 },
      { name: '标普500', code: 'SPX.US', price: '5,234.12', changePercent: 0.78 },
      { name: '纳斯达克', code: 'NDAQ.US', price: '16,345.67', changePercent: 1.05 }
    ],

    // 资产配置
    allocationData: [
      { type: 'fund', name: '基金', icon: '📊', value: '¥ 154,617', percent: 42, count: 3, change: 2.3 },
      { type: 'stock', name: '股票', icon: '📈', value: '¥ 115,962', percent: 31, count: 5, change: 1.8 },
      { type: 'deposit', name: '存款', icon: '💵', value: '¥ 100,000', percent: 27, count: 1, change: 0 }
    ],

    // 快讯数据
    newsFlash: []
  },

  onLoad() {
    this.initSystemInfo();
    this.loadData();
  },

  onShow() {
    this.refreshData();
  },

  // 初始化系统信息
  initSystemInfo() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height
    });
  },

  // 加载数据
  loadData() {
    // 加载快讯数据
    this.setData({
      newsFlash: mock.newsFlash
    });

    // 加载市场行情
    this.loadMarketData();

    // 刷新资产统计
    this.refreshData();
  },

  // 刷新数据
  async refreshData() {
    try {
      // 刷新行情数据
      await assetService.refreshAssetPrices();
    } catch (e) {
      console.error('刷新行情失败:', e);
    }

    const stats = assetService.calculateStatistics();
    const showAmount = assetService.getAmountVisibility();

    this.setData({
      showAmount,
      totalAmount: stats.totalValue,
      todayProfit: stats.todayProfit,
      totalProfit: stats.totalProfit,
      totalProfitPercent: stats.totalProfitPercent
    });

    // 更新资产配置显示
    this.updateAllocationDisplay(stats.categoryStats);
  },

  // 更新资产配置显示
  updateAllocationDisplay(categoryStats) {
    const total = Object.values(categoryStats).reduce((sum, cat) => sum + cat.value, 0);

    // 模拟涨跌数据
    const changes = {
      FUND: 2.3,
      STOCK: 1.8,
      DEPOSIT: 0
    };

    const counts = {
      FUND: 3,
      STOCK: 5,
      DEPOSIT: 1
    };

    const allocationData = [
      {
        type: 'fund',
        name: '基金',
        icon: '📊',
        value: format.formatAmount(categoryStats.FUND?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.FUND?.value || 0) / total * 100) : 0,
        count: counts.FUND,
        change: changes.FUND
      },
      {
        type: 'stock',
        name: '股票',
        icon: '📈',
        value: format.formatAmount(categoryStats.STOCK?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.STOCK?.value || 0) / total * 100) : 0,
        count: counts.STOCK,
        change: changes.STOCK
      },
      {
        type: 'deposit',
        name: '存款',
        icon: '💵',
        value: format.formatAmount(categoryStats.DEPOSIT?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.DEPOSIT?.value || 0) / total * 100) : 0,
        count: counts.DEPOSIT,
        change: changes.DEPOSIT
      }
    ];

    this.setData({ allocationData });
  },

  // 加载市场行情（模拟数据）
  loadMarketData() {
    this.setData({
      marketIndices: mock.marketData.indices
    });
  },

  // 切换金额显示
  toggleAmountVisibility() {
    const showAmount = assetService.toggleAmountVisibility();
    this.setData({ showAmount });
  },

  // 页面跳转
  gotoAssets() {
    wx.switchTab({ url: '/pages/assets/assets' });
  },

  gotoIntelligence() {
    wx.switchTab({ url: '/pages/intelligence/intelligence' });
  },

  gotoAnalysis() {
    wx.switchTab({ url: '/pages/analysis/analysis' });
  },

  // 添加资产
  addAsset() {
    wx.navigateTo({
      url: '/pages/assets/assets?action=add'
    });
  },

  // 通知和设置
  onNotificationTap() {
    wx.showToast({ title: '暂无新通知', icon: 'none' });
  },

  onSettingsTap() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  }
});
