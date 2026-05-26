// ==UserScript==
// @name         豆瓣显示评价人数
// @namespace    https://hehome.xyz/
// @version      0.1.0
// @icon         https://movie.douban.com/favicon.ico
// @description  在豆瓣选电影页面的评分旁边显示评价人数
// @author       uy/sun
// @license      MIT
// @match        https://movie.douban.com/explore*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    var ratingMap = {};

    function formatCount(n) {
        if (n >= 100000000) return (n / 100000000).toFixed(1) + "亿";
        if (n >= 10000) return (n / 10000).toFixed(1) + "万";
        return n.toLocaleString();
    }

    // Intercept XHR to capture rexxar API response
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        if (
            this._url &&
            this._url.indexOf("rexxar/api/v2/subject/recent_hot") !== -1
        ) {
            this.addEventListener("load", function () {
                try {
                    var data = JSON.parse(this.responseText);
                    if (data.items) {
                        for (var i = 0; i < data.items.length; i++) {
                            var item = data.items[i];
                            if (item.rating && item.rating.count) {
                                ratingMap[item.id] = item.rating.count;
                            }
                        }
                        injectAll();
                    }
                } catch (e) {}
            });
        }
        return origSend.apply(this, arguments);
    };

    function injectAll() {
        var cards = document.querySelectorAll(".subject-list-list > li");
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.getAttribute("data-rc-done")) continue;

            var ratingEl = card.querySelector(".drc-rating");
            if (!ratingEl) continue;

            var link = card.querySelector('a[href*="doubanapp/dispatch"]');
            if (!link) continue;

            var match = link.href.match(/\/movie\/(\d+)/);
            if (!match) continue;

            var count = ratingMap[match[1]];
            if (!count) continue;

            card.setAttribute("data-rc-done", "true");
            var span = document.createElement("span");
            span.className = "rating-count";
            span.textContent = " (" + formatCount(count) + "人)";
            span.style.fontSize = "11px";
            span.style.color = "#e09015";
            ratingEl.appendChild(span);
        }
    }

    // DOM might render after API response
    var observer = new MutationObserver(function () {
        if (Object.keys(ratingMap).length > 0) injectAll();
    });

    document.addEventListener("DOMContentLoaded", function () {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    });
})();
