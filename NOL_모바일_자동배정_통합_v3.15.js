// ==UserScript==
// @name NOL 모바일 자동배정 통합
// @namespace nol-mobile-integrated
// @version 3.15
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
let quantity = 1;
const timeout = 12000;
const totalDuration = 10 * 60 * 1000;
const DELAY = 100;
const AUTO_START = true;
const MAX_RETRY_FALLBACK = 5; // 버튼에서 max를 못 읽을 때만 사용

const SECTION = "button.SportsSeatGradeList_contentItem__i1kkb";
const NAME = ".SportsSeatGradeList_contentGradeName__sQHBT";
const REMAIN = ".SportsSeatGradeList_contentRemainCount__2HVZF";
const CARD = ".SeatCountBottomSheet_gradeCard__wdtQ3";
const CARD_NAME = ".SeatCountBottomSheet_gradeNameText__R5M_d";
const FAIL = ".AutoAssignFailDialog_container__KUcme";
const STORAGE_KEY = "nol_mobile_panel_v3";
const QUANTITY_KEY = "nol_mobile_quantity_v3";

let running = false;
let session = 0;
let round = 0;
let endTime = 0;
let panel, handle, info, logs, startBtn, stopBtn, foldBtn, content;
let quantityDisplay;
let folded = false;
let entrySoundPlayed = false;
let autoStartTriggered = false;
let lastNolClickTime = 0;
const recentLogs = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const visible = el => !!el && el.getClientRects().length > 0;
const active = id => running && session === id;

function vibrateSuccess() {
try {
if (navigator.vibrate) {
navigator.vibrate([200, 100, 200, 100, 400]);
}
} catch (e) {
console.warn("[NOL] 진동 실패", e);
}
}

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

const confirmBtn = [...document.querySelectorAll("button")].find(
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

function tryClickNolBooking() {
if (!location.href.includes("/ticket/genre/sports/postseason")) return false;
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
btn.scrollIntoView({ block: "center", behavior: "instant" });
setTimeout(() => btn.click(), 120);
return true;
}
}
return false;
}

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

function saveQuantity() {
try {
localStorage.setItem(QUANTITY_KEY, String(quantity));
} catch (e) {}
}

function loadQuantity() {
try {
const v = parseInt(localStorage.getItem(QUANTITY_KEY) || "1", 10);
if (Number.isFinite(v) && v >= 1 && v <= 4) return v;
} catch (e) {}
return 1;
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

function updateQuantityDisplay() {
if (quantityDisplay) quantityDisplay.textContent = String(quantity);
}

function changeQuantity(delta) {
const next = Math.max(1, Math.min(4, quantity + delta));
if (next === quantity) return;
quantity = next;
updateQuantityDisplay();
saveQuantity();
log(`연석 수량 → ${quantity}장`);
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

quantity = loadQuantity();

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

const qtyRow = document.createElement("div");
Object.assign(qtyRow.style, {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
marginBottom: "10px",
padding: "8px 10px",
background: "#292929",
borderRadius: "8px"
});

const qtyLabel = document.createElement("span");
qtyLabel.textContent = "연석 수량";
Object.assign(qtyLabel.style, {
fontSize: "13px",
fontWeight: "bold"
});

const stepper = document.createElement("div");
Object.assign(stepper.style, {
display: "flex",
alignItems: "center",
gap: "6px"
});

const minusBtn = document.createElement("button");
minusBtn.textContent = "−";
Object.assign(minusBtn.style, {
width: "32px",
height: "32px",
border: "none",
borderRadius: "6px",
background: "#444",
color: "#fff",
fontSize: "18px",
fontWeight: "bold",
cursor: "pointer"
});
minusBtn.onclick = () => changeQuantity(-1);

quantityDisplay = document.createElement("span");
quantityDisplay.textContent = String(quantity);
Object.assign(quantityDisplay.style, {
minWidth: "24px",
textAlign: "center",
fontSize: "16px",
fontWeight: "bold"
});

const plusBtn = document.createElement("button");
plusBtn.textContent = "+";
Object.assign(plusBtn.style, {
width: "32px",
height: "32px",
border: "none",
borderRadius: "6px",
background: "#444",
color: "#fff",
fontSize: "18px",
fontWeight: "bold",
cursor: "pointer"
});
plusBtn.onclick = () => changeQuantity(1);

stepper.append(minusBtn, quantityDisplay, plusBtn);
qtyRow.append(qtyLabel, stepper);

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

content.append(info, logs, qtyRow, buttons);
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
log(`준비 완료 / 연석 ${quantity}장`);
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

function findButton(text) {
return [...document.querySelectorAll("button")].find(
btn => visible(btn) && !btn.disabled && btn.textContent.trim() === text
);
}

function findOtherSectionButton() {
const all = [...document.querySelectorAll("button, [role='button'], a")];
for (const el of all) {
if (!visible(el)) continue;
if (el.disabled) continue;
const t = (el.textContent || "").replace(/\s+/g, " ").trim();
if (
t === "다른 구역 선택하기" ||
t === "다른구역 선택하기" ||
t.includes("다른 구역 선택") ||
t.includes("다른구역 선택")
) {
return el;
}
}
return null;
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

function isNoSeatDialog() {
const bodyText = document.body?.innerText || "";
if (
bodyText.includes("자동 배정 가능한 좌석을 찾지 못했어요") ||
bodyText.includes("좌석을 찾지 못했어요")
) {
if (findOtherSectionButton()) return true;
}
return false;
}

function isSuccessScreen() {
if (isFailPopup() || isNoSeatDialog()) return false;
if (/payment|checkout|order|confirm/i.test(location.href)) return true;
if (getSections().filter(visible).length > 3) return false;
return ["결제하기", "예매하기", "다음 단계", "좌석 선택 완료"].some(
text => !!findButton(text)
);
}

async function clickOtherSectionButton(id) {
const deadline = Date.now() + 5000;
while (active(id) && Date.now() < deadline) {
const btn = findOtherSectionButton();
if (btn) {
log("다른 구역 선택하기 클릭");
try {
btn.scrollIntoView({ block: "center", behavior: "instant" });
} catch (e) {}
await sleep(80);
btn.click();
await sleep(50);
try {
btn.dispatchEvent(
new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
);
} catch (e) {}
await sleep(DELAY * 4);
return true;
}
await sleep(DELAY);
}
log("다른 구역 선택하기 버튼을 찾지 못함");
return false;
}

async function returnToSections(id) {
if (!active(id)) return;

const clicked = await clickOtherSectionButton(id);
if (clicked) {
await sleep(DELAY * 2);
}

const leftover = findOtherSectionButton();
if (leftover) {
leftover.click();
await sleep(DELAY * 2);
}

if (!active(id)) return;
try {
await waitForSectionList(id);
} catch (e) {
log("구역 목록 복귀 대기 실패");
}
}

// ★ 버튼 텍스트에서 current/max 파싱  (예: "계속 시도(2/3)" → {current:2, max:3})
function parseAttemptFromText(text) {
const t = (text || "").replace(/\s+/g, " ").trim();
const m = t.match(/(\d+)\s*\/\s*(\d+)/);
if (m) {
return {
current: parseInt(m[1], 10),
max: parseInt(m[2], 10)
};
}
return null;
}

function findRetryButton() {
if (!isFailPopup()) return null;

const buttons = [...document.querySelectorAll("button")].filter(
btn => visible(btn) && !btn.disabled
);

for (const btn of buttons) {
const t = (btn.textContent || "").replace(/\s+/g, " ").trim();
if (
t.includes("계속 시도") ||
t.includes("재시도") ||
t.includes("다시 하기") ||
t.includes("다시하기") ||
/계속\s*시도/.test(t) ||
/재시도/.test(t)
) {
return btn;
}
}

for (const btn of buttons) {
const cls = btn.className || "";
const t = (btn.textContent || "").replace(/\s+/g, " ").trim();
if (
(cls.includes("ActionButton") ||
cls.includes("filled_primary") ||
cls.includes("dialogButton")) &&
!t.includes("수동") &&
!t.includes("직접") &&
!t.includes("다른 구역") &&
t.length > 0
) {
return btn;
}
}
return null;
}

async function handleFailAndRetry(id) {
let clickCount = 0;
let knownMax = null; // 버튼에서 읽은 max

while (active(id)) {
// 좌석 없음 / 다른 구역 버튼이 이미 있으면 종료
if (isNoSeatDialog() || findOtherSectionButton()) {
log("좌석 없음 다이얼로그 감지 → 다른 구역으로");
await clickOtherSectionButton(id);
return "limit";
}

if (!isFailPopup()) {
if (isSuccessScreen()) {
log("성공 화면 감지");
vibrateSuccess();
return "success";
}
if (findOtherSectionButton()) {
await clickOtherSectionButton(id);
return "limit";
}
return "continue";
}

const retryBtn = findRetryButton();
if (!retryBtn) {
log("계속 시도 버튼 없음 → 다른 구역 버튼 확인");
if (findOtherSectionButton() || isNoSeatDialog()) {
await clickOtherSectionButton(id);
return "limit";
}
return "no_button";
}

const btnText = (retryBtn.textContent || "").replace(/\s+/g, " ").trim();
const parsed = parseAttemptFromText(btnText);

if (parsed) {
knownMax = parsed.max;
log(`계속 시도 감지 ${parsed.current}/${parsed.max} (${btnText})`);

// 이미 current >= max 이면 더 이상 누르지 않고 다른 구역으로
if (parsed.current >= parsed.max) {
log(`앱 max(${parsed.max}) 도달 → 다른 구역으로`);
// 마지막 한 번 더 눌러서 한도 초과 다이얼로그를 유도할 수도 있지만,
// 보통 current===max 인 상태에서 누르면 한도 다이얼로그로 바뀜
retryBtn.click();
await sleep(DELAY * 5);
await clickOtherSectionButton(id);
return "limit";
}
} else {
log(`계속 시도 버튼 텍스트 파싱 실패: "${btnText}"`);
}

const limit = knownMax || MAX_RETRY_FALLBACK;
if (clickCount >= limit) {
log(`재시도 한도(${limit}) 도달 → 다른 구역으로`);
await sleep(DELAY * 3);
await clickOtherSectionButton(id);
return "max_reached";
}

clickCount++;
log(`계속 시도 클릭 ${clickCount}/${limit} (${btnText})`);
retryBtn.click();
await sleep(DELAY * 5);

const checkUntil = Date.now() + 4000;
while (active(id) && Date.now() < checkUntil) {
if (isSuccessScreen()) {
log("성공 화면 감지");
vibrateSuccess();
return "success";
}
if (isNoSeatDialog() || findOtherSectionButton()) {
log("좌석 없음 다이얼로그 감지 → 다른 구역으로");
await clickOtherSectionButton(id);
return "limit";
}
if (isFailPopup()) break;
await sleep(DELAY);
}
}

return "max_reached";
}

async function tryOneSection(sectionName, id) {
if (!active(id)) return false;

const btn = getSections().find(
b =>
visible(b) &&
b.querySelector(NAME)?.textContent.trim() === sectionName
);
if (!btn) return false;

const remainText =
btn.querySelector(REMAIN)?.textContent.trim() || "0";
const remain = parseInt(remainText.replace(/,/g, ""), 10);
if (!remain || remain <= 0) return false;

log(`${sectionName} / ${remain}석 시도 (수량 ${quantity}장)`);
btn.scrollIntoView({ block: "center", behavior: "instant" });
await sleep(DELAY);
if (!active(id)) return false;

btn.click();
await sleep(DELAY);

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
log("자동 배정 버튼 없음");
await returnToSections(id);
}
return false;
}
if (!active(id)) return false;

autoButton.click();
await sleep(DELAY);

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
log("좌석 등급 카드 없음");
await returnToSections(id);
}
return false;
}
if (!active(id)) return false;

const input = card.querySelector(
"input.SeatCountBottomSheet_stepperInput__CwbmP, input.nds-e-stepper__input"
);
const plus = card.querySelector(
"button.nds-e-stepper__incrementButton"
);
if (!input || !plus) {
log("수량 조절 요소 없음");
await returnToSections(id);
return false;
}

let count = Number(input.value);
let tries = 0;
while (active(id) && count < quantity && tries < 8) {
if (plus.disabled) {
log("수량 증가 불가");
await returnToSections(id);
return false;
}
plus.click();
await sleep(DELAY);
count = Number(input.value);
tries++;
}
if (!active(id)) return false;
if (count !== quantity) {
log("수량 설정 실패");
await returnToSections(id);
return false;
}
log(`${sectionName} / ${count}장 설정`);

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
log("최종 배정 버튼 없음");
await returnToSections(id);
}
return false;
}
if (!active(id)) return false;

finalBtn.click();
log("최종 자동 배정 요청");

const checkUntil = Date.now() + 4000;
while (active(id) && Date.now() < checkUntil) {
if (isFailPopup()) {
log("배정 실패 팝업 감지 → 계속 시도 버튼으로 재시도");
const result = await handleFailAndRetry(id);

if (result === "success") {
return true;
}
await returnToSections(id);
return false;
}

if (isNoSeatDialog() || findOtherSectionButton()) {
log("좌석 없음 다이얼로그 감지");
await clickOtherSectionButton(id);
await returnToSections(id);
return false;
}

if (isSuccessScreen()) {
log("성공 화면 감지");
vibrateSuccess();
return true;
}
await sleep(DELAY);
}

if (!active(id)) return false;

log("결과 불명확 / 화면 확인 필요");
await returnToSections(id);
return false;
}

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
log(`자동 배정 시작 / 연석 ${quantity}장 / 10분`);

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
log("예매 페이지 진입 감지");
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
start();
}
}, 400);

setTimeout(() => clearInterval(check), 30000);
}

function initialize() {
if (location.hostname.includes("yanolja.com")) {
console.log("[NOL] yanolja 페이지 감지 → 예매하기 감시 시작");
setInterval(() => {
tryClickNolBooking();
}, 800);
return;
}

loadEruda();
createPanel();
watchAndAutoStart();

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
