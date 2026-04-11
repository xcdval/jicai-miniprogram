/**
 * 模拟数据
 * 用于首次使用和开发测试
 */

// 默认资产分组
const defaultGroups = [
  { id: 'all', name: '全部', color: '#2563eb' },
  { id: 'group1', name: '稳健型', color: '#10b981' },
  { id: 'group2', name: '成长型', color: '#f59e0b' },
  { id: 'group3', name: '高收益', color: '#ef4444' }
];

// 默认资产数据
const defaultAssets = {
  version: '2.0',
  lastUpdate: new Date().toISOString(),
  groups: [
    {
      id: 'group1',
      name: '稳健型',
      color: '#10b981',
      assets: [
        {
          id: 'fund001',
          type: 'FUND',
          name: '易方达蓝筹精选混合',
          code: '005827',
          platform: '支付宝',
          costPrice: 2.3456,
          currentPrice: 2.5234,
          shares: 10000,
          currency: 'CNY'
        },
        {
          id: 'fund002',
          type: 'FUND',
          name: '招商中证白酒指数',
          code: '161725',
          platform: '天天基金',
          costPrice: 1.1234,
          currentPrice: 1.0892,
          shares: 15000,
          currency: 'CNY'
        }
      ]
    },
    {
      id: 'group2',
      name: '成长型',
      color: '#f59e0b',
      assets: [
        {
          id: 'stock001',
          type: 'STOCK',
          name: '宁德时代',
          code: '300750',
          platform: '华泰证券',
          costPrice: 185.50,
          currentPrice: 198.20,
          shares: 500,
          currency: 'CNY'
        },
        {
          id: 'stock002',
          type: 'STOCK',
          name: '比亚迪',
          code: '002594',
          platform: '华泰证券',
          costPrice: 225.00,
          currentPrice: 238.50,
          shares: 300,
          currency: 'CNY'
        }
      ]
    },
    {
      id: 'group3',
      name: '高收益',
      color: '#ef4444',
      assets: [
        {
          id: 'deposit001',
          type: 'DEPOSIT',
          name: '招商银行定期',
          platform: '招商银行',
          amount: 100000,
          annualRate: 2.85,
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          currency: 'CNY'
        }
      ]
    }
  ]
};

// 市场行情数据
const marketData = {
  indices: [
    { name: '上证指数', code: 'SH000001', price: 3052.34, change: 12.56, changePercent: 0.41 },
    { name: '深证成指', code: 'SZ399001', price: 9384.56, change: 45.23, changePercent: 0.48 },
    { name: '创业板指', code: 'SZ399006', price: 1823.45, change: 8.92, changePercent: 0.49 },
    { name: '科创50', code: 'SH000688', price: 789.34, change: -2.15, changePercent: -0.27 },
    { name: '恒生指数', code: 'HKHSI', price: 16523.45, change: 156.78, changePercent: 0.96 },
    { name: '纳斯达克', code: 'IXIC', price: 16234.56, change: -45.67, changePercent: -0.28 }
  ],
  updateTime: new Date().toISOString()
};

// 市场快讯数据
const newsFlash = [
  {
    id: 1,
    time: '10:42',
    category: 'market',
    title: 'A股三大指数集体高开',
    content: '上证指数涨0.32%，深证成指涨0.48%，创业板指涨0.65%。半导体、新能源板块领涨。',
    source: '财联社',
    isHot: true
  },
  {
    id: 2,
    time: '10:38',
    category: 'macro',
    title: '央行开展1000亿元MLF操作',
    content: '中标利率维持2.5%不变，符合市场预期。今日有1000亿元MLF到期。',
    source: '华尔街见闻',
    isHot: false
  },
  {
    id: 3,
    time: '10:25',
    category: 'company',
    title: '宁德时代：一季度净利润同比增长25%',
    content: '公司发布业绩预告，一季度实现净利润约110亿元，同比增长约25%。',
    source: '公司公告',
    isHot: true,
    stockChange: '+2.3%'
  },
  {
    id: 4,
    time: '10:15',
    category: 'market',
    title: '北向资金净流入超30亿元',
    content: '沪股通净流入18.5亿元，深股通净流入12.3亿元，连续3日净流入。',
    source: '东方财富',
    isHot: false
  },
  {
    id: 5,
    time: '09:58',
    category: 'macro',
    title: '美联储会议纪要：多数官员支持年内降息',
    content: '最新FOMC会议纪要显示，多数委员认为若通胀继续回落，年内开始降息是合适的。',
    source: '彭博',
    isHot: true
  }
];

// 市场情报数据
const intelligenceData = {
  morning: {
    phase: 'morning',
    phaseName: '早盘',
    icon: '🌅',
    summary: '隔夜美股小幅收涨，科技股表现强势。A股三大指数高开，市场情绪偏向乐观。关注今日公布的经济数据。',
    keyPoints: [
      '隔夜美股道指涨0.3%，纳指涨0.8%',
      '美债收益率回落，10年期降至4.2%',
      '原油期货小幅上涨，黄金震荡',
      '今日重点关注：CPI数据、美联储官员讲话'
    ]
  },
  intraday: {
    phase: 'intraday',
    phaseName: '盘中',
    icon: '📊',
    summary: '上午市场呈现震荡上行走势，成交量较昨日有所放大。半导体、新能源板块持续走强，金融地产板块相对疲软。',
    keyPoints: [
      '半导体板块大涨3.5%，芯片股集体走强',
      '北向资金持续流入，上午净买入28亿',
      '两市成交额突破5000亿，放量明显',
      '创业板指数领涨，涨幅超1%'
    ]
  },
  closing: {
    phase: 'closing',
    phaseName: '盘后',
    icon: '📉',
    summary: 'A股三大指数集体收涨，创业板指涨幅最大。全天成交额突破万亿，北向资金大幅净流入。市场情绪明显改善。',
    keyPoints: [
      '上证指数收涨0.65%，深成指涨0.89%',
      '全天成交额1.02万亿，放量1600亿',
      '北向资金净买入56.8亿元',
      '涨停个股68只，跌停3只'
    ]
  }
};

// AI决策数据
const aiDecision = {
  date: formatDate(new Date()),
  marketDirection: 'BULL',
  confidence: 75,
  operation: '持有为主，适度加仓',
  summary: '市场情绪转暖，技术面呈现多头排列。建议关注半导体、新能源板块的机会，保持适度仓位。',
  signals: [
    { label: '明日预判', value: '震荡偏多', type: 'hold' },
    { label: '压力位', value: '3,320', type: 'neutral' },
    { label: '支撑位', value: '3,260', type: 'neutral' },
    { label: '量能', value: '放量', type: 'bull' }
  ],
  checklist: [
    { text: '光伏板块延续性，关注龙头隆基绿能走势', checked: true },
    { text: '半导体板块突破有效性，观察成交量配合', checked: true },
    { text: '北向资金流向，若持续流入则看好反弹', checked: false },
    { text: '关注今晚美联储利率决议结果', checked: false }
  ]
};

// 分析数据
const analysisData = {
  healthScore: 78,
  industryData: [
    { name: '新能源', value: 35, color: '#10b981' },
    { name: '半导体', value: 25, color: '#2563eb' },
    { name: '消费', value: 20, color: '#f59e0b' },
    { name: '金融', value: 15, color: '#8b5cf6' },
    { name: '其他', value: 5, color: '#94a3b8' }
  ],
  suggestions: [
    {
      type: 'warning',
      title: '新能源持仓占比过高',
      content: '建议适当降低新能源板块仓位，分散风险。当前占比35%，建议控制在25%以内。'
    },
    {
      type: 'success',
      title: '半导体配置合理',
      content: '半导体板块配置比例适中，符合当前市场主线。建议继续持有。'
    },
    {
      type: 'info',
      title: '建议增加防御性配置',
      content: '当前市场波动较大，建议适当增加消费、医药等防御性板块配置。'
    }
  ]
};

// 辅助函数
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  defaultGroups,
  defaultAssets,
  marketData,
  newsFlash,
  intelligenceData,
  aiDecision,
  analysisData
};
