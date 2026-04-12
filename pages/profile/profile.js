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
    version: '1.0.0',
    storageInfo: {}
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

  // 导出数据
  exportData() {
    try {
      const data = assetService.exportData();
      const dataStr = JSON.stringify(data, null, 2);

      // 复制到剪贴板
      wx.setClipboardData({
        data: dataStr,
        success: () => {
          wx.showModal({
            title: '导出成功',
            content: '数据已复制到剪贴板，请粘贴保存到安全的地方',
            showCancel: false
          });
        }
      });
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },

  // 导入数据
  importData() {
    wx.showModal({
      title: '导入数据',
      content: '此操作将覆盖现有数据，请确保已备份。粘贴数据后点击确定。',
      editable: true,
      placeholderText: '请粘贴之前导出的JSON数据',
      success: (res) => {
        if (res.confirm && res.content) {
          try {
            const jsonData = JSON.parse(res.content);
            const result = assetService.importData(jsonData);

            if (result.success) {
              wx.showToast({ title: '导入成功', icon: 'success' });
              this.loadUserData();
            } else {
              wx.showToast({ title: result.message, icon: 'none' });
            }
          } catch (e) {
            wx.showToast({ title: '数据格式错误', icon: 'none' });
          }
        }
      }
    });
  },

  // 清空数据
  clearData() {
    wx.showModal({
      title: '清空数据',
      content: '此操作将删除所有资产数据，无法恢复！确定继续吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '再次确认',
            content: '数据清空后无法恢复，是否已备份？',
            success: (res2) => {
              if (res2.confirm) {
                assetService.clearAllData();
                wx.showToast({ title: '数据已清空', icon: 'success' });
                this.loadUserData();
              }
            }
          });
        }
      }
    });
  },

  // 显示存储信息
  showStorageInfo() {
    const info = wx.getStorageInfoSync();
    const usedMB = (info.currentSize / 1024).toFixed(2);
    const limitMB = (info.limitSize / 1024).toFixed(2);

    wx.showModal({
      title: '存储空间',
      content: `已使用: ${usedMB} MB\n总容量: ${limitMB} MB\nKeys: ${info.keys.length}`,
      showCancel: false
    });
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
