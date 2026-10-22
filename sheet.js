// ==UserScript==
// @name         실시간 좌석 오토클릭
// @match        *://*/*
// @grant        none
// ==/UserScript==
 
(function() {
    'use strict';
 
    const AVAILABLE_FILL = '#1ca814';
    const clickedSeats = new Set(); // 이미 클릭한 좌석 중복 방지
 
    function isAvailable(seat) {
        // 1. disabled 클래스가 없고
        if (seat.classList.contains('SeatMap_disabled__AZO_T')) return false;
 
        // 2. fill이 초록색이거나
        const fill = (seat.getAttribute('fill') || '').toLowerCase();
        if (fill === AVAILABLE_FILL) return true;
 
        // 3. stroke도 같이 초록이면 확실하게
        const stroke = (seat.getAttribute('stroke') || '').toLowerCase();
        return stroke === AVAILABLE_FILL;
    }
 
    function tryClick(seat) {
        if (!seat || !seat.id) return;
        if (clickedSeats.has(seat.id)) return;
        if (!isAvailable(seat)) return;
 
        clickedSeats.add(seat.id);
 
        // 실제 클릭 이벤트
        const rect = seat.getBoundingClientRect();
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        };
 
        seat.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        seat.dispatchEvent(new MouseEvent('mouseup', eventOptions));
        seat.dispatchEvent(new MouseEvent('click', eventOptions));
 
        console.log('%c클릭 성공 → ' + seat.id, 'color: #00ff88; font-weight: bold');
    }
 
    // MutationObserver로 실시간 감지
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const seat = mutation.target;
                if (seat.matches?.('circle.js-seat, [id^="seat_block_"]')) {
                    tryClick(seat);
                }
            }
 
            // 새로 추가되는 경우도 대응
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.matches?.('circle.js-seat, [id^="seat_block_"]')) {
                            tryClick(node);
                        }
                        node.querySelectorAll?.('circle.js-seat, [id^="seat_block_"]').forEach(tryClick);
                    }
                });
            }
        }
    });
 
    const target = document.querySelector('svg') || document.body;
    observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'fill', 'stroke']
    });
 
    // 폴링 백업 (아주 짧게)
    setInterval(() => {
        document.querySelectorAll('circle.js-seat:not(.SeatMap_disabled__AZO_T)').forEach(tryClick);
    }, 50);
 
    console.log('%c실시간 좌석 오토클릭 작동 중...', 'color: #00ff88; font-weight: bold');
})();