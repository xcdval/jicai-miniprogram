const assetService = require('../../services/assetService');
const intelligenceService = require('../../services/intelligenceService');
const ocrService = require('../../services/ocrService');
const notificationService = require('../../services/notificationService');
const fileParser = require('../../services/fileParser');

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
    storageInfo: {},
    // DeepSeek API 配置
    deepseekApiKey: '',
    deepseekModel: 'deepseek-chat',
    deepseekUseAI: false,
    showApiKey: false,
    // OCR 配置
    ocrSecretId: '',
    ocrSecretKey: '',
    ocrUseCloud: false,
    showOcrSecretKey: false
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
    this.loadDeepseekConfig();
    this.loadOcrConfig();
  },
  loadUserData() {
    // 从本地存储加载用户数据
    const userData = wx.getStorageSync('userData');
    const reminderCount = notificationService.getUnreadCount();
    if (userData) {
      this.setData({
        usageDays: userData.usageDays || 128,
        assetCount: userData.assetCount || 8,
        platformCount: userData.platformCount || 5,
        healthScore: userData.healthScore || 82,
        reminderCount: reminderCount
      });
    } else {
      this.setData({ reminderCount });
    }
  },
  loadDeepseekConfig() {
    const config = intelligenceService.getDeepseekConfig();
    this.setData({
      deepseekApiKey: config.apiKey || '',
      deepseekModel: config.model || 'deepseek-chat',
      deepseekUseAI: config.useAI
    });
  },
  loadOcrConfig() {
    const config = ocrService.getOcrConfig();
    this.setData({
      ocrSecretId: config.secretId || '',
      ocrSecretKey: config.secretKey || '',
      ocrUseCloud: config.useCloudOCR
    });
  },
  toggleAmount() {
    const show = assetService.toggleAmountVisibility();
    this.setData({ showAmount: show });
    wx.showToast({ title: show ? '已显示金额' : '已隐藏金额', icon: 'none' });
  },
  navigateTo(e) {
    const page = e.currentTarget.dataset.page;

    // 消息中心跳转
    if (page === 'messages') {
      wx.navigateTo({ url: '/pages/messages/messages' });
      return;
    }

    const featureInfo = {
      statistics: '资产统计 - 详细分析报告功能',
      strategy: '投资策略 - 个性化投资建议'
    };
    wx.showModal({
      title: '📋 ' + (featureInfo[page] || page),
      content: '此功能正在开发中，敬请期待！',
      confirmText: '知道了',
      showCancel: false
    });
  },
  showToast(e) {
    const page = e.currentTarget.dataset.page || '功能';
    wx.showModal({
      title: '📌 ' + page,
      content: '此功能正在开发中，敬请期待！',
      confirmText: '知道了',
      showCancel: false
    });
  },
  showSettings() {
    wx.showModal({
      title: '⚙️ 设置',
      content: '设置功能已整合到各页面中，您可以使用顶部的⚙️按钮或各功能设置项。',
      confirmText: '知道了',
      showCancel: false
    });
  },

  // DeepSeek API Key 输入
  onApiKeyInput(e) {
    this.setData({ deepseekApiKey: e.detail.value });
  },
  onModelInput(e) {
    this.setData({ deepseekModel: e.detail.value });
  },
  onUseAIToggle(e) {
    this.setData({ deepseekUseAI: e.detail.value });
  },
  toggleShowApiKey() {
    this.setData({ showApiKey: !this.data.showApiKey });
  },
  saveDeepseekConfig() {
    const config = {
      apiKey: this.data.deepseekApiKey.trim(),
      model: this.data.deepseekModel.trim() || 'deepseek-chat',
      useAI: this.data.deepseekUseAI
    };
    intelligenceService.saveDeepseekConfig(config);
    wx.showToast({ title: 'DeepSeek 配置已保存', icon: 'success' });
  },

  // OCR 配置
  onOcrSecretIdInput(e) {
    this.setData({ ocrSecretId: e.detail.value });
  },
  onOcrSecretKeyInput(e) {
    this.setData({ ocrSecretKey: e.detail.value });
  },
  onOcrUseCloudToggle(e) {
    this.setData({ ocrUseCloud: e.detail.value });
  },
  toggleShowOcrSecretKey() {
    this.setData({ showOcrSecretKey: !this.data.showOcrSecretKey });
  },
  saveOcrConfig() {
    const config = {
      secretId: this.data.ocrSecretId.trim(),
      secretKey: this.data.ocrSecretKey.trim(),
      useCloudOCR: this.data.ocrUseCloud
    };
    ocrService.saveOcrConfig(config);
    wx.showToast({ title: 'OCR 配置已保存', icon: 'success' });
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

  // 导入数据（选择方式）
  importData() {
    wx.showActionSheet({
      itemList: ['从剪贴板导入 (JSON)', '从文件导入 (CSV)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.importFromClipboard();
        } else {
          this.importFromFile();
        }
      }
    });
  },

  // 从剪贴板导入（JSON）
  importFromClipboard() {
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

  // 从文件导入（CSV）
  importFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0];
        const fileName = file.name.toLowerCase();

        // 检查文件类型
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
          wx.showModal({
            title: '不支持的文件格式',
            content: '请使用 CSV 格式文件（.csv）导入数据',
            showCancel: false
          });
          return;
        }

        wx.showLoading({ title: '解析中...' });

        // 读取文件内容
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (readRes) => {
            const parseResult = fileParser.parseCSV(readRes.data);

            if (!parseResult.success) {
              wx.hideLoading();
              wx.showModal({
                title: '解析失败',
                content: parseResult.message,
                showCancel: false
              });
              return;
            }

            // 显示预览
            wx.hideLoading();
            const previewText = parseResult.data.slice(0, 5).map((a, i) =>
              `${i + 1}. ${a.name || a.code} (${a.code}) - ${a.shares}份`
            ).join('\n');

            wx.showModal({
              title: '导入预览',
              content: `共 ${parseResult.data.length} 条资产\n\n前5条预览：\n${previewText}\n\n是否继续导入？`,
              success: (confirmRes) => {
                if (confirmRes.confirm) {
                  wx.showLoading({ title: '导入中...' });

                  const importResult = fileParser.importAssets(parseResult.data);

                  wx.hideLoading();

                  if (importResult.success) {
                    wx.showModal({
                      title: '导入成功',
                      content: `成功导入 ${importResult.imported} 条资产`,
                      showCancel: false
                    });
                    this.loadUserData();
                  } else {
                    wx.showModal({
                      title: '部分导入失败',
                      content: `成功 ${importResult.imported} 条，失败 ${importResult.failed} 条\n\n${importResult.errors[0] || ''}`,
                      showCancel: false
                    });
                  }
                }
              }
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({ title: '文件读取失败', icon: 'none' });
          }
        });
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
