/**
 * 资产录入/编辑页面
 * 支持基金、股票、存款的添加和编辑
 */

const assetService = require('../../services/assetService');
const format = require('../../utils/format');

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    // 页面模式: 'add' 添加, 'edit' 编辑
    mode: 'add',
    // 资产类型: 'FUND' 基金, 'STOCK' 股票, 'DEPOSIT' 存款
    assetType: 'FUND',
    // 表单数据
    form: {
      name: '',
      code: '',
      platform: '',
      costPrice: '',
      currentPrice: '',
      shares: '',
      amount: '',
      annualRate: '',
      startDate: '',
      endDate: '',
      remark: ''
    },
    // 表单验证错误
    errors: {},
    // 资产分组
    groups: [],
    selectedGroupId: 'group1',
    // 日期选择器
    datePickerVisible: false,
    currentDateField: '',
    currentDate: new Date().getTime()
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: sys.statusBarHeight,
      navBarHeight: (menu.top - sys.statusBarHeight) * 2 + menu.height
    });

    // 获取资产类型
    if (options.type) {
      this.setData({ assetType: options.type.toUpperCase() });
    }

    // 编辑模式
    if (options.id) {
      this.setData({ mode: 'edit' });
      this.loadAssetData(options.id);
    }

    // 加载分组
    this.loadGroups();
  },

  // 加载资产分组
  loadGroups() {
    const groups = assetService.getGroups();
    if (groups.length > 0) {
      this.setData({
        groups: groups,
        selectedGroupId: groups[0].id
      });
    } else {
      // 默认分组
      this.setData({
        groups: [
          { id: 'group1', name: '稳健型', color: '#10b981' },
          { id: 'group2', name: '成长型', color: '#f59e0b' },
          { id: 'group3', name: '高收益', color: '#ef4444' }
        ],
        selectedGroupId: 'group1'
      });
    }
  },

  // 加载资产数据（编辑模式）
  loadAssetData(assetId) {
    const assets = assetService.getAssets();
    for (const group of assets.groups) {
      const asset = group.assets.find(a => a.id === assetId);
      if (asset) {
        this.setData({
          selectedGroupId: group.id,
          assetType: asset.type,
          form: {
            name: asset.name || '',
            code: asset.code || '',
            platform: asset.platform || '',
            costPrice: asset.costPrice ? String(asset.costPrice) : '',
            currentPrice: asset.currentPrice ? String(asset.currentPrice) : '',
            shares: asset.shares ? String(asset.shares) : '',
            amount: asset.amount ? String(asset.amount) : '',
            annualRate: asset.annualRate ? String(asset.annualRate) : '',
            startDate: asset.startDate || '',
            endDate: asset.endDate || '',
            remark: asset.remark || ''
          }
        });
        break;
      }
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 切换资产类型
  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ assetType: type });
    this.clearForm();
  },

  // 选择分组
  selectGroup(e) {
    const groupId = e.currentTarget.dataset.id;
    this.setData({ selectedGroupId: groupId });
  },

  // 表单输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`form.${field}`]: value,
      [`errors.${field}`]: ''
    });
  },

  // 日期选择器
  showDatePicker(e) {
    const field = e.currentTarget.dataset.field;
    let currentDate = this.data.currentDate;
    if (this.data.form[field]) {
      currentDate = new Date(this.data.form[field]).getTime();
    }
    this.setData({
      datePickerVisible: true,
      currentDateField: field,
      currentDate: currentDate
    });
  },

  // 日期选择确认
  onDateConfirm(e) {
    const date = format.formatDate(new Date(e.detail), 'YYYY-MM-DD');
    this.setData({
      [`form.${this.data.currentDateField}`]: date,
      datePickerVisible: false
    });
  },

  // 日期选择取消
  onDateCancel() {
    this.setData({ datePickerVisible: false });
  },

  // 清空表单
  clearForm() {
    this.setData({
      form: {
        name: '',
        code: '',
        platform: '',
        costPrice: '',
        currentPrice: '',
        shares: '',
        amount: '',
        annualRate: '',
        startDate: '',
        endDate: '',
        remark: ''
      },
      errors: {}
    });
  },

  // 表单验证
  validateForm() {
    const { form, assetType } = this.data;
    const errors = {};

    // 验证名称
    if (!form.name.trim()) {
      errors.name = '请输入名称';
    }

    // 基金和股票需要代码
    if ((assetType === 'FUND' || assetType === 'STOCK') && !form.code.trim()) {
      errors.code = '请输入代码';
    }

    // 基金和股票验证
    if (assetType === 'FUND' || assetType === 'STOCK') {
      if (!form.costPrice || isNaN(form.costPrice) || parseFloat(form.costPrice) <= 0) {
        errors.costPrice = '请输入有效的成本价';
      }
      if (!form.shares || isNaN(form.shares) || parseFloat(form.shares) <= 0) {
        errors.shares = '请输入有效的份额/股数';
      }
      if (!form.platform.trim()) {
        errors.platform = '请输入购买平台/券商';
      }
    }

    // 存款验证
    if (assetType === 'DEPOSIT') {
      if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) {
        errors.amount = '请输入有效的金额';
      }
      if (!form.platform.trim()) {
        errors.platform = '请输入银行名称';
      }
      if (form.annualRate && (isNaN(form.annualRate) || parseFloat(form.annualRate) < 0)) {
        errors.annualRate = '请输入有效的利率';
      }
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  // 保存资产
  saveAsset() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单填写',
        icon: 'none'
      });
      return;
    }

    const { form, assetType, selectedGroupId, mode } = this.data;

    // 构建资产数据
    let assetData = {
      type: assetType,
      name: form.name.trim(),
      platform: form.platform.trim(),
      remark: form.remark.trim()
    };

    // 基金和股票特有字段
    if (assetType === 'FUND' || assetType === 'STOCK') {
      assetData.code = form.code.trim().toUpperCase();
      assetData.costPrice = parseFloat(form.costPrice);
      assetData.shares = parseFloat(form.shares);
      assetData.currentPrice = form.currentPrice ? parseFloat(form.currentPrice) : assetData.costPrice;
    }

    // 存款特有字段
    if (assetType === 'DEPOSIT') {
      assetData.amount = parseFloat(form.amount);
      assetData.annualRate = form.annualRate ? parseFloat(form.annualRate) : 0;
      assetData.startDate = form.startDate;
      assetData.endDate = form.endDate;
      assetData.costPrice = assetData.amount;
      assetData.currentPrice = assetData.amount;
      assetData.shares = 1;
    }

    let result;
    if (mode === 'edit') {
      // 编辑模式
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.options && prevPage.options.id) {
        result = assetService.updateAsset(prevPage.options.id, assetData);
      }
    } else {
      // 添加模式
      result = assetService.addAsset(selectedGroupId, assetData);
    }

    if (result && result.success) {
      wx.showToast({
        title: mode === 'edit' ? '修改成功' : '添加成功',
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({
        title: result ? result.message : '操作失败',
        icon: 'none'
      });
    }
  }
});
