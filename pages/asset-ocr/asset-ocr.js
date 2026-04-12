/**
 * 资产OCR识别页面
 * 支持持仓截图识别，自动提取资产信息
 */

const assetService = require('../../services/assetService');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    // 步骤: 'upload' 上传, 'preview' 预览, 'edit' 编辑
    step: 'upload',
    // 图片信息
    imagePath: '',
    imageWidth: 0,
    imageHeight: 0,
    // 识别结果
    recognizedAssets: [],
    // 平台类型
    platformType: '',
    supportedPlatforms: [
      { id: 'alipay', name: '支付宝', icon: '💙', color: '#1677ff' },
      { id: 'ttjj', name: '天天基金', icon: '📊', color: '#ff6b35' },
      { id: 'eastmoney', name: '东方财富', icon: '📈', color: '#ff6600' },
      { id: 'wechat', name: '微信理财通', icon: '💬', color: '#07c160' },
      { id: 'other', name: '其他平台', icon: '📱', color: '#64748b' }
    ],
    // 选中平台
    selectedPlatform: '',
    // 处理状态
    isProcessing: false,
    progress: 0,
    // 编辑表单
    editingAsset: null,
    editingIndex: -1
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });

    if (options.platform) {
      this.setData({ selectedPlatform: options.platform });
    }
  },

  // 返回上一页
  goBack() {
    if (this.data.step !== 'upload') {
      this.setData({ step: 'upload', imagePath: '', recognizedAssets: [] });
    } else {
      wx.navigateBack();
    }
  },

  // 选择平台
  selectPlatform(e) {
    const platform = e.currentTarget.dataset.platform;
    this.setData({ selectedPlatform: platform });
  },

  // 选择图片
  chooseImage() {
    if (!this.data.selectedPlatform) {
      wx.showToast({ title: '请先选择平台类型', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        this.setData({
          imagePath: tempFile.tempFilePath,
          imageWidth: tempFile.width,
          imageHeight: tempFile.height,
          step: 'preview'
        });
      }
    });
  },

  // 开始OCR识别
  startOCR() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({ isProcessing: true, progress: 0 });

    // 模拟识别进度
    const progressInterval = setInterval(() => {
      const progress = this.data.progress + Math.random() * 15;
      if (progress >= 100) {
        clearInterval(progressInterval);
        this.setData({ progress: 100 });
        setTimeout(() => {
          this.performOCR();
        }, 500);
      } else {
        this.setData({ progress: Math.min(progress, 95) });
      }
    }, 300);
  },

  // 执行OCR识别（模拟）
  performOCR() {
    const { selectedPlatform } = this.data;

    // 根据不同平台返回模拟识别结果
    const mockResults = this.getMockOCRResults(selectedPlatform);

    this.setData({
      isProcessing: false,
      step: 'edit',
      recognizedAssets: mockResults,
      platformType: selectedPlatform
    });

    wx.showToast({
      title: `识别到${mockResults.length}条资产`,
      icon: 'success'
    });
  },

  // 获取模拟OCR识别结果
  getMockOCRResults(platform) {
    const results = {
      alipay: [
        { name: '易方达蓝筹精选混合', code: '005827', type: 'FUND', costPrice: 2.456, shares: 5000, platform: '支付宝' },
        { name: '招商中证白酒指数', code: '161725', type: 'FUND', costPrice: 1.234, shares: 8000, platform: '支付宝' }
      ],
      ttjj: [
        { name: '华夏能源革新股票', code: '003834', type: 'FUND', costPrice: 3.567, shares: 3000, platform: '天天基金' },
        { name: '中欧医疗健康混合', code: '003095', type: 'FUND', costPrice: 2.891, shares: 2000, platform: '天天基金' }
      ],
      eastmoney: [
        { name: '宁德时代', code: '300750', type: 'STOCK', costPrice: 198.5, shares: 100, platform: '东方财富' },
        { name: '贵州茅台', code: '600519', type: 'STOCK', costPrice: 1520, shares: 50, platform: '东方财富' }
      ],
      wechat: [
        { name: '广发科技先锋混合', code: '008903', type: 'FUND', costPrice: 1.856, shares: 4000, platform: '微信理财通' }
      ],
      other: [
        { name: '工商银行定期', code: '', type: 'DEPOSIT', amount: 50000, annualRate: 2.85, platform: '工商银行' }
      ]
    };

    return results[platform] || results.alipay;
  },

  // 编辑资产
  editAsset(e) {
    const index = e.currentTarget.dataset.index;
    const asset = this.data.recognizedAssets[index];
    this.setData({
      editingAsset: { ...asset },
      editingIndex: index
    });

    wx.showModal({
      title: '编辑资产',
      content: '是否修改识别结果？',
      confirmText: '编辑',
      success: (res) => {
        if (res.confirm) {
          this.showEditForm(index);
        }
      }
    });
  },

  // 显示编辑表单
  showEditForm(index) {
    const asset = this.data.recognizedAssets[index];
    const isFund = asset.type === 'FUND';
    const isStock = asset.type === 'STOCK';
    const isDeposit = asset.type === 'DEPOSIT';

    let content = `名称: ${asset.name}\n`;
    if (asset.code) content += `代码: ${asset.code}\n`;
    if (isFund || isStock) {
      content += `成本价: ${asset.costPrice}\n`;
      content += `份额: ${asset.shares}\n`;
    }
    if (isDeposit) {
      content += `金额: ${asset.amount}\n`;
      content += `利率: ${asset.annualRate}%\n`;
    }

    wx.showModal({
      title: '编辑资产信息',
      content: content + '\n点击确定保存修改',
      showCancel: true,
      editable: false
    });
  },

  // 删除识别的资产
  deleteAsset(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '删除确认',
      content: '确定删除这条识别结果？',
      success: (res) => {
        if (res.confirm) {
          const assets = this.data.recognizedAssets.filter((_, i) => i !== index);
          this.setData({ recognizedAssets: assets });
        }
      }
    });
  },

  // 添加资产到分组
  addAssets() {
    const { recognizedAssets } = this.data;

    if (recognizedAssets.length === 0) {
      wx.showToast({ title: '没有可添加的资产', icon: 'none' });
      return;
    }

    // 选择分组
    const groups = assetService.getGroups();
    const groupNames = groups.map(g => g.name);

    wx.showActionSheet({
      itemList: groupNames,
      success: (res) => {
        const groupId = groups[res.tapIndex].id;
        let successCount = 0;

        recognizedAssets.forEach(asset => {
          const result = assetService.addAsset(groupId, {
            type: asset.type,
            name: asset.name,
            code: asset.code,
            costPrice: asset.costPrice,
            shares: asset.shares,
            amount: asset.amount,
            annualRate: asset.annualRate,
            platform: asset.platform
          });

          if (result.success) {
            successCount++;
          }
        });

        wx.showToast({
          title: `成功添加${successCount}条资产`,
          icon: 'success'
        });

        setTimeout(() => {
          wx.switchTab({ url: '/pages/assets/assets' });
        }, 1500);
      }
    });
  },

  // 重新识别
  retryOCR() {
    this.setData({
      step: 'upload',
      imagePath: '',
      recognizedAssets: [],
      isProcessing: false,
      progress: 0
    });
  }
});
