/**
 * YearBook Citations – app.js
 * Promo 2026 · Marcq Institution
 * Architecture : 100% Vanilla JS ES6, statique, aucune dépendance externe.
 */

/* ================================================================
   CONFIGURATION
   ================================================================ */
const CONFIG = {
  GOOGLE_FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSdwAZ1QZUJzDmz8ulWTXHTNuU3UwL_S-dxl6iK1cZVvxVtC3g/viewform',
  DATA_PATH: 'data/quotes.json',
  BATCH_SIZE: 24, // citations chargées par vague (lazy loading)
  TOAST_DURATION: 3200,
  MAX_CHARS: 440,
  STORAGE_KEY_FAV: 'yearbook_favorites_2026',
  STORAGE_KEY_PERSONAL: 'yearbook_personal_2026',
  STORAGE_KEY_THEME: 'yearbook_theme_2026',
};

/* ================================================================
   TAG LABELS (affichage humain)
   ================================================================ */
const TAG_LABELS = {
  'humour': '😄 Humour',
  'philosophie': '🧠 Philosophie',
  'inspiration': '✨ Inspiration',
  'motivation': '🚀 Motivation',
  'bonheur': '😊 Bonheur',
  'amitié': '🤝 Amitié',
  'amour': '❤️ Amour',
  'rêves': '🌟 Rêves',
  'devenir-soi': '🦋 Devenir soi',
  'collectif': '👥 Collectif',
  'citation-connue': '🏛️ Citation connue',
  'futur-médecine': '🩺 Médecine',
  'futur-ingénierie': '⚙️ Ingénierie',
  'futur-commerce': '📈 Commerce',
  'futur-droit': '⚖️ Droit',
};

/* ================================================================
   STATE
   ================================================================ */
let allQuotes = [];     // toutes les citations + perso
let filtered = [];     // après filtres / recherche
let displayed = 0;      // nb affiché (lazy loading)
let activeTags = new Set();
let favorites = new Set();
let personalQuotes = [];    // citations personnelles locales
let sortMode = 'favorites'; // tri par défaut : favoris en premier
let isLoading = false;
let observer = null;

/* ================================================================
   DOM REFS
   ================================================================ */
const dom = {};

function cacheDOM() {
  dom.body = document.body;
  dom.banner = document.getElementById('banner');
  dom.bannerClose = document.getElementById('banner-close');
  dom.themeToggle = document.getElementById('theme-toggle');
  dom.themeIcon = document.getElementById('theme-icon');
  dom.ctaForm = document.getElementById('cta-form');
  dom.searchInput = document.getElementById('search-input');
  dom.searchClear = document.getElementById('search-clear');
  dom.tagChips = document.getElementById('tag-chips');
  dom.filtersReset = document.getElementById('filters-reset');
  dom.sortSelect = document.getElementById('sort-select');
  dom.countLabel = document.getElementById('count-label');
  dom.quotesGrid = document.getElementById('quotes-grid');
  dom.loader = document.getElementById('loader');
  dom.endMessage = document.getElementById('end-message');
  dom.emptyMessage = document.getElementById('empty-message');
  dom.emptyReset = document.getElementById('empty-reset');
  dom.customInput = document.getElementById('custom-input');
  dom.charCounter = document.getElementById('char-counter');
  dom.customPreview = document.getElementById('custom-preview');
  dom.customSave = document.getElementById('custom-save');
  dom.toast = document.getElementById('toast');
  dom.fabFavorites = document.getElementById('fab-favorites');
  dom.fabCount = document.getElementById('fab-count');
  dom.favoritesPanel = document.getElementById('favorites-panel');
  dom.panelClose = document.getElementById('panel-close');
  dom.panelOverlay = document.getElementById('panel-overlay');
  dom.favoritesList = document.getElementById('favorites-list');
  dom.favoritesEmpty = document.getElementById('favorites-empty');
  dom.footerReset = document.getElementById('footer-reset');
  dom.modal = document.getElementById('custom-modal');
  dom.modalCancel = document.getElementById('modal-cancel');
  dom.modalConfirm = document.getElementById('modal-confirm');
}

/* ================================================================
   THEME
   ================================================================ */
function initTheme() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEY_THEME);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  setTheme(theme);
}

function setTheme(theme) {
  dom.body.setAttribute('data-theme', theme);
  dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(CONFIG.STORAGE_KEY_THEME, theme);
}

function toggleTheme() {
  const current = dom.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  if (window.posthog) posthog.capture('theme_changed', { theme: next });
}

/* ================================================================
   DATA LOADING
   ================================================================ */
async function loadData() {
  try {
    const resp = await fetch(CONFIG.DATA_PATH);
    const data = await resp.json();
    // Merge personal quotes
    allQuotes = [...personalQuotes.map(p => ({ ...p, isPersonal: true })), ...data];
  } catch {
    // Fallback si le fetch échoue en file://
    allQuotes = [...personalQuotes.map(p => ({ ...p, isPersonal: true }))];
    showToast('⚠️ Impossible de charger les citations.');
  }
}

/* ================================================================
   STORAGE HELPERS
   ================================================================ */
function loadStorage() {
  try {
    const rawFav = localStorage.getItem(CONFIG.STORAGE_KEY_FAV);
    favorites = rawFav ? new Set(JSON.parse(rawFav)) : new Set();
  } catch { favorites = new Set(); }

  try {
    const rawPers = localStorage.getItem(CONFIG.STORAGE_KEY_PERSONAL);
    personalQuotes = rawPers ? JSON.parse(rawPers) : [];
  } catch { personalQuotes = []; }
}

function saveFavorites() {
  localStorage.setItem(CONFIG.STORAGE_KEY_FAV, JSON.stringify([...favorites]));
}

function savePersonal() {
  localStorage.setItem(CONFIG.STORAGE_KEY_PERSONAL, JSON.stringify(personalQuotes));
}

/* ================================================================
   FILTER & SORT
   ================================================================ */
function getSearchQuery() {
  return dom.searchInput.value.trim().toLowerCase();
}

function applyFilters() {
  const q = getSearchQuery();
  filtered = allQuotes.filter(quote => {
    // Tag filter – UNION : la citation doit avoir AU MOINS UN des tags actifs
    if (activeTags.size > 0) {
      const quoteTags = quote.tags || [];
      const matches = [...activeTags].some(t => quoteTags.includes(t));
      if (!matches) return false;
    }
    // Text search
    if (q) {
      return quote.text.toLowerCase().includes(q);
    }
    return true;
  });

  if (q && window.posthog) {
    posthog.capture('search_performed', { query: q, results_count: filtered.length });
  }

  applySort();

  // Reset displayed count
  displayed = 0;
  dom.quotesGrid.innerHTML = '';
  dom.endMessage.hidden = true;
  dom.emptyMessage.hidden = true;
  dom.loader.hidden = true;

  updateCount();

  // Pas de batch à charger si aucun résultat
  if (filtered.length === 0) {
    showEndOrEmpty();
    return;
  }
  loadNextBatch();
}

function applySort() {
  switch (sortMode) {
    case 'alpha':
      filtered.sort((a, b) => a.text.localeCompare(b.text, 'fr'));
      break;
    case 'random':
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      break;
    case 'favorites':
      filtered.sort((a, b) => {
        const fa = favorites.has(String(a.id)) ? 1 : 0;
        const fb = favorites.has(String(b.id)) ? 1 : 0;
        return fb - fa;
      });
      break;
    default:
      // Personal citations first, then original order
      filtered.sort((a, b) => {
        if (a.isPersonal && !b.isPersonal) return -1;
        if (!a.isPersonal && b.isPersonal) return 1;
        return 0;
      });
  }
}

/* ================================================================
   LAZY LOADING
   ================================================================ */
function loadNextBatch() {
  if (isLoading) return;
  if (displayed >= filtered.length) {
    showEndOrEmpty();
    return;
  }
  isLoading = true;

  const batch = filtered.slice(displayed, displayed + CONFIG.BATCH_SIZE);
  batch.forEach((q, i) => {
    const card = createCard(q);
    card.style.animationDelay = `${i * 0.04}s`;
    dom.quotesGrid.appendChild(card);
  });
  displayed += batch.length;
  isLoading = false;

  if (displayed >= filtered.length) {
    showEndOrEmpty();
  }
}

function showEndOrEmpty() {
  if (filtered.length === 0) {
    dom.emptyMessage.hidden = false;
    dom.endMessage.hidden = true;
  } else if (displayed >= filtered.length) {
    dom.endMessage.hidden = false;
    dom.emptyMessage.hidden = true;
    if (window.posthog) posthog.capture('end_reached', { total_displayed: displayed });
  }
}

function setupIntersectionObserver() {
  if (observer) observer.disconnect();

  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  sentinel.style.cssText = 'height:1px;margin-top:-1px;';
  dom.quotesGrid.after(sentinel);

  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !isLoading && displayed < filtered.length) {
      loadNextBatch();
    }
  }, { rootMargin: '200px' });

  observer.observe(sentinel);
}

function updateCount() {
  const total = filtered.length;
  dom.countLabel.textContent =
    total === 0 ? 'Aucune citation trouvée'
      : `${total} citation${total > 1 ? 's' : ''} trouvée${total > 1 ? 's' : ''}`;
}

/* ================================================================
   CARD RENDERING
   ================================================================ */
function createCard(quote) {
  const isFav = favorites.has(String(quote.id));
  const tags = quote.tags || [];

  const article = document.createElement('article');
  article.className = 'card' + (quote.isPersonal ? ' is-personal' : '');
  article.setAttribute('role', 'listitem');
  article.dataset.id = quote.id;

  const tagsHtml = tags.map(t => {
    const label = TAG_LABELS[t] || t;
    return `<button class="card-tag" data-tag="${escapeHtml(t)}" title="Filtrer par ${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  }).join('');

  article.innerHTML = `
    ${quote.isPersonal ? '<span class="personal-badge">Ma citation</span>' : ''}
    <div class="card-body">
      <blockquote class="card-quote">« ${escapeHtml(quote.text)} »</blockquote>
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
    </div>
    <div class="card-footer">
      <button class="card-btn fav-btn ${isFav ? 'active' : ''}"
        aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
        aria-pressed="${isFav}"
        title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
        ${isFav ? '❤️' : '🤍'}
      </button>
      <button class="card-btn-copy copy-btn"
        aria-label="Copier cette citation"
        title="Copier la citation">
        📋 Copier
      </button>
    </div>
  `;

  // Events
  article.querySelector('.fav-btn').addEventListener('click', () => toggleFavorite(quote, article));
  article.querySelector('.copy-btn').addEventListener('click', () => copyQuote(quote.text, quote.id));

  article.querySelectorAll('.card-tag').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleTagFilter(btn.dataset.tag);
    });
  });

  return article;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ================================================================
   FAVORITES
   ================================================================ */
function toggleFavorite(quote, cardEl) {
  const id = String(quote.id);
  const isPersonal = !!quote.isPersonal;

  if (favorites.has(id)) {
    favorites.delete(id);
    if (window.posthog) posthog.capture('favorite_removed', { quote_id: id, is_personal: isPersonal });
    if (isPersonal) {
      // Si c'est une citation perso, on la supprime carrément
      deletePersonalQuote(id);
      showToast('🗑️ Citation personnelle supprimée');
    } else {
      showToast('💔 Retiré des favoris');
    }
  } else {
    favorites.add(id);
    if (window.posthog) posthog.capture('favorite_added', { quote_id: id, is_personal: isPersonal });
    showToast('❤️ Ajouté aux favoris !');
  }
  saveFavorites();
  updateFavButton(cardEl, favorites.has(id));
  updateFabCount();
  if (dom.favoritesPanel.classList.contains('is-open')) renderFavoritesPanel();
}

/**
 * Supprime définitivement une citation perso de l'état global et du storage
 */
function deletePersonalQuote(id) {
  // Retirer de personalQuotes
  personalQuotes = personalQuotes.filter(q => String(q.id) !== String(id));
  savePersonal();

  // Retirer de allQuotes
  allQuotes = allQuotes.filter(q => String(q.id) !== String(id));

  // Re-filtrer et re-rendre si besoin (la carte disparaîtra au prochain applyFilters ou on peut la cacher direct)
  const cardEl = dom.quotesGrid.querySelector(`[data-id="${id}"]`);
  if (cardEl) {
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'scale(0.9)';
    setTimeout(() => {
      cardEl.remove();
      updateCount();
    }, 200);
  }
}

function updateFavButton(cardEl, isFav) {
  const btn = cardEl.querySelector('.fav-btn');
  if (!btn) return;
  btn.classList.toggle('active', isFav);
  btn.setAttribute('aria-pressed', String(isFav));
  btn.setAttribute('aria-label', isFav ? 'Retirer des favoris' : 'Ajouter aux favoris');
  btn.setAttribute('title', isFav ? 'Retirer des favoris' : 'Ajouter aux favoris');
  btn.textContent = isFav ? '❤️' : '🤍';
}

function updateFabCount() {
  const count = favorites.size;
  dom.fabCount.textContent = count;
  dom.fabFavorites.setAttribute('aria-label', `Voir mes favoris (${count})`);
}

/* ================================================================
   FAVORITES PANEL
   ================================================================ */
function openFavoritesPanel() {
  dom.favoritesPanel.classList.add('is-open');
  dom.panelOverlay.classList.add('is-open');
  dom.favoritesPanel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (window.posthog) posthog.capture('favorites_panel_opened', { count: favorites.size });
  renderFavoritesPanel();
  dom.panelClose.focus();
}

function closeFavoritesPanel() {
  dom.favoritesPanel.classList.remove('is-open');
  dom.panelOverlay.classList.remove('is-open');
  dom.favoritesPanel.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function renderFavoritesPanel() {
  const favQuotes = allQuotes.filter(q => favorites.has(String(q.id)));

  if (favQuotes.length === 0) {
    dom.favoritesList.innerHTML = '';
    dom.favoritesEmpty.hidden = false;
    return;
  }
  dom.favoritesEmpty.hidden = true;

  dom.favoritesList.innerHTML = favQuotes.map(q => `
    <div class="fav-item" role="listitem" data-id="${q.id}">
      <p class="fav-item-quote">${escapeHtml(q.text)}</p>
      <div class="fav-item-actions">
        <button class="fav-item-btn copy-panel-btn" title="Copier" aria-label="Copier cette citation">📋</button>
        <button class="fav-item-btn remove-fav" title="Retirer" aria-label="Retirer des favoris">🗑️</button>
      </div>
    </div>
  `).join('');

  dom.favoritesList.querySelectorAll('.fav-item').forEach(item => {
    const id = item.dataset.id;
    const quote = allQuotes.find(q => String(q.id) === id);

    item.querySelector('.copy-panel-btn').addEventListener('click', () => copyQuote(quote.text, quote.id));
    item.querySelector('.remove-fav').addEventListener('click', () => {
      const isPersonal = String(id).startsWith('perso_');
      favorites.delete(String(id));
      if (window.posthog) posthog.capture('favorite_removed', { quote_id: id, is_personal: isPersonal, from: 'panel' });
      saveFavorites();

      if (isPersonal) {
        deletePersonalQuote(id);
      }

      updateFabCount();
      // Update card favorite button state in grid if visible
      const cardEl = dom.quotesGrid.querySelector(`[data-id="${id}"]`);
      if (cardEl && !isPersonal) updateFavButton(cardEl, false);

      renderFavoritesPanel();
    });
  });
}

/* ================================================================
   COPY & TOAST
   ================================================================ */
let toastTimer = null;

async function copyQuote(text, quoteId) {
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  await doCopy();
  if (window.posthog) posthog.capture('citation_copied', { quote_id: quoteId, text_length: text.length });

  // Toast cliquable avec lien formulaire
  dom.toast.innerHTML = `
    <span>📋 Citation copiée !</span>
    <a id="toast-form-link" class="toast-link" href="${escapeHtml(CONFIG.GOOGLE_FORM_URL)}" target="_blank" rel="noopener noreferrer">
      ✍️ Soumettre via le formulaire →
    </a>
  `;
  dom.toast.classList.add('show', 'toast-with-link');

  // Track toast link click
  const toastLink = dom.toast.querySelector('#toast-form-link');
  if (toastLink) {
    toastLink.addEventListener('click', () => {
      if (window.posthog) posthog.capture('form_cta_clicked', { location: 'toast' });
    });
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show', 'toast-with-link');
  }, CONFIG.TOAST_DURATION + 1000);
}

function showToast(msg, allowHtml = false) {
  dom.toast.classList.remove('toast-with-link');
  if (allowHtml) {
    dom.toast.innerHTML = msg;
  } else {
    dom.toast.textContent = msg;
  }
  dom.toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), CONFIG.TOAST_DURATION);
}

/* ================================================================
   TAG CHIPS RENDERING
   ================================================================ */
function renderTagChips() {
  // Collect all tags from all quotes (excluding personal)
  const tagSet = new Set();
  allQuotes.forEach(q => (q.tags || []).forEach(t => tagSet.add(t)));

  // Sort by known order, then alphabetically
  const orderedTags = Object.keys(TAG_LABELS).filter(t => tagSet.has(t));
  tagSet.forEach(t => { if (!TAG_LABELS[t]) orderedTags.push(t); });

  dom.tagChips.innerHTML = orderedTags.map(tag => {
    const label = TAG_LABELS[tag] || tag;
    const active = activeTags.has(tag);
    return `<button
      class="tag-chip ${active ? 'active' : ''}"
      role="checkbox"
      aria-checked="${active}"
      data-tag="${escapeHtml(tag)}"
      title="${escapeHtml(label)}"
    >${escapeHtml(label)}</button>`;
  }).join('');

  dom.tagChips.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleTagFilter(chip.dataset.tag));
  });
}

function toggleTagFilter(tag) {
  if (activeTags.has(tag)) {
    activeTags.delete(tag);
    if (window.posthog) posthog.capture('tag_filter_toggled', { tag, active: false });
  } else {
    activeTags.add(tag);
    if (window.posthog) posthog.capture('tag_filter_toggled', { tag, active: true });
  }
  updateFilterUI();
  applyFilters();
}

function updateFilterUI() {
  // Update chips state
  dom.tagChips.querySelectorAll('.tag-chip').forEach(chip => {
    const active = activeTags.has(chip.dataset.tag);
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-checked', String(active));
  });
  dom.filtersReset.hidden = activeTags.size === 0;
}

function resetFilters() {
  activeTags.clear();
  dom.searchInput.value = '';
  dom.searchClear.hidden = true;
  updateFilterUI();
  applyFilters();
  if (window.posthog) posthog.capture('filters_reset');
}

/* ================================================================
   CUSTOM / PERSONAL CITATIONS
   ================================================================ */
function initCustomCard() {
  dom.customInput.addEventListener('input', () => {
    const val = dom.customInput.value;
    const count = val.length;

    // Update counter visual
    dom.charCounter.textContent = `${count} / ${CONFIG.MAX_CHARS}`;
    dom.charCounter.classList.toggle('near-limit', count > CONFIG.MAX_CHARS - 20);
    dom.charCounter.classList.toggle('over-limit', count > CONFIG.MAX_CHARS);

    if (val.trim()) {
      dom.customPreview.textContent = val;
      dom.customPreview.classList.add('has-content');
    } else {
      dom.customPreview.textContent = 'Ta citation apparaîtra ici…';
      dom.customPreview.classList.remove('has-content');
    }
  });

  dom.customSave.addEventListener('click', savePersonalQuote);

  dom.customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') savePersonalQuote();
  });
}

function savePersonalQuote() {
  const text = dom.customInput.value.trim();
  if (!text) { showToast('✏️ Écris d\'abord ta citation !'); return; }
  if (text.length < 3) { showToast('✏️ Ta citation est trop courte !'); return; }
  if (text.length > CONFIG.MAX_CHARS) {
    showToast(`⚠️ Ta citation dépasse la limite de ${CONFIG.MAX_CHARS} caractères.`);
    return;
  }

  // Generate a unique ID for personal quotes
  const id = 'perso_' + Date.now();
  const newQuote = { id, text, tags: [], isPersonal: true };

  personalQuotes.unshift(newQuote);
  savePersonal();

  // Refresh allQuotes
  allQuotes = [...personalQuotes.map(p => ({ ...p, isPersonal: true })), ...allQuotes.filter(q => !q.isPersonal)];

  dom.customInput.value = '';
  dom.customPreview.textContent = 'Ta citation apparaîtra ici…';
  dom.customPreview.classList.remove('has-content');

  // Ajouter aux favoris automatiquement
  favorites.add(String(id));
  saveFavorites();
  updateFabCount();

  applyFilters();
  if (window.posthog) posthog.capture('personal_citation_saved', { text_length: text.length });
  showToast('💾 Citation sauvegardée et ajoutée aux favoris !');
}

/* ================================================================
   RESET ET MODAL
   ================================================================ */
function openModal() {
  dom.modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  dom.modal.hidden = true;
  document.body.style.overflow = '';
}

function resetAll() {
  if (window.posthog) posthog.capture('data_reset_confirmed');
  localStorage.removeItem(CONFIG.STORAGE_KEY_FAV);
  localStorage.removeItem(CONFIG.STORAGE_KEY_PERSONAL);
  // On peut aussi garder l'URL du form si on veut, mais c'est pas dans LS
  location.reload();
}

/* ================================================================
   EVENT LISTENERS
   ================================================================ */
function initEvents() {
  // Banner
  dom.bannerClose.addEventListener('click', () => {
    dom.banner.classList.add('hidden');
    if (window.posthog) posthog.capture('banner_closed');
  });

  // Theme
  dom.themeToggle.addEventListener('click', toggleTheme);

  // CTA Google Form
  dom.ctaForm.href = CONFIG.GOOGLE_FORM_URL;
  dom.ctaForm.addEventListener('click', () => {
    if (window.posthog) posthog.capture('form_cta_clicked', { location: 'header' });
  });

  // Search
  dom.searchInput.addEventListener('input', () => {
    dom.searchClear.hidden = !dom.searchInput.value;
    applyFilters();
  });
  dom.searchClear.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.searchClear.hidden = true;
    dom.searchInput.focus();
    applyFilters();
  });

  // Sort
  dom.sortSelect.addEventListener('change', () => {
    sortMode = dom.sortSelect.value;
    applyFilters();
    if (window.posthog) posthog.capture('sort_changed', { mode: sortMode });
  });

  // Reset filters buttons
  dom.filtersReset.addEventListener('click', resetFilters);
  dom.emptyReset.addEventListener('click', resetFilters);

  // Favorites panel
  dom.fabFavorites.addEventListener('click', openFavoritesPanel);
  dom.panelClose.addEventListener('click', closeFavoritesPanel);
  dom.panelOverlay.addEventListener('click', closeFavoritesPanel);

  // Footer reset
  dom.footerReset.addEventListener('click', openModal);

  // Modal handlers
  dom.modalCancel.addEventListener('click', closeModal);
  dom.modalConfirm.addEventListener('click', resetAll);
  dom.modal.addEventListener('click', e => {
    if (e.target === dom.modal) closeModal();
  });

  // Keyboard: close panel on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dom.favoritesPanel.classList.contains('is-open')) closeFavoritesPanel();
  });
}

/* ================================================================
   INIT
   ================================================================ */
async function init() {
  cacheDOM();
  loadStorage();
  initTheme();
  initEvents();
  initCustomCard();

  // Update header link
  dom.ctaForm.href = CONFIG.GOOGLE_FORM_URL;

  // Show loader
  dom.loader.hidden = false;

  await loadData();

  dom.loader.hidden = true;

  renderTagChips();
  updateFabCount();
  applyFilters();
  setupIntersectionObserver();

  if (window.posthog) {
    posthog.capture('page_loaded', {
      favorites_count: favorites.size,
      personal_quotes_count: personalQuotes.length,
      theme: dom.body.getAttribute('data-theme')
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
