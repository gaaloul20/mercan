(() => {
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  const pageLoader = one('#page-loader');
  if (pageLoader) {
    let hideTimer;
    let fallbackTimer;
    const hidePageLoader = () => {
      if (pageLoader.hidden) return;
      window.clearTimeout(hideTimer);
      window.clearTimeout(fallbackTimer);
      pageLoader.classList.remove('is-visible');
      pageLoader.classList.add('is-hiding');
      pageLoader.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('page-loading');
      window.setTimeout(() => {
        pageLoader.hidden = true;
        pageLoader.classList.remove('is-hiding');
      }, 350);
    };
    const finishLoading = () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hidePageLoader, 450);
    };

    pageLoader.hidden = false;
    pageLoader.removeAttribute('aria-hidden');
    document.body.classList.add('page-loading');
    window.requestAnimationFrame(() => pageLoader.classList.add('is-visible'));
    fallbackTimer = window.setTimeout(hidePageLoader, 10000);
    if (document.readyState === 'complete') finishLoading();
    else window.addEventListener('load', finishLoading, { once: true });
  }

  const menuButton = one('.menu-toggle');
  const navigation = one('.main-nav');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      navigation.classList.toggle('is-open', open);
    });
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        navigation.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Ouvrir le menu');
      }
    });
  }

  const slides = all('[data-slide]');
  const dots = all('[data-slide-to]');
  if (slides.length > 1) {
    const hero = one('.hero');
    const previous = one('[data-hero-previous]', hero);
    const next = one('[data-hero-next]', hero);
    let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
    let timer;
    const showSlide = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        const active = position === current;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
      dots.forEach((dot, position) => {
        const active = position === current;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', String(active));
      });
    };
    const restart = () => {
      window.clearInterval(timer);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = window.setInterval(() => showSlide(current + 1), 6000);
      }
    };
    dots.forEach((dot, index) => dot.addEventListener('click', () => {
      showSlide(index);
      restart();
    }));
    previous?.addEventListener('click', () => {
      showSlide(current - 1);
      restart();
    });
    next?.addEventListener('click', () => {
      showSlide(current + 1);
      restart();
    });
    let touchStart;
    hero?.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    hero?.addEventListener('touchend', (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      showSlide(current + (deltaX < 0 ? 1 : -1));
      restart();
    }, { passive: true });
    hero?.addEventListener('mouseenter', () => window.clearInterval(timer));
    hero?.addEventListener('mouseleave', restart);
    hero?.addEventListener('focusin', () => window.clearInterval(timer));
    hero?.addEventListener('focusout', (event) => {
      if (!hero.contains(event.relatedTarget)) restart();
    });
    restart();
  }

  all('[data-carousel]').forEach((carousel) => {
    const viewport = one('[data-carousel-viewport]', carousel);
    const track = one('[data-carousel-track]', carousel);
    const previous = one('[data-carousel-prev]', carousel);
    const next = one('[data-carousel-next]', carousel);
    if (!viewport || !track || !previous || !next) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const originalCards = [...track.children];
    let cloneCount = 0;
    let settleTimer;
    let rebasing = false;
    let previousScrollLeft = 0;
    const getStep = () => {
      const card = one('.voyage-poster', track);
      if (!card) return 0;
      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
      return card.getBoundingClientRect().width + gap;
    };
    const updateControls = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const isStatic = originalCards.length < 2 || maxScroll < 2;
      carousel.classList.toggle('is-static', isStatic);
      previous.disabled = isStatic;
      next.disabled = isStatic;
    };
    const scroll = (direction) => {
      const step = getStep();
      if (!step) return;
      viewport.scrollBy({ left: direction * step, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };
    const jumpTo = (left) => {
      rebasing = true;
      window.clearTimeout(settleTimer);
      viewport.style.scrollSnapType = 'none';
      viewport.scrollLeft = left;
      window.requestAnimationFrame(() => {
        viewport.style.scrollSnapType = '';
        rebasing = false;
        previousScrollLeft = viewport.scrollLeft;
        updateControls();
      });
    };
    const settle = () => {
      window.clearTimeout(settleTimer);
      if (rebasing || cloneCount === 0) return;
      const step = getStep();
      if (!step) return;
      const position = viewport.scrollLeft / step;
      if (position >= cloneCount + originalCards.length - 0.5) {
        jumpTo(cloneCount * step);
      } else if (position <= cloneCount - 0.5) {
        jumpTo((cloneCount + originalCards.length - 1) * step);
      }
    };
    const rebuildClones = (activeIndex = 0) => {
      track.querySelectorAll('[data-carousel-clone]').forEach((clone) => clone.remove());
      const step = getStep();
      if (originalCards.length < 2 || !step) {
        cloneCount = 0;
        updateControls();
        return;
      }
      cloneCount = Math.min(originalCards.length, Math.max(1, Math.ceil(viewport.clientWidth / step)));
      const makeClone = (card) => {
        const clone = card.cloneNode(true);
        clone.dataset.carouselClone = 'true';
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => element.setAttribute('tabindex', '-1'));
        return clone;
      };
      const before = document.createDocumentFragment();
      originalCards.slice(-cloneCount).forEach((card) => before.append(makeClone(card)));
      const after = document.createDocumentFragment();
      originalCards.slice(0, cloneCount).forEach((card) => after.append(makeClone(card)));
      track.prepend(before);
      track.append(after);
      jumpTo((cloneCount + Math.min(activeIndex, originalCards.length - 1)) * getStep());
    };
    const handleScroll = () => {
      if (rebasing) return;
      const currentScrollLeft = viewport.scrollLeft;
      previousScrollLeft = currentScrollLeft;
      updateControls();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 160);
    };
    previous.addEventListener('click', () => scroll(-1));
    next.addEventListener('click', () => scroll(1));
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    viewport.addEventListener('scrollend', settle);
    window.addEventListener('resize', () => {
      const step = getStep();
      const activeIndex = step ? Math.round(viewport.scrollLeft / step) - cloneCount : 0;
      rebuildClones(activeIndex);
    });
    rebuildClones();
  });

  const dateInputs = all('[data-date-min]');
  const today = new Date();
  const localDate = (date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  };
  dateInputs.forEach((input) => { input.min = localDate(today); });
  const departureInput = one('[name="departDate"]');
  const returnInput = one('[name="returnDate"]');
  if (departureInput && returnInput) {
    departureInput.addEventListener('change', () => {
      returnInput.min = departureInput.value || localDate(today);
      if (returnInput.value && returnInput.value < returnInput.min) returnInput.value = returnInput.min;
    });
  }
  const hotelArrival = one('[name="arrivee"]');
  const hotelDeparture = one('[name="depart"]');
  if (hotelArrival && hotelDeparture) {
    hotelArrival.addEventListener('change', () => {
      if (!hotelArrival.value) return;
      const nextDay = new Date(`${hotelArrival.value}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      hotelDeparture.min = localDate(nextDay);
      if (hotelDeparture.value && hotelDeparture.value < hotelDeparture.min) hotelDeparture.value = hotelDeparture.min;
    });
  }

  const occupancy = one('.occupancy-wrap');
  if (occupancy) {
    const panel = one('.occupancy-panel', occupancy);
    const trigger = one('.occupancy-trigger', occupancy);
    const roomList = one('[data-room-list]', occupancy);
    const roomInput = one('[name="chambres"]', occupancy);
    const summary = one('[data-occupancy-summary]', occupancy);
    const hotelForm = one('.hotel-search');
    const rooms = [{ adults: 2, children: 0 }];
    const make = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const updateSummary = () => {
      const adults = rooms.reduce((total, room) => total + room.adults, 0);
      const children = rooms.reduce((total, room) => total + room.children, 0);
      summary.textContent = `${rooms.length} chambre${rooms.length > 1 ? 's' : ''} · ${adults} adulte${adults > 1 ? 's' : ''}${children ? ` · ${children} enfant${children > 1 ? 's' : ''}` : ''}`;
      roomInput.value = String(rooms.length);
      [['voyageurs_adultes', adults], ['voyageurs_enfants', children]].forEach(([name, value]) => {
        let input = one(`[name="${name}"]`, hotelForm);
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          hotelForm.append(input);
        }
        input.value = String(value);
      });
    };
    const renderRooms = () => {
      roomList.replaceChildren();
      rooms.forEach((room, index) => {
        const row = make('section', 'room-row');
        const heading = make('div', 'room-row__head');
        heading.append(make('span', '', `Chambre ${index + 1}`));
        if (rooms.length > 1) {
          const remove = make('button', 'room-row__remove', 'Supprimer');
          remove.type = 'button';
          remove.addEventListener('click', () => { rooms.splice(index, 1); renderRooms(); });
          heading.append(remove);
        }
        row.append(heading);
        [['adultes', 'Adultes', 1, 4], ['children', 'Enfants', 0, 3]].forEach(([field, label, min, max]) => {
          const line = make('div', 'room-counter');
          line.append(make('span', '', label));
          const controls = make('div', 'counter-controls');
          const minus = make('button', '', '−');
          const amount = make('span', '', String(room[field]));
          const plus = make('button', '', '+');
          minus.type = plus.type = 'button';
          minus.setAttribute('aria-label', `Retirer un ${label.toLowerCase()} pour la chambre ${index + 1}`);
          plus.setAttribute('aria-label', `Ajouter un ${label.toLowerCase()} pour la chambre ${index + 1}`);
          minus.disabled = room[field] <= min;
          plus.disabled = room[field] >= max;
          minus.addEventListener('click', () => { room[field]--; renderRooms(); });
          plus.addEventListener('click', () => { room[field]++; renderRooms(); });
          controls.append(minus, amount, plus);
          line.append(controls);
          row.append(line);
        });
        roomList.append(row);
      });
      updateSummary();
    };
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    });
    all('[data-close-occupancy]', occupancy).forEach((button) => button.addEventListener('click', () => {
      trigger.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
      trigger.focus();
    }));
    one('[data-add-room]', occupancy).addEventListener('click', () => {
      if (rooms.length < 4) {
        rooms.push({ adults: 2, children: 0 });
        renderRooms();
      }
    });
    renderRooms();
  }

  const requestButtons = all('[data-request]');
  if (requestButtons.length) {
    const dialog = document.createElement('dialog');
    dialog.className = 'request-dialog';
    dialog.setAttribute('aria-labelledby', 'request-title');
    dialog.innerHTML = '<form method="dialog"><button class="icon-button request-dialog__close" aria-label="Fermer">×</button></form><p class="eyebrow">Parlons de votre projet</p><h2 id="request-title">Faire une demande</h2><p class="request-item"></p><form class="request-form"><label class="field"><span>Nom complet</span><input name="name" required minlength="2" maxlength="120" autocomplete="name"></label><label class="field"><span>Téléphone</span><input name="phone" type="tel" required pattern="[+()0-9 .-]{7,30}" autocomplete="tel"></label><label class="field"><span>Votre message</span><textarea name="message" rows="4" required minlength="2" maxlength="3000"></textarea></label><button class="button button--orange button--wide" type="submit">Envoyer ma demande</button><p class="form-feedback" aria-live="polite"></p></form>';
    document.body.append(dialog);
    let selectedRequest = null;
    requestButtons.forEach((button) => button.addEventListener('click', () => {
      selectedRequest = { type: button.dataset.requestType, itemId: Number(button.dataset.itemId), title: button.dataset.itemTitle };
      one('.request-item', dialog).textContent = selectedRequest.title;
      one('textarea', dialog).value = `Bonjour, je souhaite recevoir des informations sur ${selectedRequest.title}.`;
      if (document.body.dataset.userName) one('[name="name"]', dialog).value = document.body.dataset.userName;
      if (document.body.dataset.userPhone) one('[name="phone"]', dialog).value = document.body.dataset.userPhone;
      dialog.showModal();
      one('[name="name"]', dialog).focus();
    }));
    one('.request-form', dialog).addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(event.currentTarget, { ...selectedRequest });
    });
  }

  async function submitForm(form, extra = {}) {
    const feedback = one('.form-feedback', form);
    const submit = one('[type="submit"]', form);
    const originalText = submit.textContent;
    feedback.textContent = '';
    feedback.className = 'form-feedback';
    submit.disabled = true;
    submit.textContent = 'Envoi en cours…';
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...body, ...extra })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
      feedback.textContent = result.message;
      feedback.classList.add('is-success');
      form.reset();
      if (result.redirect) {
        window.location.assign(result.redirect);
      } else if (result.whatsappMessage) {
        const link = document.createElement('a');
        link.className = 'feedback-link';
        link.href = `https://wa.me/21655333100?text=${encodeURIComponent(result.whatsappMessage)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Continuer sur WhatsApp ↗';
        feedback.append(document.createElement('br'), link);
      } else if (extra.type) {
        const link = document.createElement('a');
        const message = `Bonjour Mercan Voyages, ${body.message} Mon nom : ${body.name}, téléphone : ${body.phone}.`;
        link.className = 'feedback-link';
        link.href = `https://wa.me/21655333100?text=${encodeURIComponent(message)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Envoyer aussi sur WhatsApp ↗';
        feedback.append(document.createElement('br'), link);
      }
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add('is-error');
    } finally {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }

  all('.js-form').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitForm(form);
  }));

  all('[data-logout]').forEach((button) => button.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible de fermer la session.');
      window.location.assign(result.redirect);
    } catch (error) {
      window.alert(error.message);
    }
  }));

  const accountList = one('[data-account-requests]');
  if (accountList) {
    fetch('/api/account/requests', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger vos demandes.');
        accountList.replaceChildren();
        if (!data.requests.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          const heading = document.createElement('h2');
          heading.textContent = 'Aucune demande pour le moment';
          const text = document.createElement('p');
          text.textContent = 'Vos prochaines demandes apparaîtront ici.';
          empty.append(heading, text);
          accountList.append(empty);
          return;
        }
        data.requests.forEach((request) => {
          const card = document.createElement('article');
          card.className = 'account-request';
          const details = document.createElement('div');
          const heading = document.createElement('h3');
          heading.textContent = request.item_name;
          const message = document.createElement('p');
          message.textContent = request.message;
          const date = document.createElement('p');
          date.textContent = new Date(request.created_at).toLocaleDateString('fr-FR');
          details.append(heading, message, date);
          const status = document.createElement('span');
          status.className = 'request-status';
          status.textContent = { nouvelle: 'Reçue', en_cours: 'En cours', traitee: 'Traitée' }[request.status] || request.status;
          card.append(details, status);
          accountList.append(card);
        });
      })
      .catch((error) => {
        accountList.textContent = error.message;
        accountList.classList.add('form-feedback', 'is-error');
      });
  }

  const flightForm = one('[data-flight-form]');
  if (flightForm) {
    const returnField = one('[data-return-field]', flightForm);
    all('[name="tripType"]', flightForm).forEach((radio) => radio.addEventListener('change', () => {
      const roundTrip = one('[name="tripType"]:checked', flightForm).value === 'aller-retour';
      returnField.hidden = !roundTrip;
      one('[name="returnDate"]', returnField).required = roundTrip;
    }));
  }
})();
