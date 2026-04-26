// pages/privacy/privacy.js
Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44
  },

  onLoad() {
    this.initSystemInfo();
  },

  initSystemInfo() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height
    });
  },

  goBack() {
    wx.navigateBack();
  }
});