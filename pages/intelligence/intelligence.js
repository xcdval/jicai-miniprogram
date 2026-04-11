const mock = require('../../utils/mock');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    activePhase: 'morning',
    aiData: {},
    newsFlash: []
  },
  onLoad() {
    const sys = wx.getSystemInfoSync(); const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({ statusBarHeight: sys.statusBarHeight, navBarHeight: (menu.top-sys.statusBarHeight)*2+menu.height });
    this.loadData();
  },
  loadData() {
    this.setData({ aiData: mock.aiDecision, newsFlash: mock.newsFlash });
  },
  switchPhase(e) {
    const phase = e.currentTarget.dataset.phase;
    this.setData({ activePhase: phase });
  }
});