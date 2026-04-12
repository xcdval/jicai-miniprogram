/**
 * 资产服务
 * 处理资产的增删改查和计算逻辑
 */

const storage = require('../utils/storage');
const format = require('../utils/format');
const marketService = require('./marketService');

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
 * 计算资产统计信息
 */
function calculateStatistics() {
  const assets = getAssets();
  let totalValue = 0;
  let totalCost = 0;
  let todayProfit = 0;

  const categoryStats = {
    FUND: { value: 0, cost: 0, count: 0 },
    STOCK: { value: 0, cost: 0, count: 0 },
    DEPOSIT: { value: 0, cost: 0, count: 0 }
  };

  assets.groups.forEach(group => {
    group.assets.forEach(asset => {
      let value, cost;

      if (asset.type === 'DEPOSIT') {
        value = asset.amount;
        cost = asset.amount;
      } else {
        value = asset.currentPrice * asset.shares;
        cost = asset.costPrice * asset.shares;
      }

      totalValue += value;
      totalCost += cost;

      // 按类型统计
      if (categoryStats[asset.type]) {
        categoryStats[asset.type].value += value;
        categoryStats[asset.type].cost += cost;
        categoryStats[asset.type].count += 1;
      }

      // 模拟今日盈亏（实际应从历史数据计算）
      const dailyChange = (Math.random() - 0.4) * value * 0.02;
      todayProfit += dailyChange;
    });
  });

  const totalProfit = totalValue - totalCost;
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalProfit,
    totalProfitPercent,
    todayProfit,
    categoryStats,
    updateTime: new Date().toLocaleString('zh-CN')
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

  // 生成唯一ID
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
 * 按类型获取资产（基金/股票/存款）
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
 * 按分类获取资产（兼容旧接口）
 */
function getFundsByCategory(category) {
  if (category === 'fund') {
    return getAssetsByType('FUND');
  }
  return [];
}

/**
 * 初始化数据（首次使用）
 */
function initData() {
  const mock = require('../utils/mock');

  // 检查是否已初始化
  const existing = getAssets();
  if (existing.groups && existing.groups.length > 0) {
    return false;
  }

  // 使用默认数据初始化
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

  // 获取行情
  const quotes = await marketService.getAssetQuotes(allAssets);

  // 更新资产价格
  let updated = false;
  assets.groups.forEach(group => {
    group.assets.forEach(asset => {
      if (asset.type === 'FUND' && quotes[asset.code]) {
        const quote = quotes[asset.code];
        asset.currentPrice = quote.current || asset.currentPrice;
        asset.name = quote.name || asset.name; // 更新名称
        updated = true;
      } else if (asset.type === 'STOCK' && quotes[asset.code]) {
        const quote = quotes[asset.code];
        asset.currentPrice = quote.current || asset.currentPrice;
        asset.name = quote.name || asset.name;
        updated = true;
      }
    });
  });

  if (updated) {
    saveAssets(assets);
  }

  return { success: true, updated };
}

module.exports = {
  getGroups,
  saveGroups,
  getAssets,
  saveAssets,
  calculateStatistics,
  getAssetsByGroup,
  getAssetsByType,
  getFundsByCategory,
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
