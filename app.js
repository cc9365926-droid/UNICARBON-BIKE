// 全域變數
let bluetoothDevice = null;
let gattServer = null;
let isRiding = false;
let rideTimer = null;
let rideTimeInSeconds = 0;
let rpm = 0;
let totalKwh = 0;
let totalCoins = 0;

// 1. 藍芽連接邏輯 (Web Bluetooth API)
async function connectBluetooth() {
    const statusBadge = document.getElementById("statusBadge");
    try {
        statusBadge.innerHTML = '<span class="dot"></span> 搜尋裝置中...';
        
        // 搜尋單車速頻感應器 (Cycling Speed and Cadence Service)
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['cycling_speed_and_cadence'] }]
        });

        gattServer = await bluetoothDevice.gatt.connect();
        
        statusBadge.classList.add("connected");
        statusBadge.innerHTML = '<span class="dot"></span> 已連接感應器';
        alert("藍芽感應器連接成功！");
    } catch (error) {
        console.error("藍芽連接失敗:", error);
        statusBadge.classList.remove("connected");
        statusBadge.innerHTML = '<span class="dot"></span> 未連接藍芽';
        alert("連接失敗或取消連線，將切換為模擬模式（測試用）。");
    }
}

// 2. 切換騎行狀態 (開始 / 結束)
function toggleRide() {
    const startBtn = document.getElementById("startBtn");

    if (!isRiding) {
        // 開始騎行
        isRiding = true;
        startBtn.innerHTML = '<i class="fa-solid fa-square"></i> 結束騎行';
        startBtn.className = "btn btn-danger";
        
        // 開始計時與數據更新
        rideTimer = setInterval(updateMetrics, 1000);
    } else {
        // 結束騎行
        isRiding = false;
        clearInterval(rideTimer);

        // 彈出 QR Code 視窗
        generateQRCode();

        // 按鈕復原
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 開始騎行';
        startBtn.className = "btn btn-start";
    }
}

// 3. 數據計算邏輯 (每秒更新)
function updateMetrics() {
    rideTimeInSeconds++;

    // 模擬踏頻 (RPM) 與電量計算 (若無實體藍芽則給予模擬值)
    rpm = isRiding ? Math.floor(Math.random() * (85 - 60 + 1)) + 60 : 0;
    
    // 假設發電功率與踏頻成正比 (約 50W~100W)，換算每秒發電量 (kWh)
    const currentWatts = (rpm / 80) * 75; // 平均 75W
    const kwhThisSecond = (currentWatts / 1000) / 3600;
    totalKwh += kwhThisSecond;

    // 🎯 換算碳幣：1 kWh = 20000 碳幣 (正常騎行 1 分鐘約獲得 25 個碳幣)
    totalCoins = totalKwh * 20000;

    // 顯示於 UI 畫面
    document.getElementById("timeDisplay").innerText = formatTime(rideTimeInSeconds);
    document.getElementById("rpmDisplay").innerText = rpm;
    document.getElementById("energyDisplay").innerHTML = `${totalKwh.toFixed(4)} <small>kWh</small>`;
    document.getElementById("calorieDisplay").innerHTML = `${Math.round(totalKwh * 860)} <small>kcal</small>`;
    document.getElementById("coinsDisplay").innerText = `+${totalCoins.toFixed(1)}`;
}

// 時間格式化 (格式 mm:ss)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// 4. 生成二維碼 (完全符合 Glide 的標準 JSON 格式)
function generateQRCode() {
    // 建立二維碼數據物件 (無 timestamp，防 iPhone 誤判為電話)
    const sessionData = {
        "bike_id": "BIKE-01",
        "duration_sec": rideTimeInSeconds,
        "kwh_saved": parseFloat(totalKwh.toFixed(4)),
        "coins": parseFloat(totalCoins.toFixed(1))
    };

    const jsonString = JSON.stringify(sessionData);

    // 清空並重新生成 QR Code
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
        text: jsonString,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // 更新彈窗內的數據摘要
    document.getElementById("summaryTime").innerText = formatTime(rideTimeInSeconds);
    document.getElementById("summaryEnergy").innerText = `${totalKwh.toFixed(4)} kWh`;
    document.getElementById("summaryCoins").innerText = `+${totalCoins.toFixed(1)}`;

    // 顯示 Modal 彈窗
    document.getElementById("qrOverlay").style.display = "flex";
}

// 5. 關閉 QR Code 視窗並重置數據 (下一位使用者)
function closeQR() {
    document.getElementById("qrOverlay").style.display = "none";
    
    // 重置變數與 UI
    rideTimeInSeconds = 0;
    totalKwh = 0;
    totalCoins = 0;
    rpm = 0;

    document.getElementById("timeDisplay").innerText = "00:00";
    document.getElementById("rpmDisplay").innerText = "0";
    document.getElementById("energyDisplay").innerHTML = `0.0000 <small>kWh</small>`;
    document.getElementById("calorieDisplay").innerHTML = `0 <small>kcal</small>`;
    document.getElementById("coinsDisplay").innerText = "+0.0";
}
