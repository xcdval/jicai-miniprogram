/**
 * OCR 文本解析工具
 * 从 OCR 识别出的文字中提取基金、股票、存款的结构化信息
 */

var format = require('./format');

// ========== 通用工具函数 ==========

function extractNumber(text) {
  if (!text) return null;
  var cleaned = text.replace(/,/g, '').trim();
  var num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractPercent(text) {
  if (!text) return null;
  var matched = text.match(/([\d.]+)\s*%/);
  if (matched) return parseFloat(matched[1]);
  var num = extractNumber(text);
  return num; // 直接返回数值（需要%时手动处理）
}

function trimText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

// ========== 字段提取正则 ==========

var FUND_CODE_REGEX = /\b(\d{6})\b/g;
var STOCK_CODE_REGEX = /\b(\d{6})\b/g;

// 基金代码更严格：支付宝/天天基金都是6位数字
// 但股票代码也有6位，所以需要结合上下文判断

// 名称行：基金名称通常包含"混合"、"股票"、"指数"、"债券"、"ETF"等
var FUND_NAME_KEYWORDS = ['混合', '股票', '指数', '债券', 'ETF', 'LOF', 'QDII', 'FOF', '货币', '理财', '灵活配置', '优选', '价值', '成长', '红利'];
// 股票名称通常为公司简称（2-4字）+ "股份/股票/集团"等
var STOCK_NAME_KEYWORDS = ['股份', '集团', '股票', '银行', '保险', '证券', '科技', '技术', '实业', '发展', '股份公司'];

// 成本价相关关键词
var COST_KEYWORDS = ['成本价', '单价', '买入价', '价格', '单位净值', '净值', '成本', '持仓成本'];
// 份额相关关键词
var SHARE_KEYWORDS = ['持有份额', '持有数', '持股数量', '持股数', '份额', '股票数量', '持仓', '持有', '数量'];
// 金额相关关键词
var AMOUNT_KEYWORDS = ['金额', '存款金额', '投资金额', '总额', '本金', '余额'];
// 利率相关关键词
var RATE_KEYWORDS = ['年利率', '利率', '收益率', '年化', '利息'];

// ========== 按行解析上下文 ==========

/**
 * 解析 OCR 文本行，返回提取的资产列表
 * @param {string[]} lines - OCR 识别的文本行（数组）
 * @param {string} platform - 平台 ID
 * @returns {{ assets: object[], confidence: number }}
 */
function parseOCRText(lines, platform) {
  if (!lines || lines.length === 0) {
    return { assets: [], confidence: 0 };
  }

  var allText = lines.join('\n');
  var assets = [];

  // 统一按平台分配解析器
  if (platform === 'alipay' || platform === 'ttjj' || platform === 'wechat') {
    assets = parseFundLines(lines, platform);
  } else if (platform === 'eastmoney') {
    assets = parseStockLines(lines, platform);
  } else {
    // other: 混合模式，优先基金
    var fundAssets = parseFundLines(lines, platform);
    if (fundAssets.length > 0) {
      assets = fundAssets;
    } else {
      var stockAssets = parseStockLines(lines, platform);
      if (stockAssets.length > 0) {
        assets = stockAssets;
      } else {
        assets = parseDepositLines(lines, platform);
      }
    }
  }

  // 计算总置信度
  var totalConfidence = 0;
  for (var i = 0; i < assets.length; i++) {
    totalConfidence += assets[i]._confidence || 0;
  }
  var avgConfidence = assets.length > 0 ? totalConfidence / assets.length : 0;

  // 去掉内部字段
  for (var j = 0; j < assets.length; j++) {
    delete assets[j]._confidence;
  }

  return { assets: assets, confidence: avgConfidence, rawText: allText };
}

/**
 * 解析基金持仓行
 */
function parseFundLines(lines, platform) {
  var assets = [];
  var foundCodes = [];
  var i;

  // 第一遍：找所有6位代码及其所在行
  var codeLineMap = []; // [{code, lineIndex, lineText}]
  for (i = 0; i < lines.length; i++) {
    var line = trimText(lines[i]);
    if (!line) continue;
    var codes = [];
    var match;
    FUND_CODE_REGEX.lastIndex = 0;
    while ((match = FUND_CODE_REGEX.exec(line)) !== null) {
      codes.push(match[1]);
    }
    for (var c = 0; c < codes.length; c++) {
      codeLineMap.push({ code: codes[c], lineIndex: i, lineText: line });
    }
  }

  // 去重
  var seenCodes = {};
  for (i = 0; i < codeLineMap.length; i++) {
    var entry = codeLineMap[i];
    if (seenCodes[entry.code]) continue;
    seenCodes[entry.code] = true;
    foundCodes.push(entry);
  }

  // 第二遍：找名称（与代码同行的或邻近行）
  var fundNames = findNamesNearCodes(lines, codeLineMap);

  // 第三遍：找成本价和份额（扫描所有行，关联到代码）
  var valueMap = extractValuesFromLines(lines, codeLineMap);

  // 构建资产对象
  for (i = 0; i < foundCodes.length; i++) {
    var codeEntry = foundCodes[i];
    var name = fundNames[codeEntry.code] || '';
    var values = valueMap[codeEntry.code] || {};

    var asset = {
      type: 'FUND',
      name: name,
      code: codeEntry.code,
      platform: getPlatformName(platform),
      costPrice: values.costPrice || null,
      shares: values.shares || null,
      currentPrice: null,
      _confidence: 0
    };

    // 计算置信度
    var fields = 0;
    if (asset.name) fields++;
    if (asset.code) fields++;
    if (asset.costPrice) fields++;
    if (asset.shares) fields++;
    asset._confidence = fields / 4;

    // 验证数据合理性
    if (asset.code && asset.name) {
      assets.push(asset);
    }
  }

  // 如果没找到代码，尝试纯文本匹配
  if (assets.length === 0) {
    assets = fallbackParseFunds(lines, platform);
  }

  return assets;
}

/**
 * 解析股票持仓行
 */
function parseStockLines(lines, platform) {
  var assets = [];
  var seenCodes = {};

  for (var i = 0; i < lines.length; i++) {
    var line = trimText(lines[i]);
    if (!line) continue;

    // 找6位代码
    var codes = [];
    var match;
    STOCK_CODE_REGEX.lastIndex = 0;
    while ((match = STOCK_CODE_REGEX.exec(line)) !== null) {
      codes.push(match[1]);
    }

    for (var c = 0; c < codes.length; c++) {
      var code = codes[c];
      if (seenCodes[code]) continue;
      seenCodes[code] = true;

      // 找名称（同行或邻近行）
      var name = findStockName(lines, i, code);

      // 找成本价和持股数
      var values = extractStockValues(lines, i, code);

      if (name || values.costPrice || values.shares) {
        assets.push({
          type: 'STOCK',
          name: name || '未知股票',
          code: code,
          platform: getPlatformName(platform),
          costPrice: values.costPrice || null,
          shares: values.shares || null,
          currentPrice: null,
          _confidence: calcStockConfidence(name, values)
        });
      }
    }
  }

  if (assets.length === 0) {
    assets = fallbackParseStocks(lines, platform);
  }

  return assets;
}

/**
 * 解析存款信息行
 */
function parseDepositLines(lines, platform) {
  var assets = [];
  var name = '';
  var amount = null;
  var rate = null;

  for (var i = 0; i < lines.length; i++) {
    var line = trimText(lines[i]);
    if (!line) continue;

    // 名称
    if (!name && (line.indexOf('定期') !== -1 || line.indexOf('存款') !== -1 || line.indexOf('存单') !== -1 || line.indexOf('银行') !== -1)) {
      name = line.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').substring(0, 20);
      if (name.length < 2) name = '';
    }

    // 金额
    if (line.indexOf('金额') !== -1 || line.indexOf('存款') !== -1 || line.indexOf('本金') !== -1) {
      var amtMatch = line.match(/([\d,]+(?:\.\d{1,2})?)/);
      if (amtMatch && !amount) {
        amount = extractNumber(amtMatch[1]);
      }
    }

    // 利率
    if ((line.indexOf('利率') !== -1 || line.indexOf('年化') !== -1) && !rate) {
      rate = extractPercent(line);
    }
  }

  if (amount || rate) {
    var confidence = 0;
    if (amount) confidence += 0.4;
    if (rate) confidence += 0.3;
    if (name) confidence += 0.3;

    assets.push({
      type: 'DEPOSIT',
      name: name || '银行存款',
      code: '',
      platform: getPlatformName(platform),
      amount: amount,
      annualRate: rate,
      costPrice: amount,
      shares: 1,
      _confidence: confidence
    });
  }

  return assets;
}

// ========== 辅助解析函数 ==========

/**
 * 找基金名称（与代码同行或邻近行）
 */
function findNamesNearCodes(lines, codeLineMap) {
  var nameMap = {};
  var FUND_NAME_REGEX = /[\u4e00-\u9fa5a-zA-Z0-9]{4,20}/g;

  for (var i = 0; i < codeLineMap.length; i++) {
    var entry = codeLineMap[i];
    var code = entry.code;
    var lineIdx = entry.lineIndex;
    var lineText = entry.lineText;

    // 同行动态提取名称（去掉代码本身）
    var candidates = [];
    var words = lineText.split(/[\s,，、]+/);
    for (var w = 0; w < words.length; w++) {
      var word = words[w].trim();
      // 过滤掉纯数字、纯代码
      if (word.length >= 4 && word.length <= 20 && !/^\d{6}$/.test(word)) {
        // 检查是否包含基金关键词
        for (var k = 0; k < FUND_NAME_KEYWORDS.length; k++) {
          if (word.indexOf(FUND_NAME_KEYWORDS[k]) !== -1) {
            candidates.push(word);
            break;
          }
        }
        // 如果没有关键词，但名称较长（>4字），也保留
        if (candidates.length === 0 && word.length >= 6 && !/^\d+$/.test(word)) {
          candidates.push(word);
        }
      }
    }

    if (candidates.length > 0) {
      nameMap[code] = candidates[0];
    } else {
      // 搜索邻近行（前后各3行）
      for (var offset = -3; offset <= 3; offset++) {
        if (offset === 0) continue;
        var nearIdx = lineIdx + offset;
        if (nearIdx < 0 || nearIdx >= lines.length) continue;
        var nearLine = trimText(lines[nearIdx]);
        if (!nearLine || nearLine.length < 4) continue;

        // 检查邻近行是否包含基金关键词
        var hasKeyword = false;
        for (var k2 = 0; k2 < FUND_NAME_KEYWORDS.length; k2++) {
          if (nearLine.indexOf(FUND_NAME_KEYWORDS[k2]) !== -1) {
            hasKeyword = true;
            break;
          }
        }

        if (hasKeyword || (nearLine.length >= 6 && nearLine.length <= 25 && !/\d{6}/.test(nearLine))) {
          // 提取名称
          var nameMatch = nearLine.match(/[\u4e00-\u9fa5a-zA-Z0-9]{4,20}/g);
          if (nameMatch) {
            nameMap[code] = nameMatch[0];
            break;
          }
        }
      }
    }
  }

  return nameMap;
}

/**
 * 找股票名称
 */
function findStockName(lines, codeLineIdx, code) {
  var lineText = lines[codeLineIdx] || '';
  // 同行：代码前的文字
  var idx = lineText.indexOf(code);
  if (idx > 0) {
    var before = lineText.substring(0, idx);
    var nameMatch = before.match(/[\u4e00-\u9fa5]{2,8}/);
    if (nameMatch) return nameMatch[nameMatch.length - 1];
  }

  // 邻近行
  for (var offset = -2; offset <= 2; offset++) {
    if (offset === 0) continue;
    var nearIdx = codeLineIdx + offset;
    if (nearIdx < 0 || nearIdx >= lines.length) continue;
    var nearLine = trimText(lines[nearIdx]);
    if (!nearLine) continue;

    // 找股票关键词
    for (var k = 0; k < STOCK_NAME_KEYWORDS.length; k++) {
      var kwIdx = nearLine.indexOf(STOCK_NAME_KEYWORDS[k]);
      if (kwIdx !== -1) {
        // 提取公司名称
        var start = Math.max(0, kwIdx - 8);
        var end = Math.min(nearLine.length, kwIdx + STOCK_NAME_KEYWORDS[k].length + 2);
        var extracted = nearLine.substring(start, end).trim();
        var cnMatch = extracted.match(/[\u4e00-\u9fa5]{2,8}/);
        if (cnMatch) return cnMatch[0];
      }
    }

    // 如果没有关键词，但有中文字符
    if (/[\u4e00-\u9fa5]{2,}/.test(nearLine)) {
      var allMatches = nearLine.match(/[\u4e00-\u9fa5]{2,8}/g);
      if (allMatches && allMatches.length > 0) {
        // 取最长的
        var longest = allMatches.reduce(function(a, b) { return a.length >= b.length ? a : b; });
        if (longest.length >= 4) return longest;
      }
    }
  }

  return '';
}

/**
 * 从所有行提取成本价和份额（关联到具体代码）
 */
function extractValuesFromLines(lines, codeLineMap) {
  var valueMap = {};
  var COST_REGEX = /(?:成本价|单价|买入价|价格|净值|单位净值)[：:,\s]*([\d.]+)/g;
  var SHARE_REGEX = /(?:持有份额|持有数|份额|持股|股票数量|数量)[：:,\s]*([\d,]+)/g;

  // 为每个代码初始化
  for (var c = 0; c < codeLineMap.length; c++) {
    valueMap[codeLineMap[c].code] = { costPrice: null, shares: null };
  }

  // 扫描所有行找成本价和份额
  for (var i = 0; i < lines.length; i++) {
    var line = trimText(lines[i]);
    if (!line) continue;

    // 成本价
    var costMatches = [];
    var match;
    COST_REGEX.lastIndex = 0;
    while ((match = COST_REGEX.exec(line)) !== null) {
      costMatches.push(extractNumber(match[1]));
    }

    // 份额
    var shareMatches = [];
    SHARE_REGEX.lastIndex = 0;
    while ((match = SHARE_REGEX.exec(line)) !== null) {
      shareMatches.push(extractNumber(match[1]));
    }

    if (costMatches.length > 0 || shareMatches.length > 0) {
      // 找同行代码
      var lineCodes = [];
      var codeMatch;
      FUND_CODE_REGEX.lastIndex = 0;
      while ((codeMatch = FUND_CODE_REGEX.exec(line)) !== null) {
        lineCodes.push(codeMatch[1]);
      }

      // 如果同行有代码，关联同行
      if (lineCodes.length > 0) {
        for (var j = 0; j < lineCodes.length; j++) {
          if (valueMap[lineCodes[j]]) {
            if (costMatches.length > 0) valueMap[lineCodes[j]].costPrice = costMatches[0];
            if (shareMatches.length > 0) valueMap[lineCodes[j]].shares = shareMatches[0];
          }
        }
      } else {
        // 同行没有代码 → 找最近的代码行
        var nearestCode = findNearestCode(lines, i, codeLineMap);
        if (nearestCode && valueMap[nearestCode]) {
          if (costMatches.length > 0 && !valueMap[nearestCode].costPrice) {
            valueMap[nearestCode].costPrice = costMatches[0];
          }
          if (shareMatches.length > 0 && !valueMap[nearestCode].shares) {
            valueMap[nearestCode].shares = shareMatches[0];
          }
        }
      }
    }
  }

  return valueMap;
}

/**
 * 提取股票的成本价和持股数
 */
function extractStockValues(lines, codeLineIdx, code) {
  var result = { costPrice: null, shares: null };

  // 扫描前后5行
  for (var offset = -5; offset <= 5; offset++) {
    if (offset === 0) continue;
    var lineIdx = codeLineIdx + offset;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    var line = trimText(lines[lineIdx]);

    // 成本价
    if (!result.costPrice && (line.indexOf('成本') !== -1 || line.indexOf('买入') !== -1 || line.indexOf('价') !== -1)) {
      var costMatch = line.match(/([\d.]+)/);
      if (costMatch) {
        var cost = extractNumber(costMatch[1]);
        // 股票价格通常在1-1000范围
        if (cost && cost > 0.1 && cost < 10000) {
          result.costPrice = cost;
        }
      }
    }

    // 持股数
    if (!result.shares && (line.indexOf('持股') !== -1 || line.indexOf('数量') !== -1 || line.indexOf('份额') !== -1)) {
      var shareMatch = line.match(/([\d,]+)/);
      if (shareMatch) {
        var shares = extractNumber(shareMatch[1]);
        if (shares && shares > 0) {
          result.shares = shares;
        }
      }
    }
  }

  return result;
}

/**
 * 找距离目标行最近的代码行
 */
function findNearestCode(lines, targetIdx, codeLineMap) {
  var minDist = Infinity;
  var nearest = null;

  for (var i = 0; i < codeLineMap.length; i++) {
    var dist = Math.abs(codeLineMap[i].lineIndex - targetIdx);
    if (dist < minDist) {
      minDist = dist;
      nearest = codeLineMap[i].code;
    }
  }

  return nearest;
}

/**
 * 纯文本降级解析（无代码时）
 */
function fallbackParseFunds(lines, platform) {
  var assets = [];
  var name = '';
  var costPrice = null;
  var shares = null;

  for (var i = 0; i < lines.length; i++) {
    var line = trimText(lines[i]);
    if (!line) continue;

    // 找基金名称关键词
    for (var k = 0; k < FUND_NAME_KEYWORDS.length; k++) {
      if (line.indexOf(FUND_NAME_KEYWORDS[k]) !== -1 && !name) {
        var cnMatch = line.match(/[\u4e00-\u9fa5a-zA-Z0-9]{4,20}/g);
        if (cnMatch) name = cnMatch[0];
        break;
      }
    }

    // 成本价
    if (line.indexOf('成本') !== -1 || line.indexOf('净值') !== -1) {
      var costMatch = line.match(/([\d.]+)/);
      if (costMatch && !costPrice) {
        costPrice = extractNumber(costMatch[1]);
      }
    }

    // 份额
    if (line.indexOf('份额') !== -1 || line.indexOf('持有') !== -1) {
      var shareMatch = line.match(/([\d,]+)/);
      if (shareMatch && !shares) {
        shares = extractNumber(shareMatch[1]);
      }
    }
  }

  if (name) {
    var conf = 0;
    if (name) conf += 0.4;
    if (costPrice) conf += 0.3;
    if (shares) conf += 0.3;

    assets.push({
      type: 'FUND',
      name: name,
      code: '',
      platform: getPlatformName(platform),
      costPrice: costPrice,
      shares: shares,
      currentPrice: null,
      _confidence: conf
    });
  }

  return assets;
}

/**
 * 纯文本降级解析股票
 */
function fallbackParseStocks(lines, platform) {
  var assets = [];
  var name = '';
  var costPrice = null;
  var shares = null;

  for (var i = 0; i < lines.length; i++) {
    var line = trimText(lines[i]);
    if (!line) continue;

    // 股票名称关键词
    for (var k = 0; k < STOCK_NAME_KEYWORDS.length; k++) {
      if (line.indexOf(STOCK_NAME_KEYWORDS[k]) !== -1 && !name) {
        var cnMatch = line.match(/[\u4e00-\u9fa5]{2,8}/g);
        if (cnMatch) {
          for (var m = 0; m < cnMatch.length; m++) {
            if (cnMatch[m].length >= 4) {
              name = cnMatch[m];
              break;
            }
          }
        }
        break;
      }
    }

    // 成本
    if ((line.indexOf('成本') !== -1 || line.indexOf('买入') !== -1) && !costPrice) {
      var costMatch = line.match(/([\d.]+)/);
      if (costMatch) {
        costPrice = extractNumber(costMatch[1]);
      }
    }

    // 数量
    if ((line.indexOf('持股') !== -1 || line.indexOf('数量') !== -1) && !shares) {
      var shareMatch = line.match(/([\d,]+)/);
      if (shareMatch) shares = extractNumber(shareMatch[1]);
    }
  }

  if (name) {
    assets.push({
      type: 'STOCK',
      name: name,
      code: '',
      platform: getPlatformName(platform),
      costPrice: costPrice,
      shares: shares,
      currentPrice: null,
      _confidence: (name ? 0.4 : 0) + (costPrice ? 0.3 : 0) + (shares ? 0.3 : 0)
    });
  }

  return assets;
}

/**
 * 计算股票置信度
 */
function calcStockConfidence(name, values) {
  var conf = 0;
  if (name) conf += 0.4;
  if (values.costPrice) conf += 0.3;
  if (values.shares) conf += 0.3;
  return conf;
}

// ========== 平台名称映射 ==========

function getPlatformName(platformId) {
  var names = {
    alipay: '支付宝',
    ttjj: '天天基金',
    eastmoney: '东方财富',
    wechat: '微信理财通',
    other: '其他平台'
  };
  return names[platformId] || '未知平台';
}

// ========== 对外接口 ==========

/**
 * 解析 OCR 文本为主入口
 * @param {string[]} lines - OCR 识别的文本行数组
 * @param {string} platform - 平台 ID
 */
function parseTextLines(lines, platform) {
  return parseOCRText(lines, platform);
}

/**
 * 解析纯文本（用于粘贴或降级）
 * @param {string} text - 单行或多行文本
 * @param {string} platform - 平台 ID
 */
function parseText(text, platform) {
  if (!text) return { assets: [], confidence: 0, rawText: '' };
  var lines = text.split(/\n|[\r\n]+/);
  return parseOCRText(lines, platform);
}

/**
 * 计算单条资产置信度
 */
function calcConfidence(asset) {
  var score = 0;
  if (asset.name) score += 0.25;
  if (asset.code) score += 0.25;
  if (asset.costPrice !== null && asset.costPrice !== undefined) score += 0.2;
  if (asset.shares !== null && asset.shares !== undefined) score += 0.2;
  if (asset.amount !== null && asset.amount !== undefined) score += 0.2;
  if (asset.annualRate !== null && asset.annualRate !== undefined) score += 0.1;
  return Math.round(score * 100) / 100;
}

module.exports = {
  parseTextLines: parseTextLines,
  parseText: parseText,
  parseFundHoldingText: function(text, platform) { return parseText(text, platform); },
  parseStockHoldingText: function(text, platform) { return parseText(text, platform); },
  parseDepositText: function(text, platform) { return parseText(text, platform); },
  extractNumber: extractNumber,
  extractPercent: extractPercent,
  calcConfidence: calcConfidence,
  getPlatformName: getPlatformName
};
