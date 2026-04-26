const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    // 图表数据
    profitTrendData: [],
    // 时间段选择
    timeRange: '30d',
    timeRanges: [
      { key: '30d', name: '月' },
      { key: '90d', name: '近3月' },
      { key: '1y', name: '年' }
    ],
    currentRangeName: '月',
    // 视图模式
    viewMode: 'calendar',
    viewModes: [
      { key: 'list', name: '收益曲线' },
      { key: 'calendar', name: '收益日历' }
    ],
    // 日历周期模式: month, year 或 years
    calendarPeriodMode: 'month',
    calendarPeriodModes: [
      { key: 'month', name: '月' },
      { key: 'year', name: '年' },
      { key: 'years', name: '多年' }
    ],
    // 日历显示模式: profit 或 percent
    calendarDisplayMode: 'profit',
    calendarDisplayModes: [
      { key: 'profit', name: '收益额' },
      { key: 'percent', name: '收益率' }
    ],
    // 统计概览
    stats: {
      totalReturn: 0,
      totalReturnText: '¥ 0',
      totalReturnPercent: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      volatility: 0
    },
    sharpePercent: 0,
    volatilityPercent: 0,
    // 收益明细
    todayProfit: 0,
    todayProfitText: '¥ 0',
    todayDate: '',
    weekProfit: 0,
    weekProfitText: '¥ 0',
    weekDateRange: '',
    monthProfit: 0,
    monthProfitText: '¥ 0',
    monthDateRange: '',
    yearProfit: 0,
    yearProfitText: '¥ 0',
    yearDateRange: '',
    // 收益排行
    profitRank: [],
    // 日历数据
    calendarMonth: '',
    calendarYear: new Date().getFullYear(),
    calendarDays: [],
    calendarWeeks: [],
    yearData: [],
    yearsData: [],
    yearsProfit: 0,
    yearsProfitText: '¥ 0',
    yearsProfitPercent: 0,
    selectedProfitDetail: null
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });
    this.initCalendar();
    this.loadData();
    this.updateDateInfo();
  },

  onShow() {
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadData() {
    const ranking = assetService.getProfitRanking('profit', 5);
    this.setData({
      profitRank: ranking.map(item => ({
        name: item.name,
        type: item.type === 'FUND' ? '基金' : '股票',
        profit: item.profit,
        profitPercent: item.profitPercent
      }))
    });
    this.generateProfitTrendData();
  },

  async refreshData() {
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
      stats: {
        totalReturn: stats.totalProfit || 0,
        totalReturnText: format.formatAmount(stats.totalProfit || 0),
        totalReturnPercent: Math.round((stats.totalProfitPercent || 0) * 100) / 100,
        maxDrawdown: stats.maxDrawdown || 0,
        sharpeRatio: stats.sharpeRatio || 0,
        volatility: stats.volatility || 0
      },
      sharpePercent: Math.min(100, (stats.sharpeRatio || 0) / 2 * 100),
      volatilityPercent: Math.min(100, (stats.volatility || 0) / 30 * 100)
    });

    const ranking = assetService.getProfitRanking('profit', 5);
    this.setData({
      profitRank: ranking.map(item => ({
        name: item.name,
        type: item.type === 'FUND' ? '基金' : '股票',
        profit: item.profit,
        profitPercent: item.profitPercent
      }))
    });

    this.generateCalendarDays();
    this.generateYearData();
    this.generateYearsData();
  },

  updateDateInfo() {
    const now = new Date();
    const today = format.formatDate(now, 'MM-DD');
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31);

    this.setData({
      todayDate: today,
      weekDateRange: `${format.formatDate(weekStart, 'MM-DD')} 至 ${format.formatDate(weekEnd, 'MM-DD')}`,
      monthDateRange: `${format.formatDate(monthStart, 'MM-DD')} 至 ${format.formatDate(monthEnd, 'MM-DD')}`,
      yearDateRange: `${format.formatDate(yearStart, 'MM-DD')} 至 ${format.formatDate(yearEnd, 'MM-DD')}`
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

  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range }, () => {
      this.generateProfitTrendData();
    });
  },

  switchViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
  },

  switchCalendarPeriodMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ calendarPeriodMode: mode });
  },

  tapCalendarTitle() {
    const stats = assetService.calculateStatistics();

    if (this.data.calendarPeriodMode === 'month') {
      // 月视图：点击标题显示月总计
      const [year, month] = this.data.calendarMonth.split('-').map(Number);
      // 计算当月所有日的总收益
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
      // 年视图：点击标题显示年总计
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
      // 多年视图：点击标题显示近5年总计
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

  switchCalendarDisplayMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ calendarDisplayMode: mode });
  },

  toggleCalendarDisplayMode() {
    const newMode = this.data.calendarDisplayMode === 'profit' ? 'percent' : 'profit';
    this.setData({ calendarDisplayMode: newMode });
  },

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

    // Add empty cells for days before the first day of month
    for (let i = 0; i < startIndex; i++) {
      days.push({ day: 0, empty: true });
    }

    // Add actual days
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

    // Ensure we have 42 cells (6 rows x 7 days)
    while (days.length < 42) {
      days.push({ day: 0, empty: true });
    }

    // Split into weeks (6 weeks x 7 days)
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      weeks.push({
        days: days.slice(w * 7, (w + 1) * 7)
      });
    }

    this.setData({ calendarDays: days, calendarWeeks: weeks });
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
        profitText: format.formatAmount(profitValue),
        percent: percent,
        percentText: format.formatAmount(percent),
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

    // 生成近5年的数据
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
        profitText: format.formatAmount(profitValue),
        percent: percent,
        percentText: format.formatAmount(percent),
        isCurrentYear: y === currentYear
      });
    }

    const yearsProfitPercent = stats.totalValue > 0
      ? parseFloat((totalYearsProfit / stats.totalValue * 100).toFixed(2))
      : 0;

    this.setData({
      yearsData: yearsData,
      yearsProfit: parseFloat(totalYearsProfit.toFixed(2)),
      yearsProfitText: format.formatAmount(totalYearsProfit),
      yearsProfitPercent: yearsProfitPercent
    });
  },

  prevPeriod() {
    if (this.data.calendarPeriodMode === 'month') {
      const [year, month] = this.data.calendarMonth.split('-').map(Number);
      let newYear = year;
      let newMonth = month - 1;
      if (newMonth < 1) { newMonth = 12; newYear--; }
      this.setData({ calendarMonth: `${newYear}-${String(newMonth).padStart(2, '0')}` });
      this.generateCalendarDays();
    } else if (this.data.calendarPeriodMode === 'year') {
      this.setData({ calendarYear: this.data.calendarYear - 1 });
      this.generateYearData();
    } else {
      // years 模式不需要翻页，显示最近5年
    }
  },

  nextPeriod() {
    if (this.data.calendarPeriodMode === 'month') {
      const [year, month] = this.data.calendarMonth.split('-').map(Number);
      let newYear = year;
      let newMonth = month + 1;
      if (newMonth > 12) { newMonth = 1; newYear++; }
      this.setData({ calendarMonth: `${newYear}-${String(newMonth).padStart(2, '0')}` });
      this.generateCalendarDays();
    } else if (this.data.calendarPeriodMode === 'year') {
      this.setData({ calendarYear: this.data.calendarYear + 1 });
      this.generateYearData();
    } else {
      // years 模式不需要翻页，显示最近5年
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

  switchTab() {
    wx.navigateTo({ url: '/pages/analysis/analysis' });
  },

  goBack() {
    wx.navigateTo({ url: '/pages/analysis/analysis' });
  },

  viewDetailReport() {
    wx.showToast({ title: '详细报告功能开发中', icon: 'none' });
  }
});
