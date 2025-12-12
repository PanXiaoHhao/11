const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

axios.get('http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action')
  .then(res => {
    const $ = cheerio.load(res.data);
    console.log('=== 页面中的JavaScript ===');
    
    const scripts = [];
    $('script').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        scripts.push({ type: 'external', src: src });
        console.log(`外部脚本: ${src}`);
      } else {
        const content = $(el).html();
        scripts.push({ type: 'inline', content: content });
        console.log(`内联脚本 ${i}:`);
        console.log(content);
      }
    });
    
    // 保存所有脚本到文件
    fs.writeFileSync('scripts.json', JSON.stringify(scripts, null, 2));
    console.log('\n=== 脚本已保存到 scripts.json ===');
  })
  .catch(err => console.error(err));
