const axios = require('axios');
const fs = require('fs');

async function getScripts() {
  const urls = [
    'http://jwgl.rzvtc.cn:8081/rzzyjw/custom/js/SetKingoEncypt.jsp',
    'http://jwgl.rzvtc.cn:8081/rzzyjw/custom/js/GetKingoEncypt.jsp',
    'http://jwgl.rzvtc.cn:8081/rzzyjw/custom/js/md5.js',
    'http://jwgl.rzvtc.cn:8081/rzzyjw/custom/js/base64.js'
  ];
  
  for (const url of urls) {
    try {
      const response = await axios.get(url);
      const filename = url.split('/').pop();
      fs.writeFileSync(filename, response.data);
      console.log('✅ 保存了 ' + filename);
    } catch (error) {
      console.error('❌ 获取 ' + url + ' 失败:', error.message);
    }
  }
}

getScripts();
