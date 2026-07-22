let isRiding = false;
let seconds = 0;
let timer = null;
let currentRpm = 0;
let bluetoothDevice = null;

const POWER_KW = 0.075; // 估算騎行功率 ~75W

// 1. Web Bluetooth 連接腳踏感應器 (CSCS 標準 0x1816)
async function connectBluetooth() {
    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['cycling_speed_and_cadence'] }]
        });

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService('cycling_speed_and_cadence');
        const characteristic = await service.getCharacteristic('csc_measurement');

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleBluetoothData);

        const badge = document.getElementById('statusBadge');
        badge.className = 'status-badge connected';
        badge.innerHTML = '<span class="dot"></span> 藍芽感應器已連線';
        alert('藍芽感應器連接成功！');
    } catch (error) {
        console.log('Bluetooth connection error:', error);
        alert('連接失敗或取消。若在 Demo 時，可使用模擬運動模式！');
    }
}

// 解析藍芽數據 (計算踏頻 RPM)
let lastCrankRevolutions = 0;
let lastCrankEventTime = 0;

function handleBluetoothData(event) {
    const value = event.target.value;
    // 讀取踏頻數值 (依照 CSCS 規範解析)
    let cumulativeRevolutions = value.getUint16(1, true);
    let lastEventTime = value.getUint16(3, true);

    if (lastCrankEventTime !== 0 && lastEventTime !== lastCrankEventTime) {
        let revDiff = cumulativeRevolutions - lastCrankRevolutions;
        let timeDiff = (lastEventTime - lastCrankEventTime) / 1024; // 轉為秒
        if (timeDiff > 0) {
            currentRpm = Math.round((revDiff / timeDiff) * 60);
            document.getElementById('rpmDisplay').innerText = currentRpm;
        }
    }
    lastCrankRevolutions = cumulativeRevolutions;
    lastCrankEventTime = lastEventTime;
}

// 2. 開始 / 結束騎行控制
function toggleRide() {
    const startBtn = document.getElementById('startBtn');
    const badge = document.getElementById('statusBadge');

    if (!isRiding) {
        // 開始騎行
        isRiding = true;
        startBtn.innerText = '結束騎行領取碳幣';
        startBtn.className = 'btn btn-danger';
        badge.innerHTML = '⚡ 騎行發電中...';

        timer = setInterval(updateMetrics, 1000);
    } else {
        // 結束騎行，跳出二維碼
        finishRide();
    }
}

// 3. 每秒更新統計數據
function updateMetrics() {
    seconds++;

    // 時間
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    document.getElementById('timeDisplay').innerText = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // 如果沒有連藍芽，自動模擬踏頻 RPM (60-75)
    if (!bluetoothDevice) {
        currentRpm = Math.floor(Math.random() * 15) + 60;
        document.getElementById('rpmDisplay').innerText = currentRpm;
    }

    // 計算 kWh
    let hours = seconds / 3600;
    let kwh = hours * POWER_KW;
    document.getElementById('energyDisplay').innerHTML = `${kwh.toFixed(4)} <span class="unit">kWh</span>`;

    // 卡路里
    let calories = Math.floor(seconds * 0.15);
    document.getElementById('calorieDisplay').innerHTML = `${calories} <span class="unit">kcal</span>`;

    // 碳幣公式
    let coins = (seconds / 60 * 1) + (kwh * 20);
    document.getElementById('coinsDisplay').innerText = `+${coins.toFixed(1)}`;
}

// 4. 結束騎行，生成二維碼
function finishRide() {
    clearInterval(timer);
    isRiding = false;

    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    let timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    let kwh = (seconds / 3600 * POWER_KW).toFixed(4);
    let coins = ((seconds / 60 * 1) + (kwh * 20)).toFixed(1);

    // 填充視窗內容
    document.getElementById('summaryTime').innerText = timeStr;
    document.getElementById('summaryEnergy').innerText = `${kwh} kWh`;
    document.getElementById('summaryCoins').innerText = `+${coins} 碳幣`;

    // 生成給 UNI Carbon App 掃描的二維碼 Payload (JSON 格式)
    let sessionData = {
        station: "BIKE_01",
        timestamp: Date.now(),
        duration_sec: seconds,
        kwh_saved: parseFloat(kwh),
        coins: parseFloat(coins)
    };

    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), {
        text: JSON.stringify(sessionData),
        width: 160, height: 160,
        colorDark : "#0f172a", colorLight : "#ffffff"
    });

    document.getElementById('qrOverlay').style.display = 'flex';
}

function closeQR() {
    document.getElementById('qrOverlay').style.display = 'none';
    location.reload(); // 重置畫面
}