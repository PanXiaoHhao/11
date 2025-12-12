const puppeteer = require('puppeteer');

// 模拟人类延迟的函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 生成随机延迟时间，符合人类行为习惯
const randomDelay = (min = 500, max = 2000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 模拟人类输入行为，包括随机延迟和打字速度
const typeHumanLike = async (element, text) => {
  for (const char of text) {
    await element.type(char, { delay: randomDelay(50, 150) });
  }
};

// 主函数：模拟人类登录流程
async function simulateHumanLogin(studentId, password) {
  let browser;
  try {
    console.log('📌 开始模拟人类登录流程...');
    
    // 启动浏览器
    console.log('📌 启动浏览器...');
    browser = await puppeteer.launch({
      headless: false, // 非无头模式，方便查看操作过程
      slowMo: randomDelay(50, 100), // 放慢操作速度
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled' // 禁用自动化检测
      ],
      ignoreDefaultArgs: ['--enable-automation'] // 忽略默认自动化参数
    });
    
    // 创建新页面
    const page = await browser.newPage();
    
    // 设置浏览器指纹，模拟真实用户
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 设置视口大小，模拟真实显示器
    await page.setViewport({
      width: 1920,
      height: 1080
    });
    
    // 导航到登录页
    console.log('📌 导航到登录页...');
    await page.goto('http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action', {
      waitUntil: 'networkidle2', // 等待网络空闲
      timeout: 30000
    });
    
    // 模拟页面加载完成后的等待时间
    console.log('📌 等待页面加载完成...');
    await delay(randomDelay(1000, 3000));
    
    // 找到用户名输入框并输入学号
    console.log('📌 输入学号...');
    const usernameInput = await page.waitForSelector('#username', { timeout: 10000 });
    await delay(randomDelay(300, 800)); // 模拟找到输入框后的思考时间
    await typeHumanLike(usernameInput, studentId);
    
    // 模拟输入完用户名后的等待时间
    await delay(randomDelay(300, 800));
    
    // 找到密码输入框并输入密码
    console.log('📌 输入密码...');
    const passwordInput = await page.waitForSelector('#password', { timeout: 10000 });
    await delay(randomDelay(300, 800)); // 模拟找到输入框后的思考时间
    await typeHumanLike(passwordInput, password);
    
    // 模拟输入完密码后的等待时间
    await delay(randomDelay(500, 1500));
    
    // 找到登录按钮并点击
    console.log('📌 点击登录按钮...');
    const loginButton = await page.waitForSelector('#login', { timeout: 10000 });
    
    // 模拟鼠标移动到登录按钮的过程
    await page.mouse.move(
      Math.random() * 100 + 100,
      Math.random() * 100 + 100,
      { steps: 10 } // 模拟平滑移动
    );
    await delay(randomDelay(200, 500)); // 模拟鼠标悬停时间
    
    // 点击登录按钮
    await loginButton.click();
    
    // 模拟登录请求发送后的等待时间
    console.log('📌 等待登录请求完成...');
    await delay(randomDelay(1000, 5000));
    
    // 检查登录是否成功
    const currentUrl = await page.url();
    if (currentUrl.includes('login.action')) {
      // 登录失败，获取错误信息
      console.log('❌ 登录失败...');
      const errorMessage = await page.$eval('#msg', el => el.textContent);
      console.log('❌ 错误信息：', errorMessage);
      return { success: false, message: errorMessage };
    } else {
      // 登录成功
      console.log('✅ 登录成功！');
      console.log('📌 当前页面URL：', currentUrl);
      
      // 登录成功后，可以进行后续的数据爬取操作
      // 例如，访问考试安排页面
      console.log('📌 访问考试安排页面...');
      await page.goto('http://jwgl.rzvtc.cn:8081/rzzyjw/student/exam/arrange/list.action', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // 模拟页面加载完成后的等待时间
      await delay(randomDelay(1000, 3000));
      
      // 保存页面内容到文件，以便查看结构
      const pageContent = await page.content();
      const fs = require('fs');
      fs.writeFileSync('exam_page.html', pageContent);
      console.log('📌 考试安排页面HTML已保存到 exam_page.html');
      
      // 提取考试数据
      console.log('📌 提取考试数据...');
      const examList = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        const exams = [];
        
        rows.forEach(row => {
          const tds = row.querySelectorAll('td');
          if (tds.length >= 8) {
            exams.push({
              courseName: tds[1].textContent.trim(),
              credit: tds[2].textContent.trim(),
              examMethod: tds[4].textContent.trim(),
              status: tds[7].textContent.trim()
            });
          }
        });
        
        return exams;
      });
      
      console.log('📌 提取到的考试数据：', examList);
      
      // 关闭浏览器
      await browser.close();
      
      return { success: true, examList: examList };
    }
    
  } catch (error) {
    console.error('❌ 登录过程出错:', error.message);
    console.error('❌ 错误详情:', error);
    
    // 关闭浏览器
    if (browser) {
      await browser.close();
    }
    
    return { success: false, message: error.message };
  }
}

// 测试登录功能
if (require.main === module) {
  const studentId = '2024180112';
  const password = 'zhao325389';
  
  simulateHumanLogin(studentId, password)
    .then(result => {
      console.log('📌 最终结果：', result);
    })
    .catch(error => {
      console.error('❌ 测试过程出错:', error);
    });
}

module.exports = simulateHumanLogin;