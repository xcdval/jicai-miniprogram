const mock = require('../../utils/mock');
const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    // 图表数据
    profitTrendData: [],
    // 时间段选择
    timeRange: '7d',
    timeRanges: [
      { key: '7d', name: '近7日' },
      { key: '30d', name: '近30日' },
      { key: '90d', name: '近3月' },
      { key: '1y', name: '近1年' }
    ],
    currentRangeName: '近7日',
    // 统计概览
    stats: {
      totalReturn: 12580,
      totalReturnText: '1.26万',
      totalReturnPercent: 8.56,
      maxDrawdown: -5.2,
      sharpeRatio: 1.23,
      volatility: 12.5
    },
    sharpePercent: 60,
    volatilityPercent: 40,
    // 收益明细
    todayProfit: 1240.50,
    todayProfitText: '1,240.50',
    todayDate: '',
    weekProfit: 3250.80,
    weekProfitText: '3,250.80',
    weekDateRange: '',
    monthProfit: 8560.20,
    monthProfitText: '8,560.20',
    monthDateRange: '',
    yearProfit: 12580.00,
    yearProfitText: '1.26万',
    yearDateRange: '',
    // 收益排行
    profitRank: [
      { name: '贵州茅台', type: '股票', profit: 15.8 },
      { name: '易方达蓝筹', type: '基金', profit: 12.3 },
      { name: '宁德时代', type: '股票', profit: 8.5 },
      { name: '招商白酒', type: '基金', profit: 6.2 },
      { name: '工商银行', type: '股票', profit: 3.1 }
    ]
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.loadData();
    this.updateDateInfo();
  },

  onShow() {
    this.refreshData();
  },

  loadData() {
    // 生成模拟收益走势数据
    this.generateProfitTrendData();
  },

  refreshData() {
    const stats = assetService.calculateStatistics();
    const todayProfit = stats.todayProfit || 1240.50;
    const weekProfit = stats.weekProfit || 3250.80;
    const monthProfit = stats.monthProfit || 8560.20;
    const yearProfit = stats.totalProfit || 12580.00;

    this.setData({
      todayProfit: todayProfit,
      todayProfitText: this.formatNumber(todayProfit),
      weekProfit: weekProfit,
      weekProfitText: this.formatNumber(weekProfit),
      monthProfit: monthProfit,
      monthProfitText: this.formatNumber(monthProfit),
      yearProfit: yearProfit,
      yearProfitText: this.formatNumber(yearProfit),
      stats: {
        totalReturn: stats.totalProfit,
        totalReturnText: this.formatNumber(stats.totalProfit),
        totalReturnPercent: stats.totalProfitPercent,
        maxDrawdown: -5.2,
        sharpeRatio: this.calculateSharpeRatio(),
        volatility: this.calculateVolatility()
      },
      sharpePercent: Math.min(100, this.calculateSharpeRatio() / 2 * 100),
      volatilityPercent: Math.min(100, this.calculateVolatility() / 30 * 100)
    });

    wx.showToast({ title: '刷新成功', icon: 'success' });
  },

  // 更新日期信息
  updateDateInfo() {
    const now = new Date();
    const today = format.formatDate(now, 'MM-DD');

    // 本周范围
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // 本月范围
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 本年范围
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31);

    this.setData({
      todayDate: today,
      weekDateRange: `${format.formatDate(weekStart, 'MM-DD')} 至 ${format.formatDate(weekEnd, 'MM-DD')}`,
      monthDateRange: `${format.formatDate(monthStart, 'MM-DD')} 至 ${format.formatDate(monthEnd, 'MM-DD')}`,
      yearDateRange: `${format.formatDate(yearStart, 'MM-DD')} 至 ${format.formatDate(yearEnd, 'MM-DD')}`
    });
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
    const rangeName = this.data.timeRanges.find(r => r.key === this.data.timeRange)?.name || '近7日';
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

    this.setData({
      profitTrendData: data,
      currentRangeName: rangeName
    });
  },

  // 切换时间范围
  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range }, () => {
      this.generateProfitTrendData();
    });
  },

  // 切换到持仓分析
  switchTab() {
    wx.navigateTo({
      url: '/pages/analysis/analysis'
    });
  },

  // 计算夏普比率（模拟）
  calculateSharpeRatio() {
    return +(Math.random() * 2 + 0.5).toFixed(2);
  },

  // 计算波动率（模拟）
  calculateVolatility() {
    return +(Math.random() * 20 + 5).toFixed(2);
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
  },

  viewDetailReport() {
    wx.showToast({ title: '详细报告开发中', icon: 'none' });
  }
});
