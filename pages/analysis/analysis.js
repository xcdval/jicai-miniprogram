const mock = require('../../utils/mock');
const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    healthScore: 82,
    healthColor: '#10b981',
    healthDesc: '持仓结构良好，建议适当增加防御性配置',
    // 行业集中度
    concentrationLevel: '较高',
    concentrationValue: 65,
    concentrationTip: '白酒行业占比过高，建议分散配置',
    // 持仓重叠度
    overlapLevel: '低',
    overlapValue: 20,
    overlapTip: '基金持仓重叠较少，配置合理',
    // 图表数据
    assetAllocationData: [],
    profitTrendData: [],
    industryData: [],
    // 时间段选择
    timeRange: '7d',
    timeRanges: [
      { key: '7d', name: '近7日' },
      { key: '30d', name: '近30日' },
      { key: '90d', name: '近3月' },
      { key: '1y', name: '近1年' }
    ],
    // 统计概览
    stats: {
      totalReturn: 12580,
      totalReturnPercent: 8.56,
      maxDrawdown: -5.2,
      sharpeRatio: 1.23,
      volatility: 12.5
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

  loadData() {
    const data = mock.analysisData;
    let color = '#10b981';
    if (data.healthScore < 60) color = '#ef4444';
    else if (data.healthScore < 75) color = '#f59e0b';

    this.setData({
      healthScore: data.healthScore || 82,
      healthColor: color,
      industryData: data.industryData || []
    });

    // 生成模拟收益走势数据
    this.generateProfitTrendData();
  },

  refreshData() {
    // 计算资产配置数据
    const stats = assetService.calculateStatistics();
    const categoryStats = stats.categoryStats;

    // 计算总价值和各分类占比
    const totalValue = (categoryStats.FUND?.value || 0) + (categoryStats.STOCK?.value || 0) + (categoryStats.DEPOSIT?.value || 0);

    const assetAllocationData = [
      { name: '基金', value: categoryStats.FUND?.value || 0, color: '#3b82f6', valueText: ((categoryStats.FUND?.value || 0) / 10000).toFixed(2) + '万', percent: totalValue > 0 ? ((categoryStats.FUND?.value || 0) / totalValue * 100).toFixed(1) : 0 },
      { name: '股票', value: categoryStats.STOCK?.value || 0, color: '#10b981', valueText: ((categoryStats.STOCK?.value || 0) / 10000).toFixed(2) + '万', percent: totalValue > 0 ? ((categoryStats.STOCK?.value || 0) / totalValue * 100).toFixed(1) : 0 },
      { name: '存款', value: categoryStats.DEPOSIT?.value || 0, color: '#f59e0b', valueText: ((categoryStats.DEPOSIT?.value || 0) / 10000).toFixed(2) + '万', percent: totalValue > 0 ? ((categoryStats.DEPOSIT?.value || 0) / totalValue * 100).toFixed(1) : 0 }
    ].filter(item => item.value > 0);

    this.setData({
      assetAllocationData: assetAllocationData,
      stats: {
        totalReturn: stats.totalProfit,
        totalReturnText: this.formatNumber(stats.totalProfit),
        totalReturnPercent: stats.totalProfitPercent,
        maxDrawdown: -5.2,
        sharpeRatio: 1.23,
        volatility: 12.5
      }
    });

    wx.showToast({ title: '刷新成功', icon: 'success' });
  },

  // 生成收益走势数据
  generateProfitTrendData() {
    const ranges = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };

    const days = ranges[this.data.timeRange] || 7;
    const data = [];
    let value = 0;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // 模拟波动数据
      const change = (Math.random() - 0.45) * 1000;
      value += change;

      data.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: Math.round(value),
        date: format.formatDate(date, 'MM-DD')
      });
    }

    this.setData({ profitTrendData: data });
  },

  // 切换时间范围
  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range }, () => {
      this.generateProfitTrendData();
    });
  },

  viewDetailReport() {
    wx.showToast({ title: '详细报告开发中', icon: 'none' });
  },

  // 跳转到资产页面
  gotoAssets() {
    wx.switchTab({ url: '/pages/assets/assets' });
  },

  // 格式化数字
  formatNumber(num) {
    const absNum = Math.abs(num);
    if (absNum >= 100000000) {
      return (num / 100000000).toFixed(2) + '亿';
    } else if (absNum >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    } else if (absNum >= 1000) {
      return num.toLocaleString('zh-CN');
    }
    return num.toFixed(2);
  }
});
