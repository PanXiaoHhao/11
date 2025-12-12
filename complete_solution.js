const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const md5 = require('md5');

// 创建Express应用
const app = express();
app.use(cors());
app.use(express.json());

// 1. 正确配置axios实例，解决wrapper is not a function错误
// 注意：不同版本的axios-cookiejar-support使用方式不同
// 对于旧版本（如1.0.1），需要使用以下方式
const axiosCookieJarSupport = require('axios-cookiejar-support');
axiosCookieJarSupport(axios); // 增强axios实例，使其支持cookiejar

/**
 * 创建带Cookie的axios实例
 * 解决cookie持久化问题，确保登录状态能保持
 */
function createAxiosInstance() {
  const jar = new CookieJar();
  
  const instance = axios.create({
    timeout: 15000,
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action'
    },
    jar: jar // 关联Cookie容器
  });
  
  return { instance, jar };
}

/**
 * 从登录页提取关键凭证（lt和execution）
 * 解决“凭证已失效”问题
 * @param {Object} instance - 带Cookie的axios实例
 * @returns {Object} 包含lt和execution的登录参数
 */
async function getLoginParams(instance) {
  const loginPageUrl = 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action';
  
  try {
    console.log('📌 访问登录页获取凭证...');
    const response = await instance.get(loginPageUrl);
    const $ = cheerio.load(response.data);
    
    // 关键：准确提取lt和execution参数
    // 注意：不同版本的CAS系统可能有不同的选择器
    const lt = $('input[name="lt"]').val() || '';
    const execution = $('input[name="execution"]').val() || '';
    
    console.log('📌 提取到的登录参数：');
    console.log('   - lt：', lt);
    console.log('   - execution：', execution);
    
    if (!lt || !execution) {
      throw new Error('未获取到lt或execution参数，可能登录页结构已变更');
    }
    
    return { lt, execution, _eventId: 'submit' }; // _eventId固定为submit
    
  } catch (error) {
    console.error('❌ 提取登录参数失败:', error);
    throw new Error('获取登录凭证失败，请检查网络或登录页地址');
  }
}

/**
 * 密码加密函数
 * 根据登录页JS逻辑实现，这里简化为MD5加密
 * @param {string} password - 原始密码
 * @returns {string} 加密后的密码
 */
function encryptPassword(password) {
  // 根据实际登录页JS逻辑实现
  // 大多数KINGOSOFT系统使用MD5加密，且可能需要转大写
  const encryptedPwd = md5(password).toUpperCase();
  console.log('📌 密码加密结果：', encryptedPwd);
  return encryptedPwd;
}

/**
 * 执行登录
 * @param {string} studentId - 学号
 * @param {string} password - 密码
 * @returns {Object} 登录结果
 */
async function login(studentId, password) {
  const { instance } = createAxiosInstance();
  
  try {
    // 步骤1：获取动态登录参数
    console.log('📌 第一步：获取动态登录参数');
    const loginParams = await getLoginParams(instance);
    
    // 步骤2：加密密码
    console.log('📌 第二步：加密密码');
    const encryptedPwd = encryptPassword(password);
    
    // 步骤3：提交登录请求
    console.log('📌 第三步：提交登录请求');
    const loginUrl = 'http://jwgl.rzvtc.cn:8081/rzzyjw/j_spring_security_check';
    
    const response = await instance.post(loginUrl, new URLSearchParams({
      j_username: studentId,
      j_password: encryptedPwd,
      ...loginParams // 携带lt、execution等关键凭证
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action'
      },
      maxRedirects: 0 // 禁止自动重定向，便于判断登录结果
    });
    
    console.log('📌 登录响应状态码：', response.status);
    
    // 登录成功的判断：状态码302（重定向到首页）
    const isSuccess = response.status === 302;
    console.log('📌 登录是否成功：', isSuccess);
    
    if (isSuccess) {
      console.log('✅ 登录成功！');
      return { success: true, instance };
    } else {
      console.error('❌ 登录失败：账号或密码错误');
      return { success: false, message: '登录失败：账号或密码错误' };
    }
    
  } catch (error) {
    console.error('❌ 登录过程出错:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 爬取考试安排数据
 * @param {Object} instance - 登录后的axios实例
 * @returns {Array} 考试数据列表
 */
async function fetchExamData(instance) {
  try {
    console.log('📌 第四步：爬取考试数据');
    
    // 考试安排页面URL
    const examUrl = 'http://jwgl.rzvtc.cn:8081/rzzyjw/student/exam/arrange/list.action';
    
    const response = await instance.get(examUrl, {
      headers: {
        'Referer': 'http://jwgl.rzvtc.cn:8081/rzzyjw/cas/login.action'
      }
    });
    
    console.log('📌 考试数据请求成功，状态码：', response.status);
    
    // 解析考试数据
    const $ = cheerio.load(response.data);
    const examList = [];
    
    // 关键：准确的表格选择器
    $('table tbody tr').each((index, element) => {
      const tds = $(element).find('td');
      if (tds.length >= 8) {
        examList.push({
          课程名称: $(tds[1]).text().trim(),
          学分: $(tds[2]).text().trim(),
          类别: $(tds[3]).text().trim(),
          考核方式: $(tds[4]).text().trim(),
          状态: $(tds[7]).text().trim()
        });
      }
    });
    
    console.log('📌 考试数据解析完成，共', examList.length, '条记录');
    return examList;
    
  } catch (error) {
    console.error('❌ 爬取考试数据失败:', error);
    return [];
  }
}

/**
 * 主函数：登录并获取考试数据
 * @param {string} studentId - 学号
 * @param {string} password - 密码
 * @returns {Object} 包含考试数据的结果
 */
async function getExamInfo(studentId, password) {
  // 1. 登录
  const loginResult = await login(studentId, password);
  if (!loginResult.success) {
    return { success: false, message: loginResult.message };
  }
  
  // 2. 爬取考试数据
  const examData = await fetchExamData(loginResult.instance);
  
  return {
    success: true,
    examCount: examData.length,
    examList: examData
  };
}

// API接口
app.post('/api/exam', async (req, res) => {
  const { studentId, password } = req.body;
  
  if (!studentId || !password) {
    return res.json({
      success: false,
      message: '请提供学号和密码'
    });
  }
  
  try {
    console.log('=== 收到请求，开始处理 ===');
    const result = await getExamInfo(studentId, password);
    console.log('=== 请求处理完成 ===');
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ 接口处理出错:', error);
    res.json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ 后端已启动！地址：http://localhost:${PORT}/api/exam`);
  console.log('✅ 支持：考试安排数据爬取');
  console.log('✅ 严格登录校验：只有真实登录教务系统成功后才返回数据');
  console.log('✅ 真实数据：直接从教务系统爬取真实考试数据');
  console.log('✅ 详细日志：每一步操作都有可追溯的日志记录');
});
