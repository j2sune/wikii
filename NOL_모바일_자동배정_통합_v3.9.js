// ==UserScript==
// @name NOL 모바일 자동배정 통합
// @namespace nol-mobile-integrated
// @version 3.9
// @match https://tickets.interpark.com/*
// @match https://*.interpark.com/*
// @match https://nol.yanolja.com/*
// @grant none
// @run-at document-idle
// ==/UserScript==

(function () {
"use strict";

if (window.__NOL_MOBILE_V3__) return;
window.__NOL_MOBILE_V3__ = true;

// ===== 설정 =====
const preferredSections = [
"1루 서프라이즈석",
"3루 서프라이즈석",
"3루 응원특별석",
"3루 K9석",
"1루 K9석",
"3루 K8석",
"1루 K8석",
"3루 K5석",
"1루 K5석",
"3루 EV석",
"1루 EV석",
"1루 오렌지석",
"3루 오렌지석",
"1루 블루석",
"3루 블루석",
"1루 레드석",
"3루 레드석",
"1루 네이비석",
"3루 네이비석",
"중앙 네이비석",
"1루 그린지정석",
"1루 그린응원석",
"3루 그린지정석",
"3루 그린응원석"
];
const quantity = 1;
const timeout = 12000;
const totalDuration = 10 * 60 * 1000; // 10분
const DELAY = 100;
const AUTO_START = true;
const MAX_RETRY_PER_SECTION = 3; // ★ 같은 구역 최대 재시도 횟수

const SECTION = "button.SportsSeatGradeList_contentItem__i1kkb";
const NAME = ".SportsSeatGradeList_contentGradeName__sQHBT";
const REMAIN = ".SportsSeatGradeList_contentRemainCount__2HVZF";
const CARD = ".SeatCountBottomSheet_gradeCard__wdtQ3";
const CARD_NAME = ".SeatCountBottomSheet_gradeNameText__R5M_d";
const FAIL = ".AutoAssignFailDialog_container__KUcme";
const STORAGE_KEY = "nol_mobile_panel_v3";

let running = false;
let session = 0;
let round = 0;
let endTime = 0;
let panel, handle, info, logs, startBtn, stopBtn, foldBtn, content;
let folded = false;
let entrySoundPlayed = false;
let autoStartTriggered = false;
let lastNolClickTime = 0;
const recentLogs = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const visible = el => !!el && el.getClientRects().length > 0;
const active = id => running && session === id;

// ===== 소리 =====
function playSuccessSound(strong = false) {
try {
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const now = ctx.currentTime;
if (strong) {
[880, 1100, 1320].forEach((freq, i) => {
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.connect(gain);
gain.connect(ctx.destination);
osc.type = "sine";
osc.frequency.value = freq;
const start = now + i * 0.18;
gain.gain.setValueAtTime(0.0001, start);
gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
osc.start(start);
osc.stop(start + 0.28);
});
} else {
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.connect(gain);
gain.connect(ctx.destination);
osc.type = "sine";
osc.frequency.value = 740;
gain.gain.setValueAtTime(0.0001, now);
gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
osc.start(now);
osc.stop(now + 0.4);
}
} catch (e) {
console.warn("[NOL] 소리 실패", e);
}
}

// ===== 10분 타임아웃 다이얼로그 자동 확인 =====
function clickTimeoutDialog() {
const dialog = document.querySelector(".nds-e-dialog__container");
if (!dialog || !visible(dialog)) return false;

const title = dialog.querySelector(".nds-e-dialog__title");
if (!title) return false;

const titleText = title.textContent || "";
if (
!titleText.includes("좌석을 선택할 수 있는 시간") &&
!titleText.includes("10분이 종료")
) {
return false;
}

const confirmBtn = [...dialog.querySelectorAll("button")].find(
btn => btn.textContent.trim() === "확인" && !btn.disabled
);

if (confirmBtn && visible(confirmBtn)) {
console.log("[NOL] 10분 타임아웃 다이얼로그 감지 → 확인 클릭");
log("10분 타임아웃 → 확인 자동 클릭");
confirmBtn.click();
return true;
}
return false;
}

// ===== NOL 페이지: 예매하기 자동 클릭 (계속 감시) =====
function tryClickNolBooking() {
if (!location.href.includes("/ticket/genre/sports/postseason")) return false;

// 너무 자주 누르지 않도록 3초 쿨다운
if (Date.now() - lastNolClickTime < 3000) return false;

const buttons = [...document.querySelectorAll("button")].filter(
b => b.textContent.trim() === "예매하기" && !b.disabled && visible(b)
);

for (const btn of buttons) {
let parent = btn.parentElement;
let found = false;
let depth = 0;

while (parent && depth < 12) {
const text = parent.innerText || parent.textContent || "";
const hasDate =
text.includes("10월 20일") ||
text.includes("10월20일") ||
text.includes("18:30");
const hasStadium =
text.includes("잠실야구장") || text.includes("잠실");
const hasLG = text.includes("LG");
const hasKIA = text.includes("KIA");

if (hasDate && hasStadium && hasLG && hasKIA) {
found = true;
break;
}
parent = parent.parentElement;
depth++;
}

if (found) {
console.log("[NOL] ★ 해당 경기 예매하기 버튼 발견 → 클릭");
lastNolClickTime = Date.now();
playSuccessSound(false);
btn.scrollIntoView({ block: "center", behavior: "instant" });
setTimeout(() => btn.click(), 120);
return true;
}
}
return false;
}

// ===== 패널 관련 =====
function savePanelState() {
if (!panel) return;
const rect = panel.getBoundingClientRect();
try {
localStorage.setItem(
STORAGE_KEY,
JSON.stringify({ x: rect.left, y: rect.top, folded })
);
} catch (e) {}
}

function loadPanelState() {
try {
return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
} catch (e) {
return null;
}
}

function loadEruda() {
if (document.getElementById("nol-eruda-loader")) return;
const script = document.createElement("script");
script.id = "nol-eruda-loader";
script.src = "https://cdn.jsdelivr.net/npm/eruda";
script.onload = () => {
const init = document.createElement("script");
init.textContent = `
if (window.eruda && !window.__NOL_ERUDA_INIT__) {
window.eruda.init();
window.__NOL_ERUDA_INIT__ = true;
}
`;
document.documentElement.appendChild(init);
init.remove();
};
document.documentElement.appendChild(script);
}

function log(message) {
const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
console.log("[NOL]", message);
recentLogs.push(`[${time}] ${message}`);
while (recentLogs.length > 2) recentLogs.shift();
if (logs) logs.textContent = recentLogs.join("\n");
}

function updateInfo() {
if (!running || !info) return;
const remain = Math.max(0, endTime - Date.now());
const min = Math.floor(remain / 60000);
const sec = Math.floor((remain % 60000) / 1000);
info.textContent = `실행 중 | ${round}라운드 | ${min}:${String(sec).padStart(2, "0")} 남음`;
}

function stop(message = "사용자 중지") {
if (!running) {
log(message);
return;
}
running = false;
session++;
if (startBtn) {
startBtn.disabled = false;
startBtn.style.opacity = "1";
}
if (info) info.textContent = "중지됨";
log(message);
}

function createPanel() {
if (!document.body || document.getElementById("nol-auto-panel")) return;
if (location.hostname.includes("yanolja.com")) return;

panel = document.createElement("div");
panel.id = "nol-auto-panel";
Object.assign(panel.style, {
position: "fixed",
right: "10px",
bottom: "90px",
zIndex: "2147483647",
width: "245px",
boxSizing: "border-box",
padding: "12px",
background: "#171717",
color: "#ffffff",
borderRadius: "12px",
boxShadow: "0 4px 18px #0008",
fontFamily: "sans-serif",
fontSize: "12px"
});

handle = document.createElement("div");
handle.textContent = "NOL 자동 좌석 배정 ↕";
Object.assign(handle.style, {
fontWeight: "bold",
fontSize: "14px",
padding: "4px 30px 8px 0",
cursor: "grab",
touchAction: "none",
userSelect: "none"
});

foldBtn = document.createElement("button");
foldBtn.textContent = "−";
Object.assign(foldBtn.style, {
position: "absolute",
right: "8px",
top: "7px",
width: "28px",
height: "28px",
border: "none",
borderRadius: "6px",
background: "#444",
color: "#fff",
fontSize: "19px",
cursor: "pointer"
});

content = document.createElement("div");
info = document.createElement("div");
info.textContent = "대기 중 / 10분";
Object.assign(info.style, {
color: "#b8d4ff",
marginBottom: "8px"
});

logs = document.createElement("div");
Object.assign(logs.style, {
background: "#292929",
padding: "8px",
minHeight: "40px",
borderRadius: "6px",
marginBottom: "10px",
lineHeight: "1.6",
whiteSpace: "pre-line",
overflowWrap: "anywhere"
});

const buttons = document.createElement("div");
buttons.style.display = "flex";
buttons.style.gap = "8px";

startBtn = document.createElement("button");
startBtn.textContent = "▶ 시작";
stopBtn = document.createElement("button");
stopBtn.textContent = "■ 중지";

for (const btn of [startBtn, stopBtn]) {
Object.assign(btn.style, {
flex: "1",
padding: "11px",
border: "none",
borderRadius: "7px",
color: "white",
fontWeight: "bold",
fontSize: "13px",
cursor: "pointer"
});
}
startBtn.style.background = "#1677ff";
stopBtn.style.background = "#e53935";
buttons.append(startBtn, stopBtn);

content.append(info, logs, buttons);
panel.append(handle, foldBtn, content);
document.body.appendChild(panel);

startBtn.onclick = start;
stopBtn.onclick = () => stop();
foldBtn.onclick = toggleFold;
enableDragging();

const saved = loadPanelState();
if (saved) {
if (saved.folded) setFold(true);
if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
movePanel(saved.x, saved.y);
}
}
log("준비 완료 / 자동 시작 대기 중");
}

function setFold(value) {
folded = value;
content.style.display = folded ? "none" : "block";
foldBtn.textContent = folded ? "+" : "−";
panel.style.width = folded ? "185px" : "245px";
const rect = panel.getBoundingClientRect();
movePanel(rect.left, rect.top);
}

function toggleFold() {
setFold(!folded);
savePanelState();
}

function movePanel(x, y) {
if (!panel) return;
const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
panel.style.left = Math.max(0, Math.min(maxX, x)) + "px";
panel.style.top = Math.max(0, Math.min(maxY, y)) + "px";
panel.style.right = "auto";
panel.style.bottom = "auto";
}

function enableDragging() {
let dragging = false;
let offsetX = 0;
let offsetY = 0;

handle.addEventListener("pointerdown", e => {
dragging = true;
const rect = panel.getBoundingClientRect();
offsetX = e.clientX - rect.left;
offsetY = e.clientY - rect.top;
movePanel(rect.left, rect.top);
try {
handle.setPointerCapture(e.pointerId);
} catch (err) {}
e.preventDefault();
});

handle.addEventListener("pointermove", e => {
if (!dragging) return;
movePanel(e.clientX - offsetX, e.clientY - offsetY);
});

const endDrag = () => {
if (dragging) {
dragging = false;
savePanelState();
}
};

handle.addEventListener("pointerup", endDrag);
handle.addEventListener("pointercancel", endDrag);
window.addEventListener("resize", () => {
const rect = panel.getBoundingClientRect();
movePanel(rect.left, rect.top);
savePanelState();
});
}

// ===== 좌석 관련 =====
function findButton(text) {
return [...document.querySelectorAll("button")].find(
btn => visible(btn) && !btn.disabled && btn.textContent.trim() === text
);
}

function getSections() {
return [...document.querySelectorAll(SECTION)];
}

async function waitFor(getEl, label, id, maxMs = timeout) {
const started = Date.now();
while (active(id) && Date.now() - started < maxMs) {
const el = getEl();
if (el) return el;
await sleep(DELAY);
}
throw new Error(label + " 대기 종료");
}

async function waitForSectionList(id) {
await waitFor(
() => getSections().find(visible),
"구역 리스트",
id,
8000
);
}

function getCandidates() {
const list = [];
for (const btn of getSections()) {
if (!visible(btn)) continue;
const name = btn.querySelector(NAME)?.textContent.trim();
const remainText =
btn.querySelector(REMAIN)?.textContent.trim() || "0";
const remain = parseInt(remainText.replace(/,/g, ""), 10);
if (!preferredSections.includes(name)) continue;
if (!Number.isFinite(remain) || remain <= 0) continue;
list.push({ name, remain });
}
return preferredSections
.map(name => list.find(s => s.name === name))
.filter(Boolean);
}

function isFailPopup() {
return visible(document.querySelector(FAIL));
}

function isSuccessScreen() {
if (isFailPopup()) return false;
if (/payment|checkout|order|confirm/i.test(location.href)) return true;
if (getSections().filter(visible).length > 3) return false;
return ["결제하기", "예매하기", "다음 단계", "좌석 선택 완료"].some(
text => !!findButton(text)
);
}

// ★ returnToSections: 실패 시 구역 목록으로 복귀
async function returnToSections(id) {
if (!active(id)) return;
const other = findButton("다른 구역 선택하기");
if (other) {
other.click();
await sleep(DELAY);
}
if (!active(id)) return;
try {
await waitForSectionList(id);
} catch (e) {
log("구역 목록 복귀 대기 실패");
}
}

// ★ 실패 팝업에서 재시도 버튼 클릭 시도
async function tryClickRetryOnFailPopup() {
if (!isFailPopup()) return false;

const retryBtn = [...document.querySelectorAll("button")].find(btn => {
if (!visible(btn) || btn.disabled) return false;
const t = btn.textContent.trim();
// 앱 소스 eL 기준: "재시도 (1/3)" 형태 또는 "다시 시도" 등
return (
t.includes("재시도") ||
t.includes("다시") ||
/재시도\s*\(?\s*\d+\s*\/\s*\d+\s*\)?/.test(t)
);
});

if (retryBtn) {
log("실패 팝업 → 재시도 버튼 클릭");
retryBtn.click();
await sleep(DELAY * 4);
return true;
}
return false;
}

// ★ 핵심 수정: 같은 구역에서 MAX_RETRY_PER_SECTION 만큼 재시도
async function tryOneSection(sectionName, id) {
if (!active(id)) return false;

for (let attempt = 1; attempt <= MAX_RETRY_PER_SECTION; attempt++) {
if (!active(id)) return false;

log(`${sectionName} 시도 ${attempt}/${MAX_RETRY_PER_SECTION}`);

// 1. 구역 버튼 찾기
const btn = getSections().find(
b =>
visible(b) &&
b.querySelector(NAME)?.textContent.trim() === sectionName
);
if (!btn) {
log(`${sectionName} 버튼 없음`);
return false;
}

const remainText =
btn.querySelector(REMAIN)?.textContent.trim() || "0";
const remain = parseInt(remainText.replace(/,/g, ""), 10);
if (!remain || remain <= 0) {
log(`${sectionName} 잔여석 없음`);
return false;
}

btn.scrollIntoView({ block: "center", behavior: "instant" });
await sleep(DELAY);
if (!active(id)) return false;

btn.click();
await sleep(DELAY);

// 2. 자동 배정받기 버튼
let autoButton;
try {
autoButton = await waitFor(
() => findButton("자동 배정받기"),
"자동 배정받기",
id,
8000
);
} catch (e) {
if (active(id)) {
log("자동 배정 버튼 없음 → 구역 복귀 후 재시도");
await returnToSections(id);
}
continue; // 같은 구역 다시 시도
}
if (!active(id)) return false;

autoButton.click();
await sleep(DELAY);

// 3. 좌석 등급 카드
let card;
try {
card = await waitFor(
() =>
[...document.querySelectorAll(CARD)].find(
item =>
item.querySelector(CARD_NAME)?.textContent.trim() ===
sectionName
),
"좌석 등급 카드",
id,
8000
);
} catch (e) {
if (active(id)) {
log("좌석 등급 카드 없음 → 구역 복귀 후 재시도");
await returnToSections(id);
}
continue;
}
if (!active(id)) return false;

// 4. 수량 설정
const input = card.querySelector(
"input.SeatCountBottomSheet_stepperInput__CwbmP, input.nds-e-stepper__input"
);
const plus = card.querySelector(
"button.nds-e-stepper__incrementButton"
);
if (!input || !plus) {
log("수량 조절 요소 없음 → 구역 복귀 후 재시도");
await returnToSections(id);
continue;
}

let count = Number(input.value);
let tries = 0;
while (active(id) && count < quantity && tries < 8) {
if (plus.disabled) {
log("수량 증가 불가 → 구역 복귀 후 재시도");
await returnToSections(id);
break;
}
plus.click();
await sleep(DELAY);
count = Number(input.value);
tries++;
}
if (!active(id)) return false;
if (count !== quantity) {
log("수량 설정 실패 → 구역 복귀 후 재시도");
await returnToSections(id);
continue;
}
log(`${sectionName} / ${count}장 설정`);

// 5. 최종 배정 버튼
let finalBtn;
try {
finalBtn = await waitFor(
() => findButton("자동 배정받기") || findButton("선택 완료"),
"최종 배정 버튼",
id,
4000
);
} catch (e) {
if (active(id)) {
log("최종 배정 버튼 없음 → 구역 복귀 후 재시도");
await returnToSections(id);
}
continue;
}
if (!active(id)) return false;

finalBtn.click();
log("최종 자동 배정 요청");

// 6. 결과 대기 (핵심 수정 지점)
const checkUntil = Date.now() + 4000;
let failed = false;

while (active(id) && Date.now() < checkUntil) {
if (isFailPopup()) {
log(`배정 실패 (${attempt}/${MAX_RETRY_PER_SECTION})`);

// 재시도 버튼이 있으면 먼저 눌러봄
const retried = await tryClickRetryOnFailPopup();
if (retried) {
// 재시도 버튼 눌렀으면 결과 다시 기다림
const retryCheckUntil = Date.now() + 3500;
while (active(id) && Date.now() < retryCheckUntil) {
if (isSuccessScreen()) {
log("성공 화면 감지");
playSuccessSound(true);
return true;
}
if (isFailPopup()) break; // 또 실패하면 루프 탈출
await sleep(DELAY);
}
}

// 재시도 버튼이 없거나 또 실패 → 구역으로 복귀 후 같은 구역 재시도
await returnToSections(id);
failed = true;
break;
}

if (isSuccessScreen()) {
log("성공 화면 감지");
playSuccessSound(true);
return true;
}
await sleep(DELAY);
}

if (!active(id)) return false;

if (failed) {
// 같은 구역 다음 attempt로 계속
if (attempt < MAX_RETRY_PER_SECTION) {
log(`${sectionName} 같은 구역 재시도 예정`);
await sleep(DELAY * 3);
continue;
} else {
log(`${sectionName} 최대 재시도 초과 → 다음 구역으로`);
return false; // 이제 다음 구역으로 넘어감
}
}

// 타임아웃으로 결과가 불명확한 경우
log("결과 불명확 → 구역 복귀 후 재시도");
await returnToSections(id);
}

// 여기까지 오면 최대 재시도 초과
log(`${sectionName} ${MAX_RETRY_PER_SECTION}회 모두 실패`);
return false;
}

// ===== 10분 반복 =====
async function start() {
if (running) return;
running = true;
const id = ++session;
round = 0;
endTime = Date.now() + totalDuration;
if (startBtn) {
startBtn.disabled = true;
startBtn.style.opacity = "0.5";
}
log("자동 배정 시작 / 10분");

const timer = setInterval(() => {
if (active(id)) updateInfo();
else clearInterval(timer);
}, 1000);

try {
while (active(id) && Date.now() < endTime) {
round++;
updateInfo();

try {
await waitForSectionList(id);
if (!entrySoundPlayed) {
entrySoundPlayed = true;
playSuccessSound(false);
log("예매 페이지 진입 감지 → 테스트 소리 재생");
}
} catch (e) {
if (!active(id)) break;
log("구역 리스트 대기 중");
await sleep(DELAY * 10);
continue;
}
if (!active(id)) break;

const candidates = getCandidates();
if (!candidates.length) {
log("조건에 맞는 잔여 좌석 없음");
await sleep(DELAY * 10);
continue;
}
log(`${candidates.length}개 구역 발견`);

let success = false;
for (const section of candidates) {
if (!active(id) || Date.now() >= endTime) break;
success = await tryOneSection(section.name, id);
if (success || !active(id)) break;
await sleep(DELAY);
}

if (success) {
stop("성공 화면 감지 / 직접 확인");
alert(
"좌석 배정 성공 화면이 감지되었습니다.\n실제 예매 내용을 확인하세요."
);
return;
}
if (!active(id)) break;

log("한 바퀴 완료 / 다시 탐색");
await sleep(DELAY * 5);
}
if (active(id)) stop("10분 종료");
} catch (e) {
console.error("[NOL]", e);
if (active(id)) stop("오류: " + e.message);
} finally {
clearInterval(timer);
}
}

// ===== 자동 시작 감시 =====
function watchAndAutoStart() {
if (!AUTO_START || autoStartTriggered) return;
if (location.hostname.includes("yanolja.com")) return;

const check = setInterval(() => {
if (autoStartTriggered || running) {
clearInterval(check);
return;
}
const sections = getSections().filter(visible);
if (sections.length > 0) {
autoStartTriggered = true;
clearInterval(check);
log("구역 리스트 감지 → 자동 시작");
playSuccessSound(false);
start();
}
}, 400);

setTimeout(() => clearInterval(check), 30000);
}

// ===== 초기화 =====
function initialize() {
// NOL 페이지: 계속 감시하면서 예매하기 자동 클릭
if (location.hostname.includes("yanolja.com")) {
console.log("[NOL] yanolja 페이지 감지 → 예매하기 감시 시작");
setInterval(() => {
tryClickNolBooking();
}, 800);
return;
}

// 인터파크 페이지
loadEruda();
createPanel();
watchAndAutoStart();

// 타임아웃 다이얼로그 자동 확인
setInterval(() => {
clickTimeoutDialog();
}, 500);
}

if (document.body) {
initialize();
} else {
document.addEventListener("DOMContentLoaded", initialize, { once: true });
}
})();
