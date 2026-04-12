// pages/index/index.js
const assetService = require('../../services/assetService');
const format = require('../../utils/format');
const mock = require('../../utils/mock');

Page({
  data: {
    // 系统信息
    statusBarHeight: 44,
    navBarHeight: 44,

    // 金额显示
    showAmount: true,
    totalAmount: 370579.00,
    todayProfit: 1240.50,
    totalProfit: 12580.00,
    totalProfitPercent: 3.51,

    // 市场行情
    marketIndices: [
      { name: '上证指数', code: '000001.SH', price: '3,245.68', changePercent: 0.54 },
      { name: '恒生指数', code: 'HSI.HK', price: '16,832.45', changePercent: 1.23 },
      { name: '恒生科技', code: 'HSTECH.HK', price: '3,456.78', changePercent: -0.32 },
      { name: '标普500', code: 'SPX.US', price: '5,234.12', changePercent: 0.78 },
      { name: '纳斯达克', code: 'NDAQ.US', price: '16,345.67', changePercent: 1.05 }
    ],

    // 资产配置
    allocationData: [
      { type: 'fund', name: '基金', icon: '📊', value: '¥ 154,617', percent: 42, count: 3, change: 2.3 },
      { type: 'stock', name: '股票', icon: '📈', value: '¥ 115,962', percent: 31, count: 5, change: 1.8 },
      { type: 'deposit', name: '存款', icon: '💵', value: '¥ 100,000', percent: 27, count: 1, change: 0 }
    ],

    // 快讯数据
    newsFlash: [],

    // 今日走势
    todayProfit: 1240.50,
    todayProfitText: '1,240.50',
    todayProfitPercent: 0.32,
    todayTrendData: []
  },

  onLoad() {
    this.initSystemInfo();
    this.loadData();
  },

  onShow() {
    this.refreshData();
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
    // 加载快讯数据
    this.setData({
      newsFlash: mock.newsFlash
    });

    // 加载市场行情
    this.loadMarketData();

    // 刷新资产统计
    this.refreshData();

    // 生成今日走势数据
    this.generateTodayTrendData();
  },

  // 生成今日走势数据（模拟实时数据）
  generateTodayTrendData() {
    const data = [];
    const baseValue = 386542;
    const startHour = 9;
    const endHour = 15;

    // 生成从开盘到现在的模拟数据点
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === endHour && minute > 0) break;

        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const randomChange = (Math.random() - 0.48) * 500;
        const value = baseValue + randomChange + (hour - startHour) * 100;

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
            // 使用贝塞尔曲线平滑连接
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

        // 绘制最后一个点的圆点
        const lastPoint = data[data.length - 1];
        const lastX = width;
        const lastY = height - ((lastPoint.value - minValue) / range) * height * 0.8 - height * 0.1;

        ctx.beginPath();
        ctx.arc(lastX - 4, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lastX - 4, lastY, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
        ctx.fill();
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
  },

  // 更新资产配置显示
  updateAllocationDisplay(categoryStats) {
    const total = Object.values(categoryStats).reduce((sum, cat) => sum + cat.value, 0);

    // 模拟涨跌数据
    const changes = {
      FUND: 2.3,
      STOCK: 1.8,
      DEPOSIT: 0
    };

    const counts = {
      FUND: 3,
      STOCK: 5,
      DEPOSIT: 1
    };

    const allocationData = [
      {
        type: 'fund',
        name: '基金',
        icon: '📊',
        value: format.formatAmount(categoryStats.FUND?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.FUND?.value || 0) / total * 100) : 0,
        count: counts.FUND,
        change: changes.FUND
      },
      {
        type: 'stock',
        name: '股票',
        icon: '📈',
        value: format.formatAmount(categoryStats.STOCK?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.STOCK?.value || 0) / total * 100) : 0,
        count: counts.STOCK,
        change: changes.STOCK
      },
      {
        type: 'deposit',
        name: '存款',
        icon: '💵',
        value: format.formatAmount(categoryStats.DEPOSIT?.value || 0),
        percent: total > 0 ? Math.round((categoryStats.DEPOSIT?.value || 0) / total * 100) : 0,
        count: counts.DEPOSIT,
        change: changes.DEPOSIT
      }
    ];

    this.setData({ allocationData });
  },

  // 加载市场行情（模拟数据）
  loadMarketData() {
    this.setData({
      marketIndices: mock.marketData.indices
    });
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
