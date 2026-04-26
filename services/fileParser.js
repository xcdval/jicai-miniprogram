/**
 * 文件解析服务
 * 支持 CSV 和 Excel 文件解析，用于批量导入资产数据
 */

const marketService = require('./marketService');

/**
 * 解析文件
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型 'csv' | 'xlsx' | 'xls'
 * @returns {Promise<Array>} 解析后的资产数据数组
 */
async function parseFile(filePath, fileType) {
  const fs = wx.getFileSystemManager();

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    if (fileType === 'csv' || fileType === 'txt') {
      return parseCSV(content);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      // 小程序不支持 SheetJS，这里提示用户使用 CSV
      return { success: false, message: 'Excel 格式暂不支持，请使用 CSV 格式导入' };
    }

    return { success: false, message: '不支持的文件格式' };
  } catch (e) {
    return { success: false, message: '文件读取失败: ' + e.message };
  }
}

/**
 * 解析 CSV 内容
 * @param {string} content - CSV 文件内容
 * @returns {Object} { success: true, data: assets } 或 { success: false, message: string }
 */
function parseCSV(content) {
  if (!content || typeof content !== 'string') {
    return { success: false, message: '文件内容为空' };
  }

  // 处理不同换行符
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  if (lines.length < 2) {
    return { success: false, message: '文件数据不足，请检查格式' };
  }

  // 解析表头
  const headerLine = lines[0].trim();
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  // 标准化表头映射
  const headerMap = {
    '基金代码': 'code',
    '代码': 'code',
    'code': 'code',
    '基金名称': 'name',
    '名称': 'name',
    'name': 'name',
    '持有份额': 'shares',
    '份额': 'shares',
    'shares': 'shares',
    '成本价': 'costPrice',
    '单价': 'costPrice',
    'costprice': 'costPrice',
    '分组': 'group',
    '组别': 'group',
    'group': 'group',
    '类型': 'type',
    'assettype': 'type'
  };

  const normalizedHeaders = headers.map(h => headerMap[h] || h);

  // 检查必需列
  const requiredCols = ['code', 'shares'];
  const missingCols = requiredCols.filter(col => !normalizedHeaders.includes(col));

  if (missingCols.length > 0) {
    return { success: false, message: `缺少必需列: ${missingCols.join(', ')}` };
  }

  const assets = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const asset = {};

    normalizedHeaders.forEach((col, idx) => {
      if (values[idx] !== undefined && values[idx] !== '') {
        asset[col] = values[idx].trim();
      }
    });

    // 验证必需字段
    if (!asset.code) {
      errors.push(`第${i + 1}行: 缺少基金/股票代码`);
      continue;
    }

    if (!asset.shares) {
      errors.push(`第${i + 1}行: 缺少持有份额`);
      continue;
    }

    // 类型检测
    asset.shares = parseFloat(asset.shares) || 0;
    if (asset.costPrice) {
      asset.costPrice = parseFloat(asset.costPrice);
    }

    // 自动判断资产类型
    asset.type = detectAssetType(asset.code);

    // 名称处理
    if (!asset.name) {
      asset.name = asset.code;
    }

    assets.push(asset);
  }

  if (assets.length === 0) {
    return { success: false, message: '没有有效数据: ' + errors.join('; ') };
  }

  return { success: true, data: assets, errors };
}

/**
 * 解析 CSV 行（处理引号包围的字段）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * 自动检测资产类型
 * @param {string} code - 资产代码
 * @returns {string} 'FUND' | 'STOCK' | 'DEPOSIT'
 */
function detectAssetType(code) {
  if (!code) return 'FUND';

  // 存款检测：包含"存"、"定"、"活"等关键字
  if (/[存定活]/i.test(code)) {
    return 'DEPOSIT';
  }

  // 股票检测：6位数字，且以 0、3、6、8、9 开头
  if (/^\d{6}$/.test(code)) {
    const prefix = code[0];
    if (['0', '3', '6', '8', '9'].includes(prefix)) {
      return 'STOCK';
    }
  }

  // 基金：默认
  return 'FUND';
}

/**
 * 验证并补充资产数据（获取名称和当前价格）
 * @param {Array} assets - 资产数组
 * @returns {Promise<Array>} 补充后的资产数组
 */
async function enrichAssets(assets) {
  const enriched = [];

  for (const asset of assets) {
    try {
      // 获取基金/股票信息
      if (asset.type === 'FUND' || asset.type === 'STOCK') {
        const quote = await marketService.getAssetQuotes([{ code: asset.code, type: asset.type }]);

        if (quote && quote[asset.code]) {
          asset.name = quote[asset.code].name || asset.name;
          // 如果成本价为0，使用当前价格
          if (!asset.costPrice || asset.costPrice === 0) {
            asset.costPrice = quote[asset.code].current || 0;
          }
        }
      }

      enriched.push(asset);
    } catch (e) {
      console.warn(`获取资产 ${asset.code} 信息失败:`, e);
      enriched.push(asset);
    }
  }

  return enriched;
}

/**
 * 导入资产数据（批量）
 * @param {Array} assets - 资产数组
 * @param {string} defaultGroupName - 默认分组名称
 * @returns {Object} { success: boolean, imported: number, failed: number, errors: Array }
 */
function importAssets(assets, defaultGroupName = '导入分组') {
  const assetService = require('./assetService');
  const storage = require('../utils/storage');

  let imported = 0;
  let failed = 0;
  const errors = [];

  // 确保默认分组存在
  const groups = assetService.getGroups();
  let defaultGroup = groups.find(g => g.name === defaultGroupName);

  if (!defaultGroup) {
    defaultGroup = {
      id: `group_${Date.now()}`,
      name: defaultGroupName,
      color: '#8B5CF6'
    };
    groups.push(defaultGroup);
    assetService.saveGroups(groups);
  }

  // 遍历导入
  assets.forEach((asset, idx) => {
    try {
      const result = assetService.addAsset(defaultGroup.id, {
        type: asset.type || 'FUND',
        code: asset.code,
        name: asset.name || asset.code,
        shares: asset.shares || 0,
        costPrice: asset.costPrice || 0,
        currentPrice: asset.costPrice || 0,
        groupName: defaultGroupName
      });

      if (result.success) {
        imported++;
      } else {
        failed++;
        errors.push(`第${idx + 1}条: ${result.message}`);
      }
    } catch (e) {
      failed++;
      errors.push(`第${idx + 1}条: ${e.message}`);
    }
  });

  return { success: failed === 0, imported, failed, errors };
}

/**
 * 导出为 CSV 格式
 * @param {Array} assets - 资产数组
 * @returns {string} CSV 格式字符串
 */
function toCSV(assets) {
  const headers = ['基金代码', '基金名称', '持有份额', '成本价', '分组', '类型'];
  const rows = assets.map(a => [
    a.code || '',
    a.name || '',
    a.shares || 0,
    a.costPrice || 0,
    a.groupName || '',
    a.type || 'FUND'
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

module.exports = {
  parseFile,
  parseCSV,
  detectAssetType,
  enrichAssets,
  importAssets,
  toCSV
};