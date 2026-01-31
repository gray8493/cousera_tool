// --- Skipera Extension Sidepanel Script (ULTRON 10.0 - PRO BINDING) ---
// 🔑 VERSION 10.0: LICENSE BINDING TO COURSERA USER ID
// 🛡️ ONE KEY = ONE USER = 30 DAYS

const translations = {
    en: {
        nav_auto: "Auto", nav_config: "Config", nav_pro: "Pro",
        course_control: "Course Control", course_slug_label: "Course Slug/URL",
        watch_videos: "Watch Videos (PRO)", solve_quizzes: "Solve Quizzes (AI) (PRO)", read_supplements: "Read Supplements (PRO)",
        start_automation_btn: "Start Automation", status_title: "Status", status_ready: "Ready to start...",
        credentials_title: "Credentials", cookies_hint: "Cookies auto-detected. Click 'Config' to refresh.",
        gemini_key_label: "Gemini API Key", cauth_label: "CAUTH Token", csrf_label: "CSRF3 Token",
        save_settings_btn: "Save Settings", refresh_cookies_btn: "🔄 Refresh Cookies",
        activate_pro_title: "Activate PRO Features", activate_pro_desc: "Unlock AI Quiz solving for 30 days.",
        price_period: "/30 days", license_key_label: "Enter License Key", activate_btn: "Activate Now",
        alert_save_success: "Settings saved!", alert_invalid_key: "Invalid key! Contact Zalo 0837.474.615",
        alert_please_enter_key: "Please enter key!", status_key_checking: "Checking...",
        status_key_success: "✅ Activated!", status_key_fail: "❌ Failed: Invalid code.",
        status_cookies_searching: "Searching...", status_cookies_success: "✅ Cookies found.",
        status_cookies_fail: "⚠️ No cookies found.", ai_warning: "⚠️ Note: AI answers can be wrong."
    },
    vi: {
        nav_auto: "Tự động", nav_config: "Cài đặt", nav_pro: "Bản PRO",
        course_control: "Điều khiển khóa học", course_slug_label: "Slug/URL Khóa học",
        watch_videos: "Xem Video (PRO)", solve_quizzes: "Giải Quiz (AI) (PRO)", read_supplements: "Đọc tài liệu (PRO)",
        start_automation_btn: "Bắt đầu chạy", status_title: "Trạng thái", status_ready: "Sẵn sàng...",
        credentials_title: "Thông tin xác thực", cookies_hint: "Cookie tự động nhận diện. Nhấn 'Cài đặt' để làm mới.",
        gemini_key_label: "Gemini API Key", cauth_label: "CAUTH Token", csrf_label: "CSRF3 Token",
        save_settings_btn: "Lưu cài đặt", refresh_cookies_btn: "🔄 Làm mới Cookie",
        activate_pro_title: "Kích hoạt PRO", activate_pro_desc: "Mở khóa giải Quiz bằng AI và Peer Assignment.",
        price_period: "/30 ngày", license_key_label: "Nhập mã kích hoạt (Key)", activate_btn: "Kích hoạt ngay",
        alert_save_success: "Đã lưu cài đặt!", alert_invalid_key: "Mã sai! Liên hệ Zalo 0837.474.615",
        alert_please_enter_key: "Vui lòng nhập mã!", status_key_checking: "Đang kiểm tra...",
        status_key_success: "✅ Thành công!", status_key_fail: "❌ Thất bại: Mã sai.",
        status_cookies_searching: "Đang tìm cookie...", status_cookies_success: "✅ Đã tìm thấy cookie.",
        status_cookies_fail: "⚠️ Không thấy cookie.", ai_warning: "⚠️ Lưu ý: Đáp án AI có thể sai."
    }
};

let currentLang = 'en';
const safeGet = (id) => document.getElementById(id);
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const startBtn = safeGet('start-btn');
const saveBtn = safeGet('save-settings');
const activateBtn = safeGet('activate-btn');
const refreshCookiesBtn = safeGet('refresh-cookies');
const statusDisplay = safeGet('status-display');
const licenseStatus = safeGet('license-status');
const displayUserId = safeGet('display-user-id');
const userIdTexts = document.querySelectorAll('.user-id-text');
const slugInput = safeGet('course-slug');
const geminiKeyInput = safeGet('gemini-key');
const geminiModelInput = safeGet('gemini-model');
const cauthtokenInput = safeGet('cauth-token');
const csrfTokenInput = safeGet('csrf-token');
const licenseKeyInput = safeGet('license-key');
const skipVideoCheckbox = safeGet('skip-video');
const solveQuizCheckbox = safeGet('solve-quiz');
const readSupplementCheckbox = safeGet('read-supplement');

let currentUserId = null;

function updateLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) el.innerText = translations[lang][key];
    });
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-lang') === lang));
    chrome.storage.local.set({ language: lang });
}

function logStatus(text) {
    if (!statusDisplay) return;
    const time = new Date().toLocaleTimeString();
    statusDisplay.innerHTML += `<div>[${time}] ${text}</div>`;
    statusDisplay.scrollTop = statusDisplay.scrollHeight;
}

function checkExpiry(data) {
    if (!activateBtn || !licenseStatus) return;
    if (data.isPro && data.expiryDate) {
        const now = Date.now();
        // ID BINDING CHECK
        if (data.boundUserId && currentUserId && currentUserId !== data.boundUserId) {
            licenseStatus.innerHTML = `<span style="color: #ef4444;">❌ ID Mismatch: Key used for ${data.boundUserId}</span>`;
            activateBtn.disabled = false;
            return;
        }

        if (now > data.expiryDate) {
            chrome.storage.local.set({ isPro: false });
            licenseStatus.innerText = translations[currentLang].status_key_fail;
            activateBtn.disabled = false;
        } else {
            const daysLeft = Math.ceil((data.expiryDate - now) / (1000 * 60 * 60 * 24));
            licenseStatus.innerHTML = `<span style="color: #10b981;">✅ PRO: ${daysLeft} days remaining</span>`;
            activateBtn.innerText = "Activated";
            activateBtn.disabled = true;
        }
    }
}

function updateUserIdUI(userId) {
    if (!userId) return;
    currentUserId = userId;
    if (displayUserId) displayUserId.innerText = userId;
    userIdTexts.forEach(el => el.innerText = userId);
}

saveBtn?.addEventListener('click', () => {
    chrome.storage.local.set({
        geminiKey: geminiKeyInput.value,
        geminiModel: geminiModelInput.value,
        cauthToken: cauthtokenInput.value,
        csrfToken: csrfTokenInput.value
    }, () => alert(translations[currentLang].alert_save_success));
});

activateBtn?.addEventListener('click', async () => {
    const key = licenseKeyInput.value.trim();
    if (!key) return alert(translations[currentLang].alert_please_enter_key);

    // Ensure we have User ID before activating
    if (!currentUserId) {
        alert("Please login to Coursera first to detect User ID.");
        return;
    }

    logStatus(translations[currentLang].status_key_checking);

    // VALID_KEYS is imported from keys.js
    if (typeof VALID_KEYS !== 'undefined' && VALID_KEYS.includes(key)) {
        const expiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
        chrome.storage.local.set({
            licenseKey: key,
            isPro: true,
            expiryDate: expiry,
            boundUserId: currentUserId // 🔑 BINDING HAPPENS HERE
        }, () => {
            alert("Success! Pro Activated.");
            checkExpiry({ isPro: true, expiryDate: expiry, boundUserId: currentUserId });
        });
    } else {
        alert(translations[currentLang].alert_invalid_key);
    }
});

startBtn?.addEventListener('click', () => {
    const slug = slugInput.value.trim();
    if (!slug) return alert("Enter Slug!");
    startBtn.disabled = true;
    startBtn.innerText = "...";
    chrome.runtime.sendMessage({
        action: 'startAutomation',
        config: { slug, skipVideo: skipVideoCheckbox.checked, solveQuiz: solveQuizCheckbox.checked, readSupplement: readSupplementCheckbox.checked }
    });
});

refreshCookiesBtn?.addEventListener('click', detectCookies);

function detectCookies() {
    logStatus(translations[currentLang].status_cookies_searching);
    chrome.cookies.getAll({ domain: 'coursera.org' }, (cookies) => {
        const cauth = cookies.find(c => c.name === 'CAUTH');
        const csrf = cookies.find(c => c.name === 'CSRF3-Token');
        const extId = cookies.find(c => c.name === 'externalId');

        if (cauth) cauthtokenInput.value = cauth.value;
        if (csrf) csrfTokenInput.value = csrf.value;
        if (extId) updateUserIdUI(extId.value);

        if (cauth || csrf) {
            chrome.storage.local.set({
                cauthToken: (cauth ? cauth.value : ''),
                csrfToken: (csrf ? csrf.value : ''),
            });
            logStatus(translations[currentLang].status_cookies_success);
        } else {
            logStatus(translations[currentLang].status_cookies_fail);
        }
    });
}

chrome.storage.local.get(null, (data) => {
    updateLanguage(data.language || 'en');
    if (data.geminiKey) geminiKeyInput.value = data.geminiKey;
    if (data.geminiModel) geminiModelInput.value = data.geminiModel;
    if (data.cauthToken) cauthtokenInput.value = data.cauthToken;
    if (data.csrfToken) csrfTokenInput.value = data.csrfToken;

    // Need to detect cookies first to get currentUserId
    chrome.cookies.getAll({ domain: 'coursera.org' }, (cookies) => {
        const extId = cookies.find(c => c.name === 'externalId');
        if (extId) updateUserIdUI(extId.value);
        checkExpiry(data);
        detectCookies();
    });
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'statusUpdate') logStatus(msg.text);
    if (msg.type === 'automationFinished' || msg.type === 'error') {
        startBtn.disabled = false;
        startBtn.innerText = translations[currentLang].start_automation_btn;
    }
});

navBtns.forEach(btn => btn.addEventListener('click', () => {
    tabContents.forEach(c => c.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    safeGet(btn.dataset.tab)?.classList.add('active');
}));

document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', () => updateLanguage(btn.dataset.lang)));