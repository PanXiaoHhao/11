const axios = require('axios');

// API测试脚本
async function testAPI() {
  console.log('=== 开始API测试 ===\n');
  
  const baseURL = 'http://localhost:3000/api/exam';
  const testData = {
    studentId: '123456',
    password: 'password123'
  };
  
  try {
    // 测试1：基本请求（无筛选条件）
    console.log('测试1：基本请求（无筛选条件）');
    const response1 = await axios.post(baseURL, testData);
    console.log(`结果：${response1.data.exam.length}条考试安排, ${response1.data.makeUp.length}条补课安排`);
    console.log('状态:', response1.data.success ? '成功' : '失败');
    console.log('消息:', response1.data.message || '无消息');
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试2：按学年学期筛选
    console.log('测试2：2025-2026学年第1学期');
    const response2 = await axios.post(baseURL, {
      ...testData,
      year: '2025-2026',
      semester: '1'
    });
    console.log(`结果：${response2.data.exam.length}条考试安排, ${response2.data.makeUp.length}条补课安排`);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试3：按考试类型筛选
    console.log('测试3：正常考试');
    const response3 = await axios.post(baseURL, {
      ...testData,
      examType: '正常考试'
    });
    console.log(`结果：${response3.data.exam.length}条考试安排, ${response3.data.makeUp.length}条补课安排`);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试4：组合筛选 - 2025-2026学年第1学期的正常考试
    console.log('测试4：2025-2026-1正常考试');
    const response4 = await axios.post(baseURL, {
      ...testData,
      year: '2025-2026',
      semester: '1',
      examType: '正常考试'
    });
    console.log(`结果：${response4.data.exam.length}条考试安排, ${response4.data.makeUp.length}条补课安排`);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试5：组合筛选 - 2024-2025学年第2学期
    console.log('测试5：2024-2025-2所有考试类型');
    const response5 = await axios.post(baseURL, {
      ...testData,
      year: '2024-2025',
      semester: '2'
    });
    console.log(`结果：${response5.data.exam.length}条考试安排, ${response5.data.makeUp.length}条补课安排`);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试6：按补课类型筛选
    console.log('测试6：补课安排');
    const response6 = await axios.post(baseURL, {
      ...testData,
      examType: '补课'
    });
    console.log(`结果：${response6.data.exam.length}条考试安排, ${response6.data.makeUp.length}条补课安排`);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 测试7：按缓考类型筛选
    console.log('测试7：缓考安排');
    const response7 = await axios.post(baseURL, {
      ...testData,
      examType: '缓考'
    });
    console.log(`结果：${response7.data.exam.length}条考试安排, ${response7.data.makeUp.length}条补课安排`);
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('=== API测试完成 ===');
    console.log('所有测试请求已发送，检查结果是否符合预期');
    
  } catch (error) {
    console.error('测试过程中出现错误:', error.message);
    console.error('错误详情:', error.response ? error.response.data : error);
  }
}

testAPI();
