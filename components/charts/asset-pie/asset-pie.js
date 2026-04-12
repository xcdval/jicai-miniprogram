// components/charts/asset-pie/asset-pie.js
Component({
  properties: {
    data: {
      type: Array,
      value: [],
      observer: 'updateChart'
    }
  },

  data: {
    chart: null
  },

  lifetimes: {
    attached() {
      this.initChart();
    }
  },

  methods: {
    initChart() {
      const query = this.createSelectorQuery();
      query.select('#assetPieChart').fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // 设置canvas尺寸
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        // 绘制简单的饼图
        this.drawPie(ctx, res[0].width, res[0].height, this.data.data);
      });
    },

    drawPie(ctx, width, height, data) {
      if (!data || data.length === 0) return;

      const centerX = width / 2;
      const centerY = height / 2;
      // 减小半径，留出更多边距
      const radius = Math.min(width, height) / 2 - 40;

      // 计算总值
      const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
      if (total === 0) return;

      // 绘制饼图
      let currentAngle = -Math.PI / 2;

      data.forEach((item, index) => {
        const value = item.value || 0;
        const angle = (value / total) * Math.PI * 2;

        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.closePath();
        ctx.fillStyle = item.color || this.getDefaultColor(index);
        ctx.fill();

        currentAngle += angle;
      });

      // 绘制中心空白（环形效果）- 使用浅色背景
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();

      // 绘制中心细边框
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 中心文字 - 使用深色字体适配浅色主题
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('总资产', centerX, centerY - 8);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('100%', centerX, centerY + 8);
    },

    getDefaultColor(index) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      return colors[index % colors.length];
    },

    updateChart() {
      this.initChart();
    }
  }
});
