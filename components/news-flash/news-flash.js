Component({
  properties: {
    newsList: {
      type: Array,
      value: [],
      observer: '_updateFilteredNews'
    },
    maxItems: {
      type: Number,
      value: 8
    }
  },

  lifetimes: {
    attached() {
      this._updateFilteredNews();
    }
  },

  data: {
    activeFilter: 'all',
    filters: [
      { label: '全部', value: 'all' },
      { label: '政策', value: 'policy' },
      { label: '市场', value: 'market' },
      { label: '科技', value: 'tech' },
      { label: '国际', value: 'global' },
      { label: '公司', value: 'company' }
    ],
    categoryMap: {
      policy: '政策',
      market: '市场',
      tech: '科技',
      global: '国际',
      company: '公司',
      macro: '宏观',
      general: '综合'
    },
    filteredNews: []
  },

  methods: {
    _updateFilteredNews() {
      const { newsList, activeFilter, categoryMap, maxItems } = this.data;
      let filtered = newsList || [];

      if (activeFilter !== 'all') {
        filtered = newsList.filter(item => item.category === activeFilter);
      }

      const result = filtered.slice(0, maxItems).map(item => ({
        ...item,
        categoryText: categoryMap[item.category] || item.category
      }));

      this.setData({ filteredNews: result });
    },

    onFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      this.setData({ activeFilter: filter });
      this._updateFilteredNews();
      this.triggerEvent('filterChange', { filter });
    },

    onViewMore() {
      this.triggerEvent('viewMore');
    }
  }
});
