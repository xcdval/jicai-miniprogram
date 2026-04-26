/**
 * 资产服务
 * 处理资产的增删改查和计算逻辑
 */

const storage = require('../utils/storage');
const format = require('../utils/format');
const marketService = require('./marketService');
const notificationService = require('./notificationService');

/**
 * 获取所有资产分组
 */
function getGroups() {
  return storage.get(storage.STORAGE_KEYS.ASSET_GROUPS, []);
}

/**
 * 保存资产分组
 */
function saveGroups(groups) {
  return storage.set(storage.STORAGE_KEYS.ASSET_GROUPS, groups);
}

/**
 * 获取所有资产数据
 */
function getAssets() {
  return storage.get(storage.STORAGE_KEYS.USER_ASSETS, { groups: [] });
}

/**
 * 保存资产数据
 */
function saveAssets(assets) {
  assets.lastUpdate = new Date().toISOString();
  return storage.set(storage.STORAGE_KEYS.USER_ASSETS, assets);
}

/**
 * 基础资产统计计算（同步，不含风险指标）
 */
function calculateBasicStats() {
  const assets = getAssets();
  let totalValue = 0;
  let totalCost = 0;
  let todayProfit = 0;

  const categoryStats = {
    FUND: { value: 0, cost: 0, count: 0, todayProfit: 0 },
    STOCK: { value: 0, cost: 0, count: 0, todayProfit: 0 },
    DEPOSIT: { value: 0, cost: 0, count: 0, todayProfit: 0 }
  };

  const assetMetrics = [];

  assets.groups.forEach(group => {
    group.assets.forEach(asset => {
      let value, cost, todayChangePercent = 0;

      if (asset.type === 'DEPOSIT') {
        value = asset.amount || 0;
        cost = asset.amount || 0;
        todayChangePercent = 0;
        const days = getDepositDays(asset);
        const yearlyIncome = value * (asset.annualRate || 0) / 100;
        todayProfit = parseFloat((todayProfit + yearlyIncome / 365).toFixed(2));
      } else {
        cost = (asset.costPrice || 0) * (asset.shares || 0);
        value = (asset.currentPrice || asset.costPrice || 0) * (asset.shares || 0);
        todayChangePercent = asset.todayChangePercent || 0;

        const todayChangeValue = parseFloat((value * todayChangePercent / 100).toFixed(2));
        todayProfit = parseFloat((todayProfit + todayChangeValue).toFixed(2));
        categoryStats[asset.type].todayProfit = parseFloat(((categoryStats[asset.type].todayProfit || 0) + todayChangeValue).toFixed(2));
      }

      totalValue += value;
      totalCost += cost;

      if (categoryStats[asset.type]) {
        categoryStats[asset.type].value += value;
        categoryStats[asset.type].cost += cost;
        categoryStats[asset.type].count += 1;
      }

      const profit = value - cost;
      const profitPercent = cost > 0 ? parseFloat((profit / cost * 100).toFixed(2)) : 0;

      assetMetrics.push({
        ...asset,
        groupName: group.name,
        marketValue: value,
        costValue: cost,
        profit: profit,
        profitPercent: profitPercent,
        todayChange: todayChangePercent,
        todayProfit: parseFloat((value * todayChangePercent / 100).toFixed(2))
      });
    });
  });

  const totalProfit = totalValue - totalCost;
  const totalProfitPercent = totalCost > 0 ? parseFloat((totalProfit / totalCost * 100).toFixed(2)) : 0;

  return {
    totalValue,
    totalCost,
    totalProfit,
    totalProfitPercent,
    todayProfit,
    categoryStats,
    assetMetrics,
    updateTime: new Date().toLocaleString('zh-CN')
  };
}

/**
 * 计算资产统计信息
 * @param {Object} marketQuotes - 市场行情数据（可选）
 * @param {Object} options - 可选参数 { includeRiskMetrics: boolean }
 */
function calculateStatistics(marketQuotes = {}, options = {}) {
  return calculateBasicStats();
}

/**
 * 获取收益排行榜
 */
function getProfitRanking(sortBy = 'profit', limit = 10) {
  const stats = calculateStatistics();
  const assets = stats.assetMetrics || [];

  const filtered = assets.filter(a => a.type !== 'DEPOSIT');

  filtered.sort((a, b) => {
    if (sortBy === 'profitPercent') {
      return (b.profitPercent || 0) - (a.profitPercent || 0);
    }
    return (b.profit || 0) - (a.profit || 0);
  });

  return filtered.slice(0, limit).map((asset, index) => ({
    rank: index + 1,
    name: asset.name,
    code: asset.code,
    type: asset.type,
    profit: asset.profit || 0,
    profitPercent: asset.profitPercent || 0,
    marketValue: asset.marketValue || 0
  }));
}

/**
 * 计算持仓健康评分
 */
function calculateHealthScore() {
  const stats = calculateStatistics();
  const { categoryStats, totalValue } = stats;

  let score = 100;
  const suggestions = [];

  const totalCount = (categoryStats.FUND?.count || 0) +
                     (categoryStats.STOCK?.count || 0) +
                     (categoryStats.DEPOSIT?.count || 0);

  if (totalCount < 3) {
    score -= 15;
    suggestions.push({
      type: 'warning',
      title: '持仓过于集中',
      content: '建议增加持仓品种，分散投资风险。当前持仓 ' + totalCount + ' 种。'
    });
  } else if (totalCount >= 5 && totalCount <= 15) {
    score += 5;
  }

  const depositRatio = totalValue > 0 ? (categoryStats.DEPOSIT?.value || 0) / totalValue * 100 : 0;
  if (depositRatio < 10) {
    score -= 10;
    suggestions.push({
      type: 'warning',
      title: '防御性配置不足',
      content: '建议配置 10%-20% 的存款或低风险资产，提高组合稳定性。'
    });
  } else if (depositRatio >= 10 && depositRatio <= 30) {
    score += 5;
  } else if (depositRatio > 50) {
    score -= 5;
    suggestions.push({
      type: 'info',
      title: '存款比例较高',
      content: '当前存款占比 ' + depositRatio.toFixed(1) + '%，可适当提高收益资产配置。'
    });
  }

  const stockRatio = totalValue > 0 ? (categoryStats.STOCK?.value || 0) / totalValue * 100 : 0;
  if (stockRatio > 60) {
    score -= 15;
    suggestions.push({
      type: 'warning',
      title: '股票仓位过重',
      content: '股票占比 ' + stockRatio.toFixed(1) + '%，建议控制在 50% 以内。'
    });
  }

  if (categoryStats.FUND?.count === 0 && categoryStats.STOCK?.count === 0) {
    score -= 20;
    suggestions.push({
      type: 'error',
      title: '无有效持仓',
      content: '请添加基金或股票持仓以获取收益。'
    });
  }

  const { totalProfitPercent } = stats;
  if (totalProfitPercent > 20) {
    suggestions.push({
      type: 'success',
      title: '收益表现优秀',
      content: '总体收益率 ' + totalProfitPercent.toFixed(2) + '%，继续保持！'
    });
  } else if (totalProfitPercent < -10) {
    suggestions.push({
      type: 'warning',
      title: '持仓出现较大亏损',
      content: '总体亏损 ' + Math.abs(totalProfitPercent).toFixed(2) + '%，注意控制风险。'
    });
  }

  score = Math.max(0, Math.min(100, score));

  let color = '#10b981';
  if (score < 60) color = '#ef4444';
  else if (score < 75) color = '#f59e0b';

  let desc = '持仓结构合理';
  if (score >= 85) desc = '持仓结构优秀，继续保持';
  else if (score >= 75) desc = '持仓结构良好，建议适度优化';
  else if (score >= 60) desc = '持仓风险中等，建议分散配置';
  else desc = '持仓风险较高，建议调整配置';

  return {
    score,
    color,
    desc,
    suggestions,
    stats: {
      totalCount,
      depositRatio: depositRatio.toFixed(1),
      stockRatio: stockRatio.toFixed(1),
      fundRatio: totalValue > 0 ? ((categoryStats.FUND?.value || 0) / totalValue * 100).toFixed(1) : '0'
    }
  };
}

/**
 * 按分组获取资产
 */
function getAssetsByGroup(groupId) {
  const assets = getAssets();

  if (groupId === 'all') {
    return assets.groups;
  }

  return assets.groups.filter(g => g.id === groupId);
}

/**
 * 添加资产
 */
function addAsset(groupId, asset) {
  const assets = getAssets();
  const group = assets.groups.find(g => g.id === groupId);

  if (!group) {
    return { success: false, message: '分组不存在' };
  }

  asset.id = `${asset.type.toLowerCase()}_${Date.now()}`;

  group.assets.push(asset);
  saveAssets(assets);

  return { success: true, data: asset };
}

/**
 * 更新资产
 */
function updateAsset(assetId, updates) {
  const assets = getAssets();

  for (const group of assets.groups) {
    const assetIndex = group.assets.findIndex(a => a.id === assetId);
    if (assetIndex !== -1) {
      group.assets[assetIndex] = { ...group.assets[assetIndex], ...updates };
      saveAssets(assets);
      return { success: true, data: group.assets[assetIndex] };
    }
  }

  return { success: false, message: '资产不存在' };
}

/**
 * 删除资产
 */
function deleteAsset(assetId) {
  const assets = getAssets();

  for (const group of assets.groups) {
    const assetIndex = group.assets.findIndex(a => a.id === assetId);
    if (assetIndex !== -1) {
      group.assets.splice(assetIndex, 1);
      saveAssets(assets);
      return { success: true };
    }
  }

  return { success: false, message: '资产不存在' };
}

/**
 * 切换资产金额显示状态
 */
function toggleAmountVisibility() {
  const prefs = storage.get(storage.STORAGE_KEYS.USER_PREFERENCES, {});
  prefs.showAmount = !prefs.showAmount;
  storage.set(storage.STORAGE_KEYS.USER_PREFERENCES, prefs);
  return prefs.showAmount;
}

/**
 * 获取金额显示状态
 */
function getAmountVisibility() {
  const prefs = storage.get(storage.STORAGE_KEYS.USER_PREFERENCES, { showAmount: true });
  return prefs.showAmount;
}

/**
 * 按类型获取资产
 */
function getAssetsByType(type) {
  const assets = getAssets();
  const result = [];

  assets.groups.forEach(group => {
    group.assets.forEach(asset => {
      if (asset.type === type.toUpperCase()) {
        result.push({
          ...asset,
          groupId: group.id,
          groupName: group.name
        });
      }
    });
  });

  return result;
}

/**
 * 计算单个资产的市值和盈亏
 */
function calculateAssetMetrics(asset, todayChangePercent = 0) {
  const result = { ...asset };

  if (asset.type === 'DEPOSIT') {
    const depositAmount = asset.amount || 0;
    const annualRate = asset.annualRate || 0;
    const days = getDepositDays(asset);
    const yearlyIncome = depositAmount * annualRate / 100;
    result.marketValue = depositAmount;
    result.costValue = depositAmount;
    result.profit = parseFloat((yearlyIncome * days / 365).toFixed(2));
    result.profitPercent = annualRate;
    result.todayChange = 0;
    result.todayProfit = 0;
    result.dailyIncome = parseFloat((depositAmount * annualRate / 365 / 100).toFixed(2));
    result.nav = annualRate.toFixed(2);
    result.holdings = depositAmount;
  } else {
    const shares = parseFloat(asset.shares) || 0;
    const costPrice = parseFloat(asset.costPrice) || 0;
    const currentPrice = parseFloat(asset.currentPrice) || costPrice;

    result.costValue = costPrice * shares;
    result.marketValue = currentPrice * shares;
    result.profit = parseFloat((result.marketValue - result.costValue).toFixed(2));
    result.profitPercent = result.costValue > 0 ? parseFloat((result.profit / result.costValue * 100).toFixed(2)) : 0;
    result.todayChange = todayChangePercent;
    result.todayProfit = parseFloat((result.marketValue * todayChangePercent / 100).toFixed(2));
    result.nav = currentPrice.toFixed(4);
    result.holdings = shares;
  }

  return result;
}

/**
 * 计算存款天数
 */
function getDepositDays(asset) {
  if (!asset.startDate) return 0;
  const start = new Date(asset.startDate);
  const now = new Date();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

/**
 * 按类型获取资产（带计算字段）
 */
function getEnrichedAssetsByType(type, todayChangePercent = 0) {
  const rawAssets = getAssetsByType(type);
  return rawAssets.map(asset => calculateAssetMetrics(asset, todayChangePercent));
}

/**
 * 按分类获取资产（兼容旧接口）
 */
function getFundsByCategory(category) {
  if (category === 'fund') {
    return getAssetsByType('FUND');
  }
  return [];
}

/**
 * 初始化数据
 */
function initData() {
  const mock = require('../utils/mock');

  const existing = getAssets();
  if (existing.groups && existing.groups.length > 0) {
    return false;
  }

  saveAssets(mock.defaultAssets);
  saveGroups(mock.defaultAssets.groups.map(g => ({
    id: g.id,
    name: g.name,
    color: g.color
  })));

  return true;
}

/**
 * 清空所有数据
 */
function clearAllData() {
  const storage = require('../utils/storage');
  Object.values(storage.STORAGE_KEYS).forEach(key => {
    storage.remove(key);
  });
  return true;
}

/**
 * 导出数据为JSON
 */
function exportData() {
  const assets = getAssets();
  const groups = getGroups();
  const prefs = storage.get(storage.STORAGE_KEYS.USER_PREFERENCES, {});

  return {
    version: '2.0',
    exportTime: new Date().toISOString(),
    data: {
      assets,
      groups,
      preferences: prefs
    }
  };
}

/**
 * 导入JSON数据
 */
function importData(jsonData) {
  try {
    if (!jsonData || !jsonData.data) {
      return { success: false, message: '无效的数据格式' };
    }

    const { assets, groups, preferences } = jsonData.data;

    if (assets) {
      saveAssets(assets);
    }

    if (groups) {
      saveGroups(groups);
    }

    if (preferences) {
      storage.set(storage.STORAGE_KEYS.USER_PREFERENCES, preferences);
    }

    return { success: true };
  } catch (e) {
    return { success: false, message: '导入失败: ' + e.message };
  }
}

/**
 * 刷新资产实时行情
 */
async function refreshAssetPrices() {
  const assets = getAssets();
  const allAssets = [];

  assets.groups.forEach(group => {
    group.assets.forEach(asset => {
      allAssets.push({ ...asset, groupId: group.id });
    });
  });

  const quotes = await marketService.getAssetQuotes(allAssets);

  let updated = false;
  assets.groups.forEach(group => {
    group.assets.forEach(asset => {
      if ((asset.type === 'FUND' || asset.type === 'STOCK') && quotes[asset.code]) {
        const quote = quotes[asset.code];
        asset.currentPrice = quote.current || asset.currentPrice;
        asset.todayChangePercent = quote.changePercent || 0;
        asset.name = quote.name || asset.name;
        updated = true;
      }
    });
  });

  if (updated) {
    saveAssets(assets);
  }

  // 检查提醒触发
  if (updated) {
    notificationService.checkAllTriggers(quotes);
  }

  // 检查存款到期提醒
  const deposits = assets.groups.flatMap(g => g.assets.filter(a => a.type === 'DEPOSIT'));
  if (deposits.length > 0) {
    notificationService.checkDepositExpiry(deposits);
  }

  return { success: true, updated, quotes };
}

/**
 * 计算高级统计指标（异步，包含夏普比率和波动率）
 */
async function calculateAdvancedStats() {
  const basicStats = calculateBasicStats();

  // 计算风险指标
  let sharpeRatio = 0;
  let volatility = 0;

  try {
    const assets = getAssets();
    const funds = assets.groups.flatMap(g =>
      g.assets.filter(a => a.type === 'FUND').map(a => ({ code: a.code, name: a.name }))
    );

    if (funds.length > 0) {
      const stats = await marketService.getFundStatistics(funds);
      sharpeRatio = stats.sharpeRatio;
      volatility = stats.volatility;
    }
  } catch (e) {
    console.error('计算风险指标失败:', e);
  }

  return {
    ...basicStats,
    sharpeRatio,
    volatility
  };
}

module.exports = {
  getGroups,
  saveGroups,
  getAssets,
  saveAssets,
  calculateStatistics,
  calculateAdvancedStats,
  getAssetsByGroup,
  getAssetsByType,
  getEnrichedAssetsByType,
  getFundsByCategory,
  calculateAssetMetrics,
  getProfitRanking,
  calculateHealthScore,
  addAsset,
  updateAsset,
  deleteAsset,
  toggleAmountVisibility,
  getAmountVisibility,
  initData,
  clearAllData,
  exportData,
  importData,
  refreshAssetPrices
};