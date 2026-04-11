/**
 * 数据格式化工具
 * 提供金额、百分比、日期等格式化功能
 */

/**
 * 格式化金额
 * @param {number} amount - 金额
 * @param {string} currency - 货币符号
 * @param {boolean} showSymbol - 是否显示货币符号
 * @returns {string} 格式化后的金额
 */
function formatAmount(amount, currency = '¥', showSymbol = true) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? `${currency} 0.00` : '0.00';
  }

  const num = parseFloat(amount);
  const formatted = num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return showSymbol ? `${currency} ${formatted}` : formatted;
}

/**
 * 格式化百分比
 * @param {number} value - 数值
 * @param {number} decimals - 小数位数
 * @param {boolean} showSign - 是否显示正负号
 * @returns {string} 格式化后的百分比
 */
function formatPercent(value, decimals = 2, showSign = true) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }

  const num = parseFloat(value);
  let result = num.toFixed(decimals) + '%';

  if (showSign && num > 0) {
    result = '+' + result;
  }

  return result;
}

/**
 * 格式化涨跌额
 * @param {number} value - 涨跌额
 * @returns {string} 格式化后的涨跌额
 */
function formatChange(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00';
  }

  const num = parseFloat(value);
  const prefix = num >= 0 ? '+' : '';
  return prefix + num.toFixed(2);
}

/**
 * 格式化日期
 * @param {string|Date} date - 日期
 * @param {string} format - 格式
 * @returns {string} 格式化后的日期
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes);
}

/**
 * 格式化时间（小时:分钟）
 * @param {string|Date} date - 日期
 * @returns {string} 格式化后的时间
 */
function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * 格式化数字（千分位）
 * @param {number} num - 数字
 * @returns {string} 格式化后的数字
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  return parseFloat(num).toLocaleString('zh-CN');
}

/**
 * 简化数字（万/亿）
 * @param {number} num - 数字
 * @returns {string} 简化后的数字
 */
function simplifyNumber(num) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  const n = parseFloat(num);

  if (Math.abs(n) >= 100000000) {
    return (n / 100000000).toFixed(2) + '亿';
  } else if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(2) + '万';
  }

  return n.toFixed(2);
}

/**
 * 隐藏金额（显示星号）
 * @param {number} amount - 金额
 * @param {string} currency - 货币符号
 * @returns {string} 隐藏后的金额
 */
function hideAmount(amount, currency = '¥') {
  return `${currency} ****`;
}

/**
 * 获取涨跌样式类名
 * @param {number} value - 数值
 * @returns {string} 样式类名
 */
function getTrendClass(value) {
  const num = parseFloat(value);
  if (num > 0) return 'rise';
  if (num < 0) return 'fall';
  return '';
}

/**
 * 获取涨跌颜色
 * @param {number} value - 数值
 * @returns {string} 颜色值
 */
function getTrendColor(value) {
  const num = parseFloat(value);
  if (num > 0) return '#ef4444';
  if (num < 0) return '#10b981';
  return '#64748b';
}

module.exports = {
  formatAmount,
  formatPercent,
  formatChange,
  formatDate,
  formatTime,
  formatNumber,
  simplifyNumber,
  hideAmount,
  getTrendClass,
  getTrendColor
};
