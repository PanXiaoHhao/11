Page({
  data: {
    studentId: '',
    password: '',
    loading: false,
    errorTip: '' // 新增错误提示字段
  },
  idInput(e) {
    this.setData({ studentId: e.detail.value.trim() });
  },
  pwdInput(e) {
    this.setData({ password: e.detail.value.trim() }); // 加trim避免空格问题
  },
  login() {
    const { studentId, password } = this.data;
    // 1. 校验输入，加trim避免空格问题
    if (!studentId.trim() || !password.trim()) {
      return;
    }
    // 2. 开始加载
    this.setData({ loading: true });
    
    // 3. 2秒后自动恢复按钮（模拟爬取等待，密码错时也走这个逻辑）
    const timer = setTimeout(() => {
      if (this.data.loading) {
        this.setData({ loading: false });
      }
    }, 2000);
    
    // 4. 发请求
    console.log('发送登录请求，参数：', {
      studentId: studentId.trim(),
      password: password.trim()
    });
    
    wx.request({
      url: 'http://localhost:3000/api/exam',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        studentId: studentId.trim(),
        password: password.trim() // 确保传完整参数
      },
      success: (res) => {
        // 清除定时器，立即恢复按钮
        clearTimeout(timer);
        this.setData({ loading: false });
        
        console.log('登录请求成功，响应：', res);
        
        // 处理响应
        if (res.data) {
          console.log('响应数据：', res.data);
          if (res.data?.success) {
            console.log('登录成功，准备跳转到成绩页面');
            
            // 不存储登录凭证到本地存储，直接传递给成绩页面
            // 添加登录信息到返回数据中
            const dataToPass = {
              ...res.data,
              studentId: studentId.trim(),
              password: password.trim()
            };
            
            wx.navigateTo({
              url: `/pages/score/score?data=${encodeURIComponent(JSON.stringify(dataToPass))}`,
              success: () => {
                console.log('跳转成功');
              },
              fail: (err) => {
                console.log('跳转失败：', err);
              }
            });
          } else {
            // 登录失败，显示错误信息
            const errorMsg = res.data.message || '登录失败，请检查用户名和密码';
            console.log('登录失败，错误信息：', errorMsg);
            wx.showModal({
              title: '登录失败',
              content: errorMsg,
              showCancel: false
            });
          }
        } else {
          // 无响应数据
          console.log('无响应数据');
          wx.showModal({
            title: '登录失败',
            content: '服务器无响应，请稍后重试',
            showCancel: false
          });
        }
      },
      fail: (err) => {
        // 请求失败，清除定时器
        clearTimeout(timer);
        this.setData({ loading: false });
        
        // 显示网络错误
        console.log('请求失败：', err);
        wx.showModal({
          title: '网络错误',
          content: '无法连接到服务器，请检查网络连接',
          showCancel: false
        });
      }
    });
  }
})