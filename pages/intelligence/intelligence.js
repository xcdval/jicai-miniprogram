const intelligenceService = require('../../services/intelligenceService');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    activePhase: 'morning',  // 'morning'(09:15前) | 'intraday'(09:30-15:00) | 'closing'(15:00后)
    isTradingDay: true,
    lastTradingDay: '',     // 上次开盘日期

    // 全球市场指数
    globalIndices: [],
    // 国内指数（上证、深证等）
    chinaIndices: [],
    // 市场情绪
    sentiment: { value: 65, level: '贪婪', factors: {} },
    // 资金流向
    fundFlow: { northFlow: 0, mainFlow: 0, retailFlow: 0, marginBalance: 0 },
    // 快讯新闻
    newsFlash: [],
    // 龙虎榜
    dragonTigerList: [],
    // AI分析
    aiData: {},
    // 涨跌家数
    upCount: 0,
    downCount: 0,
    upDownRatio: 50,
    totalVolume: 0,
    totalVolumeFormatted: '',
    // 行业板块数据
    sectorPerformance: { industrySectors: [], conceptSectors: [] },
    // 加载状态
    isLoading: true,
    isRefreshing: false,  // 手动刷新状态
    lastUpdate: '',
    refreshCount: 0        // 刷新计数（用于动画）
  },

  // 定时器
  _refreshTimer: null,

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.updatePhaseByTime();
    this.loadData();
    this.startAutoRefresh();
  },

  // 根据当前时间自动判断时段
  updatePhaseByTime() {
    const now = new Date();
    const day = now.getDay();  // 0=周日, 6=周六
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 判断是否为开盘日（周一至周五）
    const isWeekend = day === 0 || day === 6;
    this.setData({ isTradingDay: !isWeekend });

    if (isWeekend) {
      // 周末显示盘后复盘
      this.setData({ activePhase: 'closing' });
      return;
    }

    const beforeOpen = hours < 9 || (hours === 9 && minutes < 15);   // 09:15前
    const afterClose = hours >= 15;                                    // 15:00后

    let phase = 'intraday';  // 默认盘中
    if (beforeOpen) {
      phase = 'morning';
    } else if (afterClose) {
      phase = 'closing';
      // 收盘时保存复盘数据
      this.saveClosingData();
    }
    this.setData({ activePhase: phase });
  },

  // 保存收盘复盘数据
  saveClosingData() {
    const today = new Date().toLocaleDateString('zh-CN');
    const lastSave = wx.getStorageSync('lastClosingDate') || '';

    // 只在15:00后每天保存一次
    if (lastSave === today) return;

    const closingData = {
      date: today,
      sentiment: this.data.sentiment,
      fundFlow: this.data.fundFlow,
      dragonTigerList: this.data.dragonTigerList,
      aiData: this.data.aiData,
      upCount: this.data.upCount,
      downCount: this.data.downCount,
      upDownRatio: this.data.upDownRatio,
      totalVolumeFormatted: this.data.totalVolumeFormatted
    };

    wx.setStorageSync('lastClosingData', closingData);
    wx.setStorageSync('lastClosingDate', today);
    this.setData({ lastTradingDay: today });
  },

  onShow() {
    // 每次进入页面重新判断时段
    this.updatePhaseByTime();
    intelligenceService.clearCache();
    this.loadData();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  // 启动自动刷新
  startAutoRefresh() {
    this.stopAutoRefresh();
    this._refreshTimer = setInterval(() => {
      // 非交易时段跳过刷新
      if (!this.data.isTradingDay) return;

      // 每30秒自动刷新快讯
      intelligenceService.clearCache();
      intelligenceService.getNewsFlash().then(newsFlash => {
        const now = new Date();
        this.setData({
          newsFlash,
          lastUpdate: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      });
    }, 30000);
  },

  // 停止自动刷新
  stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  // 手动刷新 - 带动画反馈
  onRefreshTap() {
    if (this.data.isRefreshing) return;

    this.setData({ isRefreshing: true, refreshCount: this.data.refreshCount + 1 });

    // 清缓存并重新加载
    intelligenceService.clearCache();
    this.loadData().finally(() => {
      this.setData({ isRefreshing: false });
      wx.showToast({ title: '刷新成功', icon: 'success', duration: 1000 });
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    intelligenceService.clearCache();
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadData() {
    // 非交易时段加载缓存的复盘数据
    if (!this.data.isTradingDay) {
      this.loadCachedClosingData();
      return Promise.resolve();
    }

    this.setData({ isLoading: true });

    intelligenceService.clearCache();
    return Promise.all([
      intelligenceService.getGlobalIndices(),
      intelligenceService.getChinaIndices(),
      intelligenceService.getNewsFlash()
    ]).then(([globalIndices, chinaIndices, newsFlash]) => {
      // 保留已有数据用于展示
      this.setData({
        globalIndices: globalIndices || [],
        chinaIndices: chinaIndices || [],
        newsFlash: newsFlash || [],
        isLoading: false,
        lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      // 继续获取其他数据
      return Promise.all([
        intelligenceService.getMarketSentiment(),
        intelligenceService.getFundFlow(),
        intelligenceService.getDragonTigerList(),
        intelligenceService.getAIAnalysis(),
        intelligenceService.getAdvanceDecline(),
        intelligenceService.getSectorPerformance()
      ]);
    }).then(([sentiment, fundFlow, dragonTigerList, aiData, advanceDecline, sectorPerformance]) => {
      this.setData({
        sentiment: sentiment || {},
        fundFlow: fundFlow || {},
        dragonTigerList: (dragonTigerList || []).map(function(item) {
          return { name: item.name, code: item.code, change: (item.change || 0).toFixed(2), reason: item.reason, source: item.source };
        }),
        aiData: aiData || {},
        // 涨跌家数
        upCount: advanceDecline?.upCount || 0,
        downCount: advanceDecline?.downCount || 0,
        upDownRatio: advanceDecline?.ratio || 50,
        totalVolume: advanceDecline?.totalVolume || 0,
        totalVolumeFormatted: advanceDecline?.totalVolumeFormatted || '',
        // 行业板块
        sectorPerformance: sectorPerformance || { industrySectors: [], conceptSectors: [] }
      });
    }).catch(err => {
      console.error('加载情报数据失败:', err);
      this.setData({ isLoading: false });
    });
  },

  refreshData() {
    this.onRefreshTap();
  },

  // 加载缓存的复盘数据
  loadCachedClosingData() {
    const cached = wx.getStorageSync('lastClosingData');
    const lastDate = wx.getStorageSync('lastClosingDate') || '';

    if (cached) {
      this.setData({
        sentiment: cached.sentiment || {},
        fundFlow: cached.fundFlow || {},
        dragonTigerList: cached.dragonTigerList || [],
        aiData: cached.aiData || {},
        upCount: cached.upCount || 0,
        downCount: cached.downCount || 0,
        upDownRatio: cached.upDownRatio || 50,
        totalVolumeFormatted: cached.totalVolumeFormatted || '',
        lastTradingDay: lastDate,
        isLoading: false,
        lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } else {
      // 无缓存时显示空状态
      this.setData({
        sentiment: { value: 50, level: '中性' },
        fundFlow: { northFlow: 0, mainFlow: 0 },
        dragonTigerList: [],
        aiData: { conclusion: '暂无复盘数据' },
        upCount: 0,
        downCount: 0,
        upDownRatio: 50,
        totalVolumeFormatted: '--',
        lastTradingDay: '',
        isLoading: false,
        lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }
  }
});