// components/charts/profit-line/profit-line.js
Component({
  properties: {
    data: {
      type: Array,
      value: [],
      observer: 'updateChart'
    },
    type: {
      type: String,
      value: 'profit' // profit: 盈亏走势, value: 资产走势
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
      query.select('#profitLineChart').fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.drawLineChart(ctx, res[0].width, res[0].height, this.data.data);
      });
    },

    drawLineChart(ctx, width, height, data) {
      if (!data || data.length === 0) {
        this.drawEmptyState(ctx, width, height);
        return;
      }

      const padding = { top: 30, right: 20, bottom: 40, left: 60 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      // 计算数据范围
      const values = data.map(item => item.value || 0);
      const maxValue = Math.max(...values, 0);
      const minValue = Math.min(...values, 0);
      const range = maxValue - minValue || 1;

      // 绘制网格线
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }

      // 绘制坐标轴
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, padding.top + chartHeight);
      ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
      ctx.stroke();

      // 绘制零线
      const zeroY = padding.top + chartHeight - ((0 - minValue) / range * chartHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(padding.left + chartWidth, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 绘制折线
      if (data.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = this.data.type === 'profit' ? '#10b981' : '#3b82f6';
        ctx.lineWidth = 2;

        data.forEach((item, index) => {
          const x = padding.left + (index / (data.length - 1)) * chartWidth;
          const y = padding.top + chartHeight - ((item.value - minValue) / range * chartHeight);

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // 绘制渐变填充
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + chartHeight);
        data.forEach((item, index) => {
          const x = padding.left + (index / (data.length - 1)) * chartWidth;
          const y = padding.top + chartHeight - ((item.value - minValue) / range * chartHeight);
          ctx.lineTo(x, y);
        });
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        const baseColor = this.data.type === 'profit' ? '16, 185, 129' : '59, 130, 246';
        gradient.addColorStop(0, `rgba(${baseColor}, 0.3)`);
        gradient.addColorStop(1, `rgba(${baseColor}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // 绘制数据点
      data.forEach((item, index) => {
        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((item.value - minValue) / range * chartHeight);

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.data.type === 'profit' ? '#10b981' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // 绘制Y轴标签
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= 5; i++) {
        const value = minValue + (range / 5) * i;
        const y = padding.top + chartHeight - (chartHeight / 5) * i;
        const label = this.formatValue(value);
        ctx.fillText(label, padding.left - 8, y);
      }

      // 绘制X轴标签
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelStep = Math.ceil(data.length / 6);
      data.forEach((item, index) => {
        if (index % labelStep === 0) {
          const x = padding.left + (index / (data.length - 1)) * chartWidth;
          ctx.fillText(item.label || '', x, padding.top + chartHeight + 8);
        }
      });
    },

    drawEmptyState(ctx, width, height) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无数据', width / 2, height / 2);
    },

    formatValue(value) {
      if (Math.abs(value) >= 10000) {
        return (value / 10000).toFixed(1) + '万';
      }
      return value.toFixed(0);
    },

    updateChart() {
      this.initChart();
    }
  }
});
