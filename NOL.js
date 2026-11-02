(function() {

    'use strict';



    const AVAILABLE_FILL = '#1ca814';

    const clickedSeats = new Set();

    const cooldownSeats = new Map();



    // alert 자동 닫기

    window.alert = function(msg) {

        console.log('%c[alert 자동 닫기] ' + msg, 'color: orange');

    };

    window.confirm = function() { return true; };



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

        console.log('%c클릭 시도 → ' + seat.id, 'color: #00ff88; font-weight: bold');



        const rect = seat.getBoundingClientRect();

        const x = rect.left + rect.width / 2;

        const y = rect.top + rect.height / 2;



        const opts = {

            bubbles: true,

            cancelable: true,

            view: window,

            clientX: x,

            clientY: y,

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

                console.log('%c선점 실패 → 3초 쿨다운 ' + seat.id, 'color: #ff6b6b');

                cooldownSeats.set(seat.id, Date.now() + 3000);

            }

        }, 1000);

    }



    // ========== 자동 좌우 스크롤 ==========

    let scrollDirection = 1; // 1: 오른쪽, -1: 왼쪽

    let scrollContainer = null;



    // 스크롤 가능한 컨테이너 찾기

    function findScrollContainer() {

        // 일반적인 좌석맵 스크롤 컨테이너 후보들

        const candidates = [

            document.querySelector('.SeatMap'),

            document.querySelector('[class*="SeatMap"]'),

            document.querySelector('[class*="seat-map"]'),

            document.querySelector('[class*="seatmap"]'),

            document.querySelector('svg')?.parentElement,

            document.querySelector('.scroll-container'),

            document.scrollingElement

        ];



        for (const el of candidates) {

            if (el && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {

                return el;

            }

        }

        return document.scrollingElement || document.documentElement;

    }



    function autoScroll() {

        if (!scrollContainer) {

            scrollContainer = findScrollContainer();

        }



        if (!scrollContainer) return;



        const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;

        if (maxScrollLeft <= 0) return; // 스크롤할 필요 없음



        // 끝까지 가면 방향 전환

        if (scrollContainer.scrollLeft >= maxScrollLeft - 5) {

            scrollDirection = -1;

        } else if (scrollContainer.scrollLeft <= 5) {

            scrollDirection = 1;

        }



        // 스크롤 이동 (속도 조절 가능)

        scrollContainer.scrollBy({

            left: 120 * scrollDirection,  // 한 번에 움직이는 거리

            behavior: 'auto'              // smooth 쓰면 느려짐

        });

    }



    // 스크롤 주기 (ms) - 너무 빠르면 오히려 렉 날 수 있음

    setInterval(autoScroll, 300);



    // ========== 좌석 감시 ==========

    const observer = new MutationObserver((mutations) => {

        for (const m of mutations) {

            if (m.type === 'attributes') {

                const el = m.target;

                if (el.matches?.('circle.js-seat, [id^="seat_block_"]')) {

                    forceClick(el);

                }

            }

            if (m.addedNodes.length) {

                m.addedNodes.forEach(node => {

                    if (node.nodeType === 1) {

                        if (node.matches?.('circle.js-seat, [id^="seat_block_"]')) forceClick(node);

                        node.querySelectorAll?.('circle.js-seat, [id^="seat_block_"]').forEach(forceClick);

                    }

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



    setInterval(() => {

        document.querySelectorAll('circle.js-seat:not(.SeatMap_disabled__AZO_T)').forEach(forceClick);

    }, 40);



    console.log('%c오토클릭 + 자동 좌우 스크롤 작동 중', 'color: #00ff88; font-weight: bold');

})();
