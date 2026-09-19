// Runs once the page has fully loaded
document.addEventListener("DOMContentLoaded", function () {

  // ---- Mobile hamburger menu ----
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.textContent = isOpen ? '✕' : '☰';
    });
  }

  // ---- Genre filter chips on the Reviews page ----
  var chips = document.querySelectorAll(".chip[data-genre]");
  var cards = document.querySelectorAll("[data-genre-tag]");
  if (chips.length && cards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var genre = chip.getAttribute("data-genre");

        chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");

        cards.forEach(function (card) {
          var tags = card.getAttribute("data-genre-tag");
          card.style.display =
            genre === "all" || tags.toLowerCase().indexOf(genre.toLowerCase()) !== -1
              ? ""
              : "none";
        });
      });
    });

    // ---- Site Search ----
    var searchInput = document.getElementById("search-input");
    var searchResults = document.getElementById("search-results");

    if (searchInput && searchResults) {
      var baseUrlMeta = document.querySelector('meta[name="base-url"]');
      var baseUrl = baseUrlMeta ? baseUrlMeta.content : "";
      var searchIndex = [];

      fetch(baseUrl + "/search-index.json")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          searchIndex = data;
          renderSearch("");
        })
        .catch(function () {
          searchResults.innerHTML = '<p style="color:var(--text-muted);">Failed to load search index.</p>';
        });

      function renderSearch(query) {
        var q = query.trim().toLowerCase();
        var allMatches = searchIndex.filter(function (item) {
          return (item.title || "").toLowerCase().indexOf(q) !== -1;
        });

        var matches = allMatches.slice(0, 7);
        var hasMore = allMatches.length > 7;

        if (!matches.length) {
          searchResults.innerHTML = '<p class="search-empty">No results for "' + escapeHtml(query) + '".</p>';
          return;
        }

        // Sort by type then title
        matches.sort(function (a, b) {
          if (a.type !== b.type) return a.type.localeCompare(b.type);
          return a.title.localeCompare(b.title);
        });

        searchResults.innerHTML = matches.map(function (item) {
          return '<a class="search-result" href="' + baseUrl + item.url + '">' +
            '<span class="search-type">' + escapeHtml(item.type) + '</span>' +
            '<h3>' + escapeHtml(item.title) + '</h3>' +
            '<p>' + escapeHtml(item.excerpt) + '</p>' +
            '</a>';
        }).join("");
      }

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }

      searchInput.addEventListener("input", function () {
        renderSearch(searchInput.value);
      });
    }
  }

  // ---- Genre carousel arrows ----
  var genreContainer = document.querySelector(".chips-container");
  var leftArrow = document.querySelector(".genre-arrow-left");
  var rightArrow = document.querySelector(".genre-arrow-right");

  if (genreContainer && leftArrow && rightArrow) {

    function updateGenreArrows() {
      var maxScroll = genreContainer.scrollWidth - genreContainer.clientWidth;

      // If there's nothing to scroll, hide both arrows
      if (maxScroll <= 1) {
        leftArrow.disabled = true;
        rightArrow.disabled = true;
        return;
      }

      leftArrow.disabled = genreContainer.scrollLeft <= 0;
      rightArrow.disabled = genreContainer.scrollLeft >= maxScroll - 1;
    }

    leftArrow.addEventListener("click", function () {
      genreContainer.scrollBy({ left: -250, behavior: "smooth" });
    });

    rightArrow.addEventListener("click", function () {
      genreContainer.scrollBy({ left: 250, behavior: "smooth" });
    });

    genreContainer.addEventListener("scroll", updateGenreArrows);
    window.addEventListener("resize", updateGenreArrows);
    updateGenreArrows();
  }

  // ---- Content carousels (Homepage) ----
  document.querySelectorAll(".content-carousel").forEach(function (wrap) {
    var container = wrap.querySelector(".carousel-container");
    var track = wrap.querySelector(".carousel-track");
    var leftBtn = wrap.querySelector(".carousel-arrow-left");
    var rightBtn = wrap.querySelector(".carousel-arrow-right");
    if (!container || !track || !leftBtn || !rightBtn) return;

    function amount() {
      var card = track.firstElementChild;
      return card ? card.getBoundingClientRect().width + 28 : 300;
    }

    function update() {
      var maxScroll = container.scrollWidth - container.clientWidth;

      // If there's nothing to scroll, hide both arrows
      if (maxScroll <= 1) {
        leftBtn.disabled = true;
        rightBtn.disabled = true;
        return;
      }

      leftBtn.disabled = container.scrollLeft <= 0;
      rightBtn.disabled = container.scrollLeft >= maxScroll - 1;
    }

    leftBtn.addEventListener("click", function () {
      container.scrollBy({ left: -amount(), behavior: "smooth" });
    });

    rightBtn.addEventListener("click", function () {
      container.scrollBy({ left: amount(), behavior: "smooth" });
    });

    container.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
  });

  // ---- Nav Search (inline dropdown) ----
  (function initNavSearch() {
    var searchItem = document.querySelector(".nav-search-item");
    if (!searchItem) return;

    var searchToggle = searchItem.querySelector(".nav-search-toggle");
    var searchInput = searchItem.querySelector(".nav-search-input");
    var resultsBox = searchItem.querySelector(".nav-search-results");
    var listBox = searchItem.querySelector(".nav-search-list");
    var allBtn = searchItem.querySelector(".nav-search-all");

    var baseUrlMeta = document.querySelector('meta[name="base-url"]');
    var baseUrl = baseUrlMeta ? baseUrlMeta.content : "";
    var searchIndex = [];
    var loaded = false;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function loadIndex() {
      if (loaded) return Promise.resolve();
      return fetch(baseUrl + "/search-index.json")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          searchIndex = data;
          loaded = true;
        })
        .catch(function (e) {
          console.warn("Search index failed to load:", e);
        });
    }

    function renderResults(query) {
      var q = query.trim().toLowerCase();

      if (!q) {
        resultsBox.hidden = true;
        listBox.innerHTML = "";
        allBtn.hidden = true;
        return;
      }

      var allMatches = searchIndex.filter(function (item) {
        return (item.title || "").toLowerCase().indexOf(q) !== -1;
      });

      var hasMore = allMatches.length > 7;
      var matches = allMatches.slice(0, 7);

      if (!matches.length) {
        listBox.innerHTML = '<div class="nav-search-empty">No results for "' + escapeHtml(query) + '"</div>';
        allBtn.hidden = true;
        allBtn.style.display = "none";
        resultsBox.hidden = false;
        return;
      }

      listBox.innerHTML = matches.map(function (item) {
        var coverSrc = item.cover
          ? (item.cover.startsWith("http") ? item.cover : baseUrl + item.cover)
          : "";
        var coverHtml = item.cover
          ? '<img class="nav-search-cover" src="' + coverSrc + '" alt="">'
          : '<div class="nav-search-cover nav-search-cover-empty"></div>';
        var dateStr = "";
        if (item.date) {
          var d = new Date(item.date);
          if (!isNaN(d)) {
            dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
          }
        }

        return '<a class="nav-search-result" href="' + baseUrl + item.url + '">' +
          coverHtml +
          '<div class="nav-search-text">' +
          '<span class="search-type">' + escapeHtml(item.type) + '</span>' +
          '<span class="search-title">' + escapeHtml(item.title) + '</span>' +
          (dateStr ? '<span class="search-date">' + dateStr + '</span>' : '') +
          '</div>' +
          '</a>';
      }).join("");

      if (hasMore) {
        allBtn.hidden = false;
        allBtn.style.display = "";
        allBtn.href = baseUrl + "/search/?q=" + encodeURIComponent(query);
      } else {
        allBtn.hidden = true;
        allBtn.style.display = "none";
      }

      resultsBox.hidden = false;
    }

    // Toggle the input (desktop only)
    if (searchToggle) {
      searchToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = searchItem.classList.toggle("open");
        searchToggle.setAttribute("aria-expanded", isOpen);
        if (isOpen) {
          loadIndex().then(function () { searchInput.focus(); });
        } else {
          resultsBox.hidden = true;
          searchInput.value = "";
        }
      });
    }

    // Live filtering
    searchInput.addEventListener("input", function () {
      loadIndex().then(function () {
        renderResults(searchInput.value);
      });
    });

    // Close on outside click (desktop)
    document.addEventListener("click", function (e) {
      if (!searchItem.contains(e.target)) {
        searchItem.classList.remove("open");
        if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
        resultsBox.hidden = true;
      }
    });

    // Close on Escape
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        searchItem.classList.remove("open");
        if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
        resultsBox.hidden = true;
        searchInput.value = "";
        searchInput.blur();
      }
    });
  })();

  // ---- Full search results page ----
  var fullResults = document.getElementById("search-full-results");
  if (fullResults) {
    var baseUrlMeta = document.querySelector('meta[name="base-url"]');
    var baseUrl = baseUrlMeta ? baseUrlMeta.content : "";
    var query = new URLSearchParams(location.search).get("q") || "";
    document.getElementById("search-query-display").textContent = query
      ? 'Results for "' + query + '"'
      : "Type something in the search box above.";

    function fullEscape(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    if (query) {
      fetch(baseUrl + "/search-index.json")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var q = query.toLowerCase();
          var matches = data.filter(function (item) {
            return (item.title || "").toLowerCase().indexOf(q) !== -1;
          });

          if (!matches.length) {
            fullResults.innerHTML = '<p class="search-empty">No results found.</p>';
            return;
          }

          fullResults.innerHTML = matches.map(function (item) {
            var cover = item.cover
              ? '<img class="search-result-cover" src="' + baseUrl + item.cover + '" alt="">'
              : '<div class="search-result-cover search-result-cover-empty"></div>';

            var dateStr = "";
            if (item.date) {
              var d = new Date(item.date);
              if (!isNaN(d)) {
                dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
              }
            }

            return '<a class="search-result" href="' + baseUrl + item.url + '">' +
              cover +
              '<div class="search-result-text">' +
              '<span class="search-result-type">' + fullEscape(item.type) + '</span>' +
              '<h3>' + fullEscape(item.title) + '</h3>' +
              (dateStr ? '<span class="search-result-date">' + dateStr + '</span>' : '') +
              '</div>' +
              '</a>';
          }).join("");
        })
        .catch(function () {
          fullResults.innerHTML = '<p class="search-empty">Failed to load search index.</p>';
        });
    }
  }
});