// ==UserScript==
// @name         豆瓣显示评价人数
// @namespace    https://hehome.xyz/
// @version      0.1.0
// @icon         https://movie.douban.com/favicon.ico
// @description  在豆瓣选电影页面的评分旁边显示评价人数
// @author       uy/sun
// @match        https://movie.douban.com/explore*
// @grant        GM_xmlhttpRequest
// @connect      m.douban.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var ATTR_PROCESSED = 'data-rating-count-processed';

    // Rate-limited request queue
    var REQUEST_INTERVAL = 600;
    var requestQueue = [];
    var isProcessing = false;

    function formatCount(n) {
        if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        return n.toLocaleString();
    }

    function processQueue() {
        if (isProcessing || requestQueue.length === 0) return;
        isProcessing = true;
        var task = requestQueue.shift();
        task();
        setTimeout(function () {
            isProcessing = false;
            processQueue();
        }, REQUEST_INTERVAL);
    }

    function enqueue(fn) {
        requestQueue.push(fn);
        processQueue();
    }

    function fetchRatingCount(subjectId, callback) {
        enqueue(function () {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://m.douban.com/rexxar/api/v2/movie/' + subjectId,
                headers: {
                    'Referer': 'https://movie.douban.com/'
                },
                onload: function (res) {
                    if (res.status === 200) {
                        try {
                            var data = JSON.parse(res.responseText);
                            if (data.rating && data.rating.count) {
                                callback(data.rating.count);
                            }
                        } catch (e) {}
                    }
                }
            });
        });
    }

    function injectRatingCount(ratingEl, count) {
        if (ratingEl.querySelector('.rating-count')) return;
        var span = document.createElement('span');
        span.className = 'rating-count';
        span.textContent = ' (' + formatCount(count) + '人)';
        span.style.fontSize = '11px';
        span.style.color = '#e09015';
        ratingEl.appendChild(span);
    }

    function processMovieCards() {
        var cards = document.querySelectorAll('.subject-list-list > li');
        for (var i = 0; i < cards.length; i++) {
            (function (card) {
                if (card.getAttribute(ATTR_PROCESSED)) return;

                var ratingEl = card.querySelector('.drc-rating');
                if (!ratingEl) return;

                var link = card.querySelector('a[href*="doubanapp/dispatch"]');
                if (!link) return;

                var match = link.href.match(/\/movie\/(\d+)/);
                if (!match) return;

                card.setAttribute(ATTR_PROCESSED, 'true');
                var subjectId = match[1];

                fetchRatingCount(subjectId, function (count) {
                    injectRatingCount(ratingEl, count);
                });
            })(cards[i]);
        }
    }

    // Watch for dynamically loaded content
    var observer = new MutationObserver(function () {
        processMovieCards();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    processMovieCards();
})();
