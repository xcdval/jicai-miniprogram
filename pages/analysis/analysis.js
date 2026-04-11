const mock = require('../../utils/mock');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    healthScore: 78,
    healthColor: '#10b981',
    healthDesc: '持仓结构良好，建议适当增加防御性配置',
    industryData: [],
    suggestions: []
  },
  onLoad() {
    const sys = wx.getSystemInfoSync(); const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({ statusBarHeight: sys.statusBarHeight, navBarHeight: (menu.top-sys.statusBarHeight)*2+menu.height });
    this.loadData();
  },
  loadData() {
    const data = mock.analysisData;
    let color = '#10b981';
    if(data.healthScore < 60) color = '#ef4444';
    else if(data.healthScore < 75) color = '#f59e0b';
    this.setData({ healthScore: data.healthScore, healthColor: color, industryData: data.industryData, suggestions: data.suggestions });
  }
});