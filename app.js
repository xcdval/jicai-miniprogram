// app.js - 小程序入口
App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    isLogin: false
  },

  onLaunch() {
    console.log('集财小程序启动');

    // 获取系统信息
    this.getSystemInfo();

    // 初始化本地存储
    this.initStorage();

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 获取系统信息
  getSystemInfo() {
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;

    // 计算导航栏高度
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height;

    this.globalData.navBarHeight = navBarHeight;
    this.globalData.statusBarHeight = statusBarHeight;
    this.globalData.menuButtonInfo = menuButtonInfo;
  },

  // 初始化本地存储
  initStorage() {
    const storage = require('./utils/storage');

    // 检查是否是首次使用
    const isFirstUse = !storage.get('user_assets_v2');

    if (isFirstUse) {
      console.log('首次使用，初始化默认数据');
      this.initDefaultData();
    }
  },

  // 初始化默认数据
  initDefaultData() {
    const storage = require('./utils/storage');
    const mockData = require('./utils/mock');

    // 初始化资产分组
    storage.set('asset_groups', mockData.defaultGroups);

    // 初始化资产数据
    storage.set('user_assets_v2', mockData.defaultAssets);

    // 初始化用户偏好
    storage.set('user_prefs', {
      showAmount: true,
      theme: 'light',
      currency: 'CNY'
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    this.globalData.isLogin = !!token;
  },

  // 全局错误处理
  onError(msg) {
    console.error('小程序错误:', msg);
  },

  // 页面不存在处理
  onPageNotFound(res) {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  }
});
