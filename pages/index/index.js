// pages/index/index.js
const assetService = require('../../services/assetService');
const marketService = require('../../services/marketService');
const intelligenceService = require('../../services/intelligenceService');
const format = require('../../utils/format');

Page({
  data: {
    // 系统信息
    statusBarHeight: 44,
    navBarHeight: 44,

    // 金额显示
    showAmount: true,
    totalAmount: 0,
    todayProfit: 0,
    totalProfit: 0,
    totalProfitPercent: 0,

    // 市场行情
    marketIndices: [],
    marketIndicesLoading: true,

    // 资产配置
    allocationData: [
      { type: 'fund', name: '基金', icon: '📊', value: '¥ 0', percent: 0, count: 0, change: 0 },
      { type: 'stock', name: '股票', icon: '📈', value: '¥ 0', percent: 0, count: 0, change: 0 },
      { type: 'deposit', name: '存款', icon: '💵', value: '¥ 0', percent: 0, count: 0, change: 0 }
    ],

    // 快讯数据
    newsFlash: [],

    // 今日走势
    todayProfit: 0,
    todayProfitText: '0',
    todayProfitPercent: 0,
    todayTrendData: [],

    // 刷新状态
    isRefreshing: false,
    refreshCount: 0,
    lastUpdate: ''
  },

  // 定时器
  _refreshTimer: null,

  onLoad() {
    this.initSystemInfo();
    this.loadData();
    this.startAutoRefresh();
  },

  onShow() {
    this.refreshData();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  // 启动自动刷新 - 每30秒刷新快讯，每60秒刷新行情
  startAutoRefresh() {
    this.stopAutoRefresh();
    this._refreshTimer = setInterval(() => {
      // 每30秒刷新快讯
      intelligenceService.getNewsFlash().then(newsFlash => {
        this.setData({ newsFlash });
      }).catch(() => {
        this.setData({ newsFlash: [] });
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

    Promise.all([
      this.refreshData(),
      this.loadMarketData()
    ]).finally(() => {
      this.setData({
        isRefreshing: false,
        lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      wx.showToast({ title: '刷新成功', icon: 'success', duration: 1000 });
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    Promise.all([
      this.refreshData(),
      this.loadMarketData()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 初始化系统信息
  initSystemInfo() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height
    });
  },

  // 加载数据
  loadData() {
    // 加载快讯数据（优先真实数据，失败时降级）
    intelligenceService.getNewsFlash().then(newsFlash => {
      this.setData({ newsFlash });
    }).catch(() => {
      this.setData({ newsFlash: [] });
    });

    // 加载市场行情
    this.loadMarketData();

    // 刷新资产统计
    this.refreshData();

    // 生成今日走势数据
    this.generateTodayTrendData();
  },

  // 加载市场行情
  async loadMarketData() {
    this.setData({ marketIndicesLoading: true });

    try {
      const indexData = await marketService.getIndexData();

      // 转换格式
      const indices = Object.entries(indexData).map(([name, data]) => ({
        name: name,
        code: data.code || '',
        price: data.current > 0 ? this.formatPrice(data.current) : '--',
        changePercent: data.changePercent || 0,
        change: data.change || 0
      }));

      this.setData({
        marketIndices: indices,
        marketIndicesLoading: false
      });
    } catch (e) {
      console.error('加载指数行情失败:', e);
      // 接口失败时使用降级数据
      const fallbackIndices = [
        { name: '上证指数', code: 'SH000001', price: '--', changePercent: 0, change: 0 },
        { name: '深证成指', code: 'SZ399001', price: '--', changePercent: 0, change: 0 },
        { name: '创业板', code: 'SZ399006', price: '--', changePercent: 0, change: 0 }
      ];
      this.setData({
        marketIndices: fallbackIndices,
        marketIndicesLoading: false
      });
    }
  },

  // 格式化价格
  formatPrice(price) {
    if (!price || price === 0) return '--';
    return price.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // 生成今日走势数据（基于资产统计模拟）
  generateTodayTrendData() {
    const stats = assetService.calculateStatistics();
    const baseValue = stats.totalValue || 100000;
    const startHour = 9;
    const endHour = new Date().getHours() || 15;

    const data = [];

    // 生成从开盘到现在的模拟数据点
    for (let hour = startHour; hour <= Math.min(endHour, 15); hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === endHour && minute > new Date().getMinutes()) break;

        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const randomChange = (Math.random() - 0.48) * baseValue * 0.002;
        const value = baseValue + randomChange + (hour - startHour) * 50;

        data.push({
          time,
          value: Math.round(value),
          change: Math.round(randomChange)
        });
      }
    }

    this.setData({ todayTrendData: data });

    // 延迟绘制图表
    setTimeout(() => {
      this.drawTodayTrendChart();
    }, 100);
  },

  // 绘制今日走势图表
  drawTodayTrendChart() {
    const query = wx.createSelectorQuery();
    query.select('#todayTrendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const width = res[0].width;
        const height = res[0].height;

        // 设置canvas尺寸
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        const data = this.data.todayTrendData;
        if (data.length < 2) return;

        // 计算数据范围
        const values = data.map(d => d.value);
        const minValue = Math.min(...values) * 0.999;
        const maxValue = Math.max(...values) * 1.001;
        const range = maxValue - minValue;

        // 绘制渐变区域
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

        ctx.beginPath();
        ctx.moveTo(0, height);

        data.forEach((point, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((point.value - minValue) / range) * height * 0.8 - height * 0.1;

          if (index === 0) {
            ctx.lineTo(x, y);
          } else {
            const prevX = ((index - 1) / (data.length - 1)) * width;
            const prevY = height - ((data[index - 1].value - minValue) / range) * height * 0.8 - height * 0.1;
            const cpX = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
            ctx.quadraticCurveTo(cpX, (prevY + y) / 2, x, y);
          }
        });

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // 绘制线条
        ctx.beginPath();
        data.forEach((point, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((point.value - minValue) / range) * height * 0.8 - height * 0.1;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevX = ((index - 1) / (data.length - 1)) * width;
            const prevY = height - ((data[index - 1].value - minValue) / range) * height * 0.8 - height * 0.1;
            const cpX = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
            ctx.quadraticCurveTo(cpX, (prevY + y) / 2, x, y);
          }
        });

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
  },

  // 刷新数据
  async refreshData() {
    try {
      // 刷新行情数据
      await assetService.refreshAssetPrices();
    } catch (e) {
      console.error('刷新行情失败:', e);
    }

    const stats = assetService.calculateStatistics();
    const showAmount = assetService.getAmountVisibility();

    this.setData({
      showAmount,
      totalAmount: stats.totalValue,
      todayProfit: stats.todayProfit,
      todayProfitText: this.formatNumber(stats.todayProfit),
      totalProfit: stats.totalProfit,
      totalProfitPercent: stats.totalProfitPercent
    });

    // 更新资产配置显示
    this.updateAllocationDisplay(stats.categoryStats);

    // 更新今日走势
    this.generateTodayTrendData();
  },

  // 更新资产配置显示
  updateAllocationDisplay(categoryStats) {
    const total = Object.values(categoryStats).reduce((sum, cat) => sum + cat.value, 0);

    // 模拟涨跌数据（待接入真实数据）
    const changes = {
      FUND: 0,
      STOCK: 0,
      DEPOSIT: 0
    };

    const allocationData = [
      {
        type: 'fund',
        name: '基金',
        icon: '📊',
        value: format.formatAmount(categoryStats.FUND?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.FUND?.value || 0) / total * 100) : 0,
        count: categoryStats.FUND?.count || 0,
        change: changes.FUND
      },
      {
        type: 'stock',
        name: '股票',
        icon: '📈',
        value: format.formatAmount(categoryStats.STOCK?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.STOCK?.value || 0) / total * 100) : 0,
        count: categoryStats.STOCK?.count || 0,
        change: changes.STOCK
      },
      {
        type: 'deposit',
        name: '存款',
        icon: '💵',
        value: format.formatAmount(categoryStats.DEPOSIT?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.DEPOSIT?.value || 0) / total * 100) : 0,
        count: categoryStats.DEPOSIT?.count || 0,
        change: changes.DEPOSIT
      }
    ];

    this.setData({ allocationData });
  },

  // 切换金额显示
  toggleAmountVisibility() {
    const showAmount = assetService.toggleAmountVisibility();
    this.setData({ showAmount });
  },

  // 页面跳转
  gotoAssets() {
    wx.switchTab({ url: '/pages/assets/assets' });
  },

  gotoIntelligence() {
    wx.switchTab({ url: '/pages/intelligence/intelligence' });
  },

  gotoAnalysis() {
    wx.switchTab({ url: '/pages/analysis/analysis' });
  },

  // 添加资产
  addAsset() {
    wx.navigateTo({
      url: '/pages/assets/assets?action=add'
    });
  },

  // 格式化数字
  formatNumber(num) {
    const absNum = Math.abs(num);
    if (absNum >= 100000000) {
      return (num / 100000000).toFixed(2) + '亿';
    } else if (absNum >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    } else if (absNum >= 1000) {
      return num.toLocaleString('zh-CN');
    }
    return num.toFixed(2);
  },

  // 通知和设置
  onNotificationTap() {
    wx.showToast({ title: '暂无新通知', icon: 'none' });
  },

  onSettingsTap() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  }
});
