const assetService = require('../../services/assetService');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    userInfo: { name: '张明', id: '888888' },
    usageDays: 128,
    showAmount: true,
    darkMode: false,
    // 数据概览
    assetCount: 8,
    platformCount: 5,
    healthScore: 82,
    reminderCount: 12,
    version: '1.0.0'
  },
  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.setData({ showAmount: assetService.getAmountVisibility() });
    this.loadUserData();
  },
  loadUserData() {
    // 从本地存储加载用户数据
    const userData = wx.getStorageSync('userData');
    if (userData) {
      this.setData({
        usageDays: userData.usageDays || 128,
        assetCount: userData.assetCount || 8,
        platformCount: userData.platformCount || 5,
        healthScore: userData.healthScore || 82,
        reminderCount: userData.reminderCount || 12
      });
    }
  },
  toggleAmount() {
    const show = assetService.toggleAmountVisibility();
    this.setData({ showAmount: show });
    wx.showToast({ title: show ? '已显示金额' : '已隐藏金额', icon: 'none' });
  },
  navigateTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.showToast({ title: `${page} 功能开发中`, icon: 'none' });
  },
  showSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' });
  },
  showToast() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  }
});
