/**
 * 行情数据服务
 * 接入免费行情API（新浪、腾讯等）
 */

const storage = require('../utils/storage');
const format = require('../utils/format');

// 行情数据缓存时间（毫秒）
const CACHE_TIME = 60000; // 1分钟

/**
 * 获取行情数据（带缓存）
 */
function getMarketData(codes) {
  const cacheKey = `market_${codes.join('_')}`;
  const cached = storage.get(cacheKey);

  if (cached && (Date.now() - cached.time < CACHE_TIME)) {
    return Promise.resolve(cached.data);
  }

  return fetchMarketData(codes).then(data => {
    storage.set(cacheKey, {
      time: Date.now(),
      data: data
    });
    return data;
  });
}

/**
 * 从新浪获取行情数据
 * @param {Array} codes - 股票/基金代码数组
 */
function fetchMarketData(codes) {
  return new Promise((resolve, reject) => {
    if (!codes || codes.length === 0) {
      resolve({});
      return;
    }

    // 格式化代码（新浪接口格式）
    const formattedCodes = codes.map(code => {
      // 基金代码
      if (/^\d{6}$/.test(code)) {
        if (code.startsWith('5') || code.startsWith('1')) {
          return `sh${code}`; // 上海基金
        }
        return `sz${code}`; // 深圳基金
      }
      return code;
    });

    const url = `https://hq.sinajs.cn/list=${formattedCodes.join(',')}`;

    wx.request({
      url: url,
      method: 'GET',
      header: {
        'Referer': 'https://finance.sina.com.cn'
      },
      success: (res) => {
        try {
          const data = parseSinaData(res.data);
          resolve(data);
        } catch (e) {
          console.error('解析行情数据失败:', e);
          reject(e);
        }
      },
      fail: (err) => {
        console.error('获取行情数据失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 解析新浪行情数据
 */
function parseSinaData(responseText) {
  const result = {};

  if (!responseText) return result;

  // 新浪返回格式: var hq_str_sh600519="贵州茅台,...
  const lines = responseText.split(';');

  lines.forEach(line => {
    const match = line.match(/var hq_str_(\w+)="(.+)";/);
    if (match) {
      const code = match[1];
      const data = match[2];

      if (data) {
        const fields = data.split(',');

        if (fields.length >= 3) {
          result[code] = {
            name: fields[0],
            open: parseFloat(fields[1]) || 0,
            close: parseFloat(fields[2]) || 0,
            current: parseFloat(fields[3]) || 0,
            high: parseFloat(fields[4]) || 0,
            low: parseFloat(fields[5]) || 0,
            volume: parseInt(fields[8]) || 0,
            amount: parseFloat(fields[9]) || 0,
            updateTime: format.formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')
          };

          // 计算涨跌幅
          if (result[code].close > 0) {
            const change = result[code].current - result[code].close;
            result[code].change = change;
            result[code].changePercent = (change / result[code].close * 100);
          } else {
            result[code].change = 0;
            result[code].changePercent = 0;
          }
        }
      }
    }
  });

  return result;
}

/**
 * 获取基金净值（使用天天基金接口）
 */
function getFundNav(fundCode) {
  return new Promise((resolve, reject) => {
    if (!fundCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js`;

    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        try {
          // 天天基金返回格式: jsonpgz({"fundcode":"005827",...})
          const match = res.data.match(/jsonpgz\((.+)\)/);
          if (match) {
            const data = JSON.parse(match[1]);
            resolve({
              code: data.fundcode,
              name: data.name,
              nav: parseFloat(data.dwjz), // 单位净值
              accumNav: parseFloat(data.ljjz), // 累计净值
              current: parseFloat(data.gsz), // 估算净值
              changePercent: parseFloat(data.gszzl) || 0,
              date: data.jzrq,
              updateTime: data.gztime
            });
          } else {
            reject(new Error('解析基金数据失败'));
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject
    });
  });
}

/**
 * 批量获取基金净值
 */
function getBatchFundNav(fundCodes) {
  const promises = fundCodes.map(code =>
    getFundNav(code).catch(err => {
      console.error(`获取基金 ${code} 净值失败:`, err);
      return null;
    })
  );

  return Promise.all(promises).then(results => {
    const data = {};
    results.forEach((item, index) => {
      if (item) {
        data[fundCodes[index]] = item;
      }
    });
    return data;
  });
}

/**
 * 获取指数行情
 */
function getIndexData() {
  const indices = [
    { code: 'sh000001', name: '上证指数' },
    { code: 'sz399001', name: '深证成指' },
    { code: 'sz399006', name: '创业板指' },
    { code: 'sh000688', name: '科创50' }
  ];

  return getMarketData(indices.map(i => i.code));
}

/**
 * 计算资产实时市值和盈亏
 */
function calculateRealtimeProfit(assets, marketData) {
  return assets.map(asset => {
    const market = marketData[asset.code];
    const result = { ...asset };

    if (market) {
      result.currentPrice = market.current || asset.currentPrice;
      result.marketValue = result.currentPrice * result.shares;
      result.cost = asset.costPrice * asset.shares;
      result.profit = result.marketValue - result.cost;
      result.profitPercent = result.cost > 0
        ? (result.profit / result.cost * 100)
        : 0;
      result.todayChange = market.changePercent || 0;
      result.todayProfit = result.marketValue * (result.todayChange / 100);
    }

    return result;
  });
}

/**
 * 获取资产行情（自动识别类型）
 */
function getAssetQuotes(assets) {
  const funds = assets.filter(a => a.type === 'FUND');
  const stocks = assets.filter(a => a.type === 'STOCK');

  const promises = [];

  // 获取基金行情
  if (funds.length > 0) {
    promises.push(
      getBatchFundNav(funds.map(f => f.code))
        .then(data => ({ type: 'fund', data }))
    );
  }

  // 获取股票行情
  if (stocks.length > 0) {
    promises.push(
      getMarketData(stocks.map(s => s.code))
        .then(data => ({ type: 'stock', data }))
    );
  }

  return Promise.all(promises).then(results => {
    const quotes = {};
    results.forEach(result => {
      if (result && result.data) {
        Object.assign(quotes, result.data);
      }
    });
    return quotes;
  });
}

/**
 * 搜索股票/基金
 */
function searchSymbol(keyword) {
  return new Promise((resolve, reject) => {
    if (!keyword || keyword.length < 2) {
      resolve([]);
      return;
    }

    // 使用腾讯证券搜索接口
    const url = `https://smartbox.gtimg.cn/s3/?q=${encodeURIComponent(keyword)}&t=all`;

    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        try {
          const data = res.data;
          if (data && data.data) {
            const results = data.data.map(item => ({
              code: item.code,
              name: item.name,
              type: item.type === 'fund' ? 'FUND' : 'STOCK'
            }));
            resolve(results);
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      },
      fail: () => resolve([])
    });
  });
}

module.exports = {
  getMarketData,
  getFundNav,
  getBatchFundNav,
  getIndexData,
  calculateRealtimeProfit,
  getAssetQuotes,
  searchSymbol
};
