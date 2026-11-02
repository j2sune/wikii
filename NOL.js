(function() {
    'use strict';
 
    const AVAILABLE_FILL = '#1ca814';
    const clickedSeats = new Set();
    const cooldownSeats = new Map();
    const prevState = new WeakMap();
 
    // alert 자동 닫기
    window.alert = function(msg) {
        console.log('%c[alert 자동 닫기] ' + msg, 'color: orange');
    };
    window.confirm = function() { return true; };
 
    function getSeatInfo(el) {
        return {
            id: el.id || '(id 없음)',
            className: el.className?.baseVal || el.className || '',
            fill: el.getAttribute('fill') || '',
            stroke: el.getAttribute('stroke') || '',
            hasDisabled: el.classList.contains('SeatMap_disabled__AZO_T')
        };
    }
 
    function logChange(el, oldInfo, newInfo) {
        const diffs = [];
        if (oldInfo.className !== newInfo.className) diffs.push(`class: "${oldInfo.className}" → "${newInfo.className}"`);
        if (oldInfo.fill !== newInfo.fill) diffs.push(`fill: "${oldInfo.fill}" → "${newInfo.fill}"`);
        if (oldInfo.stroke !== newInfo.stroke) diffs.push(`stroke: "${oldInfo.stroke}" → "${newInfo.stroke}"`);
        if (diffs.length === 0) return;
 
        const isNowAvailable = !newInfo.hasDisabled && newInfo.fill.toLowerCase() === AVAILABLE_FILL;
        console.groupCollapsed(
            `%c[${isNowAvailable ? '🟢 사용가능' : '🔴 변경'}] ${newInfo.id}`,
            isNowAvailable ? 'color: #00ff88; font-weight: bold' : 'color: #ffcc00'
        );
        diffs.forEach(d => console.log('  • ' + d));
        console.log('요소:', el);
        console.groupEnd();
    }
 
    function isAvailable(seat) {
        if (!seat || !seat.id) return false;
        const cooldownUntil = cooldownSeats.get(seat.id);
        if (cooldownUntil && Date.now() < cooldownUntil) return false;
        if (seat.classList.contains('SeatMap_disabled__AZO_T')) return false;
        const fill = (seat.getAttribute('fill') || '').toLowerCase();
        return fill === AVAILABLE_FILL;
    }
 
    function forceClick(seat) {
        if (!isAvailable(seat)) return;
        if (clickedSeats.has(seat.id)) return;
 
        clickedSeats.add(seat.id);
        console.log('%c👉 클릭 시도 → ' + seat.id, 'color: #00ff88; font-weight: bold');
 
        const rect = seat.getBoundingClientRect();
        const opts = {
            bubbles: true, cancelable: true, view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 0
        };
 
        seat.dispatchEvent(new MouseEvent('mouseover', opts));
        seat.dispatchEvent(new MouseEvent('mousedown', opts));
        seat.dispatchEvent(new MouseEvent('mouseup', opts));
        seat.dispatchEvent(new MouseEvent('click', opts));
        try { seat.click(); } catch(e) {}
 
        setTimeout(() => {
            clickedSeats.delete(seat.id);
            if (!isAvailable(seat)) {
                console.log('%c❌ 선점 실패 → 3초 쿨다운 ' + seat.id, 'color: #ff6b6b');
                cooldownSeats.set(seat.id, Date.now() + 3000);
            }
        }, 1000);
    }
 
    // ========== 짧은 좌우 흔들기 ==========
    let scrollDirection = 1;
    let scrollContainer = null;
    let baseScrollLeft = null;   // 네가 정해놓은 기준 위치
    const SHAKE_DISTANCE = 80;  // 좌우로 흔드는 거리 (픽셀) - 필요하면 조절
 
    function findScrollContainer() {
        const all = document.querySelectorAll('*');
        let best = null;
        let maxDiff = 0;
 
        for (const el of all) {
            const diff = el.scrollWidth - el.clientWidth;
            if (diff > maxDiff && diff > 30) {
                const style = getComputedStyle(el);
                if (['auto', 'scroll', 'overlay'].includes(style.overflowX) || 
                    ['auto', 'scroll', 'overlay'].includes(style.overflow)) {
                    maxDiff = diff;
                    best = el;
                }
            }
        }
 
        if (!best) {
            let el = document.querySelector('svg');
            while (el) {
                if (el.scrollWidth > el.clientWidth + 30) {
                    best = el;
                    break;
                }
                el = el.parentElement;
            }
        }
        return best || document.scrollingElement || document.documentElement;
    }
 
    function autoScroll() {
        if (!scrollContainer) {
            scrollContainer = findScrollContainer();
            if (scrollContainer) {
                baseScrollLeft = scrollContainer.scrollLeft;  // 현재 위치를 기준으로 저장
                console.log('%c스크롤 대상 찾음 (기준 위치 저장됨)', 'color: #00bfff; font-weight: bold');
            } else {
                return;
            }
        }
 
        // 기준 위치에서 좌우로만 짧게 움직임
        const target = baseScrollLeft + (scrollDirection * SHAKE_DISTANCE);
        scrollContainer.scrollLeft = target;
 
        // 방향 전환
        scrollDirection *= -1;
    }
 
    setInterval(autoScroll, 400);  // 0.4초마다 짧게 흔들림
 
    // ========== 좌석 감시 ==========
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === 'attributes') {
                const el = m.target;
                if (!el.matches?.('circle.js-seat, [id^="seat_block_"]')) continue;
 
                const oldInfo = prevState.get(el) || {};
                const newInfo = getSeatInfo(el);
                if (JSON.stringify(oldInfo) !== JSON.stringify(newInfo)) {
                    logChange(el, oldInfo, newInfo);
                    prevState.set(el, newInfo);
                }
                forceClick(el);
            }
 
            if (m.addedNodes.length) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const seats = [];
                    if (node.matches?.('circle.js-seat, [id^="seat_block_"]')) seats.push(node);
                    node.querySelectorAll?.('circle.js-seat, [id^="seat_block_"]').forEach(s => seats.push(s));
                    seats.forEach(seat => {
                        const info = getSeatInfo(seat);
                        logChange(seat, {}, info);
                        prevState.set(seat, info);
                        forceClick(seat);
                    });
                });
            }
        }
    });
 
    observer.observe(document.querySelector('svg') || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'fill', 'stroke']
    });
 
    document.querySelectorAll('circle.js-seat, [id^="seat_block_"]').forEach(el => {
        prevState.set(el, getSeatInfo(el));
    });
 
    setInterval(() => {
        document.querySelectorAll('circle.js-seat:not(.SeatMap_disabled__AZO_T)').forEach(forceClick);
    }, 40);
 
    console.log('%c✅ 짧은 흔들기 스크롤 + 오토클릭 작동 중', 'color: #00ff88; font-weight: bold');
    console.log('사용법: 원하는 위치로 직접 맞춰놓고 이 스크립트 실행');
})();
