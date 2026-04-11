Component({
  properties: {
    newsList: {
      type: Array,
      value: []
    },
    maxItems: {
      type: Number,
      value: 5
    }
  },

  data: {
    activeFilter: 'all',
    filters: [
      { label: '全部', value: 'all' },
      { label: '市场', value: 'market' },
      { label: '宏观', value: 'macro' },
      { label: '公司', value: 'company' }
    ],
    categoryMap: {
      market: '市场',
      macro: '宏观',
      company: '公司'
    }
  },

  computed: {
    filteredNews() {
      const { newsList, activeFilter, categoryMap, maxItems } = this.data;
      let filtered = newsList;

      if (activeFilter !== 'all') {
        filtered = newsList.filter(item => item.category === activeFilter);
      }

      return filtered.slice(0, maxItems).map(item => ({
        ...item,
        categoryText: categoryMap[item.category] || item.category
      }));
    }
  },

  methods: {
    onFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      this.setData({ activeFilter: filter });
      this.triggerEvent('filterChange', { filter });
    },

    onViewMore() {
      this.triggerEvent('viewMore');
    }
  }
});