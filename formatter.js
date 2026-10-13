/* =====================================================================
   formatter.js — MyClassHelp Free Academic Assignment Formatter
   =====================================================================

   A zero-dependency, vanilla JavaScript engine that:

     1. Parses plain-text essay input (and detects a pasted source list).
     2. Formats source metadata into APA 7th, MLA 9th, or Chicago
        bibliography entries.
     3. Renders a live, visual APA/MLA/Chicago layout into #doc-sheet.
     4. Exports the rendered document as .doc, .html, or Print/PDF.
     5. Auto-saves the draft to localStorage so nothing is ever lost.

   No frameworks, no libraries, no build step. Everything is client-side.
   ===================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------------
     FORMAT RULES
     One config object per citation style. These encode the "paper" rules:
     font, size (pt), line height (multiple), reference-section heading,
     and whether the style uses a dedicated title page.
     ------------------------------------------------------------------- */
  var FORMAT_RULES = {
    apa: {
      label: 'APA 7th Edition',
      font: 'Times New Roman',
      fontSize: 12,
      lineHeight: 2,               // double spaced
      refHeading: 'References',
      titlePage: true              // full title page
    },
    mla: {
      label: 'MLA 9th Edition',
      font: 'Times New Roman',
      fontSize: 12,
      lineHeight: 2,
      refHeading: 'Works Cited',
      titlePage: false             // header block on page 1 instead
    },
    chicago: {
      label: 'Chicago 17th Edition',
      font: 'Times New Roman',
      fontSize: 12,
      lineHeight: 2,
      refHeading: 'Bibliography',
      titlePage: true
    }
  };

  /* -------------------------------------------------------------------
     SMALL UTILITIES
     ------------------------------------------------------------------- */

  /** Create an element with an optional class and text content. */
  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  /** Escape a string for safe insertion into HTML (used with innerHTML). */
  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Title-Case a string while keeping small connector words lowercase
   * (used for MLA/Chicago titles, which are title-cased).
   */
  function toTitleCase(str) {
    var smallWords = /^(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|v|vs|via)$/i;
    return String(str || '')
      .toLowerCase()
      .split(' ')
      .map(function (word, index) {
        if (index > 0 && smallWords.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /* -------------------------------------------------------------------
     AUTHOR FORMATTERS
     Sources arrive as a single string of authors separated by semicolons,
     e.g. "Smith, J.; Doe, A.". Each style reorders/inverts names
     differently. These mirror the rules used on the live MyClassHelp tool.
     ------------------------------------------------------------------- */

  /** Split "Last, First" pairs into a trimmed array. */
  function splitNames(authorStr) {
    return String(authorStr || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** APA: Lastname, F. M., & Lastname, F. M. */
  function formatAuthorsAPA(authorStr) {
    if (!authorStr || authorStr === 'Unknown') return 'Unknown Author';
    var formatted = splitNames(authorStr).map(function (name) {
      if (name.indexOf(',') === -1) return name;              // already "Lastname"
      var parts = name.split(',').map(function (p) { return p.trim(); });
      var lastName = parts[0];
      var firstName = parts[1] || '';
      var initials = firstName.split(/\s+/).filter(Boolean)
        .map(function (n) { return n.charAt(0).toUpperCase() + '.'; }).join(' ');
      return lastName + (initials ? ', ' + initials : '');
    });
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return formatted[0] + ', & ' + formatted[1];
    return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
  }

  /** MLA: First author inverted, then "et al" for 3+ authors. */
  function formatAuthorsMLA(authorStr) {
    if (!authorStr || authorStr === 'Unknown') return 'Unknown Author';
    var names = splitNames(authorStr);
    if (names.length >= 3) {
      var parts = names[0].split(',').map(function (p) { return p.trim(); });
      return (parts[0] || names[0]) + ', ' + (parts[1] || '') + ', et al';
    }
    return formatAuthorsChicago(authorStr); // same pattern for 1–2 authors
  }

  /** Chicago: only the first author is inverted (Last, First). */
  function formatAuthorsChicago(authorStr) {
    if (!authorStr || authorStr === 'Unknown') return 'Unknown Author';
    var names = splitNames(authorStr);
    var formatted = names.map(function (name, i) {
      if (name.indexOf(',') === -1) return name;
      var parts = name.split(',').map(function (p) { return p.trim(); });
      var lastName = parts[0];
      var firstName = parts[1] || '';
      if (i === 0) return lastName + (firstName ? ', ' + firstName : '');
      return (firstName ? firstName + ' ' : '') + lastName;
    });
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return formatted[0] + ', and ' + formatted[1];
    return formatted.slice(0, -1).join(', ') + ', and ' + formatted[formatted.length - 1];
  }
  /* -------------------------------------------------------------------
     CITATION FORMATTING
     Turn a normalised source object into a bibliography entry. Returns an
     HTML string so journals/titles can be italicised via <em>. All user
     text is escaped first, so innerHTML insertion is safe.
     ------------------------------------------------------------------- */

  /**
   * Format one source for the given style.
   * @param {object} source {author,title,year,publisher,url}
   * @param {string} format 'apa' | 'mla' | 'chicago'
   * @returns {string} HTML string
   */
  function formatSingle(source, format) {
    var style = (format || 'apa').toLowerCase();
    var authors = source.author || 'Unknown Author';
    var year = source.year || 'n.d.';
    var title = source.title || 'Untitled';
    var journal = source.publisher || '';
    var url = source.url || '';

    if (style === 'mla') {
      // Author. "Title." Journal, Year.
      var mla = escapeHtml(formatAuthorsMLA(authors)) + '. ' +
                '&ldquo;' + escapeHtml(toTitleCase(title)) + '.&rdquo;';
      if (journal) mla += ' <em>' + escapeHtml(journal) + '</em>,';
      mla += ' ' + escapeHtml(year) + '.';
      return mla;
    }

    if (style === 'chicago') {
      // Author. Year. "Title." Journal.
      var chi = escapeHtml(formatAuthorsChicago(authors)) + '. ' + escapeHtml(year) + '. ' +
                '&ldquo;' + escapeHtml(toTitleCase(title)) + '.&rdquo;';
      if (journal) chi += ' <em>' + escapeHtml(journal) + '</em>';
      chi += '.';
      if (url) chi += ' ' + escapeHtml(url) + '.';
      return chi;
    }

    // Default: APA 7th — Author, F. M. (Year). Title. Journal. URL
    var apa = escapeHtml(formatAuthorsAPA(authors)) + ' (' + escapeHtml(year) + '). ' +
              escapeHtml(title) + '.';
    if (journal) apa += ' <em>' + escapeHtml(journal) + '</em>.';
    if (url) apa += ' ' + escapeHtml(url);
    return apa;
  }

  /** Format an array of sources into a newline-separated bibliography. */
  function formatBibliography(sources, format) {
    if (!sources || !sources.length) return [];
    return sources.map(function (s) { return formatSingle(s, format); });
  }

  /* -------------------------------------------------------------------
     ESSAY PARSER
     Splits the raw textarea value into { bodyText, pastedReferences }.
     A line containing ONLY "references", "works cited", or "bibliography"
     acts as the divider; everything below it becomes the source list.
     ------------------------------------------------------------------- */
  function parseEssayText(raw) {
    var normalised = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = normalised.split('\n');
    var pattern = /^(references|works\s+cited|bibliography)$/i;
    var splitIndex = -1;

    for (var i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i].trim())) { splitIndex = i; break; }
    }

    if (splitIndex === -1) {
      return { bodyText: normalised.trim(), pastedReferences: '' };
    }
    return {
      bodyText: lines.slice(0, splitIndex).join('\n').trim(),
      pastedReferences: lines.slice(splitIndex + 1).join('\n').trim()
    };
  }
  /* -------------------------------------------------------------------
     APPLICATION STATE + DOM REFERENCES
     ------------------------------------------------------------------- */
  var state = {
    format: 'apa',
    sources: []      // array of normalised source objects
  };

  var els = {};       // populated in cacheDom()

  function cacheDom() {
    els.root           = document.querySelector('.tool');
    els.essayBody      = document.getElementById('essay-body');
    els.formatSelect   = document.getElementById('format-select');
    els.clearBtn       = document.getElementById('clear-btn');

    els.docTitle       = document.getElementById('doc-title');
    els.studentName    = document.getElementById('student-name');
    els.courseName     = document.getElementById('course-name');
    els.instructorName = document.getElementById('instructor-name');
    els.docDate        = document.getElementById('doc-date');

    els.sourceAuthor    = document.getElementById('source-author');
    els.sourceTitle     = document.getElementById('source-title');
    els.sourceYear      = document.getElementById('source-year');
    els.sourcePublisher = document.getElementById('source-publisher');
    els.sourceUrl       = document.getElementById('source-url');
    els.addSourceBtn    = document.getElementById('add-source-btn');
    els.sourceList      = document.getElementById('source-list');
    els.sourceCount     = document.getElementById('source-count');

    els.sheet           = document.getElementById('doc-sheet');

    els.statWords       = document.getElementById('stat-words');
    els.statPages       = document.getElementById('stat-pages');
    els.statCitations   = document.getElementById('stat-citations');

    els.exportBtn       = document.getElementById('export-btn');
    els.exportMenu      = document.getElementById('export-menu');
  }

  /** Read the document-details inputs into a plain object. */
  function collectMeta() {
    return {
      title:          (els.docTitle.value || '').trim(),
      studentName:    (els.studentName.value || '').trim(),
      courseName:     (els.courseName.value || '').trim(),
      instructorName: (els.instructorName.value || '').trim(),
      date:           (els.docDate.value || '').trim()
    };
  }

  /* -------------------------------------------------------------------
     RENDERING
     ------------------------------------------------------------------- */

  /**
   * Render the fully formatted document into #doc-sheet for the current
   * style. This is the "visual" formatting step.
   */
  function renderPreview() {
    var rules = FORMAT_RULES[state.format];
    var meta = collectMeta();
    var parsed = parseEssayText(els.essayBody.value);
    var sheet = els.sheet;

    sheet.innerHTML = '';
    sheet.setAttribute('data-format', state.format);
    // Apply the style's typography inline so all three styles share one sheet.
    sheet.style.fontFamily = "'" + rules.font + "', serif";
    sheet.style.fontSize = rules.fontSize + 'pt';
    sheet.style.lineHeight = String(rules.lineHeight);

    // ---- Front matter -------------------------------------------------
    if (state.format === 'mla') {
      // MLA: no title page — a left-aligned header block, then centered title.
      var header = createEl('div', 'doc-mlaheader');
      [meta.studentName, meta.instructorName, meta.courseName, meta.date]
        .forEach(function (line) {
          if (line) header.appendChild(createEl('div', 'doc-mlaline', line));
        });
      sheet.appendChild(header);
      if (meta.title) sheet.appendChild(createEl('div', 'doc-title doc-title--centered', meta.title));
    } else {
      // APA & Chicago: dedicated title page.
      var page = createEl('div', 'doc-titlepage');
      page.appendChild(createEl('div', 'doc-title', meta.title || 'Untitled Document'));
      var metaBlock = createEl('div', 'doc-meta');
      [meta.studentName, meta.courseName, meta.instructorName, meta.date]
        .forEach(function (line) {
          if (line) metaBlock.appendChild(createEl('div', 'doc-metaline', line));
        });
      page.appendChild(metaBlock);
      sheet.appendChild(page);
      sheet.appendChild(createEl('div', 'doc-pagebreak'));
    }

    // ---- Body paragraphs (one per non-empty line) ---------------------
    parsed.bodyText.split('\n').forEach(function (line) {
      var trimmed = line.trim();
      if (trimmed) sheet.appendChild(createEl('p', 'doc-p', trimmed));
    });

    // ---- References section -------------------------------------------
    var refs = [];
    // (a) references the user pasted under the heading
    if (parsed.pastedReferences) {
      parsed.pastedReferences.split('\n').forEach(function (l) {
        if (l.trim()) refs.push(escapeHtml(l.trim()));
      });
    }
    // (b) sources added through the UI (formatted per style)
    formatBibliography(state.sources, state.format).forEach(function (html) {
      refs.push(html);
    });

    if (refs.length) {
      sheet.appendChild(createEl('div', 'doc-pagebreak'));
      sheet.appendChild(createEl('div', 'doc-heading', rules.refHeading));
      refs.forEach(function (html) {
        var p = createEl('p', 'doc-ref');
        p.innerHTML = html;   // safe: user text was escaped in formatSingle()
        sheet.appendChild(p);
      });
    }

    updateStats(refs.length);
  }

  /** Update the word / page / citation counters. */
  function updateStats(refCount) {
    var words = (els.essayBody.value || '').trim().split(/\s+/).filter(Boolean).length;
    els.statWords.textContent = words;
    els.statPages.textContent = Math.max(1, Math.ceil(words / 275)); // ~275 words per double-spaced page
    els.statCitations.textContent = refCount;
  }
  /* -------------------------------------------------------------------
     SOURCE LIST UI
     ------------------------------------------------------------------- */
  function renderSources() {
    els.sourceList.innerHTML = '';
    state.sources.forEach(function (src, index) {
      var li = createEl('li', 'source-item');

      var text = createEl('span', 'source-item__text',
        (src.author || 'Unknown') +
        (src.year ? ' (' + src.year + ')' : '') +
        (src.title ? '. ' + src.title : ''));

      var remove = createEl('button', 'source-item__remove', '\u2715');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove source');
      remove.addEventListener('click', function () {
        state.sources.splice(index, 1);
        renderSources();
        renderPreview();
        saveDraft();
      });

      li.appendChild(text);
      li.appendChild(remove);
      els.sourceList.appendChild(li);
    });
    els.sourceCount.textContent = state.sources.length;
  }

  /** Add a source from the manual-entry fields. */
  function addSourceFromFields() {
    var author = (els.sourceAuthor.value || '').trim();
    var title = (els.sourceTitle.value || '').trim();
    if (!author && !title) return;   // nothing meaningful to add

    state.sources.push({
      author: author,
      title: title,
      year: (els.sourceYear.value || '').trim(),
      publisher: (els.sourcePublisher.value || '').trim(),
      url: (els.sourceUrl.value || '').trim()
    });

    // Reset the entry fields.
    [els.sourceAuthor, els.sourceTitle, els.sourceYear, els.sourcePublisher, els.sourceUrl]
      .forEach(function (input) { input.value = ''; });
    els.sourceAuthor.focus();

    renderSources();
    renderPreview();
    saveDraft();
  }

  /* -------------------------------------------------------------------
     EXPORT  (the requested "sample export function")
     Supports three zero-dependency formats:
       • .doc   — Word-compatible HTML with print/page CSS
       • .html  — a self-contained snapshot of the formatted document
       • print  — the browser's Print dialog (Save as PDF)
     ------------------------------------------------------------------- */

  /** Build the sanitised filename (from the document title). */
  function buildFilename() {
    var raw = (els.docTitle.value || '').trim();
    if (!raw) return 'Formatted_Assignment';
    var clean = raw
      .replace(/[\\/:*?"<>|]/g, '')   // strip illegal filesystem characters
      .replace(/\s+/g, '_')           // spaces -> underscores
      .replace(/_{2,}/g, '_')         // collapse duplicates
      .replace(/^_|_$/g, '');         // trim edge underscores
    return clean || 'Formatted_Assignment';
  }

  /**
   * CSS used inside exported documents. Mirrors the on-screen .doc-sheet
   * rules but is self-contained (no external stylesheet reference).
   */
  function buildExportCss(rules) {
    return [
      '@page { size: 8.5in 11in; margin: 1in; }',
      'body { font-family: "' + rules.font + '", "Times New Roman", serif;' +
        ' font-size: ' + rules.fontSize + 'pt; line-height: ' + rules.lineHeight + ';' +
        ' color: #000; background: #fff; margin: 0; }',
      '.doc-sheet { max-width: 6.5in; margin: 0 auto; }',
      '.doc-titlepage { text-align: center; }',
      '.doc-titlepage .doc-title { margin-top: 2.5in; }',
      '.doc-title { font-weight: 700; margin: 0 0 1.5em; }',
      '.doc-title--centered { text-align: center; }',
      '.doc-metaline, .doc-mlaline { line-height: ' + rules.lineHeight + '; }',
      '.doc-mlaheader { margin-bottom: 1em; }',
      '.doc-p { margin: 0; text-indent: 0.5in; }',
      '.doc-heading { text-align: center; font-weight: 700; margin: 0 0 0.25em; }',
      '.doc-ref { margin: 0 0 0 0.5in; text-indent: -0.5in; }',
      '.doc-pagebreak { page-break-after: always; break-after: page; height: 0; }'
    ].join('\n');
  }

  /** Trigger a client-side file download from a string payload. */
  function downloadBlob(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Main export entry point.
   * @param {string} kind 'doc' | 'html' | 'print'
   */
  function exportDocument(kind) {
    var rules = FORMAT_RULES[state.format];
    var filename = buildFilename();
    var inner = els.sheet.innerHTML;
    var css = buildExportCss(rules);

    if (kind === 'print') {
      // @media print in styles.css hides all chrome and prints only the sheet.
      window.print();
      return;
    }

    if (kind === 'doc') {
      // Word-compatible HTML rendered with an .doc extension. Word, Pages,
      // Google Docs and LibreOffice all open this correctly.
      var docHtml =
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
        'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
        '<title>' + escapeHtml(filename) + '</title><style>' + css + '</style>' +
        '</head><body><div class="doc-sheet">' + inner + '</div></body></html>';
      downloadBlob(docHtml, filename + '.doc', 'application/msword');
      return;
    }

    if (kind === 'html') {
      // A fully self-contained HTML snapshot (inline CSS, no external files).
      var htmlDoc =
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>' + escapeHtml(filename) + '</title><style>' + css + '</style>' +
        '</head><body><div class="doc-sheet">' + inner + '</div></body></html>';
      downloadBlob(htmlDoc, filename + '.html', 'text/html');
    }
  }
  /* -------------------------------------------------------------------
     AUTO-SAVE (localStorage)
     The draft survives refreshes, tab closes, and crashes.
     ------------------------------------------------------------------- */
  var STORAGE_KEY = 'assignment_formatter_draft';

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        essayBody: els.essayBody.value,
        docTitle: els.docTitle.value,
        studentName: els.studentName.value,
        courseName: els.courseName.value,
        instructorName: els.instructorName.value,
        docDate: els.docDate.value,
        format: state.format
      }));
    } catch (e) {
      /* localStorage can be disabled (private mode) — fail silently. */
    }
  }

  function loadDraft() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;

    try {
      var draft = JSON.parse(raw);
      els.essayBody.value   = draft.essayBody   || '';
      els.docTitle.value    = draft.docTitle    || '';
      els.studentName.value = draft.studentName || '';
      els.courseName.value  = draft.courseName  || '';
      els.instructorName.value = draft.instructorName || '';
      els.docDate.value     = draft.docDate     || '';

      if (draft.format && FORMAT_RULES[draft.format]) {
        state.format = draft.format;
        els.formatSelect.value = draft.format;
      }
    } catch (e) {
      /* corrupt draft — ignore and start fresh */
    }
  }

  /* -------------------------------------------------------------------
     EXPORT MENU HELPERS
     ------------------------------------------------------------------- */
  function openExportMenu() {
    els.exportMenu.classList.remove('hidden');
    els.exportBtn.setAttribute('aria-expanded', 'true');
  }

  function closeExportMenu() {
    els.exportMenu.classList.add('hidden');
    els.exportBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleExportMenu() {
    if (els.exportMenu.classList.contains('hidden')) openExportMenu();
    else closeExportMenu();
  }

  /** Debounce: run fn only after `wait` ms of inactivity. */
  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  /* -------------------------------------------------------------------
     EVENT WIRING
     ------------------------------------------------------------------- */
  function bindEvents() {
    // Re-render as the user types (debounced for performance).
    var onEssayInput = debounce(function () { renderPreview(); saveDraft(); }, 150);
    els.essayBody.addEventListener('input', onEssayInput);

    // Document details re-render + save immediately.
    var onMetaInput = function () { renderPreview(); saveDraft(); };
    [els.docTitle, els.studentName, els.courseName, els.instructorName, els.docDate]
      .forEach(function (input) { input.addEventListener('input', onMetaInput); });

    // Format switch.
    els.formatSelect.addEventListener('change', function () {
      state.format = els.formatSelect.value;
      renderPreview();
      saveDraft();
    });

    // Clear the essay.
    els.clearBtn.addEventListener('click', function () {
      if (!els.essayBody.value.trim() || window.confirm('Clear all essay text?')) {
        els.essayBody.value = '';
        renderPreview();
        saveDraft();
      }
    });

    // Add a source (button + Enter inside the author field).
    els.addSourceBtn.addEventListener('click', addSourceFromFields);
    els.sourceAuthor.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addSourceFromFields(); }
    });

    // Export menu.
    els.exportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleExportMenu();
    });
    els.exportMenu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-export]');
      if (!btn) return;
      closeExportMenu();
      exportDocument(btn.getAttribute('data-export'));
    });
    // Close the menu on outside click or Escape.
    document.addEventListener('click', closeExportMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeExportMenu();
    });
  }

  /* -------------------------------------------------------------------
     INITIALISE
     ------------------------------------------------------------------- */
  function init() {
    cacheDom();
    if (!els.root || !els.sheet) return;   // not on the formatter page

    loadDraft();
    bindEvents();
    renderSources();
    renderPreview();
  }

  // Boot once the DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }




})();
