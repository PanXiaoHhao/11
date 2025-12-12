const axios = require('axios');
const fs = require('fs');

// 获取登录页源码
async function getLoginPage() {
  try {
    const response = await axios.get('http://jwgl.rzvtc.cn:8081/rzzyjw/login.jsp', {
      responseType: 'arraybuffer'
    });
    
    // 保存为HTML文件
    fs.writeFileSync('login_page.html', response.data);
    console.log('✅ 登录页源码已保存到 login_page.html');
    
    // 读取并显示部分内容
    const content = fs.readFileSync('login_page.html', 'utf8');
    console.log('\n=== 登录页源码片段 ===');
    console.log(content.substring(0, 2000) + '...');
    
    // 搜索密码加密相关代码
    console.log('\n=== 搜索密码加密相关代码 ===');
    const passwordRegex = /password|encrypt|md5|encode/i;
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (passwordRegex.test(line)) {
        console.log(`第${index + 1}行: ${line.trim()}`);
      }
    });
    
  } catch (error) {
    console.error('❌ 获取登录页源码失败:', error.message);
    console.error('错误详情:', error);
  }
}

getLoginPage();