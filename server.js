const express = require('express');
const cors = require('cors');
const { default: wrapper } = require('axios-cookiejar-support');
const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const md5 = require('md5');

// 教务系统基础配置（完全匹配页面）
const EDU_BASE_URL = 'http://jwgl.rzvtc.cn:8081/rzzyjw';
const LOGIN_PAGE_URL = `${EDU_BASE_URL}/cas/login.action`; // 登录页地址
const LOGIN_SUBMIT_URL = `${EDU_BASE_URL}/cas/login.action.html`; // 表单提交地址（关键！）
const EXAM_INFO_URL = `${EDU_BASE_URL}/student/examarrange/examarrange_query.jsp`; // 考试信息页

// 创建Express应用
const app = express();
app.use(cors());
app.use(express.json());

/**
 * 创建带Cookie的axios实例（修复wrapper不是函数的问题）
 */
function createAxiosInstance() {
  const jar = new CookieJar();
  
  // User-Agent池，模拟不同浏览器和设备
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ];
  
  // 随机选择一个User-Agent
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  logWithTimestamp(`🔍 随机选择User-Agent: ${randomUserAgent}`, 'DEBUG');
  
  // 新版本用法：先创建axios实例，再用wrapper包装
  const instance = wrapper(axios.create({
    timeout: 15000,
    withCredentials: true,
    headers: {
      'User-Agent': randomUserAgent,
      'Referer': LOGIN_PAGE_URL,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Connection': 'keep-alive',
      'Host': 'jwgl.rzvtc.cn:8081'
    },
    jar: jar // 直接绑定CookieJar（新版本支持）
  }));
  
  return instance;
}

/**
 * 从登录页面提取动态参数
 * @param {Object} instance - axios实例
 * @returns {Object} 包含动态参数的对象
 */
async function getLoginParams(instance) {
  logWithTimestamp(`📌 提取登录页面动态参数...`);
  const loginPageUrl = 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action';
  
  // 请求登录页面
  const loginPageRes = await instance.get(loginPageUrl);
  logWithTimestamp(`📌 登录页面请求成功，状态码：${loginPageRes.status}`);
  
  // 保存登录页面HTML到文件，便于调试
  const fs = require('fs');
  fs.writeFileSync('login_page.html', loginPageRes.data);
  logWithTimestamp(`📁 登录页面HTML已保存到 login_page.html`, 'DEBUG');
  
  // 解析HTML，优先从表单隐藏域提取参数
  const $ = cheerio.load(loginPageRes.data);
  
  // 1. 从表单隐藏域提取参数（CAS登录系统的标准做法）
  const loginForm = $('form[id="dosub"]');
  const formParams = {
    // 提取表单的action属性，作为登录URL
    formAction: loginForm.attr('action') || '',
    // 提取表单中的隐藏域参数
    lt: $('input[name="lt"]').val() || '',
    execution: $('input[name="execution"]').val() || '',
    _eventId: $('input[name="_eventId"]').val() || 'submit',
    // 其他可能的表单参数
    _rememberMe: $('input[name="_rememberMe"]').val() || '',
    submit: $('input[name="submit"]').val() || '登录'
  };
  
  // 2. 从script标签中提取补充参数
  const htmlContent = loginPageRes.data;
  const scriptParams = {
    _sessionid: htmlContent.match(/var _sessionid = "([^"]+)";/)?.[1] || '',
    schoolcode: htmlContent.match(/var schoolcode = "([^"]+)";/)?.[1] || '',
    modename: htmlContent.match(/var modename = "([^"]+)";/)?.[1] || ''
  };
  
  // 合并所有参数
  const params = { ...formParams, ...scriptParams };
  
  logWithTimestamp(`� 提取到的动态参数: ${JSON.stringify(params)}`, 'DEBUG');
  
  // 验证关键参数是否存在
  if (!params.lt || !params.execution) {
    logWithTimestamp(`❌ 关键参数提取失败，可能是页面结构变化`, 'ERROR');
    // 尝试从script标签中提取作为后备方案
    params.lt = htmlContent.match(/var _lt = "([^"]+)";/)?.[1] || '';
    params.execution = htmlContent.match(/var _execution = "([^"]+)";/)?.[1] || '';
    logWithTimestamp(`📋 尝试从script标签提取后的参数: ${JSON.stringify(params)}`, 'DEBUG');
  }
  
  return params;
}

/**
 * 检查密码复杂度
 * @param {string} password - 原始密码
 * @param {string} username - 学号
 * @returns {Object} 密码检查结果
 */
function checkPasswordComplexity(password, username) {
  // 检查密码复杂度
  let result = 0;
  for (let i = 0; i < password.length; i++) {
    const charCode = password.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) {
      result |= 8; // 数字
    } else if (charCode >= 97 && charCode <= 122) {
      result |= 4; // 小写字母
    } else if (charCode >= 65 && charCode <= 90) {
      result |= 2; // 大写字母
    } else {
      result |= 1; // 特殊字符
    }
  }
  
  // 检查密码是否包含账号
  const inuserzh = password.toLowerCase().trim().includes(username.toLowerCase().trim()) ? "1" : "0";
  
  return {
    txt_mm_expression: result.toString(),
    txt_mm_length: password.length.toString(),
    txt_mm_userzh: inuserzh
  };
}

/**
 * 密码加密（完全匹配系统规则）
 * 规则：hex_md5(hex_md5(password) + hex_md5(randnumber.toLowerCase()))
 * 即：两次MD5 + 验证码拼接
 * 
 * @param {string} password - 原始密码
 * @param {string} randnumber - 验证码（可以为空）
 * @returns {string} 加密后的密码
 */
function encryptPassword(password, randnumber = '') {
  logWithTimestamp(`📌 开始密码加密，原始密码：${password}`);
  
  try {
    // 1. 第一次MD5并转大写
    const md5Pwd = md5(password).toUpperCase();
    logWithTimestamp(`📌 第一次MD5加密结果：${md5Pwd}`);
    
    // 2. 验证码MD5（转小写后）并转大写，验证码为空时使用空字符串
    const md5Rand = randnumber ? md5(randnumber.toLowerCase()).toUpperCase() : '';
    logWithTimestamp(`📌 验证码MD5加密结果：${md5Rand}`);
    
    // 3. 将两个加密结果拼接，再进行一次MD5并转大写
    const finalMd5 = md5(md5Pwd + md5Rand).toUpperCase();
    logWithTimestamp(`📌 最终密码加密结果：${finalMd5}`);
    
    return finalMd5;
  } catch (error) {
    logWithTimestamp(`❌ 密码加密失败：${error.message}`, 'ERROR');
    // 加密失败时，返回原始密码的MD5值作为备用
    return md5(password).toUpperCase();
  }
}

/**
 * 执行登录
 * @param {string} studentId - 学号
 * @param {string} password - 密码
 * @returns {Object} 登录结果
 */
// 添加带时间戳的日志函数
const logWithTimestamp = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// 模拟人类延迟的函数
const delay = (ms) => {
  logWithTimestamp(`⏱️  等待 ${ms}ms...`, 'DEBUG');
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 生成随机延迟时间，符合人类行为习惯
const randomDelay = (min = 500, max = 2000) => {
  // 人类行为延迟更偏向于正态分布，而不是完全随机
  // 使用三角形分布来模拟更真实的人类等待时间
  const a = min;
  const b = max;
  const c = (a + b) / 2; // 峰值在中间，更符合真实人类行为
  
  const u = Math.random();
  let delayTime;
  
  if (u < (c - a) / (b - a)) {
    delayTime = a + Math.sqrt(u * (b - a) * (c - a));
  } else {
    delayTime = b - Math.sqrt((1 - u) * (b - a) * (b - c));
  }
  
  return Math.floor(delayTime);
};

async function login(studentId, password, randnumber = '') {
  try {
    logWithTimestamp(`📌 接收到登录请求：学号=${studentId}`);
    
    // 1. 模拟人类操作：等待随机时间，模拟用户思考
    logWithTimestamp(`🤔 模拟用户思考时间...`, 'DEBUG');
    await delay(randomDelay(1000, 2000));
    
    // 2. 创建带Cookie的axios实例
    logWithTimestamp(`🔧 创建带Cookie的axios实例`, 'DEBUG');
    const instance = createAxiosInstance(); // 现在返回的是已包装好的实例
    
    // 3. 先访问登录页，获取Cookie（必须！否则服务器认为是非法请求）
    logWithTimestamp(`📌 访问登录页获取Cookie...`);
    await instance.get(LOGIN_PAGE_URL);
    logWithTimestamp(`📌 登录页Cookie获取成功`);
    
    // 5. 密码复杂度检查
    const passwordCheck = checkPasswordComplexity(password, studentId);
    logWithTimestamp(`📌 密码复杂度检查结果：${JSON.stringify(passwordCheck)}`, 'DEBUG');
    
    // 6. 模拟表单字段输入时间
    logWithTimestamp(`⌨️  模拟表单字段输入时间...`, 'DEBUG');
    await delay(randomDelay(300, 800));
    
    // 7. 加密密码，使用修正后的加密逻辑
    logWithTimestamp(`🔑 开始加密密码...`);
    // 使用函数参数传入的randnumber，免验证时为空
    const encryptedPassword = encryptPassword(password, randnumber);
    logWithTimestamp(`🔑 密码加密完成，结果：${encryptedPassword}`, 'DEBUG');
    
    // 8. 构建登录请求数据
    logWithTimestamp(`📌 构建登录请求数据...`);
    
    // 构建完整的登录参数，完全匹配HTML里的字段
    const loginParams = new URLSearchParams({
      username: studentId, // 账号
      password: encryptedPassword, // 加密后的密码
      randnumber: randnumber, // 验证码（免验证时为空）
      txt_mm_expression: passwordCheck.txt_mm_expression, // 密码复杂度
      txt_mm_length: passwordCheck.txt_mm_length, // 密码长度
      txt_mm_userzh: passwordCheck.txt_mm_userzh, // 是否包含用户名
      hid_flag: '1', // 免验证码标识（关键！）
      hid_dxyzm: '', // 隐藏字段，默认空
      hid_sjhm: '' // 隐藏字段，默认空
    });
    
    // 模拟表单提交前的准备时间
    logWithTimestamp(`📝 模拟表单提交前的准备时间...`, 'DEBUG');
    await delay(randomDelay(300, 1000));
    
    // 10. 发送登录请求
    logWithTimestamp(`📤 发送POST请求到登录URL：${LOGIN_SUBMIT_URL}`, 'DEBUG');
    logWithTimestamp(`📋 登录请求数据：${loginParams.toString()}`, 'DEBUG');
    
    const loginResponse = await instance.post(LOGIN_SUBMIT_URL, loginParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': LOGIN_PAGE_URL,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
      },
      validateStatus: (status) => status < 400 // 允许3xx状态码
    });
    
    // 模拟登录请求发送后的等待时间
    logWithTimestamp(`⏳ 模拟登录请求发送后的等待时间...`, 'DEBUG');
    await delay(randomDelay(500, 1500));
    
    logWithTimestamp(`📌 登录请求完成，状态码：${loginResponse.status}`);
    logWithTimestamp(`📌 登录请求最终URL：${loginResponse.request.res.responseUrl}`, 'DEBUG');
    
    // 9. 检查登录是否成功：登录成功会跳转到系统首页（URL不含cas/login）
    logWithTimestamp(`📌 检查登录结果...`);
    const isSuccess = !loginResponse.request.res.responseUrl.includes('cas/login');
    if (!isSuccess) {
      logWithTimestamp(`❌ 登录失败：账号密码错误/参数不匹配/需要验证码`, 'ERROR');
      throw new Error('登录失败：账号密码错误/参数不匹配/需要验证码');
    }
    
    logWithTimestamp(`✅ 登录成功！`);
    return { success: true, instance };
    
  } catch (error) {
    // 完善错误处理，区分不同类型的错误
    let errorMessage = '登录失败：';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage += '网络连接失败，请检查网络连接或目标网站是否可访问';
    } else if (error.response) {
      // 服务器返回了错误响应
      errorMessage += `服务器返回错误：状态码 ${error.response.status}，消息 ${error.response.statusText}`;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage += '未收到服务器响应，请检查网络连接或目标网站状态';
    } else {
      // 请求配置错误
      errorMessage += error.message;
    }
    
    logWithTimestamp(`❌ 登录过程出错: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误类型: ${error.code || 'Unknown'}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    logWithTimestamp(`❌ 详细错误分析：${errorMessage}`, 'ERROR');
    throw new Error(errorMessage);
  }
}

/**
 * 爬取考试安排数据
 * @param {Object} instance - 登录后的axios实例
 * @returns {Array} 考试数据列表
 */
async function fetchExamData(instance) {
  try {
    logWithTimestamp('📌 第四步：爬取考试数据');
    
    // 检查instance是否有效
    if (!instance) {
      logWithTimestamp('❌ 登录实例无效，无法爬取数据', 'ERROR');
      throw new Error('登录实例无效，无法爬取数据');
    }
    
    // 模拟用户寻找并点击考试安排链接的延迟
    const clickDelay = randomDelay(500, 1200);
    logWithTimestamp(`👆 模拟用户寻找并点击考试安排链接的延迟：${clickDelay}ms`);
    await delay(clickDelay);
    
    // 考试安排页面URL
    const examUrl = EXAM_INFO_URL;
    logWithTimestamp(`🌐 考试安排页面URL：${examUrl}`);
    
    // 发送请求获取考试数据
    logWithTimestamp('📌 发送请求获取考试数据...');
    
    // 添加随机延迟模拟用户等待页面加载
    const waitDelay = randomDelay(300, 800);
    logWithTimestamp(`⏳ 模拟用户等待页面加载的延迟：${waitDelay}ms`);
    await delay(waitDelay);
    
    logWithTimestamp(`📤 发送GET请求到考试安排URL：${examUrl}`, 'DEBUG');
    const response = await instance.get(examUrl, {
      headers: {
        'Referer': LOGIN_PAGE_URL
      }
    });
    
    logWithTimestamp(`📌 考试数据请求成功，状态码：${response.status}`);
    
    // 保存考试页面HTML到文件，便于调试
    const fs = require('fs');
    fs.writeFileSync('exam_page.html', response.data);
    logWithTimestamp(`📁 考试页面HTML已保存到 exam_page.html`, 'DEBUG');
    
    // 模拟用户等待页面完全加载的延迟
    const fullLoadDelay = randomDelay(600, 1500);
    logWithTimestamp(`🖥️  模拟用户等待页面完全加载的延迟：${fullLoadDelay}ms`);
    await delay(fullLoadDelay);
    
    // 解析考试数据
    const $ = cheerio.load(response.data);
    const examList = [];
    
    // 解析考试表格，提取完整的考试信息
    logWithTimestamp('📌 开始解析考试数据...');
    
    // 模拟用户浏览表格内容的延迟
    const browseDelay = randomDelay(400, 900);
    logWithTimestamp(`📖 模拟用户浏览表格内容的延迟：${browseDelay}ms`);
    await delay(browseDelay);
    
    // 【关键】根据考试页的实际表格结构调整选择器（示例：通用表格解析）
    logWithTimestamp('📊 开始通用表格解析...');
    let rowCount = 0;
    
    $('table').each((tableIdx, tableEl) => {
      $(tableEl).find('tr').each((rowIdx, rowEl) => {
        if (rowIdx === 0) return; // 跳过表头
        
        rowCount++;
        
        // 模拟用户滚动到当前行的延迟
        const scrollDelay = randomDelay(50, 150);
        logWithTimestamp(`📜 模拟用户滚动到第 ${rowCount} 行的延迟：${scrollDelay}ms`, 'DEBUG');
        
        // 模拟用户查看当前行的延迟
        const viewDelay = randomDelay(100, 300);
        logWithTimestamp(`👀 模拟用户查看第 ${rowCount} 行的延迟：${viewDelay}ms`, 'DEBUG');
        
        const tds = $(rowEl).find('td');
        if (tds.length < 3) {
          logWithTimestamp(`⚠️  第 ${rowCount} 行数据字段不足，跳过`, 'WARNING');
          return; // 过滤无效行
        }
        
        // 通用表格解析，提取关键考试信息
        examList.push({
          courseName: $(tds[1]).text().trim() || '未知',
          examTime: $(tds[2]).text().trim() || '未知',
          examLocation: $(tds[3]).text().trim() || '未知',
          seatNumber: $(tds[4]).text().trim() || '未知',
          // 添加额外的字段以兼容不同的表格结构
          credit: $(tds[5]).text().trim() || '未知',
          examMethod: $(tds[6]).text().trim() || '未知',
          status: $(tds[7]).text().trim() || '未知'
        });
        
        // 每查看3-5行，模拟用户短暂休息
        if (rowCount % Math.floor(Math.random() * 3) + 3 === 0) {
          const restDelay = randomDelay(300, 800);
          logWithTimestamp(`☕ 模拟用户查看 ${rowCount} 行后的短暂休息：${restDelay}ms`, 'DEBUG');
        }
      });
    });
    
    logWithTimestamp(`📊 共处理 ${rowCount} 行数据`);
    
    // 模拟用户浏览完所有数据后的思考延迟
    const thinkDelay = randomDelay(500, 1200);
    logWithTimestamp(`💭 模拟用户浏览完所有数据后的思考延迟：${thinkDelay}ms`);
    await delay(thinkDelay);
    
    logWithTimestamp(`📌 考试数据解析完成，共 ${examList.length} 条记录`);
    
    // 确保返回的数据是真实爬取的
    if (examList.length === 0) {
      logWithTimestamp('⚠️  爬取到的考试数据为空，检查页面结构是否变化', 'WARNING');
      throw new Error('未爬取到考试数据，可能是页面结构变化或登录状态失效');
    }
    
    logWithTimestamp(`✅ 成功爬取 ${examList.length} 条考试数据`);
    return examList;
    
  } catch (error) {
    // 完善错误处理，区分不同类型的错误
    let errorMessage = '爬取考试数据失败：';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage += '网络连接失败，请检查网络连接或目标网站是否可访问';
    } else if (error.response) {
      // 服务器返回了错误响应
      errorMessage += `服务器返回错误：状态码 ${error.response.status}，消息 ${error.response.statusText}`;
      if (error.response.status === 401 || error.response.status === 403) {
        errorMessage += '，可能是登录状态已过期或访问被拒绝';
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage += '未收到服务器响应，请检查网络连接或目标网站状态';
    } else {
      // 请求配置错误或解析错误
      errorMessage += error.message;
    }
    
    logWithTimestamp(`❌ 爬取考试数据失败: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误类型: ${error.code || 'Unknown'}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    logWithTimestamp(`❌ 详细错误分析：${errorMessage}`, 'ERROR');
    throw new Error(errorMessage);
  }
}

/**
 * 爬取成绩数据
 * @param {Object} instance - 登录后的axios实例
 * @returns {Array} 成绩数据列表
 */
async function fetchGradeData(instance) {
  try {
    logWithTimestamp('📌 第五步：爬取成绩数据');
    
    // 检查instance是否有效
    if (!instance) {
      logWithTimestamp('❌ 登录实例无效，无法爬取数据', 'ERROR');
      throw new Error('登录实例无效，无法爬取数据');
    }
    
    // 模拟用户寻找并点击成绩查询链接的延迟
    const clickDelay = randomDelay(500, 1200);
    logWithTimestamp(`👆 模拟用户寻找并点击成绩查询链接的延迟：${clickDelay}ms`);
    await delay(clickDelay);
    
    // 成绩查询页面URL
    const gradeUrl = 'http://jwgl.rzvtc.cn:8081/rzzyjw/student/score/all/list.action';
    logWithTimestamp(`🌐 成绩查询页面URL：${gradeUrl}`);
    
    // 发送请求获取成绩数据
    logWithTimestamp('📌 发送请求获取成绩数据...');
    
    // 添加随机延迟模拟用户等待页面加载
    const waitDelay = randomDelay(300, 800);
    logWithTimestamp(`⏳ 模拟用户等待页面加载的延迟：${waitDelay}ms`);
    await delay(waitDelay);
    
    logWithTimestamp(`📤 发送GET请求到成绩查询URL：${gradeUrl}`, 'DEBUG');
    const response = await instance.get(gradeUrl, {
      headers: {
        'Referer': 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action'
      }
    });
    
    logWithTimestamp(`📌 成绩数据请求成功，状态码：${response.status}`);
    
    // 模拟用户等待页面完全加载的延迟
    const fullLoadDelay = randomDelay(600, 1500);
    logWithTimestamp(`🖥️  模拟用户等待页面完全加载的延迟：${fullLoadDelay}ms`);
    await delay(fullLoadDelay);
    
    // 解析成绩数据
    const $ = cheerio.load(response.data);
    const gradeList = [];
    
    // 解析成绩表格
    logWithTimestamp('📌 开始解析成绩数据...');
    
    // 模拟用户浏览表格内容的延迟
    const browseDelay = randomDelay(400, 900);
    logWithTimestamp(`📖 模拟用户浏览表格内容的延迟：${browseDelay}ms`);
    await delay(browseDelay);
    
    // 获取所有行
    const rows = $('table tbody tr');
    logWithTimestamp(`📊 找到 ${rows.length} 行成绩数据`);
    
    // 模拟用户逐行查看数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // 模拟用户滚动到当前行的延迟
      const scrollDelay = randomDelay(50, 150);
      logWithTimestamp(`📜 模拟用户滚动到第 ${i + 1} 行的延迟：${scrollDelay}ms`, 'DEBUG');
      await delay(scrollDelay);
      
      // 模拟用户查看当前行的延迟
      const viewDelay = randomDelay(100, 300);
      logWithTimestamp(`👀 模拟用户查看第 ${i + 1} 行的延迟：${viewDelay}ms`, 'DEBUG');
      await delay(viewDelay);
      
      const tds = $(row).find('td');
      if (tds.length >= 10) {
        gradeList.push({
          courseName: $(tds[1]).text().trim(),
          courseType: $(tds[2]).text().trim(),
          credit: $(tds[3]).text().trim(),
          grade: $(tds[4]).text().trim(),
          semester: $(tds[7]).text().trim(),
          examDate: $(tds[8]).text().trim(),
          status: $(tds[9]).text().trim()
        });
      }
      
      // 每查看3-5行，模拟用户短暂休息
      if ((i + 1) % Math.floor(Math.random() * 3) + 3 === 0) {
        const restDelay = randomDelay(300, 800);
        logWithTimestamp(`☕ 模拟用户查看 ${i + 1} 行后的短暂休息：${restDelay}ms`, 'DEBUG');
        await delay(restDelay);
      }
    }
    
    // 模拟用户浏览完所有数据后的思考延迟
    const thinkDelay = randomDelay(500, 1200);
    logWithTimestamp(`💭 模拟用户浏览完所有数据后的思考延迟：${thinkDelay}ms`);
    await delay(thinkDelay);
    
    logWithTimestamp(`📌 成绩数据解析完成，共 ${gradeList.length} 条记录`);
    
    // 确保返回的数据是真实爬取的
    if (gradeList.length === 0) {
      logWithTimestamp('⚠️  爬取到的成绩数据为空，检查页面结构是否变化', 'WARNING');
      throw new Error('未爬取到成绩数据，可能是页面结构变化或登录状态失效');
    }
    
    logWithTimestamp(`✅ 成功爬取 ${gradeList.length} 条成绩数据`);
    return gradeList;
    
  } catch (error) {
    // 完善错误处理，区分不同类型的错误
    let errorMessage = '爬取成绩数据失败：';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage += '网络连接失败，请检查网络连接或目标网站是否可访问';
    } else if (error.response) {
      // 服务器返回了错误响应
      errorMessage += `服务器返回错误：状态码 ${error.response.status}，消息 ${error.response.statusText}`;
      if (error.response.status === 401 || error.response.status === 403) {
        errorMessage += '，可能是登录状态已过期或访问被拒绝';
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage += '未收到服务器响应，请检查网络连接或目标网站状态';
    } else {
      // 请求配置错误或解析错误
      errorMessage += error.message;
    }
    
    logWithTimestamp(`❌ 爬取成绩数据失败: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误类型: ${error.code || 'Unknown'}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    logWithTimestamp(`❌ 详细错误分析：${errorMessage}`, 'ERROR');
    throw new Error(errorMessage);
  }
}

/**
 * 爬取课表数据
 * @param {Object} instance - 登录后的axios实例
 * @returns {Array} 课表数据列表
 */
async function fetchScheduleData(instance) {
  try {
    logWithTimestamp('📌 第六步：爬取课表数据');
    
    // 检查instance是否有效
    if (!instance) {
      logWithTimestamp('❌ 登录实例无效，无法爬取数据', 'ERROR');
      throw new Error('登录实例无效，无法爬取数据');
    }
    
    // 模拟用户寻找并点击课表查询链接的延迟
    const clickDelay = randomDelay(500, 1200);
    logWithTimestamp(`👆 模拟用户寻找并点击课表查询链接的延迟：${clickDelay}ms`);
    await delay(clickDelay);
    
    // 课表查询页面URL
    const scheduleUrl = 'http://jwgl.rzvtc.cn:8081/rzzyjw/student/schedule/list.action';
    logWithTimestamp(`🌐 课表查询页面URL：${scheduleUrl}`);
    
    // 发送请求获取课表数据
    logWithTimestamp('📌 发送请求获取课表数据...');
    
    // 添加随机延迟模拟用户等待页面加载
    const waitDelay = randomDelay(300, 800);
    logWithTimestamp(`⏳ 模拟用户等待页面加载的延迟：${waitDelay}ms`);
    await delay(waitDelay);
    
    logWithTimestamp(`📤 发送GET请求到课表查询URL：${scheduleUrl}`, 'DEBUG');
    const response = await instance.get(scheduleUrl, {
      headers: {
        'Referer': 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action'
      }
    });
    
    logWithTimestamp(`📌 课表数据请求成功，状态码：${response.status}`);
    
    // 模拟用户等待页面完全加载的延迟
    const fullLoadDelay = randomDelay(600, 1500);
    logWithTimestamp(`🖥️  模拟用户等待页面完全加载的延迟：${fullLoadDelay}ms`);
    await delay(fullLoadDelay);
    
    // 解析课表数据
    const $ = cheerio.load(response.data);
    const scheduleList = [];
    
    // 解析课表表格
    logWithTimestamp('📌 开始解析课表数据...');
    
    // 模拟用户浏览表格内容的延迟
    const browseDelay = randomDelay(400, 900);
    logWithTimestamp(`📖 模拟用户浏览表格内容的延迟：${browseDelay}ms`);
    await delay(browseDelay);
    
    // 获取所有行
    const rows = $('table tbody tr');
    logWithTimestamp(`📊 找到 ${rows.length} 行课表数据`);
    
    // 模拟用户逐行查看数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // 模拟用户滚动到当前行的延迟
      const scrollDelay = randomDelay(50, 150);
      logWithTimestamp(`📜 模拟用户滚动到第 ${i + 1} 行的延迟：${scrollDelay}ms`, 'DEBUG');
      await delay(scrollDelay);
      
      // 模拟用户查看当前行的延迟
      const viewDelay = randomDelay(100, 300);
      logWithTimestamp(`👀 模拟用户查看第 ${i + 1} 行的延迟：${viewDelay}ms`, 'DEBUG');
      await delay(viewDelay);
      
      const tds = $(row).find('td');
      if (tds.length >= 8) {
        scheduleList.push({
          courseName: $(tds[1]).text().trim(),
          teacher: $(tds[2]).text().trim(),
          classroom: $(tds[3]).text().trim(),
          dayOfWeek: $(tds[4]).text().trim(),
          timeSlot: $(tds[5]).text().trim(),
          semester: $(tds[6]).text().trim(),
          status: $(tds[7]).text().trim()
        });
      }
      
      // 每查看3-5行，模拟用户短暂休息
      if ((i + 1) % Math.floor(Math.random() * 3) + 3 === 0) {
        const restDelay = randomDelay(300, 800);
        logWithTimestamp(`☕ 模拟用户查看 ${i + 1} 行后的短暂休息：${restDelay}ms`, 'DEBUG');
        await delay(restDelay);
      }
    }
    
    // 模拟用户浏览完所有数据后的思考延迟
    const thinkDelay = randomDelay(500, 1200);
    logWithTimestamp(`💭 模拟用户浏览完所有数据后的思考延迟：${thinkDelay}ms`);
    await delay(thinkDelay);
    
    logWithTimestamp(`📌 课表数据解析完成，共 ${scheduleList.length} 条记录`);
    
    // 确保返回的数据是真实爬取的
    if (scheduleList.length === 0) {
      logWithTimestamp('⚠️  爬取到的课表数据为空，检查页面结构是否变化', 'WARNING');
      throw new Error('未爬取到课表数据，可能是页面结构变化或登录状态失效');
    }
    
    logWithTimestamp(`✅ 成功爬取 ${scheduleList.length} 条课表数据`);
    return scheduleList;
    
  } catch (error) {
    // 完善错误处理，区分不同类型的错误
    let errorMessage = '爬取课表数据失败：';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage += '网络连接失败，请检查网络连接或目标网站是否可访问';
    } else if (error.response) {
      // 服务器返回了错误响应
      errorMessage += `服务器返回错误：状态码 ${error.response.status}，消息 ${error.response.statusText}`;
      if (error.response.status === 401 || error.response.status === 403) {
        errorMessage += '，可能是登录状态已过期或访问被拒绝';
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage += '未收到服务器响应，请检查网络连接或目标网站状态';
    } else {
      // 请求配置错误或解析错误
      errorMessage += error.message;
    }
    
    logWithTimestamp(`❌ 爬取课表数据失败: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误类型: ${error.code || 'Unknown'}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    logWithTimestamp(`❌ 详细错误分析：${errorMessage}`, 'ERROR');
    throw new Error(errorMessage);
  }
}

/**
 * 主函数：登录并获取指定类型的数据
 * @param {string} studentId - 学号
 * @param {string} password - 密码
 * @param {string} dataType - 数据类型：exam, grade, schedule
 * @returns {Object} 包含指定数据的结果
 */
async function fetchDataByType(studentId, password, dataType, randnumber = '') {
    // 分步验证机制，确保每一步操作成功后才能进行下一步
    
    // 步骤1：验证用户输入
    logWithTimestamp('📌 验证用户输入...');
    if (!studentId || !password) {
      logWithTimestamp('❌ 用户输入不完整，缺少学号或密码', 'ERROR');
      return { success: false, message: '请提供学号和密码' };
    }
    
    // 步骤2：执行登录
    logWithTimestamp('📌 执行登录...');
    const loginResult = await login(studentId, password, randnumber);
    if (!loginResult.success) {
      return { success: false, message: loginResult.message };
    }
    
    // 模拟人类思考和操作时间
    const postLoginDelay = randomDelay(800, 1500);
    logWithTimestamp(`👀 模拟用户登录后浏览页面时间：${postLoginDelay}ms`);
    await delay(postLoginDelay);
    
    // 步骤3：根据数据类型获取对应数据
    logWithTimestamp(`📌 获取${dataType}数据...`);
    let dataList;
    
    switch(dataType) {
      case 'exam':
        dataList = await fetchExamData(loginResult.instance);
        break;
      case 'grade':
        dataList = await fetchGradeData(loginResult.instance);
        break;
      case 'schedule':
        dataList = await fetchScheduleData(loginResult.instance);
        break;
      default:
        logWithTimestamp(`❌ 无效的数据类型：${dataType}`, 'ERROR');
        return { success: false, message: '无效的数据类型，支持：exam, grade, schedule' };
    }
    
    // 步骤4：验证数据完整性
    logWithTimestamp('📌 验证数据完整性...');
    if (!Array.isArray(dataList)) {
      logWithTimestamp(`${dataType}数据格式错误，不是数组类型`, 'ERROR');
      return { success: false, message: `${dataType}数据格式错误` };
    }
    
    // 步骤5：返回结果
    logWithTimestamp('📌 所有步骤完成，返回真实爬取数据...');
    logWithTimestamp(`✅ 成功获取 ${dataList.length} 条${dataType}数据`);
    
    // 构建返回结果
    const result = {
      success: true,
      [dataType + 'Count']: dataList.length,
      [dataType + 'List']: dataList
    };
    
    return result;
}

/**
 * 主函数：登录并获取考试数据（兼容旧版接口）
 * @param {string} studentId - 学号
 * @param {string} password - 密码
 * @param {string} randnumber - 验证码（可以为空）
 * @returns {Object} 包含考试数据的结果
 */
async function getExamInfo(studentId, password, randnumber = '') {
  return fetchDataByType(studentId, password, 'exam', randnumber);
}

// API接口
// 新增：统一考试查询接口（兼容最终版）
app.post('/api/queryExam', async (req, res) => {
  const { username, password, randnumber = '' } = req.body;
  
  // 使用logWithTimestamp替代console.log，统一日志格式
  logWithTimestamp('📥 收到考试数据请求（新版接口）', 'INFO');
  
  if (!username || !password) {
    logWithTimestamp('❌ 请求参数不完整，缺少学号或密码', 'ERROR');
    return res.json({
      success: false,
      message: '请提供学号和密码'
    });
  }
  
  try {
    logWithTimestamp(`🚀 开始处理请求：学号=${username}`, 'INFO');
    // 登录
    const loginResult = await login(username, password, randnumber);
    if (!loginResult.success) {
      return res.json({ success: false, message: loginResult.message });
    }
    // 获取考试信息
    const examInfo = await fetchExamData(loginResult.instance);
    
    logWithTimestamp(`✅ 请求处理完成，返回 ${examInfo.length} 条考试数据`, 'INFO');
    res.json({ success: true, data: { exams: examInfo } });
    
  } catch (error) {
    logWithTimestamp(`❌ 接口处理出错: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    res.json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
});

// 考试数据接口（兼容旧版）
app.post('/api/exam', async (req, res) => {
  const { studentId, password, randnumber = '' } = req.body;
  
  // 使用logWithTimestamp替代console.log，统一日志格式
  logWithTimestamp('📥 收到考试数据请求', 'INFO');
  
  if (!studentId || !password) {
    logWithTimestamp('❌ 请求参数不完整，缺少学号或密码', 'ERROR');
    return res.json({
      success: false,
      message: '请提供学号和密码'
    });
  }
  
  try {
    logWithTimestamp(`🚀 开始处理请求：学号=${studentId}`, 'INFO');
    const result = await fetchDataByType(studentId, password, 'exam', randnumber);
    logWithTimestamp(`✅ 请求处理完成，返回 ${result.examCount} 条考试数据`, 'INFO');
    
    res.json(result);
    
  } catch (error) {
    logWithTimestamp(`❌ 接口处理出错: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    res.json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
});

// 成绩数据接口
app.post('/api/grade', async (req, res) => {
  const { studentId, password, randnumber = '' } = req.body;
  
  logWithTimestamp('📥 收到成绩数据请求', 'INFO');
  
  if (!studentId || !password) {
    logWithTimestamp('❌ 请求参数不完整，缺少学号或密码', 'ERROR');
    return res.json({
      success: false,
      message: '请提供学号和密码'
    });
  }
  
  try {
    logWithTimestamp(`🚀 开始处理请求：学号=${studentId}`, 'INFO');
    const result = await fetchDataByType(studentId, password, 'grade', randnumber);
    logWithTimestamp(`✅ 请求处理完成，返回 ${result.gradeCount} 条成绩数据`, 'INFO');
    
    res.json(result);
    
  } catch (error) {
    logWithTimestamp(`❌ 接口处理出错: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    res.json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
});

// 课表数据接口
app.post('/api/schedule', async (req, res) => {
  const { studentId, password, randnumber = '' } = req.body;
  
  logWithTimestamp('📥 收到课表数据请求', 'INFO');
  
  if (!studentId || !password) {
    logWithTimestamp('❌ 请求参数不完整，缺少学号或密码', 'ERROR');
    return res.json({
      success: false,
      message: '请提供学号和密码'
    });
  }
  
  try {
    logWithTimestamp(`🚀 开始处理请求：学号=${studentId}`, 'INFO');
    const result = await fetchDataByType(studentId, password, 'schedule', randnumber);
    logWithTimestamp(`✅ 请求处理完成，返回 ${result.scheduleCount} 条课表数据`, 'INFO');
    
    res.json(result);
    
  } catch (error) {
    logWithTimestamp(`❌ 接口处理出错: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    res.json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
});

// 通用数据接口（支持多种数据类型）
app.post('/api/data', async (req, res) => {
  const { studentId, password, dataType, randnumber = '' } = req.body;
  
  logWithTimestamp(`📥 收到${dataType}数据请求`, 'INFO');
  
  if (!studentId || !password || !dataType) {
    logWithTimestamp('❌ 请求参数不完整，缺少学号、密码或数据类型', 'ERROR');
    return res.json({
      success: false,
      message: '请提供学号、密码和数据类型（exam, grade, schedule）'
    });
  }
  
  try {
    logWithTimestamp(`🚀 开始处理请求：学号=${studentId}，数据类型=${dataType}`, 'INFO');
    const result = await fetchDataByType(studentId, password, dataType, randnumber);
    logWithTimestamp(`✅ 请求处理完成，返回 ${result[dataType + 'Count']} 条${dataType}数据`, 'INFO');
    
    res.json(result);
    
  } catch (error) {
    logWithTimestamp(`❌ 接口处理出错: ${error.message}`, 'ERROR');
    logWithTimestamp(`❌ 错误详情: ${error.stack}`, 'ERROR');
    res.json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  const startTime = new Date().toLocaleString();
  console.log(`\n✅ 后端服务已启动！`);
  console.log(`📅 启动时间：${startTime}`);
  console.log(`🌐 支持API端点：`);
  console.log(`   - 新版考试查询：http://localhost:${PORT}/api/queryExam`);
  console.log(`   - 旧版考试数据：http://localhost:${PORT}/api/exam`);
  console.log(`   - 成绩查询：http://localhost:${PORT}/api/grade`);
  console.log(`   - 课表查询：http://localhost:${PORT}/api/schedule`);
  console.log(`   - 通用数据接口：http://localhost:${PORT}/api/data`);
  console.log(`📋 支持功能：考试安排、成绩、课表数据爬取`);
  console.log(`🔒 安全特性：`);
  console.log(`   - 严格登录校验：只有真实登录教务系统成功后才返回数据`);
  console.log(`   - 真实数据获取：直接从教务系统爬取真实数据`);
  console.log(`   - 人类行为模拟：符合真实用户操作习惯的延迟和间隔`);
  console.log(`   - 完整HTML表单支持：包含所有必要的隐藏字段`);
  console.log(`📝 日志特性：每一步操作都有详细的时间戳和操作描述`);
  console.log(`🔧 技术优化：已修复axios-cookiejar-support和wrapper函数错误`);
  console.log(`🚫 验证码支持：支持免验证码登录和验证码登录`);
  console.log(`🎯 登录流程：严格按照实际登录页JS实现密码加密和登录请求`);
  console.log('\n');
});
