/**
 * 行情数据服务
 * 接入免费行情API（天天基金、新浪）
 */

const storage = require('../utils/storage');

// 行情数据缓存时间（毫秒）
const CACHE_TIME = 60000; // 1分钟

/**
 * 获取基金净值（使用天天基金接口）
 * @param {string} fundCode - 基金代码
 * @returns {Promise<Object>} 基金净值数据
 */
function getFundNav(fundCode) {
  return new Promise((resolve, reject) => {
    if (!fundCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    // 先检查缓存
    const cacheKey = `fund_nav_${fundCode}`;
    const cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_TIME)) {
      resolve(cached.data);
      return;
    }

    const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;

    wx.request({
      url: url,
      method: 'GET',
      dataType: 'text',
      timeout: 10000,
      success: (res) => {
        try {
          if (!res.data || res.statusCode !== 200) {
            throw new Error('请求失败');
          }

          // 天天基金返回格式: jsonpgz({"fundcode":"005827",...})
          const match = res.data.match(/jsonpgz\((.+)\)/);
          if (match) {
            const data = JSON.parse(match[1]);
            const result = {
              code: data.fundcode,
              name: data.name,
              nav: parseFloat(data.dwjz) || 0,
              accumNav: parseFloat(data.ljjz) || 0,
              current: parseFloat(data.gsz) || 0,
              changePercent: parseFloat((parseFloat(data.gszzl) || 0).toFixed(2)),
              date: data.jzrq,
              updateTime: data.gztime,
              isEstimated: data.estmm !== 'null'
            };

            // 缓存结果
            storage.set(cacheKey, {
              time: Date.now(),
              data: result
            });

            resolve(result);
          } else {
            const fallback = cached ? cached.data : createEmptyFundNav(fundCode);
            resolve(fallback);
          }
        } catch (e) {
          console.error(`解析基金 ${fundCode} 数据失败:`, e);
          const fallback = cached ? cached.data : createEmptyFundNav(fundCode);
          resolve(fallback);
        }
      },
      fail: (err) => {
        console.error(`获取基金 ${fundCode} 净值失败:`, err);
        if (cached) {
          resolve(cached.data);
        } else {
          resolve(createEmptyFundNav(fundCode));
        }
      }
    });
  });
}

/**
 * 创建空基金数据
 */
function createEmptyFundNav(fundCode) {
  return {
    code: fundCode,
    name: '未知',
    nav: 0,
    accumNav: 0,
    current: 0,
    changePercent: 0,
    date: '',
    updateTime: '',
    isEstimated: false,
    isStale: true
  };
}

/**
 * 批量获取基金净值
 * @param {Array<string>} fundCodes - 基金代码数组
 * @returns {Promise<Object>} 基金净值数据映射
 */
function getBatchFundNav(fundCodes) {
  if (!fundCodes || fundCodes.length === 0) {
    return Promise.resolve({});
  }

  const uniqueCodes = [...new Set(fundCodes)];

  const promises = uniqueCodes.map(code =>
    getFundNav(code).catch(err => {
      console.error(`获取基金 ${code} 净值失败:`, err);
      return createEmptyFundNav(code);
    })
  );

  return Promise.all(promises).then(results => {
    const data = {};
    results.forEach((item, index) => {
      if (item) {
        data[uniqueCodes[index]] = item;
      }
    });
    return data;
  });
}

/**
 * 新浪股票行情接口
 * @param {Array<string>} codes - 股票代码数组
 * @returns {Promise<Object>} 行情数据
 */
function getStockQuotes(codes) {
  if (!codes || codes.length === 0) {
    return Promise.resolve({});
  }

  const cacheKey = `stock_${codes.sort().join('_')}`;
  const cached = storage.get(cacheKey);

  // 30秒缓存
  if (cached && (Date.now() - cached.time < 30000)) {
    return Promise.resolve(cached.data);
  }

  // 转换代码格式: 1.600519 -> sh600519, 0.300750 -> sz300750
  const sinaCodes = codes.map(code => {
    if (code.startsWith('1.')) return `sh${code.slice(2)}`;
    if (code.startsWith('0.')) return `sz${code.slice(2)}`;
    return code;
  });

  const url = `https://hq.sinajs.cn/list=${sinaCodes.join(',')}`;

  return new Promise((resolve) => {
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      header: {
        'Referer': 'https://finance.sina.com.cn/'
      },
      success: (res) => {
        try {
          if (!res.data) {
            throw new Error('无数据');
          }

          const result = {};
          const lines = res.data.split(';');

          lines.forEach(line => {
            const match = line.match(/var hq_str_(\w+)="(.+)"/);
            if (match) {
              const code = match[1];
              const data = match[2].split(',');
              if (data.length >= 4) {
                const realCode = code.replace(/^(sh|sz)/, '');
                const change = parseFloat(data[3]) - parseFloat(data[2]);
                const changePercent = parseFloat(data[2]) > 0
                  ? ((parseFloat(data[3]) - parseFloat(data[2])) / parseFloat(data[2]) * 100)
                  : 0;
                result[realCode] = {
                  code: realCode,
                  name: data[0] || '未知',
                  open: parseFloat(data[1]) || 0,
                  previousClose: parseFloat(data[2]) || 0,
                  current: parseFloat(data[3]) || 0,
                  high: parseFloat(data[4]) || 0,
                  low: parseFloat(data[5]) || 0,
                  change: parseFloat(change.toFixed(2)),
                  changePercent: parseFloat(changePercent.toFixed(2))
                };
              }
            }
          });

          storage.set(cacheKey, {
            time: Date.now(),
            data: result
          });

          resolve(result);
        } catch (e) {
          console.error('新浪行情解析失败:', e);
          if (cached) {
            resolve(cached.data);
          } else {
            resolve({});
          }
        }
      },
      fail: (err) => {
        console.error('新浪行情获取失败:', err);
        if (cached) {
          resolve(cached.data);
        } else {
          resolve({});
        }
      }
    });
  });
}

/**
 * 获取单只股票行情
 * @param {string} code - 股票代码
 * @returns {Promise<Object>} 股票行情
 */
function getStockQuote(code) {
  return getStockQuotes([code]).then(result => {
    return result[code] || createEmptyStockQuote(code);
  });
}

/**
 * 创建空股票行情
 */
function createEmptyStockQuote(code) {
  return {
    code: code,
    name: '未知',
    current: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    open: 0,
    previousClose: 0,
    isStale: true
  };
}

/**
 * 获取指数行情
 * @returns {Promise<Object>} 指数行情数据
 */
function getIndexData() {
  const cacheKey = 'index_data_cache';
  const cached = storage.get(cacheKey);

  if (cached && (Date.now() - cached.time < CACHE_TIME)) {
    return Promise.resolve(cached.data);
  }

  // 上证、深证、创业板、科创50
  const indices = ['1.000001', '0.399001', '0.399006', '1.000688'];

  return getStockQuotes(indices).then(data => {
    const result = {
      上证指数: data['000001'] || { name: '上证指数', current: 0, change: 0, changePercent: 0 },
      深证成指: data['399001'] || { name: '深证成指', current: 0, change: 0, changePercent: 0 },
      创业板指: data['399006'] || { name: '创业板指', current: 0, change: 0, changePercent: 0 },
      科创50: data['000688'] || { name: '科创50', current: 0, change: 0, changePercent: 0 }
    };

    storage.set(cacheKey, {
      time: Date.now(),
      data: result
    });

    return result;
  }).catch(() => {
    return {
      上证指数: { name: '上证指数', current: 0, change: 0, changePercent: 0 },
      深证成指: { name: '深证成指', current: 0, change: 0, changePercent: 0 },
      创业板指: { name: '创业板指', current: 0, change: 0, changePercent: 0 },
      科创50: { name: '科创50', current: 0, change: 0, changePercent: 0 }
    };
  });
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
      result.cost = asset.costPrice * result.shares;
      result.profit = result.marketValue - result.cost;
      result.profitPercent = result.cost > 0 ? (result.profit / result.cost * 100) : 0;
      result.todayChange = market.changePercent || 0;
      result.todayProfit = result.marketValue * (result.todayChange / 100);
    } else {
      result.currentPrice = asset.currentPrice || asset.costPrice;
      result.marketValue = result.currentPrice * result.shares;
      result.cost = asset.costPrice * result.shares;
      result.profit = result.marketValue - result.cost;
      result.profitPercent = result.cost > 0 ? (result.profit / result.cost * 100) : 0;
      result.todayChange = 0;
      result.todayProfit = 0;
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
        .catch(err => {
          console.error('获取基金行情失败:', err);
          return { type: 'fund', data: {} };
        })
    );
  }

  // 获取股票行情
  if (stocks.length > 0) {
    const stockCodes = stocks.map(s => {
      const code = s.code;
      if (code.startsWith('6')) return `1.${code}`;
      if (code.startsWith('0') || code.startsWith('3')) return `0.${code}`;
      return code;
    });

    promises.push(
      getStockQuotes(stockCodes)
        .then(data => ({ type: 'stock', data }))
        .catch(err => {
          console.error('获取股票行情失败:', err);
          return { type: 'stock', data: {} };
        })
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
 * 搜索股票/基金（使用新浪搜索）
 */
function searchSymbol(keyword) {
  return new Promise((resolve) => {
    if (!keyword || keyword.length < 1) {
      resolve([]);
      return;
    }

    const url = `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15,16,17,18,19,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220&key=${encodeURIComponent(keyword)}&count=10`;

    wx.request({
      url: url,
      method: 'GET',
      timeout: 5000,
      header: {
        'Referer': 'https://finance.sina.com.cn/'
      },
      success: (res) => {
        try {
          if (!res.data) {
            resolve([]);
            return;
          }

          // 新浪搜索返回格式: var suggest_result = [...];
          const match = res.data.match(/suggest_result\s*=\s*\[(.+)\]/);
          if (!match) {
            resolve([]);
            return;
          }

          const items = match[1].split(',');
          const results = [];

          for (let i = 0; i < items.length && results.length < 10; i += 4) {
            if (items[i + 1]) {
              const code = items[i + 1];
              const name = items[i + 2];
              const type = code.startsWith('1') || code.startsWith('5') || code.startsWith('4') ? 'FUND' : 'STOCK';
              results.push({ code, name, type });
            }
          }

          resolve(results);
        } catch (e) {
          console.error('解析搜索结果失败:', e);
          resolve([]);
        }
      },
      fail: () => resolve([])
    });
  });
}

/**
 * 清除所有行情缓存
 */
function clearCache() {
  const fundKeys = wx.getStorageInfoSync().keys || [];
  fundKeys.forEach(key => {
    if (key.startsWith('fund_nav_') || key.startsWith('stock_') || key === 'index_data_cache') {
      storage.remove(key);
    }
  });
  return true;
}

/**
 * 获取基金历史净值数据（用于计算夏普比率和波动率）
 * @param {string} fundCode - 基金代码
 * @param {number} days - 历史天数，默认180天
 * @returns {Promise<Array>} 历史净值列表 [{date, nav, change}]
 */
function getFundHistory(fundCode, days = 180) {
  return new Promise((resolve, reject) => {
    if (!fundCode) {
      resolve([]);
      return;
    }

    const cacheKey = `fund_history_${fundCode}`;
    const cached = storage.get(cacheKey);

    // 缓存6小时
    if (cached && (Date.now() - cached.time < 21600000)) {
      resolve(cached.data);
      return;
    }

    // 天天基金历史净值接口
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fundCode}&pageIndex=1&pageSize=${days}&startDate=&endDate=&_=${Date.now()}`;

    wx.request({
      url: url,
      method: 'GET',
      timeout: 15000,
      header: {
        'Referer': 'https://fund.eastmoney.com/'
      },
      success: (res) => {
        try {
          if (res.data && res.data.Data && res.data.Data.LSJZList) {
            const history = res.data.Data.LSJZList.map(item => ({
              date: item.FSRQ,
              nav: parseFloat(item.DWJZ) || 0,
              accumNav: parseFloat(item.LJJZ) || 0,
              change: parseFloat(((parseFloat(item.DWJZ) - parseFloat(item.PREVIOUS)) / parseFloat(item.PREVIOUS) * 100).toFixed(4)) || 0
            })).reverse();

            storage.set(cacheKey, {
              time: Date.now(),
              data: history
            });

            resolve(history);
          } else {
            resolve(cached ? cached.data : []);
          }
        } catch (e) {
          console.error(`获取基金 ${fundCode} 历史数据失败:`, e);
          resolve(cached ? cached.data : []);
        }
      },
      fail: (err) => {
        console.error(`请求基金 ${fundCode} 历史数据失败:`, err);
        resolve(cached ? cached.data : []);
      }
    });
  });
}

/**
 * 计算基金夏普比率
 * @param {Array} history - 历史净值数据
 * @param {number} riskFreeRate - 无风险利率，默认2.5%
 * @returns {number} 夏普比率
 */
function calculateSharpeRatio(history, riskFreeRate = 2.5) {
  if (!history || history.length < 30) {
    return 0;
  }

  // 计算每日收益率
  const dailyReturns = [];
  for (let i = 1; i < history.length; i++) {
    if (history[i].nav > 0 && history[i - 1].nav > 0) {
      const dailyReturn = (history[i].nav - history[i - 1].nav) / history[i - 1].nav;
      dailyReturns.push(dailyReturn);
    }
  }

  if (dailyReturns.length < 30) {
    return 0;
  }

  // 计算平均日收益率
  const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // 计算收益率标准差
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return 0;
  }

  // 年化收益率和年化波动率
  const annualReturn = avgReturn * 252;
  const annualStdDev = stdDev * Math.sqrt(252);

  // 夏普比率 = (年化收益率 - 无风险利率) / 年化波动率
  const sharpe = (annualReturn - riskFreeRate) / annualStdDev;

  // 限制在合理范围
  return Math.max(-5, Math.min(5, parseFloat(sharpe.toFixed(2))));
}

/**
 * 计算基金波动率
 * @param {Array} history - 历史净值数据
 * @returns {number} 年化波动率（百分比）
 */
function calculateVolatility(history) {
  if (!history || history.length < 30) {
    return 0;
  }

  // 计算每日收益率
  const dailyReturns = [];
  for (let i = 1; i < history.length; i++) {
    if (history[i].nav > 0 && history[i - 1].nav > 0) {
      const dailyReturn = (history[i].nav - history[i - 1].nav) / history[i - 1].nav;
      dailyReturns.push(dailyReturn);
    }
  }

  if (dailyReturns.length < 30) {
    return 0;
  }

  // 计算标准差
  const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const dailyStdDev = Math.sqrt(variance);

  // 年化波动率
  const annualVolatility = dailyStdDev * Math.sqrt(252);

  return parseFloat((annualVolatility * 100).toFixed(2));
}

/**
 * 批量获取基金统计指标
 * @param {Array} funds - 基金列表 [{code, name}]
 * @returns {Promise<Object>} {sharpeRatio, volatility}
 */
async function getFundStatistics(funds) {
  if (!funds || funds.length === 0) {
    return { sharpeRatio: 0, volatility: 0 };
  }

  // 获取第一只基金的统计指标作为代表
  const fund = funds[0];
  const history = await getFundHistory(fund.code, 180);

  if (history.length < 30) {
    return { sharpeRatio: 0, volatility: 0 };
  }

  return {
    sharpeRatio: calculateSharpeRatio(history),
    volatility: calculateVolatility(history)
  };
}

module.exports = {
  getFundNav,
  getBatchFundNav,
  getStockQuote,
  getStockQuotes,
  getIndexData,
  calculateRealtimeProfit,
  getAssetQuotes,
  searchSymbol,
  clearCache,
  getFundHistory,
  calculateSharpeRatio,
  calculateVolatility,
  getFundStatistics
};
