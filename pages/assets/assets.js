const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44, navBarHeight: 44,
    activeGroup: 'all',
    groups: [],
    showAmount: true,
    totalAmount: '¥ 0',
    totalProfit: 0,
    totalProfitPercent: 0,
    todayProfit: 0,
    todayProfitPercent: 0,
    categoryList: [
      {type:'fund',name:'基金',icon:'📊',count:0,amount:'¥ 0',change:0},
      {type:'stock',name:'股票',icon:'📈',count:0,amount:'¥ 0',change:0},
      {type:'deposit',name:'存款',icon:'💰',count:0,amount:'¥ 0',change:0}
    ]
  },
  onLoad() {
    const sys = wx.getSystemInfoSync(); const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({ statusBarHeight: sys.statusBarHeight, navBarHeight: (menu.top-sys.statusBarHeight)*2+menu.height });
    this.loadGroups();
    this.refreshData();
  },
  onShow() { this.refreshData(); },
  onPullDownRefresh() {
    this.refreshData(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },
  loadGroups() {
    const groups = assetService.getGroups();
    if (!groups || groups.length === 0) {
      this.setData({
        groups: [{id:'all',name:'全部'}]
      });
    } else {
      this.setData({
        groups: [{id:'all',name:'全部'}, ...groups]
      });
    }
  },

  getGroupColor(index) {
    const colors = ['#10b981', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  },
  async refreshData(showToast = false) {
    let refreshSuccess = true;
    try {
      // 尝试刷新行情（可能因网络问题失败）
      try {
        await assetService.refreshAssetPrices();
      } catch (e) {
        console.error('刷新行情失败（使用本地数据）:', e);
        refreshSuccess = false;
      }
    } catch (e) {
      console.error('刷新失败:', e);
      refreshSuccess = false;
    }

    const stats = assetService.calculateStatistics();
    const show = assetService.getAmountVisibility();

    // 更新分类统计
    const categoryList = [
      {type:'fund',name:'基金',icon:'📊',count:0,amount:'¥ 0',change:0},
      {type:'stock',name:'股票',icon:'📈',count:0,amount:'¥ 0',change:0},
      {type:'deposit',name:'存款',icon:'💰',count:0,amount:'¥ 0',change:0}
    ].map(cat => {
      const typeKey = cat.type.toUpperCase();
      const typeStat = stats.categoryStats[typeKey];
      if (typeStat) {
        // 计算今日收益率百分比
        const change = typeStat.value > 0 && typeStat.todayProfit !== undefined
          ? parseFloat((typeStat.todayProfit / typeStat.value * 100).toFixed(2))
          : 0;
        return {
          ...cat,
          amount: format.formatAmount(typeStat.value),
          count: typeStat.count,
          change: change
        };
      }
      return cat;
    });

    // 计算今日收益率百分比
    const todayProfitPercent = stats.totalValue > 0
      ? parseFloat((stats.todayProfit / stats.totalValue * 100).toFixed(2))
      : 0;

    this.setData({
      showAmount: show,
      totalAmount: format.formatAmount(stats.totalValue),
      totalProfit: stats.totalProfit,
      totalProfitPercent: stats.totalProfitPercent,
      todayProfit: stats.todayProfit,
      todayProfitPercent: todayProfitPercent,
      categoryList: categoryList
    });

    if (showToast) {
      if (refreshSuccess) {
        wx.showToast({ title: '刷新成功', icon: 'success' });
      } else {
        wx.showToast({ title: '刷新失败（使用缓存）', icon: 'none' });
      }
    }
  },
  switchGroup(e) { this.setData({ activeGroup: e.currentTarget.dataset.id }); },
  toggleAmount() { assetService.toggleAmountVisibility(); this.refreshData(); },
  showAddOptions() {
    wx.showActionSheet({
      itemList: ['手动录入', '截图导入(OCR)', '导入持仓'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: '/pages/asset-edit/asset-edit?type=FUND'
          });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({
            url: '/pages/asset-ocr/asset-ocr'
          });
        } else {
          wx.showToast({ title: '功能开发中', icon: 'none' });
        }
      }
    });
  },
  gotoCategory(e) {
    const type = e.currentTarget.dataset.type;
    const pages = {
      'fund': '/pages/funds/funds',
      'stock': '/pages/stocks/stocks',
      'deposit': '/pages/deposits/deposits'
    };
    const url = pages[type];
    if (url) {
      wx.navigateTo({ url });
    }
  },
  gotoAnalysis() {
    wx.navigateTo({ url: '/pages/analysis/analysis' });
  },
  goBack() { wx.switchTab({ url: '/pages/index/index' }); },
  addGroup() {
    wx.showModal({
      title: '添加分组',
      content: '请输入分组名称',
      editable: true,
      placeholderText: '例如：养老计划、子女教育',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const name = res.content.trim();
          const groups = assetService.getGroups();

          // 检查是否重名
          if (groups.some(g => g.name === name)) {
            wx.showToast({ title: '分组已存在', icon: 'none' });
            return;
          }

          // 创建新分组
          const newGroup = {
            id: `group_${Date.now()}`,
            name: name,
            color: getGroupColor(groups.length)
          };

          groups.push(newGroup);
          assetService.saveGroups(groups);

          // 更新页面数据
          this.loadGroups();
          wx.showToast({ title: '分组已创建', icon: 'success' });
        }
      }
    });
  }
});