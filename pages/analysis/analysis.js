const mock = require('../../utils/mock');

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
    industryData: []
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
  },
  refreshData() {
    wx.showToast({ title: '刷新成功', icon: 'success' });
    this.loadData();
  },
  viewDetailReport() {
    wx.showToast({ title: '详细报告开发中', icon: 'none' });
  }
});
