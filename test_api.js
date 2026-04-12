// 載入 Node.js 內建的 fetch (需 Node 18+)
// 若執行有問題，請確保您的 Node.js 版本夠新

async function testApi() {
  const url = 'http://125.229.183.169:3001/api/layout';
  
  console.log(`[測試 1] 呼叫 ${url} 取得【目前時間 時盤】...`);
  try {
    const res1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartType: 'hour', timeMode: 'now' })
    });
    const data1 = await res1.json();
    console.log('✅ 時盤結果 (文字版排版):');
    console.log(data1.visualText);
    console.log('--------------------------------------------------\n');
  } catch (err) {
    console.error('❌ 時盤測試失敗:', err.message);
  }

  console.log(`[測試 2] 呼叫 ${url} 取得【指定時間 日盤 (2026-03-31)】...`);
  try {
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartType: 'day', timeMode: 'custom', datetime: '2026-03-23T17:05:00' })
    });
    const data2 = await res2.json();
    console.log('✅ 日盤結果 (文字版排版):');
    console.log(data2.visualText);
    console.log('--------------------------------------------------\n');
  } catch (err) {
    console.error('❌ 日盤測試失敗:', err.message);
  }
}

testApi();
