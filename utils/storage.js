/**
 * 本地存储封装
 * 提供统一的本地存储接口，支持对象序列化
 */

const STORAGE_KEYS = {
  USER_ASSETS: 'user_assets_v2',      // 用户资产数据
  ASSET_GROUPS: 'asset_groups',       // 资产分组
  INTELLIGENCE_CACHE: 'intel_cache',  // 情报缓存
  USER_PREFERENCES: 'user_prefs',     // 用户偏好
  MARKET_DATA: 'market_data',         // 市场行情缓存
  ANALYSIS_CACHE: 'analysis_cache',   // 分析数据缓存
  NOTIFICATIONS: 'notifications',     // 通知列表
  REMINDERS: 'reminders'              // 提醒配置
};

/**
 * 设置存储项
 * @param {string} key - 键名
 * @param {*} value - 值（支持对象）
 */
function set(key, value) {
  try {
    if (typeof value === 'object') {
      wx.setStorageSync(key, JSON.stringify(value));
    } else {
      wx.setStorageSync(key, value);
    }
    return true;
  } catch (e) {
    console.error('存储失败:', e);
    return false;
  }
}

/**
 * 获取存储项
 * @param {string} key - 键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 存储的值
 */
function get(key, defaultValue = null) {
  try {
    const value = wx.getStorageSync(key);
    if (value === '' || value === undefined || value === null) {
      return defaultValue;
    }
    // 尝试解析JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (e) {
    console.error('读取失败:', e);
    return defaultValue;
  }
}

/**
 * 移除存储项
 * @param {string} key - 键名
 */
function remove(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (e) {
    console.error('删除失败:', e);
    return false;
  }
}

/**
 * 清空所有存储
 */
function clear() {
  try {
    wx.clearStorageSync();
    return true;
  } catch (e) {
    console.error('清空失败:', e);
    return false;
  }
}

/**
 * 获取存储信息
 */
function info() {
  try {
    return wx.getStorageInfoSync();
  } catch (e) {
    console.error('获取存储信息失败:', e);
    return null;
  }
}

module.exports = {
  STORAGE_KEYS,
  set,
  get,
  remove,
  clear,
  info
};
