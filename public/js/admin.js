(() => {
  const root = document.querySelector('[data-admin-app]');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-admin-tab]')];
  const content = root.querySelector('[data-admin-content]');
  const title = root.querySelector('[data-admin-title]');
  const feedback = root.querySelector('[data-admin-feedback]');
  const addButton = root.querySelector('[data-admin-add]');
  const exportButton = root.querySelector('[data-admin-export]');
  const dialog = document.querySelector('[data-admin-dialog]');
  const editor = document.querySelector('[data-admin-editor]');
  const editorFields = document.querySelector('[data-admin-editor-fields]');
  const editorTitle = document.querySelector('#admin-dialog-title');
  const editorFeedback = document.querySelector('[data-editor-feedback]');
  const resourceTitles = {
    hotels: 'Hôtels',
    packages: 'Voyages, tours & Omra',
    slides: 'Diaporama',
    partners: 'Partenaires',
    requests: 'Demandes',
    messages: 'Messages',
    newsletter: 'Newsletter'
  };
  const definitions = {
    hotels: [
      ['slug', 'Slug URL', 'text', true], ['name', 'Nom', 'text', true], ['city', 'Ville', 'select', true, ['Hammamet', 'Sousse', 'Monastir', 'Mahdia', 'Djerba', 'Tabarka']],
      ['stars', 'Étoiles', 'number', true], ['summary', 'Résumé', 'text', true], ['description', 'Description', 'textarea', true],
      ['board', 'Pension', 'text', true], ['services', 'Services (JSON)', 'json', true], ['images', 'Images / scènes (JSON)', 'json', true],
      ['price', 'Prix en TND (laisser vide si sur demande)', 'number', false], ['featured', 'Mettre en avant', 'checkbox']
    ],
    packages: [
      ['slug', 'Slug URL', 'text', true], ['type', 'Type', 'select', true, ['voyage', 'tour', 'omra']],
      ['title', 'Titre', 'text', true], ['destination', 'Destination', 'text', true], ['summary', 'Résumé', 'text', true],
      ['description', 'Description', 'textarea', true], ['dates', 'Dates (JSON)', 'json', true], ['duration', 'Durée', 'text', true],
      ['program', 'Programme (JSON)', 'json', true], ['inclusions', 'Compris (JSON)', 'json', true],
      ['exclusions', 'Non compris (JSON)', 'json', true], ['images', 'Images / scènes (JSON)', 'json', true],
      ['price', 'Prix en TND (laisser vide si sur demande)', 'number', false], ['featured', 'Mettre en avant', 'checkbox']
    ],
    slides: [
      ['title', 'Titre', 'text', true], ['text', 'Texte', 'textarea', true], ['button_text', 'Texte du bouton', 'text', true],
      ['button_url', 'Lien du bouton', 'text', true], ['image', 'Scène ou chemin d’image', 'text', true],
      ['position', 'Position', 'number', true], ['active', 'Diapositive active', 'checkbox']
    ],
    partners: [
      ['name', 'Nom du partenaire', 'text', true], ['logo', 'URL du logo', 'text', true],
      ['url', 'Lien (facultatif)', 'text', false], ['position', 'Position', 'number', true], ['active', 'Partenaire actif', 'checkbox']
    ]
  };
  let currentTab = 'hotels';
  let currentRows = [];
  let editingId = null;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const showFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.className = `form-feedback ${isError ? 'is-error' : 'is-success'}`;
  };
  const safeText = (value) => {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : item).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  const pretty = (value) => {
    if (Array.isArray(value)) return JSON.stringify(value, null, 2);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return JSON.stringify([value], null, 2);
      }
    }
    return JSON.stringify(value ?? [], null, 2);
  };

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...options });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
    return result;
  }

  function displayOffers(rows) {
    content.replaceChildren();
    if (!rows.length) {
      const empty = make('div', 'empty-state');
      empty.append(make('h2', '', 'Aucun élément pour le moment'), make('p', '', 'Ajoutez une première offre pour la rendre visible sur le site.'));
      content.append(empty);
      return;
    }
    const columns = currentTab === 'hotels'
      ? [['name', 'Nom'], ['city', 'Ville'], ['stars', 'Étoiles'], ['price', 'Prix']]
      : currentTab === 'packages'
        ? [['title', 'Titre'], ['type', 'Type'], ['destination', 'Destination'], ['price', 'Prix']]
        : currentTab === 'slides'
          ? [['title', 'Titre'], ['position', 'Position'], ['active', 'Active']]
          : [['name', 'Partenaire'], ['url', 'Lien'], ['position', 'Position'], ['active', 'Actif']];
    const wrap = make('div', 'admin-table-wrap');
    const table = make('table', 'admin-table');
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    columns.forEach(([, label]) => headRow.append(make('th', '', label)));
    headRow.append(make('th', '', 'Actions'));
    head.append(headRow);
    const body = document.createElement('tbody');
    rows.forEach((row) => {
      const line = document.createElement('tr');
      columns.forEach(([field]) => {
        const cell = document.createElement('td');
        if (field === 'price') cell.textContent = row.price === null ? 'Sur demande' : `${safeText(row.price)} TND`;
        else if (field === 'active') cell.textContent = row.active ? 'Oui' : 'Non';
        else cell.textContent = safeText(row[field]);
        line.append(cell);
      });
      const actions = make('td', 'admin-table__actions');
      const edit = make('button', '', 'Modifier');
      edit.type = 'button';
      edit.addEventListener('click', () => openEditor(row));
      const remove = make('button', '', 'Supprimer');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Supprimer cet élément ? Cette action est définitive.')) return;
        try {
          await fetchJson(`/api/admin/data/${currentTab}/${row.id}`, { method: 'DELETE' });
          showFeedback('Élément supprimé.');
          await loadCurrent();
        } catch (error) {
          showFeedback(error.message, true);
        }
      });
      actions.append(edit, remove);
      line.append(actions);
      body.append(line);
    });
    table.append(head, body);
    wrap.append(table);
    content.append(wrap);
  }

  function displayInbox(data) {
    content.replaceChildren();
    const records = data[currentTab] || [];
    if (!records.length) {
      const empty = make('div', 'empty-state');
      empty.append(make('h2', '', 'Aucun élément reçu'), make('p', '', 'Les nouvelles entrées apparaîtront ici.'));
      content.append(empty);
      return;
    }
    const list = make('div', 'admin-inbox');
    records.forEach((record) => {
      const card = make('article', 'inbox-card');
      const top = make('div', 'inbox-card__top');
      const identity = document.createElement('div');
      const titleText = currentTab === 'requests' ? `${record.name} · ${record.item_name || record.request_type}` : currentTab === 'messages' ? `${record.name} · ${record.subject}` : record.email;
      identity.append(make('h3', '', titleText));
      if (record.email) {
        const email = make('a', '', record.email);
        email.href = `mailto:${record.email}`;
        identity.append(email);
      }
      if (record.phone) identity.append(make('p', '', record.phone));
      top.append(identity);
      if (currentTab === 'requests') {
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Statut de la demande ${record.id}`);
        [['nouvelle', 'Nouvelle'], ['en_cours', 'En cours'], ['traitee', 'Traitée']].forEach(([value, label]) => {
          const option = make('option', '', label);
          option.value = value;
          option.selected = record.status === value;
          select.append(option);
        });
        select.addEventListener('change', async () => {
          try {
            await fetchJson(`/api/admin/requests/${record.id}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
            showFeedback('Statut de la demande mis à jour.');
          } catch (error) {
            showFeedback(error.message, true);
          }
        });
        top.append(select);
      }
      card.append(top);
      if (record.message) card.append(make('p', '', record.message));
      const date = make('time', '', new Date(record.created_at).toLocaleString('fr-FR'));
      card.append(date);
      list.append(card);
    });
    content.append(list);
  }

  async function loadCurrent() {
    content.replaceChildren(make('p', 'loading-message', 'Chargement…'));
    feedback.textContent = '';
    addButton.hidden = !definitions[currentTab];
    exportButton.hidden = !['requests', 'messages', 'newsletter'].includes(currentTab);
    if (currentTab === 'requests' || currentTab === 'messages' || currentTab === 'newsletter') {
      const data = await fetchJson('/api/admin/inbox');
      displayInbox(data);
      return;
    }
    const data = await fetchJson(`/api/admin/data/${currentTab}`);
    currentRows = data.rows;
    displayOffers(currentRows);
  }

  function setTab(name) {
    currentTab = name;
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.adminTab === name)));
    title.textContent = resourceTitles[name];
    loadCurrent().catch((error) => {
      content.replaceChildren(make('p', 'form-feedback is-error', error.message));
      showFeedback(error.message, true);
    });
  }

  function fieldControl(field, value, spec) {
    const [name, label, type, required, options = []] = spec;
    const wrapper = make('label', `field ${type === 'textarea' || type === 'json' ? 'field--full' : ''}`);
    const caption = make('span', '', label);
    wrapper.append(caption);
    let input;
    if (type === 'textarea' || type === 'json') {
      input = document.createElement('textarea');
      input.rows = type === 'json' ? 4 : 3;
      input.value = type === 'json' ? pretty(value) : value || '';
      if (type === 'json') {
        const help = make('small', 'admin-field-help', 'Saisissez une liste JSON valide, par exemple ["Service A", "Service B"].');
        wrapper.append(input, help);
      } else wrapper.append(input);
    } else if (type === 'select') {
      input = document.createElement('select');
      options.forEach((optionValue) => {
        const option = make('option', '', optionValue);
        option.value = optionValue;
        option.selected = value === optionValue;
        input.append(option);
      });
      wrapper.append(input);
    } else {
      input = document.createElement('input');
      input.type = type === 'checkbox' ? 'checkbox' : type;
      if (type === 'checkbox') input.checked = Boolean(value);
      else input.value = value === null || value === undefined ? '' : String(value);
      wrapper.append(input);
    }
    input.name = name;
    if (required) input.required = true;
    if (name === 'stars') { input.min = '1'; input.max = '5'; }
    if (name === 'price') { input.min = '0'; input.step = '0.01'; }
    if (name === 'position') input.min = '0';
    if (name === 'slug') input.pattern = '[a-z0-9]+(?:-[a-z0-9]+)*';
    if (name === 'images' || name === 'logo') {
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/jpeg,image/png,image/webp,image/avif';
      file.setAttribute('aria-label', 'Importer une image');
      file.addEventListener('change', async () => {
        if (!file.files.length) return;
        const formData = new FormData();
        formData.append('image', file.files[0]);
        try {
          const response = await fetch('/api/admin/upload', { method: 'POST', body: formData, headers: { Accept: 'application/json' } });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Import impossible.');
          if (name === 'images') {
            let current = [];
            try { current = JSON.parse(input.value); } catch { current = []; }
            if (!Array.isArray(current)) current = [];
            current.push(result.url);
            input.value = JSON.stringify(current, null, 2);
          } else input.value = result.url;
          editorFeedback.textContent = 'Image importée.';
          editorFeedback.className = 'form-feedback is-success';
        } catch (error) {
          editorFeedback.textContent = error.message;
          editorFeedback.className = 'form-feedback is-error';
        }
      });
      wrapper.append(make('span', '', 'Importer une image (JPG, PNG, WebP ou AVIF, 5 Mo max.)'), file);
    }
    return wrapper;
  }

  function openEditor(row = null) {
    editingId = row ? row.id : null;
    editorTitle.textContent = row ? 'Modifier un élément' : 'Ajouter un élément';
    editorFields.replaceChildren();
    editorFeedback.textContent = '';
    definitions[currentTab].forEach((spec) => editorFields.append(fieldControl(spec[0], row?.[spec[0]], spec)));
    dialog.showModal();
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.adminTab)));
  addButton.addEventListener('click', () => openEditor());
  exportButton.addEventListener('click', () => { window.location.assign(`/api/admin/export/${currentTab}`); });
  document.querySelector('[data-admin-cancel]').addEventListener('click', () => dialog.close());
  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    editorFeedback.textContent = '';
    const values = {};
    definitions[currentTab].forEach(([name, , type]) => {
      const input = editor.elements.namedItem(name);
      values[name] = type === 'checkbox' ? input.checked : input.value;
    });
    const method = editingId ? 'PUT' : 'POST';
    const url = `/api/admin/data/${currentTab}${editingId ? `/${editingId}` : ''}`;
    const submit = editor.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await fetchJson(url, { method, body: JSON.stringify(values) });
      dialog.close();
      showFeedback(result.message);
      await loadCurrent();
    } catch (error) {
      editorFeedback.textContent = error.message;
      editorFeedback.className = 'form-feedback is-error';
    } finally {
      submit.disabled = false;
    }
  });

  setTab('hotels');
})();
