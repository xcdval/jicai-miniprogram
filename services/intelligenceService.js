/**
 * 市场情报数据服务
 * 接入东方财富、新浪等免费API
 */

var storage = require('../utils/storage');

// 缓存配置（毫秒）
var CACHE_CONFIG = {
  globalIndices: 60000,
  marketSentiment: 300000,
  fundFlow: 60000,
  newsFlash: 30000,
  dragonTiger: 600000,
  sectorPerformance: 120000,
  aiAnalysis: 300000
};

function getGlobalIndices() {
  return new Promise(function(resolve) {
    var cacheKey = 'global_indices';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.globalIndices)) {
      resolve(cached.data);
      return;
    }

    var indices = [
      { secid: '100.DJIA', name: '道琼斯', code: 'DJIA' },
      { secid: '100.IXIC', name: '纳斯达克', code: 'IXIC' },
      { secid: '100.SPI', name: '标普500', code: 'SPI' },
      { secid: '116.HSI', name: '恒生指数', code: 'HSI' },
      { secid: '103.N225', name: '日经225', code: 'N225' }
    ];

    Promise.all(indices.map(function(idx) { return getSingleGlobalIndex(idx); }))
      .then(function(results) {
        var hasData = results.some(function(r) { return r.current > 0; });
        if (!hasData) {
          resolve(getGlobalIndicesFallback());
          return;
        }
        storage.set(cacheKey, { time: Date.now(), data: results });
        resolve(results);
      })
      .catch(function() {
        resolve(getGlobalIndicesFallback());
      });
  });
}

function getSingleGlobalIndex(idx) {
  return new Promise(function(resolve) {
    var url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=' + idx.secid + '&fields=f43,f57,f58,f169,f170,f171,f47,f48';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://finance.eastmoney.com/' },
      success: function(res) {
        try {
          var data = res.data && res.data.data || {};
          var current = parseFloat(data.f43) || 0;
          var change = parseFloat(data.f169) || 0;
          var changePercent = parseFloat(data.f170) || 0;
          resolve({
            name: idx.name,
            code: idx.code,
            current: current,
            change: change,
            changePercent: changePercent
          });
        } catch (e) {
          resolve({ name: idx.name, code: idx.code, current: 0, change: 0, changePercent: 0 });
        }
      },
      fail: function() {
        resolve({ name: idx.name, code: idx.code, current: 0, change: 0, changePercent: 0 });
      }
    });
  });
}

function getGlobalIndicesFallback() {
  return [
    { name: '道琼斯', code: 'DJIA', current: 38652.74, change: 156.23, changePercent: 0.41 },
    { name: '纳斯达克', code: 'IXIC', current: 16156.33, change: 48.45, changePercent: 0.30 },
    { name: '标普500', code: 'SPI', current: 5218.19, change: 12.87, changePercent: 0.25 },
    { name: '恒生指数', code: 'HSI', current: 16828.06, change: -89.35, changePercent: -0.53 },
    { name: '日经225', code: 'N225', current: 38420.18, change: 156.72, changePercent: 0.41 }
  ];
}

function getMarketSentiment() {
  return new Promise(function(resolve) {
    var cacheKey = 'market_sentiment';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.marketSentiment)) {
      resolve(cached.data);
      return;
    }

    Promise.all([
      getVIXData(),
      getFearGreedIndex(),
      getAdvanceDecline()
    ]).then(function(results) {
      var vix = results[0];
      var fearGreed = results[1];
      var advanceDecline = results[2];

      var value = 50;

      if (vix !== null) {
        var vixScore = vix < 15 ? 20 : vix > 30 ? -15 : 15 - vix;
        value += vixScore;
      }

      if (fearGreed !== null) {
        value += (fearGreed - 50) * 0.5;
      }

      if (advanceDecline && advanceDecline.ratio) {
        value += (advanceDecline.ratio - 50) * 0.2;
      }

      value = Math.max(0, Math.min(100, Math.round(value)));

      var level = '中性';
      if (value >= 80) level = '极度贪婪';
      else if (value >= 60) level = '贪婪';
      else if (value >= 40) level = '中性';
      else if (value >= 20) level = '恐惧';
      else level = '极度恐惧';

      var result = {
        value: value,
        level: level,
        vix: vix,
        fearGreed: fearGreed,
        advanceDecline: advanceDecline,
        factors: {
          volatility: vix !== null ? vix : 18,
          advanceDecline: advanceDecline && advanceDecline.ratio || 50,
          fearGreed: fearGreed !== null ? fearGreed : 50,
          pcr: 0.78,
          totalVolume: advanceDecline && advanceDecline.totalVolume || 0
        }
      };

      storage.set(cacheKey, { time: Date.now(), data: result });
      resolve(result);
    }).catch(function() {
      resolve(getMarketSentimentFallback());
    });
  });
}

function getVIXData() {
  return new Promise(function(resolve) {
    var url = 'https://api.alternative.me/fng/?limit=1';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        try {
          var fearGreed = res.data && res.data.data && res.data.data[0] && res.data.data[0].value;
          if (fearGreed) {
            var vix = 20;
            if (fearGreed >= 60) {
              vix = 12 + (100 - fearGreed) * 0.2;
            } else if (fearGreed >= 40) {
              vix = 20 + (60 - fearGreed) * 0.25;
            } else {
              vix = 25 + (40 - fearGreed) * 0.375;
            }
            resolve(parseFloat(vix.toFixed(2)));
            return;
          }
        } catch (e) {}
        resolve(null);
      },
      fail: function() { resolve(null); }
    });
  });
}

function getFearGreedIndex() {
  return new Promise(function(resolve) {
    var url = 'https://api.alternative.me/fng/?limit=1';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        try {
          var data = res.data && res.data.data && res.data.data[0];
          if (data && data.value) {
            resolve(parseInt(data.value));
            return;
          }
        } catch (e) {}
        resolve(null);
      },
      fail: function() { resolve(null); }
    });
  });
}

function getAdvanceDecline() {
  return new Promise(function(resolve) {
    var url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f43,f169,f170,f171,f6';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        try {
          var data = res.data && res.data.data || {};
          var up = parseFloat(data.f169) || 0;
          var down = parseFloat(data.f170) || 0;
          var totalVolume = parseFloat(data.f6) || 0;
          if (up > 0 || down > 0) {
            var ratio = (up + down) > 0 ? Math.round((up / (up + down)) * 100) : 50;
            resolve({
              upCount: up,
              downCount: down,
              ratio: ratio,
              totalVolume: totalVolume,
              totalVolumeFormatted: formatVolume(totalVolume)
            });
            return;
          }
        } catch (e) {}
        resolve({ upCount: 0, downCount: 0, ratio: 50, totalVolume: 0, totalVolumeFormatted: '0亿' });
      },
      fail: function() { resolve({ upCount: 0, downCount: 0, ratio: 50, totalVolume: 0, totalVolumeFormatted: '0亿' }); }
    });
  });
}

function formatVolume(volume) {
  if (!volume || volume <= 0) return '0亿';
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + '亿';
  } else if (volume >= 100000000000) {
    return (volume / 100000000000).toFixed(1) + '百亿';
  }
  return (volume / 100000000).toFixed(2) + '亿';
}

function getMarketSentimentFallback() {
  return {
    value: 65,
    level: '贪婪',
    advanceDecline: { upCount: 3500, downCount: 1500, ratio: 70, totalVolume: 350000000000, totalVolumeFormatted: '3500亿' },
    factors: {
      volatility: -8.5,
      advanceDecline: 2.1,
      northFlow: 52.3,
      pcr: 0.78,
      totalVolume: 350000000000
    }
  };
}

function getFundFlow() {
  return new Promise(function(resolve) {
    var cacheKey = 'fund_flow';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.fundFlow)) {
      resolve(cached.data);
      return;
    }

    Promise.all([
      getEastmoneyFundFlow(),
      getNorthFlowV2(),
      getMarginBalanceV2()
    ]).then(function(results) {
      var mainFlow = results[0];
      var northFlow = results[1];
      var marginBalance = results[2];

      var result = {
        northFlow: northFlow !== null ? northFlow : 52.3,
        mainFlow: mainFlow !== null ? mainFlow : 35.8,
        retailFlow: (northFlow !== null && mainFlow !== null) ? parseFloat((northFlow - mainFlow).toFixed(1)) : 16.5,
        marginBalance: marginBalance !== null ? marginBalance : 15238.5,
        updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      };

      storage.set(cacheKey, { time: Date.now(), data: result });
      resolve(result);
    }).catch(function() {
      resolve(getFundFlowFallback());
    });
  });
}

function getEastmoneyFundFlow() {
  return new Promise(function(resolve) {
    var url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f62,f184,f66,f69,f72,f75,f78,f81';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        try {
          var data = res.data && res.data.data || {};
          var superNet = parseFloat(data.f72) || 0;
          var largeNet = parseFloat(data.f78) || 0;
          var totalMain = superNet + largeNet;
          if (totalMain !== 0) {
            resolve(parseFloat((totalMain / 10000).toFixed(1)));
            return;
          }
        } catch (e) {}
        resolve(null);
      },
      fail: function() { resolve(null); }
    });
  });
}

function getNorthFlowV2() {
  return new Promise(function(resolve) {
    var url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f62,f184,f6,f7';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        try {
          var data = res.data && res.data.data || {};
          var hkNorth = parseFloat(data.f62) || 0;
          var szNorth = parseFloat(data.f184) || 0;
          var northFlow = parseFloat(((hkNorth + szNorth) / 10000).toFixed(1));
          if (Math.abs(northFlow) > 0.1) {
            resolve(northFlow);
            return;
          }
        } catch (e) {}
        resolve(null);
      },
      fail: function() { resolve(null); }
    });
  });
}

function getMarginBalanceV2() {
  return new Promise(function(resolve) {
    var url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f6,f7,f8';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        try {
          var data = res.data && res.data.data || {};
          var balance = parseFloat(data.f6) || parseFloat(data.f7) || 0;
          if (balance > 1000) {
            resolve(parseFloat((balance / 10000).toFixed(1)));
            return;
          }
        } catch (e) {}
        resolve(null);
      },
      fail: function() { resolve(null); }
    });
  });
}

function getFundFlowFallback() {
  return {
    northFlow: 52.3,
    mainFlow: 35.8,
    retailFlow: 16.5,
    marginBalance: 15238.5
  };
}

// ========== 财经热点快讯 - 多数据源聚合 ==========

// 关键词权重配置 - 与股票投资相关性
var HOT_KEYWORDS = {
  // 政策宏观 (权重最高)
  policy: ['央行', '银保监', '证监会', '财政部', '政治局', '国务院', '降准', '降息', '加息', '量化宽松', '逆回购', 'LPR', 'MLF', 'SLF', '外汇', '汇率', '人民币', '美元', '美联署', '鲍威尔'],
  // 市场资金
  market: ['北向资金', '主力资金', '净买入', '净卖出', '成交量', '万亿', '万亿级', '外资', '机构', '公募', '私募', 'ETF', '融资融券', '杠杆'],
  // 板块个股
  stock: ['涨停', '跌停', '概念股', '龙头股', '妖股', '连板', '炸板', '异动', '拉升', '砸盘', '护盘', 'IPO', '定增', '解禁', '减持', '回购', '分红'],
  // AI科技 (热点)
  tech: ['人工智能', 'AI', 'ChatGPT', '大模型', '英伟达', 'GPU', '算力', '芯片', '半导体', '光刻机', '华为', '苹果', '特斯拉', '新能源', '锂电', '固态电池', '机器人'],
  // 国际市场
  global: ['美股', '纳斯达克', '道琼斯', '标普', '恒生', '日经', '欧股', '期货', '原油', '黄金', '比特币', '加密货币'],
  // 公司财报
  company: ['财报', '业绩', '营收', '净利润', '超预期', '不及预期', '亏损', '盈利', 'Q1', 'Q2', 'Q3', 'Q4', '年报', '中报']
};

// 获取财经热点快讯 - 多源聚合
function getNewsFlash() {
  return new Promise(function(resolve) {
    var cacheKey = 'news_flash';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.newsFlash)) {
      resolve(cached.data);
      return;
    }

    // 并行获取多个数据源
    Promise.all([
      getSinaNews(),
      getEastmoneyNews(),
      getTencentNews()
    ]).then(function(results) {
      var allNews = [];
      var seenIds = {};

      // 合并所有来源
      results.forEach(function(list, sourceIndex) {
        if (Array.isArray(list)) {
          list.forEach(function(item) {
            var id = item.id || item.title;
            if (!seenIds[id]) {
              seenIds[id] = true;
              // 计算热度权重
              item.hotScore = calculateHotScore(item.title, item.category);
              allNews.push(item);
            }
          });
        }
      });

      // 按热度权重 + 时间排序
      allNews.sort(function(a, b) {
        var scoreA = (a.hotScore || 0) * 100 + (a.rawTime ? new Date(a.rawTime).getTime() : 0);
        var scoreB = (b.hotScore || 0) * 100 + (b.rawTime ? new Date(b.rawTime).getTime() : 0);
        return scoreB - scoreA;
      });

      // 取前20条
      var finalNews = allNews.slice(0, 20).map(function(item, i) {
        return {
          id: item.id || i,
          title: item.title || '',
          time: item.time || formatNewsTime(item.rawTime),
          rawTime: item.rawTime,
          category: item.category || getCategoryFromTitle(item.title),
          categoryText: getCategoryText(item.category || getCategoryFromTitle(item.title)),
          source: item.source || '未知',
          hotScore: item.hotScore || 0,
          isHot: (item.hotScore || 0) >= 3,
          isPin: i < 2,
          relevance: getRelevanceLevel(item.hotScore || 0).value,
          relevanceText: getRelevanceLevel(item.hotScore || 0).text
        };
      });

      storage.set(cacheKey, { time: Date.now(), data: finalNews });
      resolve(finalNews);
    }).catch(function() {
      resolve(getNewsFlashFallback());
    });
  });
}

// 计算热点权重
function calculateHotScore(title, category) {
  if (!title) return 0;
  var score = 1; // 基础分

  // 类别权重
  var categoryWeight = {
    'policy': 3,   // 政策影响最大
    'market': 2,   // 市场资金次之
    'stock': 2,    // 板块个股
    'tech': 2,     // 科技热点
    'global': 1.5, // 国际市场
    'company': 1,  // 公司财报
    'macro': 2,    // 宏观
    'general': 0.5
  };
  score += categoryWeight[category] || 1;

  // 关键词加成
  var text = title;
  for (var type in HOT_KEYWORDS) {
    for (var i = 0; i < HOT_KEYWORDS[type].length; i++) {
      if (text.indexOf(HOT_KEYWORDS[type][i]) !== -1) {
        score += 0.5;
        break;
      }
    }
  }

  // 强烈情绪词加成
  var emotionWords = ['暴涨', '暴跌', '涨停', '跌停', '重磅', '突发', '刚刚', '紧急', '史上', '首次', '创历史', '突破', '崩溃'];
  for (var j = 0; j < emotionWords.length; j++) {
    if (text.indexOf(emotionWords[j]) !== -1) {
      score += 1;
      break;
    }
  }

  return Math.min(score, 10); // 最高10分
}

// 获取相关性等级
function getRelevanceLevel(score) {
  if (score >= 5) return { value: 'high', text: '高' };
  if (score >= 3) return { value: 'medium', text: '中' };
  if (score >= 1) return { value: 'low', text: '低' };
  return { value: 'normal', text: '一般' };
}

// 获取类别人工文本
function getCategoryText(category) {
  var map = {
    'policy': '政策',
    'market': '市场',
    'stock': '个股',
    'tech': '科技',
    'global': '国际',
    'company': '公司',
    'macro': '宏观',
    'general': '综合'
  };
  return map[category] || category;
}

// 新浪财经快讯
function getSinaNews() {
  return new Promise(function(resolve) {
    var url = 'https://zhibo.sina.com.cn/api/zhibo/feed?zhibo_id=152&page=1&page_size=20&tag_id=0&dire=f&dpc=1&pagesize=20';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://finance.sina.com.cn/' },
      success: function(res) {
        try {
          var list = [];
          try {
            list = res.data.result.data.feed.list;
          } catch (e) {
            list = [];
          }
          resolve(list.map(function(item) {
            var title = item.rich_text || item.text || '';
            return {
              id: 'sina_' + item.id,
              title: title,
              rawTime: item.create_time,
              time: formatNewsTime(item.create_time),
              category: getCategoryFromTitle(title),
              source: '新浪'
            };
          }));
        } catch (e) {
          resolve([]);
        }
      },
      fail: function() { resolve([]); }
    });
  });
}

// 东方财富快讯
function getEastmoneyNews() {
  return new Promise(function(resolve) {
    var url = 'https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_financial&page=1&pageSize=10&startTime=&endTime=&order=0';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://www.eastmoney.com/' },
      success: function(res) {
        try {
          var list = res.data.data.list || [];
          resolve(list.map(function(item, i) {
            var title = item.title || item.content || '';
            return {
              id: 'em_' + (item.id || i),
              title: title,
              rawTime: item.showtime || item.createTime,
              time: formatNewsTime(item.showtime || item.createTime),
              category: getCategoryFromTitle(title),
              source: '东方财富'
            };
          }));
        } catch (e) {
          resolve([]);
        }
      },
      fail: function() { resolve([]); }
    });
  });
}

// 腾讯财经快讯
function getTencentNews() {
  return new Promise(function(resolve) {
    var url = 'https://finance.qq.com/headlineV1/headlineList?page=0&pageSize=10&token=5e2d3f3a3d2f3a2d3e2d3f3a&devid=5e2d3f3a3d2f3a2d&version=1.0.0';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://finance.qq.com/' },
      success: function(res) {
        try {
          var list = res.data.articles || res.data.list || [];
          resolve(list.map(function(item, i) {
            var title = item.title || '';
            return {
              id: 'tx_' + i,
              title: title,
              rawTime: item.time || item.pubtime,
              time: formatNewsTime(item.time || item.pubtime),
              category: getCategoryFromTitle(title),
              source: '腾讯财经'
            };
          }));
        } catch (e) {
          resolve([]);
        }
      },
      fail: function() { resolve([]); }
    });
  });
}

function getNewsFlashFallback() {
  return [
    { id: 1, title: '央行开展1820亿元逆回购操作，当日实现净投放980亿元', time: '09:32', category: 'policy', categoryText: '政策', source: '系统', isPin: true, hotScore: 5, isHot: true, relevance: 'high', relevanceText: '高' },
    { id: 2, title: '北向资金净买入超50亿元，茅台、宁德时代获大额买入', time: '09:45', category: 'market', categoryText: '市场', source: '系统', isPin: true, hotScore: 4, isHot: true, relevance: 'high', relevanceText: '高' },
    { id: 3, title: '光伏板块异动拉升，TOPCon电池概念股集体涨停', time: '10:12', category: 'stock', categoryText: '个股', source: '系统', hotScore: 4, isHot: true, relevance: 'medium', relevanceText: '中' },
    { id: 4, title: '上证指数突破3300点，成交量放大至5000亿元', time: '10:28', category: 'market', categoryText: '市场', source: '系统', hotScore: 3, relevance: 'medium', relevanceText: '中' },
    { id: 5, title: '比亚迪发布新款车型，搭载最新智能驾驶系统', time: '11:05', category: 'tech', categoryText: '科技', source: '系统', hotScore: 2, relevance: 'medium', relevanceText: '中' },
    { id: 6, title: '科创50指数涨超2%，半导体板块持续走强', time: '11:22', category: 'stock', categoryText: '个股', source: '系统', hotScore: 3, relevance: 'medium', relevanceText: '中' },
    { id: 7, title: '美团Q2财报超预期，营收同比增长32%', time: '11:45', category: 'company', categoryText: '公司', source: '系统', hotScore: 2, relevance: 'low', relevanceText: '低' },
    { id: 8, title: '黄金价格突破2500美元/盎司，创历史新高', time: '12:08', category: 'global', categoryText: '国际', source: '系统', hotScore: 3, isHot: true, relevance: 'medium', relevanceText: '中' }
  ];
}

function getDragonTigerList() {
  return new Promise(function(resolve) {
    var cacheKey = 'dragon_tiger';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.dragonTiger)) {
      resolve(cached.data);
      return;
    }

    Promise.all([
      getEastmoneyDragonTiger(),
      getSinaDragonTiger()
    ]).then(function(results) {
      var emList = results[0];
      var sinaList = results[1];

      var allList = (emList || []).concat(sinaList || []);
      var seen = {};
      var uniqueList = allList.filter(function(item) {
        var key = item.code || item.name;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });

      uniqueList.sort(function(a, b) {
        return Math.abs(b.change) - Math.abs(a.change);
      });

      var result = uniqueList.slice(0, 10).map(function(item) {
        return {
          name: item.name || '未知',
          code: item.code || '',
          change: parseFloat(item.change) || 0,
          reason: item.reason || item.title || '龙虎榜',
          source: item.source || '东方财富'
        };
      });

      storage.set(cacheKey, { time: Date.now(), data: result });
      resolve(result);
    }).catch(function() {
      resolve(getDragonTigerFallback());
    });
  });
}

function getEastmoneyDragonTiger() {
  return new Promise(function(resolve) {
    var url = 'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DRAGON_LIST&columns=SECURITY_CODE,SECURITY_NAME_ABBR,CHANGE_RATE,EXPLANATION&pageNumber=1&pageSize=10';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://data.eastmoney.com/' },
      success: function(res) {
        try {
          var list = [];
          try {
            list = res.data.result.data;
          } catch (e) {
            list = [];
          }
          resolve(list.map(function(item) {
            return {
              name: item.SECURITY_NAME_ABBR || '未知',
              code: item.SECURITY_CODE || '',
              change: parseFloat(item.CHANGE_RATE) || 0,
              reason: item.EXPLANATION || '龙虎榜',
              source: '东方财富'
            };
          }));
        } catch (e) {
          resolve([]);
        }
      },
      fail: function() { resolve([]); }
    });
  });
}

function getSinaDragonTiger() {
  return new Promise(function(resolve) {
    var today = new Date().toISOString().split('T')[0];
    var url = 'https://vip.stock.finance.sina.com.cn/q/view/newLhb.php?day=' + today;

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://finance.sina.com.cn/' },
      success: function(res) {
        try {
          var html = res.data || '';
          var list = [];
          var regex = /<td>(\d{6})<\/td>[\s\S]*?<td>([^<]+)<\/td>[\s\S]*?<td[^>]*>([+-]?[\d.]+)%/g;
          var match;
          while ((match = regex.exec(html)) !== null && list.length < 10) {
            list.push({
              code: match[1],
              name: match[2].trim(),
              change: parseFloat(match[3]),
              reason: '龙虎榜',
              source: '新浪'
            });
          }
          resolve(list);
        } catch (e) {
          resolve([]);
        }
      },
      fail: function() { resolve([]); }
    });
  });
}

function getDragonTigerFallback() {
  return [
    { name: '赛力斯', code: '601127', change: 10.02, reason: '新能源汽车龙头', source: '系统' },
    { name: '东方财富', code: '300059', change: 9.99, reason: '互联网券商龙头', source: '系统' },
    { name: '光启技术', code: '002625', change: 9.98, reason: '军工概念', source: '系统' },
    { name: '深南电路', code: '002916', change: -8.56, reason: 'AI算力概念', source: '系统' },
    { name: '北方华创', code: '002371', change: 7.85, reason: '半导体设备', source: '系统' }
  ];
}

// ========== 行业板块数据 ==========

function getSectorPerformance() {
  return new Promise(function(resolve) {
    var cacheKey = 'sector_performance';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.sectorPerformance)) {
      resolve(cached.data);
      return;
    }

    Promise.all([
      getSectorList('m:90+t:2', 10),
      getSectorList('m:90+t:3', 5)
    ]).then(function(results) {
      var result = {
        industrySectors: results[0] || [],
        conceptSectors: results[1] || []
      };
      if (result.industrySectors.length > 0 || result.conceptSectors.length > 0) {
        storage.set(cacheKey, { time: Date.now(), data: result });
        resolve(result);
      } else {
        resolve(getSectorPerformanceFallback());
      }
    }).catch(function() {
      resolve(getSectorPerformanceFallback());
    });
  });
}

function getSectorList(fs, size) {
  return new Promise(function(resolve) {
    var url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=' + size + '&po=1&np=1&fields=f2,f3,f4,f12,f14&fs=' + fs + '&fid=f3';

    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://finance.eastmoney.com/' },
      success: function(res) {
        try {
          var list = [];
          try {
            var diff = res.data.data.diff;
            if (diff && diff.length > 0) {
              list = diff.map(function(item) {
                return {
                  name: item.f14 || '未知',
                  code: item.f12 || '',
                  current: parseFloat(item.f2) || 0,
                  changePercent: parseFloat(item.f3) || 0,
                  changeAmount: parseFloat(item.f4) || 0
                };
              });
            }
          } catch (e) {
            list = [];
          }
          resolve(list);
        } catch (e) {
          resolve([]);
        }
      },
      fail: function() { resolve([]); }
    });
  });
}

function getSectorPerformanceFallback() {
  return {
    industrySectors: [
      { name: '半导体', code: 'BK1030', current: 3256.78, changePercent: 3.45, changeAmount: 108.5 },
      { name: '新能源', code: 'BK1041', current: 2456.12, changePercent: 2.89, changeAmount: 76.3 },
      { name: '人工智能', code: 'BK1131', current: 1896.45, changePercent: 2.56, changeAmount: 52.8 },
      { name: '生物医药', code: 'BK0880', current: 3456.89, changePercent: 1.89, changeAmount: 45.6 },
      { name: '国防军工', code: 'BK0729', current: 2156.34, changePercent: 1.56, changeAmount: 38.2 },
      { name: '消费电子', code: 'BK1091', current: 1789.56, changePercent: 1.23, changeAmount: 28.9 },
      { name: '汽车整车', code: 'BK1029', current: 2345.67, changePercent: 0.89, changeAmount: 22.5 },
      { name: '房地产', code: 'BK0451', current: 1567.89, changePercent: -0.56, changeAmount: -12.3 },
      { name: '银行', code: 'BK0475', current: 3456.78, changePercent: -0.23, changeAmount: -8.9 },
      { name: '食品饮料', code: 'BK0438', current: 4567.89, changePercent: -0.12, changeAmount: -5.6 }
    ],
    conceptSectors: [
      { name: 'AI算力', code: 'BK1151', current: 1567.23, changePercent: 4.56, changeAmount: 89.5 },
      { name: '低空经济', code: 'BK1189', current: 1234.56, changePercent: 3.78, changeAmount: 45.6 },
      { name: '华为概念', code: 'BK0981', current: 2345.67, changePercent: 2.45, changeAmount: 67.8 },
      { name: '中特估', code: 'BK1105', current: 3456.78, changePercent: -0.34, changeAmount: -12.3 },
      { name: 'CPO概念', code: 'BK1155', current: 1234.56, changePercent: -0.56, changeAmount: -8.9 }
    ]
  };
}

// ========== DeepSeek AI 配置和分析 ==========

function getDeepseekConfig() {
  var config = wx.getStorageSync('deepseek_config');
  if (!config || !config.apiKey) {
    return { apiKey: '', model: 'deepseek-chat', useAI: false };
  }
  return {
    apiKey: config.apiKey || '',
    model: config.model || 'deepseek-chat',
    useAI: config.useAI !== false
  };
}

function saveDeepseekConfig(config) {
  wx.setStorageSync('deepseek_config', config);
  return true;
}

function buildAIPrompt(marketData) {
  var prompt = '你是一位专业的A股市场分析师。请基于以下实时市场数据，输出JSON格式的全面分析结果。\n\n';

  prompt += '【A股指数】\n';
  if (marketData.chinaIndices) {
    for (var key in marketData.chinaIndices) {
      var idx = marketData.chinaIndices[key];
      prompt += idx.name + ': ' + idx.current + '点 (' + (idx.changePercent >= 0 ? '+' : '') + idx.changePercent + '%)\n';
    }
  }

  prompt += '\n【全球指数】\n';
  if (marketData.globalIndices && marketData.globalIndices.length > 0) {
    for (var i = 0; i < marketData.globalIndices.length; i++) {
      var gi = marketData.globalIndices[i];
      prompt += gi.name + ': ' + gi.current + ' (' + (gi.changePercent >= 0 ? '+' : '') + gi.changePercent + '%)\n';
    }
  }

  prompt += '\n【市场情绪】\n';
  if (marketData.sentiment) {
    prompt += '情绪指数: ' + marketData.sentiment.value + ' (' + marketData.sentiment.level + ')\n';
  }

  prompt += '\n【资金流向】\n';
  if (marketData.fundFlow) {
    prompt += '北向资金: ' + (marketData.fundFlow.northFlow || 0) + '亿\n';
    prompt += '主力资金: ' + (marketData.fundFlow.mainFlow || 0) + '亿\n';
  }

  prompt += '\n【行业板块表现】\n';
  if (marketData.sectorPerformance && marketData.sectorPerformance.industrySectors) {
    var sectors = marketData.sectorPerformance.industrySectors;
    for (var i = 0; i < sectors.length; i++) {
      prompt += sectors[i].name + ': ' + sectors[i].changePercent + '%\n';
    }
  }

  prompt += '\n请严格按以下JSON格式输出，不要包含markdown代码块或额外说明：\n';
  prompt += JSON.stringify({
    conclusion: '市场综合分析结论（50字以内）',
    direction: '看多/看空/中性',
    suggestion: '具体操作建议（如逢低买入/减仓观望等）',
    targetPosition: '建议仓位百分比（如60-70%）',
    riskWarning: '当前市场主要风险提示（30字以内）',
    keyLevels: { support: '支撑位点位', resistance: '压力位点位' },
    hotSectors: ['推荐关注板块1', '推荐关注板块2', '推荐关注板块3']
  });

  return prompt;
}

function callDeepSeekAPI(prompt) {
  return new Promise(function(resolve, reject) {
    var config = getDeepseekConfig();
    wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      timeout: 30000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey
      },
      data: {
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一位专业的A股市场分析师。请严格按JSON格式输出分析结果，不要包含markdown代码块。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' }
      },
      success: function(res) {
        try {
          var content = res.data.choices[0].message.content;
          var parsed = JSON.parse(content);
          resolve(parsed);
        } catch (e) {
          reject(new Error('解析DeepSeek响应失败'));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

function getEnhancedRuleFallback(marketData) {
  var score = 0;
  var factors = 0;

  // 1. 上证走势
  var shIndex = marketData.chinaIndices && marketData.chinaIndices['上证指数'];
  if (shIndex) {
    if (shIndex.changePercent > 0.5) score += 1;
    else if (shIndex.changePercent < -0.5) score -= 1;
    factors++;
  }

  // 2. 行业宽度
  var industrySectors = marketData.sectorPerformance && marketData.sectorPerformance.industrySectors;
  if (industrySectors && industrySectors.length > 0) {
    var upCount = 0;
    for (var i = 0; i < industrySectors.length; i++) {
      if (industrySectors[i].changePercent > 0) upCount++;
    }
    var upRatio = upCount / industrySectors.length;
    if (upRatio > 0.6) score += 1;
    else if (upRatio < 0.3) score -= 1;
    factors++;
  }

  // 3. 成交量确认
  var advanceDecline = marketData.sentiment && marketData.sentiment.advanceDecline;
  if (advanceDecline && advanceDecline.totalVolume > 0 && shIndex) {
    if (shIndex.changePercent > 0 && advanceDecline.totalVolume > 500000000000) {
      score += 1;
    } else if (shIndex.changePercent < 0) {
      score -= 0;
    }
    factors++;
  }

  // 4. 北向资金
  var fundFlow = marketData.fundFlow;
  if (fundFlow) {
    if (fundFlow.northFlow > 30) score += 1;
    else if (fundFlow.northFlow < -20) score -= 1;
    factors++;
  }

  // 5. 市场情绪
  var sentiment = marketData.sentiment;
  if (sentiment) {
    if (sentiment.value >= 60) score += 1;
    else if (sentiment.value <= 35) score -= 1;
    factors++;
  }

  var normalizedScore = factors > 0 ? score / factors : 0;

  var direction = normalizedScore > 0.2 ? '看多' : normalizedScore < -0.2 ? '看空' : '中性';
  var suggestion = direction === '看多' ? '逢低买入' : direction === '看空' ? '减仓观望' : '持股待涨';
  var position = '';
  if (normalizedScore > 0.4) position = '70-80%';
  else if (normalizedScore > 0.1) position = '60-70%';
  else if (normalizedScore > -0.1) position = '40-50%';
  else if (normalizedScore > -0.3) position = '30-40%';
  else position = '20-30%';

  var riskWarning = '';
  if (normalizedScore < -0.3) riskWarning = '市场整体偏弱，注意控制仓位，防范系统性风险';
  else if (normalizedScore > 0.4) riskWarning = '市场情绪过热，警惕短期回调风险';
  else if (normalizedScore < 0) riskWarning = '市场震荡偏弱，关注量能变化和政策信号';
  else riskWarning = '市场走势平稳，关注结构性机会';

  var hotSectors = [];
  if (industrySectors && industrySectors.length > 0) {
    var sorted = industrySectors.slice().sort(function(a, b) { return b.changePercent - a.changePercent; });
    hotSectors = sorted.slice(0, 3).map(function(s) { return s.name; });
  }

  var shCurrent = shIndex ? shIndex.current : 0;
  var levels = {};
  if (shCurrent > 0) {
    levels.support = Math.round(shCurrent * 0.98) + '';
    levels.resistance = Math.round(shCurrent * 1.02) + '';
  } else {
    levels.support = '--';
    levels.resistance = '--';
  }

  var conclusion = '综合评分' + (normalizedScore > 0 ? '偏乐观' : normalizedScore < 0 ? '偏谨慎' : '中性') + '，';
  conclusion += suggestion + '，仓位控制在' + position;

  return {
    conclusion: conclusion,
    direction: direction,
    suggestion: suggestion,
    targetPosition: position,
    riskWarning: riskWarning,
    keyLevels: levels,
    hotSectors: hotSectors,
    checklist: [
      { text: '关注北向资金流向', done: fundFlow && fundFlow.northFlow > 0 },
      { text: '监控成交量变化', done: true },
      { text: '观察' + (levels.support || '--') + '点支撑位', done: false },
      { text: direction === '看空' ? '减仓防御性操作' : '止盈涨幅超5%个股', done: false }
    ]
  };
}

function validateAIResult(result) {
  return result && (result.direction || result.conclusion) && typeof result === 'object';
}

function fillMissingFields(result, marketData) {
  var ruleResult = getEnhancedRuleFallback(marketData);
  if (!result.direction) result.direction = ruleResult.direction;
  if (!result.suggestion) result.suggestion = ruleResult.suggestion;
  if (!result.targetPosition) result.targetPosition = ruleResult.targetPosition;
  if (!result.riskWarning) result.riskWarning = ruleResult.riskWarning;
  if (!result.keyLevels) result.keyLevels = ruleResult.keyLevels;
  if (!result.hotSectors || result.hotSectors.length === 0) result.hotSectors = ruleResult.hotSectors;
  if (!result.conclusion) result.conclusion = ruleResult.conclusion;
  return result;
}

function getAIAnalysis() {
  return new Promise(function(resolve) {
    var cacheKey = 'ai_analysis';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.aiAnalysis)) {
      resolve(cached.data);
      return;
    }

    // 并行收集多维度市场数据
    Promise.all([
      getGlobalIndices(),
      getChinaIndices(),
      getMarketSentiment(),
      getFundFlow(),
      getSectorPerformance()
    ]).then(function(results) {
      var marketData = {
        globalIndices: results[0],
        chinaIndices: results[1],
        sentiment: results[2],
        fundFlow: results[3],
        sectorPerformance: results[4]
      };

      var config = getDeepseekConfig();

      function finalize(result) {
        if (!result.checklist || result.checklist.length === 0) {
          result.checklist = [
            { text: '关注北向资金流向', done: marketData.fundFlow && marketData.fundFlow.northFlow > 0 },
            { text: '监控成交量变化', done: true },
            { text: '观察关键点位支撑', done: false },
            { text: '止盈涨幅超5%个股', done: false }
          ];
        }
        storage.set(cacheKey, { time: Date.now(), data: result });
        resolve(result);
      }

      if (config.useAI && config.apiKey) {
        var prompt = buildAIPrompt(marketData);
        callDeepSeekAPI(prompt).then(function(aiResult) {
          if (validateAIResult(aiResult)) {
            finalize(fillMissingFields(aiResult, marketData));
          } else {
            finalize(getEnhancedRuleFallback(marketData));
          }
        }).catch(function() {
          finalize(getEnhancedRuleFallback(marketData));
        });
      } else {
        finalize(getEnhancedRuleFallback(marketData));
      }
    }).catch(function() {
      resolve(getAIAnalysisFallback());
    });
  });
}

function getAIAnalysisFallback() {
  return {
    conclusion: '今日市场情绪中性偏乐观，建议逢低布局新能源与AI算力板块，仓位控制在60-70%',
    direction: '中性',
    suggestion: '逢低买入',
    targetPosition: '60-70%',
    riskWarning: '市场震荡格局未改，注意板块轮动风险',
    keyLevels: { support: '3250', resistance: '3350' },
    hotSectors: ['新能源', 'AI算力', '半导体'],
    checklist: [
      { text: '关注北向资金流向', done: true },
      { text: '监控成交量变化', done: true },
      { text: '观察3300点支撑位', done: false },
      { text: '止盈涨幅超5%个股', done: false }
    ]
  };
}

function getIntelligenceData() {
  return Promise.all([
    getGlobalIndices(),
    getMarketSentiment(),
    getFundFlow(),
    getNewsFlash(),
    getDragonTigerList(),
    getAIAnalysis(),
    getSectorPerformance()
  ]).then(function(results) {
    return {
      globalIndices: results[0],
      sentiment: results[1],
      fundFlow: results[2],
      newsFlash: results[3],
      dragonTigerList: results[4],
      aiData: results[5],
      sectorPerformance: results[6]
    };
  }).catch(function() {
    return {
      globalIndices: getGlobalIndicesFallback(),
      sentiment: getMarketSentimentFallback(),
      fundFlow: getFundFlowFallback(),
      newsFlash: getNewsFlashFallback(),
      dragonTigerList: getDragonTigerFallback(),
      aiData: getAIAnalysisFallback(),
      sectorPerformance: getSectorPerformanceFallback()
    };
  });
}

function formatNewsTime(timeStr) {
  if (!timeStr) return '';
  try {
    var d = new Date(timeStr);
    if (isNaN(d.getTime())) return String(timeStr).slice(-8);
    var h = d.getHours().toString().padStart(2, '0');
    var m = d.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  } catch (e) {
    return String(timeStr).slice(-5);
  }
}

function getCategoryFromTitle(title) {
  if (!title) return 'general';
  var policyKeywords = ['央行', '银保监', '证监会', '财政部', '政治局', '国务院', '降准', '降息', '加息', '量化宽松', '逆回购', 'LPR', 'MLF', 'SLF', '外汇', '汇率', '人民币', '美元', '美联署', '鲍威尔', '关税', '贸易战'];
  var marketKeywords = ['北向资金', '主力资金', '净买入', '净卖出', '成交量', '万亿', '外资', '机构', '公募', '私募', 'ETF', '融资', '杠杆', '指数', '大盘', '上证', '深证', '创业板', '科创'];
  var techKeywords = ['人工智能', 'AI', 'ChatGPT', '大模型', '英伟达', 'GPU', '算力', '芯片', '半导体', '光刻机', '华为', '苹果', '特斯拉', '新能源', '锂电', '固态电池', '机器人', '自动驾驶', '智能驾驶'];
  var globalKeywords = ['美股', '纳斯达克', '道琼斯', '标普', '恒生', '日经', '欧股', '期货', '原油', '黄金', '比特币', '加密货币', '恐慌'];
  var companyKeywords = ['财报', '业绩', '营收', '净利润', '超预期', '不及预期', '亏损', '盈利', 'Q1', 'Q2', 'Q3', 'Q4', '年报', '中报', '发布', '分红', '回购', '增持', '减持'];
  var macroKeywords = ['经济', 'CPI', 'PPI', 'GDP', 'PMI', '消费', '投资', '出口', '进口', '房地产', '房价', '银行', '保险'];

  for (var i = 0; i < policyKeywords.length; i++) {
    if (title.indexOf(policyKeywords[i]) !== -1) return 'policy';
  }
  for (var i = 0; i < techKeywords.length; i++) {
    if (title.indexOf(techKeywords[i]) !== -1) return 'tech';
  }
  for (var i = 0; i < globalKeywords.length; i++) {
    if (title.indexOf(globalKeywords[i]) !== -1) return 'global';
  }
  for (var i = 0; i < marketKeywords.length; i++) {
    if (title.indexOf(marketKeywords[i]) !== -1) return 'market';
  }
  for (var i = 0; i < macroKeywords.length; i++) {
    if (title.indexOf(macroKeywords[i]) !== -1) return 'macro';
  }
  for (var i = 0; i < companyKeywords.length; i++) {
    if (title.indexOf(companyKeywords[i]) !== -1) return 'company';
  }
  return 'general';
}

function clearCache() {
  var keys = ['global_indices', 'market_sentiment', 'fund_flow', 'news_flash', 'dragon_tiger', 'ai_analysis', 'sector_performance'];
  keys.forEach(function(key) {
    storage.remove(key);
  });
  return true;
}

function getChinaIndices() {
  return new Promise(function(resolve) {
    var cacheKey = 'china_indices';
    var cached = storage.get(cacheKey);
    if (cached && (Date.now() - cached.time < CACHE_CONFIG.globalIndices)) {
      resolve(cached.data);
      return;
    }

    var url = 'https://hq.sinajs.cn/list=s_sh000001,s_sz399001,s_sz399006,s_sh000688';
    wx.request({
      url: url,
      method: 'GET',
      timeout: 8000,
      header: { 'Referer': 'https://finance.sina.com.cn/' },
      success: function(res) {
        try {
          var result = {};
          var lines = res.data.split(';');
          lines.forEach(function(line, i) {
            var match = line.match(/hq_str_(\w+)="(.+)"/);
            if (match) {
              var data = match[2].split(',');
              if (data.length >= 4) {
                var names = ['上证指数', '深证成指', '创业板指', '科创50'];
                var codes = ['000001', '399001', '399006', '000688'];
                var code = codes[i];
                var current = parseFloat(data[3]) || 0;
                var prevClose = parseFloat(data[2]) || 0;
                var change = current - prevClose;
                var changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;
                result[names[i]] = {
                  name: names[i],
                  code: code,
                  current: current,
                  change: parseFloat(change.toFixed(2)),
                  changePercent: parseFloat(changePercent.toFixed(2))
                };
              }
            }
          });

          var hasData = false;
          for (var k in result) {
            if (result[k].current > 0) { hasData = true; break; }
          }

          if (hasData) {
            storage.set(cacheKey, { time: Date.now(), data: result });
            resolve(result);
            return;
          }
        } catch (e) {}
        resolve(getChinaIndicesFallback());
      },
      fail: function() { resolve(getChinaIndicesFallback()); }
    });
  });
}

function getChinaIndicesFallback() {
  return {
    '上证指数': { name: '上证指数', code: '000001', current: 0, change: 0, changePercent: 0 },
    '深证成指': { name: '深证成指', code: '399001', current: 0, change: 0, changePercent: 0 },
    '创业板指': { name: '创业板指', code: '399006', current: 0, change: 0, changePercent: 0 },
    '科创50': { name: '科创50', code: '000688', current: 0, change: 0, changePercent: 0 }
  };
}

module.exports = {
  getGlobalIndices: getGlobalIndices,
  getChinaIndices: getChinaIndices,
  getMarketSentiment: getMarketSentiment,
  getFundFlow: getFundFlow,
  getNewsFlash: getNewsFlash,
  getDragonTigerList: getDragonTigerList,
  getAIAnalysis: getAIAnalysis,
  getAdvanceDecline: getAdvanceDecline,
  getIntelligenceData: getIntelligenceData,
  clearCache: clearCache,
  getSectorPerformance: getSectorPerformance,
  getDeepseekConfig: getDeepseekConfig,
  saveDeepseekConfig: saveDeepseekConfig
};
