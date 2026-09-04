/*
 * Language handling for static hosting. Two jobs, no dependencies:
 *  1. Remember an explicit language choice when a switch link is clicked.
 *  2. On a German page, send visitors whose browser is not German to the
 *     English equivalent — unless they have already chosen a language.
 * Loaded blocking in <head> so no German content flashes before the redirect.
 * The pages render fully without this script; it is an enhancement.
 */
(function () {
  "use strict";

  var KEY = "audioroute-lang";
  var TO_ENGLISH = {
    "/": "/en/index.html",
    "/index.html": "/en/index.html",
    "/impressum.html": "/en/legal-notice.html",
    "/datenschutz.html": "/en/privacy.html"
  };

  function readChoice() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (error) {
      return null;
    }
  }

  function storeChoice(value) {
    try {
      window.localStorage.setItem(KEY, value);
    } catch (error) {
      /* private mode or storage disabled — the link still works */
    }
  }

  document.addEventListener(
    "click",
    function (event) {
      var node = event.target;
      var link = node && node.closest ? node.closest("[data-lang-switch]") : null;
      if (!link) return;
      var choice = link.getAttribute("data-lang-switch");
      if (choice === "de" || choice === "en") storeChoice(choice);
    },
    true
  );

  var target = TO_ENGLISH[window.location.pathname];
  if (!target) return;

  var choice = readChoice();
  if (choice === "de") return;

  if (choice !== "en") {
    var tags =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (var i = 0; i < tags.length; i++) {
      var tag = String(tags[i] || "").toLowerCase();
      if (tag === "de" || tag.indexOf("de-") === 0) return;
    }
  }

  window.location.replace(target + window.location.hash);
})();
