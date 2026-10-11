// ==UserScript==
// @name         豆瓣显示评价人数
// @namespace    https://hehome.xyz/
// @version      0.1.2
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

    // 按 GB/T 15835—2011《出版物上数字用法》书写评价人数：
    // 不使用千分撇「,」，四位以内的整数不加千分空，数值较大时以「万 / 亿」作单位。
    // 取整按 GB/T 8170 的四舍六入五留双（五留双）。
    //
    // 写法交给 Intl 紧凑表示法（zh-CN 区域数据正好是这套写法），但修约必须先自己做：
    // Intl 默认四舍五入，遇 x.x5万 这类五分位会与国标口径差一位。
    var compactFormatter = null;
    try {
        var formatter = new Intl.NumberFormat("zh-CN", { notation: "compact" });
        // 不支持 notation 或缺少 zh-CN 数据时会静默退回三位分组，需要实际探测
        if (formatter.format(10000) === "1万") compactFormatter = formatter;
    } catch (e) {}

    // 四舍六入五留双：把 n 修约到 step 的整数倍。
    // n、step 均为正整数，全程整数运算，避免 toFixed 受二进制误差影响（如 1.15 实际小于 1.15）。
    function roundHalfEven(n, step) {
        var q = Math.floor(n / step);
        var rem = n - q * step;
        // 余数大于半个 step 时进一；恰好半个 step 时，保留位为奇数才进一
        if (rem * 2 > step || (rem * 2 === step && q % 2 === 1)) q += 1;
        return q * step;
    }

    // 万 / 亿 的尾数：不足 10 保留一位小数，其余取整，且不写多余的 ".0"
    function scaled(v, suffix) {
        var s = v < 10 ? v.toFixed(1) : String(v);
        if (s.slice(-2) === ".0") s = s.slice(0, -2);
        return s + suffix;
    }

    // 回退实现：入参已按国标修约，输出与 Intl 紧凑表示法一致
    function fallbackCount(n) {
        if (n >= 1000000000000) return scaled(n / 1000000000000, "万亿");
        if (n >= 100000000) return scaled(n / 100000000, "亿");
        if (n >= 10000) return scaled(n / 10000, "万");
        return String(n);
    }

    function formatCount(n) {
        if (n < 10000) return String(n); // 四位以内的整数不加千分空
        var unit = n >= 1000000000000 ? 1000000000000 : n >= 100000000 ? 100000000 : 10000;
        var step = n / unit < 10 ? unit / 10 : unit; // 尾数不足 10 时保留一位小数
        var rounded = roundHalfEven(n, step);
        return compactFormatter ? compactFormatter.format(rounded) : fallbackCount(rounded);
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
            (this._url.indexOf("rexxar/api/v2/subject/recent_hot") !== -1 ||
                this._url.indexOf("rexxar/api/v2/movie/recommend") !== -1)
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
            span.style.marginLeft = "4px";
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
