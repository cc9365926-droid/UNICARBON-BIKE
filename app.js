/**
 * UniCarbon Power - 單車發電儀表板核心邏輯
 * 包含：Web Bluetooth 藍芽感應器連線、發電量與碳幣計算、QR Code 生成
 */

// ==================== 全域狀態管理 ====================
const CONFIG = {
    BIKE_ID: "BIKE-01",
    COIN_MULTIPLIER: 20000, // 🎯 1 kWh = 20000 碳幣 (1 分鐘正常騎行約可獲得 ~25 個碳幣)
    AVG_WATTS: 75           // 預設發電功率 (瓦特 W)
};

let bluetoothDevice = null;
let gattServer = null;
let isRiding = false;
let rideTimer = null;

// 騎行數據變數
let rideTimeInSeconds = 0;
let rpm = 0;
let totalKwh = 0;
let totalCoins = 0;

// ==================== 1. 藍芽連線邏輯 ====================
async function connectBluetooth() {
    const statusBadge = document.getElementById("statusBadge");
    try {
        if (!statusBadge) return;
        statusBadge.innerHTML = '<span class="dot"></span> 搜尋裝置中...';

        // 請求單車踏頻感應器 (Cycling Speed and Cadence Service)
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['cycling_speed_and_cadence'] }]
        });

        gattServer = await bluetoothDevice.gatt.connect();

        statusBadge.classList.add("connected");
        statusBadge.innerHTML = '<span class="dot"></span> 已連接感應器';
        alert("🎉 藍芽感應器連線成功！");
    } catch (error) {
        console.warn("藍芽連線未完成:", error);
        if (statusBadge) {
            statusBadge.classList.remove("connected");
            statusBadge.innerHTML = '<span class="dot"></span> 未連接藍芽';
        }
        alert("未連接藍芽感應器，系統將切換為模擬測試模式。");
    }
}

// ==================== 2. 騎行狀態切換 ====================
function toggleRide() {
    const startBtn = document.getElementById("startBtn");
    if (!startBtn) return;

    if (!isRiding) {
        // --- 開始騎行 ---
        isRiding = true;
        startBtn.innerHTML = '<i class="fa-solid fa-square"></i> 結束騎行';
        startBtn.className = "btn btn-danger";

        // 每秒觸發一次數據更新
        rideTimer = setInterval(updateMetrics, 1000);
    } else {
        // --- 結束騎行 ---
        isRiding = false;
        clearInterval(rideTimer);

        // 產生 QR Code 彈窗
        generateQRCode();

        // 恢復按鈕狀態
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 開始騎行';
        startBtn.className = "btn btn-start";
    }
}

// ==================== 3. 數據計算與 UI 更新 ====================
function updateMetrics() {
    rideTimeInSeconds++;

    // 踏頻 (RPM) 模擬計算 (60~85 RPM)
    rpm = isRiding ? Math.floor(Math.random() * (85 - 60 + 1)) + 60 : 0;

    // 發電量計算：功率(W) / 1000 = kW，再除以 3600 秒得到這秒的 kWh
    const currentWatts = (rpm / 80) * CONFIG.AVG_WATTS;
    const kwhThisSecond = (currentWatts / 1000) / 3600;
    totalKwh += kwhThisSecond;

    // 🎯 碳幣換算公式：根據發電量乘以 20000 (1 分鐘約 0.00125 kWh = 約 25 碳幣)
    totalCoins = totalKwh * CONFIG.COIN_MULTIPLIER;

    // 更新畫面顯示
    updateUI();
}

function updateUI() {
    const timeElem = document.getElementById("timeDisplay");
    const rpmElem = document.getElementById("rpmDisplay");
    const energyElem = document.getElementById("energyDisplay");
    const calorieElem = document.getElementById("calorieDisplay");
    const coinsElem = document.getElementById("coinsDisplay");

    if (timeElem) timeElem.innerText = formatTime(rideTimeInSeconds);
    if (rpmElem) rpmElem.innerText = rpm;
    if (energyElem) energyElem.innerHTML = `${totalKwh.toFixed(4)} <small>kWh</small>`;
    if (calorieElem) calorieElem.innerHTML = `${Math.round(totalKwh * 860)} <small>kcal</small>`;
    if (coinsElem) coinsElem.innerText = `+${totalCoins.toFixed(1)}`;
}

// 時間格式化工具 (秒 -> MM:SS)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// ==================== 4. 生成 QR Code (Glide 專用 JSON 格式) ====================
function generateQRCode() {
    // 打包乾淨標準的 JSON 物件 (無 timestamp，防 iOS 誤判為電話選單)
    const sessionData = {
        "bike_id": CONFIG.BIKE_ID,
        "duration_sec": rideTimeInSeconds,
        "kwh_saved": parseFloat(totalKwh.toFixed(4)),
        "coins": parseFloat(totalCoins.toFixed(1))
    };

    const jsonString = JSON.stringify(sessionData);

    // 清空舊的二維碼圖片
    const qrContainer = document.getElementById("qrcode");
    if (qrContainer) {
        qrContainer.innerHTML = "";

        // 使用 QRCode.js 套件繪製二維碼
        new QRCode(qrContainer, {
            text: jsonString,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    // 更新彈窗內的數據摘要
    const summaryTime = document.getElementById("summaryTime");
    const summaryEnergy = document.getElementById("summaryEnergy");
    const summaryCoins = document.getElementById("summaryCoins");

    if (summaryTime) summaryTime.innerText = formatTime(rideTimeInSeconds);
    if (summaryEnergy) summaryEnergy.innerText = `${totalKwh.toFixed(4)} kWh`;
    if (summaryCoins) summaryCoins.innerText = `+${totalCoins.toFixed(1)}`;

    // 顯示 Modal 遮罩彈窗
    const qrOverlay = document.getElementById("qrOverlay");
    if (qrOverlay) qrOverlay.style.display = "flex";
}

// ==================== 5. 關閉彈窗並重置數據 ====================
function closeQR() {
    const qrOverlay = document.getElementById("qrOverlay");
    if (qrOverlay) qrOverlay.style.display = "none";

    // 重置所有變數
    rideTimeInSeconds = 0;
    totalKwh = 0;
    totalCoins = 0;
    rpm = 0;

    // 歸零 UI 畫面
    updateUI();
}
