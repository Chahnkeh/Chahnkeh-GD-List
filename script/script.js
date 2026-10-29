let selectedItem = null;

const STATUS_MARKERS = {
    "Promoted": { symbol: "↑", label: "Promoted" },
    "Technicality": { symbol: "*", label: "Technicality" },
    "Not Demon": { symbol: "X", label: "Not Demon" }
};

const UNRANKED_STATUSES = ["Benchmark", "Not Demon", "Promoted", "Technicality"];

function markerTitleAttr(item) {
    const marker = STATUS_MARKERS[item.promoted];
    return marker ? ` title="${marker.label}"` : '';
}

document.addEventListener('DOMContentLoaded', () => {
    const pageType = document.body.getAttribute('data-page');
    if (pageType === 'edl' || pageType === 'mdl') {
        initRankingPage(pageType);
    }
});

async function initRankingPage(type) {
    const listFile = type === 'edl' ? '../data/_edl.json' : '../data/_mdl.json';

    try {
        const response = await fetch(listFile);
        if (!response.ok) throw new Error(`Could not locate index list: ${listFile}`);

        const fileNames = await response.json();

        const fetchPromises = fileNames.map(file => fetch(`../data/${file}`).then(res => res.json()));
        const levelsData = await Promise.all(fetchPromises);

        const listContainer = document.getElementById('ranking-list');
        const filterSelect = document.getElementById('status-filter');

        const searchInput = document.getElementById('level-search');
        let statusFilter = 'All';
        let searchQuery = '';

        const refreshList = () => renderList(levelsData, listContainer, statusFilter, searchQuery);

        refreshList();

        filterSelect.addEventListener('change', (e) => {
            statusFilter = e.target.value;
            refreshList();
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                refreshList();
            });
        }

    } catch (error) {
        console.error("Initialization Error:", error);
    }
}

function escapeHTML(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function renderList(data, container, filter, query = '') {
    container.innerHTML = '';
    let rankCounter = 1;
    let shown = 0;
    const needle = normalizeText(query);

    data.forEach(item => {
        const isUnranked = UNRANKED_STATUSES.includes(item.promoted);
        let rankDisplay = "—";
        let rankLabel = "Unranked";
        if (!isUnranked) {
            rankDisplay = `#${rankCounter}`;
            rankLabel = `Rank ${rankCounter}`;
            rankCounter++;
        }

        const marker = STATUS_MARKERS[item.promoted];
        if (marker) {
            rankDisplay = isUnranked ? marker.symbol : rankDisplay + marker.symbol;
            rankLabel += `, ${marker.label}`;
        }

        if (filter !== 'All' && item.promoted !== filter) {
            return;
        }
        if (needle && !normalizeText(item.name).includes(needle)) {
            return;
        }
        shown++;

        const li = document.createElement('li');
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'ranking-item';
        if (item === selectedItem) button.setAttribute('aria-current', 'true');

        button.innerHTML = `
            <span class="rank-badge" aria-hidden="true"${markerTitleAttr(item)}>${rankDisplay}</span>
            <span class="sr-only">${rankLabel}:</span>
            <span class="level-name">${escapeHTML(item.name)}</span>
        `;

        button.addEventListener('click', () => {
            selectItem(item, rankDisplay, rankLabel, button, container);
        });

        li.appendChild(button);
        container.appendChild(li);
    });

    if (shown === 0) {
        const empty = document.createElement('li');
        empty.className = 'list-empty';
        empty.textContent = 'No levels match your search.';
        container.appendChild(empty);
    }

    const status = document.getElementById('results-status');
    if (status) {
        const narrowed = needle || filter !== 'All';
        status.textContent = narrowed
            ? `Showing ${shown} of ${data.length} levels`
            : '';
    }
}

function selectItem(item, rankDisplay, rankLabel, button, container) {
    selectedItem = item;

    container.querySelectorAll('.ranking-item[aria-current]').forEach(el => {
        el.removeAttribute('aria-current');
    });
    button.setAttribute('aria-current', 'true');

    updatePreview(item, rankDisplay, rankLabel);

    if (window.matchMedia('(max-width: 767px)').matches) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('preview-content')
            .scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
}

function updatePreview(item, rankDisplay, rankLabel) {
    const previewContainer = document.getElementById('preview-content');
    if (!previewContainer) return;

    previewContainer.innerHTML = `
        <article class="preview-card">
            <header class="preview-header">
                <h2 class="preview-title">
                    <span class="preview-rank" aria-hidden="true"${markerTitleAttr(item)}>${rankDisplay}</span>
                    <span class="sr-only">${rankLabel}:</span>${escapeHTML(item.name)}
                    <span class="preview-meta">${escapeHTML(item.creator)}</span>
                </h2>
                <p class="preview-meta">${escapeHTML(item.promoted)}</p>
            </header>
            <section class="preview-body">
                <h3 class="preview-label">Comments</h3>
                <p>${escapeHTML(item.comments)}</p>
            </section>
            <dl class="preview-stats">
                <div class="stat">
                    <dt>Personal GDDL Rating</dt>
                    <dd class="stat-accent">${escapeHTML(item.gddlRating)}</dd>
                </div>
                <div class="stat">
                    <dt>Level ID</dt>
                    <dd>${escapeHTML(item.id)}</dd>
                </div>
            </dl>
            ${item.reliable ? `
            <section class="preview-reliable">
                <h3 class="preview-label">Placement reliability</h3>
                <p>${escapeHTML(item.reliable)}</p>
            </section>` : ''}
        </article>
    `;
}
