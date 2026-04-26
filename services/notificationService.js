/**
 * 通知服务
 * 处理消息提醒、价格警报、到期通知等功能
 */

const storage = require('../utils/storage');

/**
 * 通知类型
 */
const NOTIFICATION_TYPES = {
  PRICE_ALERT: 'priceAlert',       // 价格提醒
  CHANGE_ALERT: 'changeAlert',     // 涨跌幅提醒
  DEPOSIT_EXPIRY: 'depositExpiry', // 存款到期
  SYSTEM_NOTICE: 'systemNotice'    // 系统通知
};

/**
 * 通知优先级
 */
const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * 获取所有通知
 */
function getNotifications() {
  return storage.get(storage.STORAGE_KEYS.NOTIFICATIONS, []);
}

/**
 * 保存通知列表
 */
function saveNotifications(notifications) {
  return storage.set(storage.STORAGE_KEYS.NOTIFICATIONS, notifications);
}

/**
 * 添加通知
 * @param {Object} notification - 通知对象
 * @returns {Object} { success: boolean, data: notification }
 */
function addNotification(notification) {
  const notifications = getNotifications();

  const newNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: notification.type || NOTIFICATION_TYPES.SYSTEM_NOTICE,
    title: notification.title || '',
    content: notification.content || '',
    timestamp: new Date().toISOString(),
    read: false,
    priority: notification.priority || PRIORITY.MEDIUM,
    assetCode: notification.assetCode || null,
    triggerCondition: notification.triggerCondition || null
  };

  notifications.unshift(newNotification); // 最新通知在前

  // 最多保留100条通知
  if (notifications.length > 100) {
    notifications.splice(100);
  }

  saveNotifications(notifications);
  return { success: true, data: newNotification };
}

/**
 * 标记通知为已读
 * @param {string} notificationId - 通知ID
 */
function markAsRead(notificationId) {
  const notifications = getNotifications();
  const notification = notifications.find(n => n.id === notificationId);

  if (notification) {
    notification.read = true;
    saveNotifications(notifications);
  }

  return { success: true };
}

/**
 * 标记所有通知为已读
 */
function markAllAsRead() {
  const notifications = getNotifications();
  notifications.forEach(n => { n.read = true; });
  saveNotifications(notifications);
  return { success: true };
}

/**
 * 删除通知
 * @param {string} notificationId - 通知ID
 */
function deleteNotification(notificationId) {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === notificationId);

  if (index !== -1) {
    notifications.splice(index, 1);
    saveNotifications(notifications);
  }

  return { success: true };
}

/**
 * 清空所有通知
 */
function clearAll() {
  saveNotifications([]);
  return { success: true };
}

/**
 * 获取未读通知数量
 */
function getUnreadCount() {
  const notifications = getNotifications();
  return notifications.filter(n => !n.read).length;
}

/**
 * 获取所有提醒配置
 */
function getReminders() {
  return storage.get(storage.STORAGE_KEYS.REMINDERS, []);
}

/**
 * 保存提醒配置
 */
function saveReminders(reminders) {
  return storage.set(storage.STORAGE_KEYS.REMINDERS, reminders);
}

/**
 * 添加提醒配置
 * @param {Object} reminder - 提醒配置
 * @returns {Object} { success: boolean, data: reminder }
 */
function addReminder(reminder) {
  const reminders = getReminders();

  const newReminder = {
    id: `remind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    assetCode: reminder.assetCode || '',
    assetName: reminder.assetName || '',
    assetType: reminder.assetType || 'FUND', // FUND, STOCK, DEPOSIT
    alertType: reminder.alertType || 'changeAlert', // priceAlert, changeAlert, depositExpiry
    condition: reminder.condition || {}, // { above: number, below: number, changePercent: number }
    enabled: reminder.enabled !== false,
    createdAt: new Date().toISOString(),
    lastTriggered: null
  };

  reminders.push(newReminder);
  saveReminders(reminders);
  return { success: true, data: newReminder };
}

/**
 * 更新提醒配置
 * @param {string} reminderId - 提醒ID
 * @param {Object} updates - 更新内容
 */
function updateReminder(reminderId, updates) {
  const reminders = getReminders();
  const reminder = reminders.find(r => r.id === reminderId);

  if (reminder) {
    Object.assign(reminder, updates);
    saveReminders(reminders);
    return { success: true, data: reminder };
  }

  return { success: false, message: 'Reminder not found' };
}

/**
 * 删除提醒配置
 * @param {string} reminderId - 提醒ID
 */
function deleteReminder(reminderId) {
  const reminders = getReminders();
  const index = reminders.findIndex(r => r.id === reminderId);

  if (index !== -1) {
    reminders.splice(index, 1);
    saveReminders(reminders);
    return { success: true };
  }

  return { success: false, message: 'Reminder not found' };
}

/**
 * 切换提醒启用状态
 * @param {string} reminderId - 提醒ID
 */
function toggleReminder(reminderId) {
  const reminders = getReminders();
  const reminder = reminders.find(r => r.id === reminderId);

  if (reminder) {
    reminder.enabled = !reminder.enabled;
    saveReminders(reminders);
    return { success: true, enabled: reminder.enabled };
  }

  return { success: false, message: 'Reminder not found' };
}

/**
 * 检查提醒是否触发
 * @param {string} assetCode - 资产代码
 * @param {Object} quoteData - 行情数据 { current, changePercent, name }
 * @returns {Array} 触发的提醒列表
 */
function checkTriggers(assetCode, quoteData) {
  const reminders = getReminders();
  const triggered = [];

  reminders.forEach(reminder => {
    if (!reminder.enabled || reminder.assetCode !== assetCode) return;

    let isTriggered = false;
    let triggerReason = '';

    if (reminder.alertType === 'changeAlert' && reminder.condition.changePercent !== undefined) {
      const changePercent = Math.abs(quoteData.changePercent || 0);
      const threshold = Math.abs(reminder.condition.changePercent);

      if (changePercent >= threshold) {
        isTriggered = true;
        triggerReason = `涨跌幅达到 ${quoteData.changePercent > 0 ? '+' : ''}${quoteData.changePercent.toFixed(2)}%，触发阈值 ±${threshold}%`;
      }
    } else if (reminder.alertType === 'priceAlert') {
      const currentPrice = quoteData.current || 0;

      if (reminder.condition.above !== undefined && currentPrice >= reminder.condition.above) {
        isTriggered = true;
        triggerReason = `价格 ${currentPrice} 超过阈值 ${reminder.condition.above}`;
      }

      if (reminder.condition.below !== undefined && currentPrice > 0 && currentPrice <= reminder.condition.below) {
        isTriggered = true;
        triggerReason = `价格 ${currentPrice} 低于阈值 ${reminder.condition.below}`;
      }
    }

    if (isTriggered) {
      triggered.push({
        reminder,
        reason: triggerReason,
        quoteData
      });

      // 更新最后触发时间
      reminder.lastTriggered = new Date().toISOString();
    }
  });

  if (triggered.length > 0) {
    saveReminders(reminders);
  }

  return triggered;
}

/**
 * 处理触发的提醒，生成通知
 * @param {Array} triggeredReminders - 触发的提醒列表
 */
function processTriggeredReminders(triggeredReminders) {
  triggeredReminders.forEach(item => {
    const { reminder, reason, quoteData } = item;

    // 避免重复触发（同一天内同一资产的同一提醒）
    const notifications = getNotifications();
    const isDuplicate = notifications.some(n =>
      n.assetCode === reminder.assetCode &&
      n.type === (reminder.alertType === 'changeAlert' ? NOTIFICATION_TYPES.CHANGE_ALERT : NOTIFICATION_TYPES.PRICE_ALERT) &&
      !n.read &&
      new Date(n.timestamp).toDateString() === new Date().toDateString()
    );

    if (!isDuplicate) {
      addNotification({
        type: reminder.alertType === 'changeAlert' ? NOTIFICATION_TYPES.CHANGE_ALERT : NOTIFICATION_TYPES.PRICE_ALERT,
        title: `【${reminder.assetName}】价格提醒`,
        content: reason,
        priority: PRIORITY.HIGH,
        assetCode: reminder.assetCode,
        triggerCondition: reminder.condition
      });
    }
  });
}

/**
 * 检查所有提醒（批量）
 * @param {Object} quotes - 行情数据字典 { assetCode: quoteData }
 */
function checkAllTriggers(quotes) {
  const triggeredReminders = [];

  Object.entries(quotes).forEach(([assetCode, quoteData]) => {
    const triggered = checkTriggers(assetCode, quoteData);
    triggeredReminders.push(...triggered);
  });

  if (triggeredReminders.length > 0) {
    processTriggeredReminders(triggeredReminders);
  }

  return triggeredReminders;
}

/**
 * 检查存款到期提醒
 * @param {Array} deposits - 存款列表
 */
function checkDepositExpiry(deposits) {
  const reminders = getReminders().filter(r => r.enabled && r.alertType === 'depositExpiry');

  reminders.forEach(reminder => {
    const deposit = deposits.find(d => d.id === reminder.assetCode);

    if (deposit && deposit.endDate) {
      const endDate = new Date(deposit.endDate);
      const now = new Date();
      const daysLeft = Math.floor((endDate - now) / (1000 * 60 * 60 * 24));

      // 提前7天提醒
      if (daysLeft <= 7 && daysLeft >= 0) {
        const notifications = getNotifications();
        const isDuplicate = notifications.some(n =>
          n.assetCode === deposit.id &&
          n.type === NOTIFICATION_TYPES.DEPOSIT_EXPIRY &&
          !n.read
        );

        if (!isDuplicate) {
          addNotification({
            type: NOTIFICATION_TYPES.DEPOSIT_EXPIRY,
            title: `【${deposit.name || '存款'}】即将到期`,
            content: `还有 ${daysLeft} 天到期，届时将返还 ${deposit.amount || 0} 元本金及利息`,
            priority: daysLeft <= 3 ? PRIORITY.HIGH : PRIORITY.MEDIUM,
            assetCode: deposit.id
          });
        }
      }
    }
  });
}

/**
 * 获取提醒按资产分组
 */
function getRemindersByAsset() {
  const reminders = getReminders();
  const grouped = {};

  reminders.forEach(reminder => {
    const code = reminder.assetCode || 'unknown';
    if (!grouped[code]) {
      grouped[code] = [];
    }
    grouped[code].push(reminder);
  });

  return grouped;
}

/**
 * 获取某资产的所有提醒
 * @param {string} assetCode - 资产代码
 */
function getRemindersForAsset(assetCode) {
  const reminders = getReminders();
  return reminders.filter(r => r.assetCode === assetCode);
}

module.exports = {
  NOTIFICATION_TYPES,
  PRIORITY,
  getNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  getUnreadCount,
  getReminders,
  addReminder,
  updateReminder,
  deleteReminder,
  toggleReminder,
  checkTriggers,
  checkAllTriggers,
  checkDepositExpiry,
  getRemindersByAsset,
  getRemindersForAsset
};