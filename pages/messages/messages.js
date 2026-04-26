// pages/messages/messages.js
const notificationService = require('../../services/notificationService');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    activeTab: 'notifications',
    notifications: [],
    reminders: [],
    unreadCount: 0
  },

  onLoad() {
    this.initSystemInfo();
    this.loadData();
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
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const notifications = notificationService.getNotifications();
    const reminders = notificationService.getReminders();
    const unreadCount = notificationService.getUnreadCount();

    this.setData({
      notifications,
      reminders,
      unreadCount
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onNotificationTap(e) {
    const id = e.currentTarget.dataset.id;
    notificationService.markAsRead(id);
    this.loadData();
  },

  deleteNotification(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除通知',
      content: '确定要删除这条通知吗？',
      success: (res) => {
        if (res.confirm) {
          notificationService.deleteNotification(id);
          this.loadData();
        }
      }
    });
  },

  markAllRead() {
    notificationService.markAllAsRead();
    this.loadData();
    wx.showToast({ title: '已全部标为已读', icon: 'success' });
  },

  clearAll() {
    wx.showModal({
      title: '清空通知',
      content: '确定要清空所有通知吗？',
      success: (res) => {
        if (res.confirm) {
          notificationService.clearAll();
          this.loadData();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  },

  onReminderToggle(e) {
    const id = e.currentTarget.dataset.id;
    const enabled = e.detail.value;
    notificationService.updateReminder(id, { enabled });
  },

  deleteReminder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除提醒',
      content: '确定要删除这个提醒吗？',
      success: (res) => {
        if (res.confirm) {
          notificationService.deleteReminder(id);
          this.loadData();
        }
      }
    });
  },

  getNotificationIcon(type) {
    const icons = {
      priceAlert: '💰',
      changeAlert: '📈',
      depositExpiry: '💵',
      systemNotice: '📢'
    };
    return icons[type] || '📋';
  },

  getPriorityText(priority) {
    const texts = { high: '紧急', medium: '一般', low: '低' };
    return texts[priority] || '一般';
  },

  getAlertTypeText(alertType) {
    const texts = {
      priceAlert: '价格提醒',
      changeAlert: '涨跌幅提醒',
      depositExpiry: '到期提醒'
    };
    return texts[alertType] || '提醒';
  },

  getConditionText(item) {
    if (item.alertType === 'changeAlert' && item.condition.changePercent !== undefined) {
      return `涨跌幅达到 ±${item.condition.changePercent}% 时提醒`;
    } else if (item.alertType === 'priceAlert') {
      const parts = [];
      if (item.condition.above !== undefined) {
        parts.push(`高于 ¥${item.condition.above}`);
      }
      if (item.condition.below !== undefined) {
        parts.push(`低于 ¥${item.condition.below}`);
      }
      return parts.join(' 或 ');
    }
    return '设置条件';
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }
});