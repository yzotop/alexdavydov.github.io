(function () {
  "use strict";

  var STORAGE_KEY = "davydov-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }

  function applyTheme(theme) {
    var html = document.documentElement;
    if (theme === "dark") {
      html.setAttribute("data-theme", "dark");
    } else {
      html.removeAttribute("data-theme");
    }
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-label", theme === "dark" ? "Светлая тема" : "Тёмная тема");
    });
  }

  function initTheme() {
    var stored = getStoredTheme();
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
    } else {
      applyTheme("light");
    }
  }

  function toggleTheme() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    setStoredTheme(next);
    applyTheme(next);
  }

  function closeDrawer() {
    var drawer = document.getElementById("nav-drawer");
    var backdrop = document.getElementById("nav-drawer-backdrop");
    var burger = document.getElementById("nav-burger");
    if (drawer) drawer.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-open");
    if (burger) burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function openDrawer() {
    var drawer = document.getElementById("nav-drawer");
    var backdrop = document.getElementById("nav-drawer-backdrop");
    var burger = document.getElementById("nav-burger");
    if (drawer) drawer.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-open");
    if (burger) burger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function toggleDrawer() {
    var drawer = document.getElementById("nav-drawer");
    if (!drawer) return;
    if (drawer.classList.contains("is-open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();

    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.addEventListener("click", toggleTheme);
    });

    var burger = document.getElementById("nav-burger");
    var backdrop = document.getElementById("nav-drawer-backdrop");
    if (burger) {
      burger.addEventListener("click", toggleDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeDrawer);
    }

    /* Drawer: primary row + divider + secondary row (markup in HTML). Close on any link. */
    var drawer = document.getElementById("nav-drawer");
    if (drawer) {
      drawer.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          closeDrawer();
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeDrawer();
      }
    });
  });
})();
