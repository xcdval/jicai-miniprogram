Component({
  properties: {
    activeIndex: {
      type: Number,
      value: 0
    }
  },

  data: {
    safeAreaBottom: 0,
    list: [
      { text: '首页', icon: '⌂', activeIcon: '⌂', pagePath: '/pages/index/index' },
      { text: '资产', icon: '≡', activeIcon: '≡', pagePath: '/pages/assets/assets' },
      { text: '情报', icon: '◈', activeIcon: '◈', pagePath: '/pages/intelligence/intelligence' },
      { text: '分析', icon: '▤', activeIcon: '▤', pagePath: '/pages/analysis/analysis' },
      { text: '我的', icon: '○', activeIcon: '●', pagePath: '/pages/profile/profile' }
    ]
  },

  lifetimes: {
    attached() {
      // 获取安全区域高度
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        safeAreaBottom: systemInfo.safeAreaInsetBottom || 0
      });
    }
  },

  methods: {
    onTabTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];

      if (index === this.data.activeIndex) {
        return;
      }

      wx.switchTab({
        url: item.pagePath
      });

      this.triggerEvent('change', { index, item });
    }
  }
});
