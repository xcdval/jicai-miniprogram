const assetService = require('../../services/assetService');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    userInfo: { name: '用户', id: '888888' },
    showAmount: true, darkMode: false
  },
  onLoad() {
    const sys = wx.getSystemInfoSync(); const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({ statusBarHeight: sys.statusBarHeight, navBarHeight: (menu.top-sys.statusBarHeight)*2+menu.height });
    this.setData({ showAmount: assetService.getAmountVisibility() });
  },
  toggleAmount() {
    const show = assetService.toggleAmountVisibility();
    this.setData({ showAmount: show });
    wx.showToast({ title: show ? '已显示金额' : '已隐藏金额', icon: 'none' });
  },
  showToast() { wx.showToast({ title: '功能开发中', icon: 'none' }); }
});