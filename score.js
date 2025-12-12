Page({
  data: {
    examList: [],
    studentId: '',
    password: '',
    loading: false,
    error: ''
  },

  // 初始化页面
  onLoad(options) {
    console.log('成绩页面onLoad，options:', options);
    
    this.setData({ loading: true });
    
    // 从URL获取登录信息和数据
    if (options.data) {
      console.log('从URL获取data参数');
      try {
        const data = JSON.parse(decodeURIComponent(options.data));
        console.log('解析后的data:', data);
        
        // 从解析后的数据中获取登录信息
        if (data.studentId && data.password) {
          this.setData({
            studentId: data.studentId,
            password: data.password
          });
          
          // 如果已经有examList数据，直接使用
          if (data.examList && Array.isArray(data.examList)) {
            console.log('直接使用传递的examList数据');
            this.setData({
              loading: false,
              examList: data.examList
            });
          } else {
            // 没有examList数据，调用API获取
            this.loadExamData(data.studentId, data.password);
          }
        } else {
          // 没有登录信息，显示错误
          console.log('没有登录信息');
          this.setData({
            loading: false,
            error: '请先登录'
          });
          
          wx.showModal({
            title: '错误',
            content: '请先登录',
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
        }
      } catch (error) {
        console.error('解析data参数失败:', error);
        this.setData({
          loading: false,
          error: '数据格式错误'
        });
        
        wx.showModal({
          title: '错误',
          content: '数据格式错误，请重新登录',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    } else {
      // 没有data参数，显示错误
      console.log('没有data参数');
      this.setData({
        loading: false,
        error: '请先登录'
      });
      
      wx.showModal({
        title: '错误',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },
  
  // 加载考试数据
  loadExamData(studentId, password) {
    console.log('加载考试数据，参数:', { studentId, password });
    
    this.setData({ 
      loading: true,
      error: ''
    });
    
    wx.request({
      url: 'http://localhost:3000/api/exam',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        studentId: studentId,
        password: password
      },
      success: (res) => {
        console.log('请求考试数据成功，响应:', res);
        
        this.setData({ loading: false });
        
        if (res.data && res.data.success) {
          // 直接使用后端返回的examList数据
          this.setData({
            examList: res.data.examList || []
          });
        } else {
          this.setData({
            examList: [],
            error: res.data?.message || '获取数据失败'
          });
          
          wx.showModal({
            title: '错误',
            content: res.data?.message || '获取数据失败',
            showCancel: false
          });
        }
      },
      fail: (err) => {
        console.log('请求考试数据失败:', err);
        this.setData({ 
          loading: false,
          examList: [],
          error: '网络错误，无法连接到服务器'
        });
        
        wx.showModal({
          title: '网络错误',
          content: '无法连接到服务器，请检查网络连接',
          showCancel: false
        });
      }
    });
  }
})