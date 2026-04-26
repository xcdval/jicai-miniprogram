const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    healthScore: 0,
    healthColor: '#10b981',
    healthDesc: '',
    // 健康评分建议
    suggestions: [],
    // 持仓统计
    statsDetail: {
      totalCount: 0,
      depositRatio: '0',
      stockRatio: '0',
      fundRatio: '0'
    },
    // 图表数据
    assetAllocationData: [],
    industryData: [],
    // 统计概览
    stats: {
      totalReturn: 0,
      totalReturnText: '0',
      totalReturnPercent: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      volatility: 0
    }
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.loadData();
  },

  onShow() {
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadData() {
    // 使用健康评分
    const health = assetService.calculateHealthScore();

    this.setData({
      healthScore: health.score,
      healthColor: health.color,
      healthDesc: health.desc,
      suggestions: health.suggestions || [],
      statsDetail: health.stats || {}
    });

    // 计算资产配置
    this.updateAllocationData();
  },

  async refreshData() {
    try {
      // 刷新行情
      await assetService.refreshAssetPrices();
    } catch (e) {
      console.error('刷新行情失败:', e);
    }

    // 重新计算健康评分
    const health = assetService.calculateHealthScore();

    this.setData({
      healthScore: health.score,
      healthColor: health.color,
      healthDesc: health.desc,
      suggestions: health.suggestions || [],
      statsDetail: health.stats || {}
    });

    // 更新资产配置
    this.updateAllocationData();
  },

  updateAllocationData() {
    const stats = assetService.calculateStatistics();
    const categoryStats = stats.categoryStats;

    // 计算总价值和各分类占比
    const totalValue = (categoryStats.FUND?.value || 0) +
                      (categoryStats.STOCK?.value || 0) +
                      (categoryStats.DEPOSIT?.value || 0);

    const assetAllocationData = [
      {
        name: '基金',
        value: categoryStats.FUND?.value || 0,
        color: '#10b981',
        valueText: format.formatAmount(categoryStats.FUND?.value || 0),
        percent: totalValue > 0 ? Math.round((categoryStats.FUND?.value || 0) / totalValue * 100) : 0
      },
      {
        name: '股票',
        value: categoryStats.STOCK?.value || 0,
        color: '#3b82f6',
        valueText: format.formatAmount(categoryStats.STOCK?.value || 0),
        percent: totalValue > 0 ? Math.round((categoryStats.STOCK?.value || 0) / totalValue * 100) : 0
      },
      {
        name: '存款',
        value: categoryStats.DEPOSIT?.value || 0,
        color: '#f59e0b',
        valueText: format.formatAmount(categoryStats.DEPOSIT?.value || 0),
        percent: totalValue > 0 ? Math.round((categoryStats.DEPOSIT?.value || 0) / totalValue * 100) : 0
      }
    ].filter(item => item.value > 0);

    // 生成conic-gradient
    const conicGradient = this.generateConicGradient(assetAllocationData);

    this.setData({
      assetAllocationData: assetAllocationData,
      conicGradient: conicGradient,
      totalAssetText: totalValue > 0 ? format.formatAmount(totalValue) : '¥ 0',
      stats: {
        totalReturn: stats.totalProfit,
        totalReturnText: format.formatAmount(stats.totalProfit),
        totalReturnPercent: Math.round((stats.totalProfitPercent || 0) * 100) / 100,
        maxDrawdown: stats.maxDrawdown || 0,
        sharpeRatio: stats.sharpeRatio || 0,
        volatility: stats.volatility || 0
      }
    });
  },

  viewDetailReport() {
    wx.showToast({ title: '详细报告功能开发中', icon: 'none' });
  },

  // 跳转到资产页面
  gotoAssets() {
    wx.switchTab({ url: '/pages/assets/assets' });
  },

  // 切换到收益分析
  switchTab() {
    wx.navigateTo({
      url: '/pages/profit-analysis/profit-analysis'
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateTo({ url: '/pages/profit-analysis/profit-analysis' });
  },

  // 生成conic-gradient样式
  generateConicGradient(data) {
    if (!data || data.length === 0) return '';

    let gradient = '';
    let currentPercent = 0;

    data.forEach((item, index) => {
      const percent = item.percent || 0;
      if (percent > 0) {
        if (gradient) gradient += ', ';
        gradient += `${item.color} ${currentPercent}% ${currentPercent + percent}%`;
        currentPercent += percent;
      }
    });

    return gradient;
  }
});
