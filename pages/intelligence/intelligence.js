const intelligenceService = require('../../services/intelligenceService');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    activePhase: 'morning',

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
    this.loadData();
    this.startAutoRefresh();
  },

  onShow() {
    // 每次进入页面强制刷新快讯（实时性强）
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

  switchPhase(e) {
    const phase = e.currentTarget.dataset.phase;
    this.setData({ activePhase: phase });
  }
});