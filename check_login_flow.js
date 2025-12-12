const axios = require('axios');

// 查看密码加密相关的JavaScript文件
async function checkEncryptionScripts() {
  try {
    // 获取密码加密相关的脚本
    const scripts = [
      '/rzzyjw/custom/js/SetKingoEncypt.jsp?t=72291176545866931476311',
      '/rzzyjw/custom/js/GetKingoEncypt.jsp?t=43891176545866931415052',
      '/rzzyjw/custom/js/md5.js?t=13494176545866931495448',
      '/rzzyjw/frame/themes/kingo/js/loginbar.js?t=57088176545866931478542'
    ];
    
    for (const script of scripts) {
      console.log(`\n=== 获取脚本: ${script} ===`);
      const response = await axios.get(`http://jwgl.rzvtc.cn:8081${script}`);
      console.log(response.data);
    }
    
  } catch (error) {
    console.error('获取脚本失败:', error);
  }
}

checkEncryptionScripts();
