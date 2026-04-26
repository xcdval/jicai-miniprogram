const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    lastUpdate: '',
    isRefreshing: false,

    // Tab切换
    activeTab: 'position',  // 'position' | 'profit'

    // ===== 持仓分析数据 =====
    healthScore: 0,
    healthColor: '#10b981',
    concentrationLevel: '中',
    concentrationValue: 50,
    concentrationTip: '',
    overlapLevel: '低',
    overlapValue: 30,
    overlapTip: '',
    suggestions: [],
    assetAllocationData: [],
    conicGradient: '',
    industryData: [],

    // ===== 收益分析数据 =====
    viewMode: 'calendar',  // 'chart' | 'calendar'
    viewModes: [
      { key: 'chart', name: '收益曲线' },
      { key: 'calendar', name: '收益日历' }
    ],
    timeRange: '30d',
    timeRanges: [
      { key: '30d', name: '月' },
      { key: '90d', name: '近3月' },
      { key: '1y', name: '年' }
    ],
    currentRangeName: '月',
    profitTrendData: [],

    // 日历
    calendarPeriodMode: 'month',
    calendarPeriodModes: [
      { key: 'month', name: '月' },
      { key: 'year', name: '年' },
      { key: 'years', name: '多年' }
    ],
    calendarDisplayMode: 'profit',
    calendarMonth: '',
    calendarYear: new Date().getFullYear(),
    calendarWeeks: [],
    yearData: [],
    yearsData: [],
    selectedProfitDetail: null,

    // 收益明细
    todayProfit: 0,
    todayProfitText: '¥ 0',
    todayDate: '',
    todayProfitPercent: 0,
    monthProfit: 0,
    monthProfitText: '¥ 0',
    monthDateRange: '',
    monthProfitPercent: 0,
    yearProfit: 0,
    yearProfitText: '¥ 0',
    yearDateRange: '',
    yearProfitPercent: 0,

    // 收益排行
    profitRank: [],

    // ===== 共同数据 =====
    stats: {
      totalReturn: 0,
      totalReturnText: '¥ 0',
      totalReturnPercent: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      volatility: 0
    },
    sharpePercent: 0,
    volatilityPercent: 0
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });

    // 从缓存恢复上次Tab
    const savedTab = wx.getStorageSync('analysisActiveTab') || 'position';
    this.setData({ activeTab: savedTab });

    this.initCalendar();
    this.updateDateInfo();
    this.loadData();
    this.refreshData();
  },

  onShow() {
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    wx.setStorageSync('analysisActiveTab', tab);
  },

  loadData() {
    // 持仓分析数据
    const health = assetService.calculateHealthScore();
    this.setData({
      healthScore: health.score,
      healthColor: health.color,
      suggestions: health.suggestions || [],
      statsDetail: health.stats || {}
    });

    // 收益排行
    const ranking = assetService.getProfitRanking('profit', 5);
    this.setData({
      profitRank: ranking.map(item => ({
        name: item.name,
        type: item.type === 'FUND' ? '基金' : '股票',
        profit: item.profit,
        profitPercent: item.profitPercent
      }))
    });

    this.updateAllocationData();
    this.generateProfitTrendData();
  },

  async refreshData() {
    if (this.data.isRefreshing) return;
    this.setData({ isRefreshing: true });

    try {
      await assetService.refreshAssetPrices();
    } catch (e) {
      console.error('刷新行情失败:', e);
    }

    const stats = assetService.calculateStatistics();
    const todayP = stats.todayProfit || 0;
    const monthP = parseFloat((todayP * 22).toFixed(2));
    const yearP = stats.totalProfit || 0;

    const todayPercent = stats.totalValue > 0
      ? parseFloat((todayP / stats.totalValue * 100).toFixed(2)) : 0;
    const monthPercent = stats.totalValue > 0
      ? parseFloat((monthP / stats.totalValue * 100).toFixed(2)) : 0;
    const yearPercent = stats.totalValue > 0
      ? parseFloat((yearP / stats.totalValue * 100).toFixed(2)) : 0;

    // 健康评分
    const health = assetService.calculateHealthScore();

    this.setData({
      todayProfit: todayP,
      todayProfitText: format.formatAmount(todayP),
      todayProfitPercent: todayPercent,
      monthProfit: monthP,
      monthProfitText: format.formatAmount(monthP),
      monthProfitPercent: monthPercent,
      yearProfit: yearP,
      yearProfitText: format.formatAmount(yearP),
      yearProfitPercent: yearPercent,
      healthScore: health.score,
      healthColor: health.color,
      suggestions: health.suggestions || [],
      stats: {
        totalReturn: stats.totalProfit || 0,
        totalReturnText: format.formatAmount(stats.totalProfit || 0),
        totalReturnPercent: Math.round((stats.totalProfitPercent || 0) * 100) / 100,
        maxDrawdown: stats.maxDrawdown || 0,
        sharpeRatio: stats.sharpeRatio || 0,
        volatility: stats.volatility || 0
      },
      sharpePercent: Math.min(100, (stats.sharpeRatio || 0) / 2 * 100),
      volatilityPercent: Math.min(100, (stats.volatility || 0) / 30 * 100),
      lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isRefreshing: false
    });

    // 更新持仓数据
    this.updateAllocationData();
    this.generateCalendarDays();
    this.generateYearData();
    this.generateYearsData();

    // 更新收益排行
    const ranking = assetService.getProfitRanking('profit', 5);
    this.setData({
      profitRank: ranking.map(item => ({
        name: item.name,
        type: item.type === 'FUND' ? '基金' : '股票',
        profit: item.profit,
        profitPercent: item.profitPercent
      }))
    });
  },

  updateAllocationData() {
    const stats = assetService.calculateStatistics();
    const categoryStats = stats.categoryStats;

    const totalValue = (categoryStats.FUND?.value || 0) +
                      (categoryStats.STOCK?.value || 0) +
                      (categoryStats.DEPOSIT?.value || 0);

    const assetAllocationData = [
      {
        name: '基金',
        value: categoryStats.FUND?.value || 0,
        color: '#10b981',
        valueText: format.formatAmount(categoryStats.FUND?.value || 0),
        percent: totalValue > 0 ? Math.round((categoryStats.FUND?.value || 0) / totalValue * 100) : 0
      },
      {
        name: '股票',
        value: categoryStats.STOCK?.value || 0,
        color: '#3b82f6',
        valueText: format.formatAmount(categoryStats.STOCK?.value || 0),
        percent: totalValue > 0 ? Math.round((categoryStats.STOCK?.value || 0) / totalValue * 100) : 0
      },
      {
        name: '存款',
        value: categoryStats.DEPOSIT?.value || 0,
        color: '#f59e0b',
        valueText: format.formatAmount(categoryStats.DEPOSIT?.value || 0),
        percent: totalValue > 0 ? Math.round((categoryStats.DEPOSIT?.value || 0) / totalValue * 100) : 0
      }
    ].filter(item => item.value > 0);

    const conicGradient = this.generateConicGradient(assetAllocationData);

    // 行业分布模拟
    const industryData = [
      { name: '科技', value: 35, color: '#2563eb' },
      { name: '消费', value: 25, color: '#10b981' },
      { name: '医疗', value: 20, color: '#f59e0b' },
      { name: '金融', value: 15, color: '#8b5cf6' },
      { name: '其他', value: 5, color: '#64748b' }
    ];

    // 持仓分析指标
    const concentrationValue = 65;
    const concentrationLevel = concentrationValue > 60 ? '较高' : concentrationValue > 40 ? '中' : '低';
    const concentrationTip = concentrationValue > 60 ? '建议适当分散行业配置，降低单一行业风险' : '行业分布较为均衡，继续保持';

    const overlapValue = 35;
    const overlapLevel = overlapValue < 30 ? '低' : overlapValue < 50 ? '中' : '高';
    const overlapTip = overlapValue < 30 ? '持仓重叠度较低，风险分散良好' : '部分持仓重叠较高，可适当优化';

    this.setData({
      assetAllocationData,
      conicGradient,
      totalAssetText: totalValue > 0 ? format.formatAmount(totalValue) : '¥ 0',
      industryData,
      concentrationValue,
      concentrationLevel,
      concentrationTip,
      overlapValue,
      overlapLevel,
      overlapTip
    });
  },

  // ========== 收益分析相关 ==========

  updateDateInfo() {
    const now = new Date();
    const today = format.formatDate(now, 'MM-DD');
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31);

    this.setData({
      todayDate: today,
      monthDateRange: `${format.formatDate(monthStart, 'MM-DD')} 至 ${format.formatDate(monthEnd, 'MM-DD')}`,
      yearDateRange: `${format.formatDate(yearStart, 'MM-DD')} 至 ${format.formatDate(yearEnd, 'MM-DD')}`
    });
  },

  switchViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
  },

  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range }, () => {
      this.generateProfitTrendData();
    });
  },

  generateProfitTrendData() {
    const ranges = { '30d': 30, '90d': 90, '1y': 365 };
    const days = ranges[this.data.timeRange] || 30;
    const rangeName = this.data.timeRanges.find(r => r.key === this.data.timeRange)?.name || '月';
    const stats = assetService.calculateStatistics();
    const baseValue = stats.totalValue || 100000;
    const dailyVolatility = 0.005;
    const data = [];
    let cumulativeProfit = 0;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const change = baseValue * dailyVolatility * (Math.random() - 0.48);
      cumulativeProfit += change;
      data.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: Math.round(cumulativeProfit),
        date: format.formatDate(date, 'MM-DD')
      });
    }

    this.setData({ profitTrendData: data, currentRangeName: rangeName });
  },

  // ========== 日历相关 ==========

  initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.setData({
      calendarMonth: `${year}-${String(month).padStart(2, '0')}`,
      calendarYear: year
    });
    this.generateCalendarDays();
    this.generateYearData();
    this.generateYearsData();
  },

  generateCalendarDays() {
    const [year, month] = this.data.calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();

    const stats = assetService.calculateStatistics();
    const todayProfit = stats ? (stats.todayProfit || 0) : 0;
    const baseProfit = Math.abs(todayProfit) || 100;
    const now = new Date();
    const today = now.getDate();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

    const days = [];
    const startIndex = startWeekday === 0 ? 6 : startWeekday - 1;

    for (let i = 0; i < startIndex; i++) {
      days.push({ day: 0, empty: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPositive = Math.random() > 0.4;
      const profit = baseProfit * (Math.random() * 0.5 + 0.1) * (isPositive ? 1 : -1);
      const profitValue = parseFloat(profit.toFixed(2));
      const percent = stats && stats.totalValue > 0
        ? parseFloat((profitValue / stats.totalValue * 100).toFixed(2))
        : 0;

      days.push({
        day: d,
        empty: false,
        isToday: isCurrentMonth && d === today,
        dateStr: dateStr,
        profit: profitValue,
        percent: percent
      });
    }

    while (days.length < 42) {
      days.push({ day: 0, empty: true });
    }

    const weeks = [];
    for (let w = 0; w < 6; w++) {
      weeks.push({ days: days.slice(w * 7, (w + 1) * 7) });
    }

    this.setData({ calendarWeeks: weeks });
  },

  generateYearData() {
    const year = this.data.calendarYear;
    const stats = assetService.calculateStatistics();
    const todayProfit = stats.todayProfit || 0;
    const baseProfit = Math.abs(todayProfit) || 100;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    const monthNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const yearData = [];

    for (let m = 1; m <= 12; m++) {
      const isPositive = Math.random() > 0.4;
      const profit = baseProfit * (Math.random() * 3 + 1) * (isPositive ? 1 : -1);
      const profitValue = parseFloat(profit.toFixed(2));
      const percent = stats.totalValue > 0
        ? parseFloat((profitValue / stats.totalValue * 100).toFixed(2))
        : 0;
      yearData.push({
        month: monthNames[m - 1],
        profit: profitValue,
        percent: percent,
        isCurrentMonth: m === currentMonth
      });
    }

    this.setData({ yearData: yearData });
  },

  generateYearsData() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const stats = assetService.calculateStatistics();
    const todayProfit = stats.todayProfit || 0;
    const baseProfit = Math.abs(todayProfit) || 100;

    const yearsData = [];
    let totalYearsProfit = 0;
    for (let y = currentYear - 4; y <= currentYear; y++) {
      const isPositive = Math.random() > 0.4;
      const profit = baseProfit * (Math.random() * 8 + 4) * (isPositive ? 1 : -1);
      const profitValue = parseFloat(profit.toFixed(2));
      const percent = stats.totalValue > 0
        ? parseFloat((profitValue / stats.totalValue * 100).toFixed(2))
        : 0;
      totalYearsProfit += profitValue;
      yearsData.push({
        year: y,
        profit: profitValue,
        percent: percent,
        isCurrentYear: y === currentYear
      });
    }

    this.setData({ yearsData: yearsData });
  },

  switchCalendarPeriodMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ calendarPeriodMode: mode });
  },

  toggleCalendarDisplayMode() {
    const newMode = this.data.calendarDisplayMode === 'profit' ? 'percent' : 'profit';
    this.setData({ calendarDisplayMode: newMode });
  },

  prevPeriod() {
    if (this.data.calendarPeriodMode === 'month') {
      const [year, month] = this.data.calendarMonth.split('-').map(Number);
      let newYear = year, newMonth = month - 1;
      if (newMonth < 1) { newMonth = 12; newYear--; }
      this.setData({ calendarMonth: `${newYear}-${String(newMonth).padStart(2, '0')}` });
      this.generateCalendarDays();
    } else if (this.data.calendarPeriodMode === 'year') {
      this.setData({ calendarYear: this.data.calendarYear - 1 });
      this.generateYearData();
    }
  },

  nextPeriod() {
    if (this.data.calendarPeriodMode === 'month') {
      const [year, month] = this.data.calendarMonth.split('-').map(Number);
      let newYear = year, newMonth = month + 1;
      if (newMonth > 12) { newMonth = 1; newYear++; }
      this.setData({ calendarMonth: `${newYear}-${String(newMonth).padStart(2, '0')}` });
      this.generateCalendarDays();
    } else if (this.data.calendarPeriodMode === 'year') {
      this.setData({ calendarYear: this.data.calendarYear + 1 });
      this.generateYearData();
    }
  },

  tapCalendarTitle() {
    const stats = assetService.calculateStatistics();

    if (this.data.calendarPeriodMode === 'month') {
      const [year, month] = this.data.calendarMonth.split('-').map(Number);
      const monthTotal = this.data.calendarDays
        .filter(d => !d.empty && d.profit !== undefined)
        .reduce((sum, d) => sum + d.profit, 0);
      const monthPercent = stats.totalValue > 0
        ? parseFloat((monthTotal / stats.totalValue * 100).toFixed(2)) : 0;

      this.setData({
        selectedProfitDetail: {
          type: 'month',
          title: `${year}年${month}月`,
          profit: parseFloat(monthTotal.toFixed(2)),
          percent: monthPercent
        }
      });
    } else if (this.data.calendarPeriodMode === 'year') {
      const year = this.data.calendarYear;
      const yearTotal = this.data.yearData.reduce((sum, d) => sum + d.profit, 0);
      const yearPercent = stats.totalValue > 0
        ? parseFloat((yearTotal / stats.totalValue * 100).toFixed(2)) : 0;

      this.setData({
        selectedProfitDetail: {
          type: 'year',
          title: `${year}年`,
          profit: parseFloat(yearTotal.toFixed(2)),
          percent: yearPercent
        }
      });
    } else {
      const yearsTotal = this.data.yearsData.reduce((sum, d) => sum + d.profit, 0);
      const yearsPercent = stats.totalValue > 0
        ? parseFloat((yearsTotal / stats.totalValue * 100).toFixed(2)) : 0;

      this.setData({
        selectedProfitDetail: {
          type: 'years',
          title: '近5年累计',
          profit: parseFloat(yearsTotal.toFixed(2)),
          percent: yearsPercent
        }
      });
    }
  },

  tapCalendarDay(e) {
    const dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;

    const [year, month, day] = dateStr.split('-').map(Number);
    const dayData = this.data.calendarDays.find(d => d.dateStr === dateStr);

    if (dayData && dayData.profit !== undefined) {
      this.setData({
        selectedProfitDetail: {
          type: 'day',
          title: `${month}月${day}日`,
          profit: dayData.profit,
          percent: dayData.percent
        }
      });
    }
  },

  tapYearMonth(e) {
    const month = parseInt(e.currentTarget.dataset.month);
    const monthData = this.data.yearData.find(d => parseInt(d.month) === month);

    if (monthData) {
      this.setData({
        selectedProfitDetail: {
          type: 'month',
          title: `${month}月`,
          profit: monthData.profit,
          percent: monthData.percent
        }
      });
    }
  },

  tapYearsYear(e) {
    const year = parseInt(e.currentTarget.dataset.year);
    const yearData = this.data.yearsData.find(d => d.year === year);

    if (yearData) {
      this.setData({
        selectedProfitDetail: {
          type: 'year',
          title: `${year}年`,
          profit: yearData.profit,
          percent: yearData.percent
        }
      });
    }
  },

  closeDayDetail() {
    this.setData({ selectedProfitDetail: null });
  },

  preventBubble() {},

  // ========== 通用 ==========

  generateConicGradient(data) {
    if (!data || data.length === 0) return '';
    let gradient = '';
    let currentPercent = 0;
    data.forEach((item, index) => {
      const percent = item.percent || 0;
      if (percent > 0) {
        if (gradient) gradient += ', ';
        gradient += `${item.color} ${currentPercent}% ${currentPercent + percent}%`;
        currentPercent += percent;
      }
    });
    return gradient;
  },

  viewDetailReport() {
    wx.showToast({ title: '详细报告功能开发中', icon: 'none' });
  },

  gotoAssets() {
    wx.switchTab({ url: '/pages/assets/assets' });
  }
});
