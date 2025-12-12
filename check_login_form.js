const axios = require('axios');
const cheerio = require('cheerio');

axios.get('http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action')
  .then(res => {
    const $ = cheerio.load(res.data);
    console.log('=== 登录表单HTML ===');
    console.log($('form').html());
    console.log('\n=== 所有input元素 ===');
    const inputs = [];
    $('input').each((i, el) => {
      inputs.push({
        name: $(el).attr('name'),
        value: $(el).attr('value'),
        type: $(el).attr('type'),
        id: $(el).attr('id')
      });
    });
    console.log(inputs);
  })
  .catch(err => console.error(err));
