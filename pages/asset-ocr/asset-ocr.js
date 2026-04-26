/**
 * 资产OCR识别页面
 * 支持持仓截图识别，自动提取资产信息
 */

const assetService = require('../../services/assetService');
const ocrService = require('../../services/ocrService');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    // 步骤: 'upload' 上传, 'preview' 预览, 'edit' 编辑, 'manual' 手动输入
    step: 'upload',
    // 图片信息
    imagePath: '',
    imageWidth: 0,
    imageHeight: 0,
    // 识别结果
    recognizedAssets: [],
    // OCR 原始文本
    rawOCRText: '',
    // OCR 置信度
    ocrConfidence: 0,
    ocrConfidencePercent: 0,
    ocrConfidenceClass: 'low',
    // 手动输入文本
    manualText: '',
    // 是否演示模式
    isDemo: false,
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

  // 执行OCR识别
  performOCR() {
    const { selectedPlatform, imagePath } = this.data;

    this.setData({ isProcessing: true, progress: 0 });

    // 模拟识别进度（实际调用API时也显示进度）
    const progressInterval = setInterval(() => {
      const progress = this.data.progress + Math.random() * 15;
      if (progress >= 90) {
        clearInterval(progressInterval);
        this.setData({ progress: 90 });
        // 开始真实识别
        this.doRealOCR(imagePath, selectedPlatform);
      } else {
        this.setData({ progress: Math.min(progress, 85) });
      }
    }, 200);
  },

  // 执行真实 OCR 识别
  doRealOCR(imagePath, platform) {
    ocrService.recognize(imagePath, platform)
      .then(result => {
        var confidence = result.confidence || 0;
        var confidencePercent = Math.round(confidence * 100);
        var confidenceClass = confidence >= 0.8 ? 'high' : (confidence >= 0.5 ? 'medium' : 'low');

        this.setData({
          isProcessing: false,
          progress: 100,
          recognizedAssets: result.assets || [],
          rawOCRText: result.rawText || '',
          ocrConfidence: confidence,
          ocrConfidencePercent: confidencePercent,
          ocrConfidenceClass: confidenceClass,
          isDemo: result.isDemo || false,
          step: result.needsManualInput ? 'manual' : (result.assets && result.assets.length > 0 ? 'edit' : 'manual'),
          platformType: platform
        });

        if (result.needsManualInput) {
          wx.showModal({
            title: '请手动输入',
            content: '无法从截图识别到资产信息，请在下方手动输入文本或粘贴持仓信息',
            showCancel: false,
            confirmText: '知道了'
          });
        } else if (result.assets && result.assets.length > 0) {
          wx.showToast({
            title: `识别到${result.assets.length}条资产，请核对`,
            icon: 'success',
            duration: 2000
          });
        }
      })
      .catch(err => {
        console.error('OCR 识别失败:', err);
        this.setData({
          isProcessing: false,
          progress: 100,
          step: 'manual'
        });
        wx.showModal({
          title: '识别失败',
          content: '请手动输入资产信息，或重新上传更清晰的截图',
          showCancel: true,
          cancelText: '重新上传',
          confirmText: '手动输入',
          success: res => {
            if (!res.confirm) {
              this.setData({ step: 'upload', imagePath: '', recognizedAssets: [] });
            }
          }
        });
      });
  },

  // 提交手动输入的文本
  submitManualText() {
    const { manualText, selectedPlatform } = this.data;
    if (!manualText || !manualText.trim()) {
      wx.showToast({ title: '请输入资产信息', icon: 'none' });
      return;
    }

    this.setData({ isProcessing: true });

    // 使用文本解析器解析粘贴的文本
    const result = ocrService.recognizeText(manualText, selectedPlatform);

    var confidence = result.confidence || 0;
    var confidencePercent = Math.round(confidence * 100);
    var confidenceClass = confidence >= 0.8 ? 'high' : (confidence >= 0.5 ? 'medium' : 'low');

    this.setData({
      isProcessing: false,
      recognizedAssets: result.assets || [],
      rawOCRText: manualText,
      ocrConfidence: confidence,
      ocrConfidencePercent: confidencePercent,
      ocrConfidenceClass: confidenceClass,
      isDemo: false,
      step: result.assets && result.assets.length > 0 ? 'edit' : 'manual'
    });

    if (result.assets && result.assets.length > 0) {
      wx.showToast({ title: `解析到${result.assets.length}条资产`, icon: 'success' });
    } else {
      wx.showToast({ title: '未能解析到资产信息', icon: 'none' });
    }
  },

  // 手动输入文本变化
  onManualTextInput(e) {
    this.setData({ manualText: e.detail.value });
  },

  // 切换到手动输入模式
  switchToManual() {
    this.setData({ step: 'manual', manualText: '' });
  },

  // 获取演示模式识别结果（isDemo 标记供 UI 显示）
  getMockOCRResults(platform) {
    const results = {
      alipay: [
        { name: '易方达蓝筹精选混合', code: '005827', type: 'FUND', costPrice: 2.456, shares: 5000, platform: '支付宝', _confidence: 0.95 },
        { name: '招商中证白酒指数', code: '161725', type: 'FUND', costPrice: 1.234, shares: 8000, platform: '支付宝', _confidence: 0.95 }
      ],
      ttjj: [
        { name: '华夏能源革新股票', code: '003834', type: 'FUND', costPrice: 3.567, shares: 3000, platform: '天天基金', _confidence: 0.9 },
        { name: '中欧医疗健康混合', code: '003095', type: 'FUND', costPrice: 2.891, shares: 2000, platform: '天天基金', _confidence: 0.9 }
      ],
      eastmoney: [
        { name: '宁德时代', code: '300750', type: 'STOCK', costPrice: 198.5, shares: 100, platform: '东方财富', _confidence: 0.9 },
        { name: '贵州茅台', code: '600519', type: 'STOCK', costPrice: 1520, shares: 50, platform: '东方财富', _confidence: 0.9 }
      ],
      wechat: [
        { name: '广发科技先锋混合', code: '008903', type: 'FUND', costPrice: 1.856, shares: 4000, platform: '微信理财通', _confidence: 0.9 }
      ],
      other: [
        { name: '工商银行定期', code: '', type: 'DEPOSIT', amount: 50000, annualRate: 2.85, platform: '工商银行', _confidence: 0.85 }
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
          // 过滤掉内部字段
          var cleanAsset = {
            type: asset.type,
            name: asset.name,
            code: asset.code || '',
            costPrice: asset.costPrice || 0,
            shares: asset.shares || 0,
            amount: asset.amount || 0,
            annualRate: asset.annualRate || 0,
            platform: asset.platform || ''
          };
          const result = assetService.addAsset(groupId, cleanAsset);

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
      rawOCRText: '',
      ocrConfidence: 0,
      ocrConfidencePercent: 0,
      ocrConfidenceClass: 'low',
      isDemo: false,
      manualText: '',
      isProcessing: false,
      progress: 0
    });
  }
});
