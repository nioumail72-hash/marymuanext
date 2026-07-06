const state = {
  properties: [],
  cityTiles: [],
  siteSettings: {},
  filters: {
    category: "",
    location: "",
    intent: "",
    maxPrice: 300000
  },
  adminUnlocked: false,
  currentReceipt: null,
  adminProperties: [],
  adminCityTiles: [],
  notificationCount: 0,
  notificationTimer: null,
  adminIdleTimer: null,
  adminPollTimer: null
};

const formatter = new Intl.NumberFormat("fr-FR");

const qs = selector => document.querySelector(selector);
const qsa = selector => [...document.querySelectorAll(selector)];

function fcfa(value) {
  return `${formatter.format(Number(value || 0))} FCFA`;
}

function dateFr(value) {
  if (!value) return "Non precise";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function propertyHighlights(property) {
  return property.highlights?.length ? property.highlights : property.amenities || [];
}

function propertyRules(property) {
  return property.houseRules?.length
    ? property.houseRules
    : ["Piece d'identite requise", "Confirmation de paiement avant entree", "Respect du voisinage", "Etat des lieux a l'arrivee"];
}

function linesToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function splitLines(value) {
  return String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function applySiteSettings(settings = state.siteSettings) {
  const hero = qs("#heroBg");
  if (!hero || !settings?.heroImage) return;
  hero.style.backgroundImage = `url('${settings.heroImage}')`;
  hero.setAttribute("aria-label", settings.heroAlt || "Image d'accueil hebergementciv");
}

function syncHeroImagePreview() {
  const form = qs("#siteSettingsForm");
  const preview = qs("#heroImagePreview");
  if (!form || !preview) return;
  const image = form.elements.heroImage.value;
  preview.innerHTML = image
    ? `<span style="background-image:url('${image}')" title="Image d'accueil"></span>`
    : "<small>Aucune image ajoutee.</small>";
}

function syncImagePreview() {
  const form = qs("#propertyAdminForm");
  const preview = qs("#imageAdminPreview");
  if (!form || !preview) return;
  const images = uniqueList([form.elements.image.value, ...splitLines(form.elements.gallery.value)]).slice(0, 12);
  preview.innerHTML = images.length
    ? images.map((image, index) => `<span style="background-image:url('${image}')" title="Image ${index + 1}"></span>`).join("")
    : "<small>Aucune image ajoutee.</small>";
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Fichier image invalide"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire l'image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Image illisible"));
      image.onload = () => {
        const maxSide = 1600;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleMainImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    qs("#propertyAdminForm").elements.image.value = await imageFileToDataUrl(file);
    syncImagePreview();
    toast("Image principale ajoutee");
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
}

async function handleGalleryFiles(event) {
  const files = [...(event.target.files || [])].slice(0, 12);
  if (!files.length) return;
  try {
    const form = qs("#propertyAdminForm");
    const images = await Promise.all(files.map(imageFileToDataUrl));
    form.elements.gallery.value = uniqueList([...splitLines(form.elements.gallery.value), ...images]).join("\n");
    syncImagePreview();
    toast(`${images.length} image(s) ajoutee(s) a la galerie`);
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
}

async function handleHeroImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    qs("#siteSettingsForm").elements.heroImage.value = await imageFileToDataUrl(file);
    syncHeroImagePreview();
    toast("Image d'accueil ajoutee");
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
}

function fillSiteSettingsForm(settings = state.siteSettings) {
  const form = qs("#siteSettingsForm");
  if (!form) return;
  form.elements.heroImage.value = settings.heroImage || "";
  form.elements.heroAlt.value = settings.heroAlt || "Vue moderne d'Abidjan et logements premium";
  syncHeroImagePreview();
}

async function submitSiteSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const { siteSettings } = await api("/api/admin/settings", { method: "PATCH", admin: true, body: payload });
    state.siteSettings = siteSettings;
    applySiteSettings();
    syncHeroImagePreview();
    toast("Image d'accueil mise a jour");
  } catch (error) {
    toast(error.message);
  }
}

function toast(message) {
  const node = qs("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.admin ? { Authorization: "Bearer hebergementciv-admin" } : {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erreur reseau");
  return data;
}

async function loadBootstrap() {
  const data = await api("/api/bootstrap");
  state.properties = data.properties;
  state.cityTiles = data.cityTiles || [];
  state.siteSettings = data.siteSettings || {};
  applySiteSettings();
  const statListings = qs("#statListings");
  if (statListings) statListings.textContent = data.stats.listings;
  renderCityCarousel();
  renderProperties();
  renderBookingOptions();
  renderRoute();
}

function propertyCityText(property) {
  return `${property.city || ""} ${property.district || ""}`.toLowerCase();
}

function renderCityCounts() {
  qsa("[data-city-count]").forEach(node => {
    const city = node.dataset.cityCount.toLowerCase();
    const count = state.properties.filter(property => propertyCityText(property).includes(city)).length;
    node.textContent = `${count} bien${count > 1 ? "s" : ""}`;
  });
}

function cityCount(search) {
  const query = String(search || "").toLowerCase();
  return state.properties.filter(property => propertyCityText(property).includes(query)).length;
}

function renderCityCarousel() {
  const carousel = qs("#cityCarousel");
  if (!carousel) return;
  carousel.innerHTML = state.cityTiles.map(tile => {
    const count = cityCount(tile.search);
    return `
      <article class="city-card" data-city="${tile.search}">
        <div class="city-card-image" style="background-image:url('${tile.image}')"></div>
        <div class="city-card-copy">
          <span>${tile.status}</span>
          <h3>${tile.name}</h3>
          <p>${tile.subtitle}</p>
          <strong>${count} bien${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}</strong>
        </div>
      </article>
    `;
  }).join("");
}

function filteredProperties() {
  const query = state.filters.location.toLowerCase();
  return state.properties.filter(property => {
    const category = !state.filters.category || property.category === state.filters.category;
    const intent = !state.filters.intent || property.intent === state.filters.intent || (state.filters.intent === "vente" && property.salePrice);
    const location = !query || `${property.district} ${property.city} ${property.title}`.toLowerCase().includes(query);
    const price = property.price <= state.filters.maxPrice || (property.salePrice && property.salePrice <= state.filters.maxPrice);
    return category && intent && location && price;
  });
}

function propertyCard(property) {
  const selling = property.salePrice ? `<span class="price">Achat: ${fcfa(property.salePrice)}</span>` : "";
  return `
    <article class="property-card" data-detail="${property.id}">
      <div class="property-image" style="background-image:url('${property.image}')">
        <div class="badge-row">
          <span class="badge">${property.category}</span>
          <span class="badge secondary">${property.status}</span>
        </div>
      </div>
      <div class="property-body">
        <div>
          <h3>${property.title}</h3>
          <div class="property-meta">
            <span>${property.district}</span>
            <span>${property.beds} ch.</span>
            <span>${property.surface} m2</span>
            <span>${property.rating}/5</span>
          </div>
        </div>
        <div>
          <div class="price">${fcfa(property.price)} / nuit</div>
          ${selling}
        </div>
        <div class="amenities">${property.amenities.slice(0, 4).map(item => `<span>${item}</span>`).join("")}</div>
        <div class="card-actions">
          <button class="outline-button" data-detail="${property.id}">Voir le logement</button>
          <button class="primary-button" data-reserve="${property.id}">Reserver</button>
        </div>
      </div>
    </article>
  `;
}

function renderProperties() {
  const properties = filteredProperties();
  qs("#propertyGrid").innerHTML = properties.length
    ? properties.map(propertyCard).join("")
    : `<div class="property-card"><div class="property-body"><h3>Aucun bien trouve</h3><p>Essayez un autre quartier, budget ou type de logement.</p></div></div>`;
}

function renderBookingOptions() {
  const select = qs("#bookingProperty");
  if (!select) return;
  select.innerHTML = state.properties
    .map(property => `<option value="${property.id}">${property.title} - ${property.district}</option>`)
    .join("");
  renderBookingPreview(select.value);
  renderPaymentOptions(select.value);
}

function renderPaymentOptions(propertyId) {
  const select = qs("#bookingForm")?.elements.paymentMethod;
  if (!select) return;
  const property = state.properties.find(item => item.id === propertyId);
  const methods = property?.paymentMethods?.length
    ? property.paymentMethods
    : ["Mobile Money", "Carte bancaire", "Virement", "Paiement a l'agence", "Cheque certifie"];
  select.innerHTML = methods.map(method => `<option>${method}</option>`).join("");
}

function showView(name) {
  qs("#publicView")?.classList.toggle("is-hidden", name !== "public");
  qs("#detailView")?.classList.toggle("is-hidden", name !== "detail");
  qs("#adminView")?.classList.toggle("is-hidden", name !== "admin");
  document.body.dataset.view = name;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function propertyUrl(id) {
  return `/logement/${encodeURIComponent(id)}`;
}

function openProperty(id, push = true) {
  const property = state.properties.find(item => item.id === id);
  if (!property) return;
  if (push) history.pushState({}, "", propertyUrl(id));
  renderPropertyPage(property);
  showView("detail");
}

function selectForBooking(id) {
  const select = qs("#bookingProperty");
  if (select) select.value = id;
  renderBookingPreview(id);
  renderPaymentOptions(id);
  if (location.pathname !== "/") history.pushState({}, "", "/");
  showView("public");
  setTimeout(() => document.querySelector("#reservation")?.scrollIntoView({ behavior: "smooth" }), 30);
}

function allImages(property) {
  const images = uniqueList([property.image, ...(property.gallery || [])]);
  while (images.length < 6) images.push(images[images.length % Math.max(1, images.length)] || property.image);
  return images.slice(0, 6);
}

function renderBookingPreview(id) {
  const preview = qs("#bookingPropertyPreview");
  if (!preview) return;
  const property = state.properties.find(item => item.id === id) || state.properties[0];
  if (!property) {
    preview.innerHTML = "";
    return;
  }
  const images = allImages(property);
  const selling = property.salePrice ? `<span>Achat: ${fcfa(property.salePrice)}</span>` : "";
  preview.innerHTML = `
    <div class="booking-preview-image" style="background-image:url('${images[0]}')"></div>
    <div class="booking-preview-copy">
      <div>
        <span class="booking-preview-kicker">${property.category} - ${property.status}</span>
        <h4>${property.title}</h4>
        <p>${property.district}, ${property.city}</p>
      </div>
      <div class="booking-preview-meta">
        <span>${fcfa(property.price)} / nuit</span>
        ${selling}
        <span>${property.beds} ch.</span>
        <span>${property.surface} m2</span>
        <span>${property.guests} pers.</span>
      </div>
      <div class="booking-preview-amenities">
        ${property.amenities.slice(0, 4).map(item => `<span>${item}</span>`).join("")}
      </div>
      <div class="booking-preview-thumbs">
        ${images.slice(1, 4).map(image => `<span style="background-image:url('${image}')"></span>`).join("")}
      </div>
    </div>
  `;
}

function renderPropertyPage(property) {
  const images = allImages(property);
  const saleLine = property.salePrice ? `<div><span>Achat</span><strong>${fcfa(property.salePrice)}</strong></div>` : "";
  qs("#detailView").innerHTML = `
    <section class="booking-detail">
      <div class="detail-top-search">
        <label><span>Destination</span><input value="${property.district}, ${property.city}" readonly></label>
        <label><span>Date d'arrivee</span><input type="date"></label>
        <label><span>Date de depart</span><input type="date"></label>
        <label><span>Voyageurs</span><select><option>${property.guests} voyageurs - ${property.beds} chambre(s)</option></select></label>
        <button class="primary-button" data-reserve="${property.id}">Reserver</button>
      </div>

      <nav class="detail-tabs" aria-label="Sections du logement">
        <button type="button" data-scroll-detail="#overview">Ambiance</button>
        <button type="button" data-scroll-detail="#tarifs">Sejour</button>
        <button type="button" data-scroll-detail="#equipements">Confort</button>
        <button type="button" data-scroll-detail="#regles">Conditions</button>
        <button type="button" data-scroll-detail="#avis">Retours clients</button>
        <button type="button" data-go-public="#biens">Autres biens</button>
      </nav>

      <div class="detail-title-row" id="overview">
        <div>
          <p class="breadcrumbs"><button type="button" data-go-public="#accueil">Accueil</button> / <button type="button" data-go-public="#biens">Logements</button> / ${property.category} / ${property.district}</p>
          <div class="stars">Selection hebergementciv</div>
          <h1>${property.title}</h1>
          <p class="location-line">Adresse suivie localement: ${property.district}, ${property.city}</p>
        </div>
        <div class="detail-actions">
          <button class="outline-button" type="button">Enregistrer</button>
          <button class="primary-button" data-reserve="${property.id}">Reserver votre sejour</button>
        </div>
      </div>

      <div class="detail-gallery">
        <button class="gallery-main gallery-zoom" type="button" data-lightbox-image="${images[0]}" data-lightbox-caption="${property.title} - image principale" style="background-image:url('${images[0]}')" aria-label="Agrandir l'image principale"></button>
        <div class="gallery-stack">
          <button class="gallery-zoom" type="button" data-lightbox-image="${images[1]}" data-lightbox-caption="${property.title} - image 2" style="background-image:url('${images[1]}')" aria-label="Agrandir l'image 2"></button>
          <button class="gallery-zoom" type="button" data-lightbox-image="${images[2]}" data-lightbox-caption="${property.title} - image 3" style="background-image:url('${images[2]}')" aria-label="Agrandir l'image 3"></button>
        </div>
        <aside class="score-card">
          <div class="score-head"><span>Indice confiance</span><strong>${property.rating.toFixed(1)}</strong></div>
          <p>Dossier verifie, suivi client et disponibilite confirmee par l'equipe.</p>
          <strong>Quartier: ${property.district}</strong>
          <div class="mini-map">Repere local<br><span>${property.city}</span></div>
        </aside>
        <div class="gallery-thumbs">
          ${images.slice(3).map((image, index) => `<button class="gallery-zoom" type="button" data-lightbox-image="${image}" data-lightbox-caption="${property.title} - image ${index + 4}" style="background-image:url('${image}')" aria-label="Agrandir l'image ${index + 4}">${index === 2 ? "<span>+ photos</span>" : ""}</button>`).join("")}
        </div>
      </div>

      <div class="feature-grid" id="equipements">
        ${["Tout l'hebergement est pour vous", `${property.surface} m2 superficie`, ...propertyHighlights(property), ...property.amenities].slice(0, 10).map(item => `<article>${item}</article>`).join("")}
      </div>

      <div class="detail-content-grid">
        <article class="long-copy">
          <h2>Presentation du logement</h2>
          <p>${property.description}</p>
          <p>Ce bien est selectionne pour les voyageurs, familles, professionnels et clients qui veulent un logement fiable avec suivi local. L'equipe hebergementciv peut organiser une visite, confirmer les disponibilites, preparer une facture entreprise et accompagner le paiement en FCFA.</p>
          <p>Vous profitez d'une adresse pratique a ${property.district}, avec controle du dossier de reservation, suivi des requetes et confirmation par l'equipe avant remise des cles.</p>
          <h3>Ses points forts</h3>
          <div class="amenity-line">${propertyHighlights(property).map(item => `<span>${item}</span>`).join("")}</div>
          <h3>Equipements inclus</h3>
          <div class="amenity-line">${property.amenities.map(item => `<span>${item}</span>`).join("")}</div>
        </article>
        <aside class="reserve-side">
          <p class="eyebrow">Tarifs & disponibilite</p>
          <div class="reserve-price">${fcfa(property.price)} <span>/ nuit</span></div>
          ${saleLine}
          <p>${property.availability}</p>
          <button class="primary-button full" data-reserve="${property.id}">Reserver</button>
          <button class="outline-button full" data-scroll-detail="#tarifs">Voir les tarifs</button>
        </aside>
      </div>

      <section class="availability" id="tarifs">
        <div>
          <h2>Disponibilite</h2>
          <p class="notice">Veuillez selectionner vos dates pour voir les disponibilites et les tarifs de ce logement.</p>
        </div>
        <div class="availability-search">
          <input type="date">
          <input type="date">
          <select><option>${property.guests} voyageurs</option></select>
          <button class="primary-button" data-reserve="${property.id}">Voir les tarifs</button>
        </div>
        <div class="rate-table">
          <div class="rate-head">Type d'hebergement</div>
          <div class="rate-head">Nombre de voyageurs</div>
          <div class="rate-head">Action</div>
          <div><strong>${property.category}</strong><br>${property.beds} chambre(s), ${property.baths} salle(s) de bains</div>
          <div>${property.guests} voyageurs</div>
          <div><button class="primary-button" data-reserve="${property.id}">Reserver</button></div>
        </div>
      </section>

      <section class="rules-reviews" id="regles">
        <div>
          <h2>Regles de la maison</h2>
          <ul class="rule-list">${propertyRules(property).map(rule => `<li>${rule}</li>`).join("")}</ul>
        </div>
        <div id="avis">
          <h2>Commentaires clients</h2>
          <div class="review-score"><strong>${property.rating.toFixed(1)}</strong><span>Indice confiance - retours verifies</span></div>
          <div class="review-bars">
            ${["Personnel", "Equipements", "Proprete", "Confort", "Rapport qualite/prix", "Situation geographique"].map((label, index) => `<p><span>${label}</span><strong>${index === 5 ? "10" : "8,8"}</strong></p>`).join("")}
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderRoute() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/marymua") {
    showView("admin");
    return;
  }
  if (path.startsWith("/logement/")) {
    const id = decodeURIComponent(path.split("/").pop());
    openProperty(id, false);
    return;
  }
  showView("public");
}

function bookingReceipt(booking) {
  return `
    <div class="receipt-document">
      <header class="receipt-header">
        <div>
          <span class="receipt-logo">hc</span>
          <strong>hebergementciv</strong>
          <small>Location et vente de logements - Cote d'Ivoire</small>
        </div>
        <div class="receipt-status">
          <span>${booking.status}</span>
          <small>${booking.paymentStatus}</small>
        </div>
      </header>

      <section class="receipt-hero">
        <div>
          <p class="eyebrow">Recu de reservation</p>
          <h2>${booking.orderNumber}</h2>
          <p>Document de tracabilite genere automatiquement apres la demande client.</p>
        </div>
        <div class="receipt-ref">
          <span>Facture</span>
          <strong>${booking.invoiceNumber}</strong>
          <small>${dateFr(booking.createdAt)}</small>
        </div>
      </section>

      <section class="receipt-grid">
        <article>
          <h3>Client</h3>
          <p><strong>${booking.client.name}</strong></p>
          <p>${booking.client.phone}</p>
          <p>${booking.client.email || "Email non precise"}</p>
          <p>${booking.client.nationality}</p>
        </article>
        <article>
          <h3>Logement</h3>
          <p><strong>${booking.propertyTitle}</strong></p>
          <p>${booking.propertyCategory}</p>
          <p>Operation: ${booking.intent === "vente" ? "Achat" : "Location"}</p>
          <p>Voyageurs: ${booking.stay.guests}</p>
        </article>
        <article>
          <h3>Sejour</h3>
          <p>Arrivee: <strong>${dateFr(booking.stay.checkIn)}</strong></p>
          <p>Depart: <strong>${dateFr(booking.stay.checkOut)}</strong></p>
          <p>Nuits: <strong>${booking.stay.nights}</strong></p>
          <p>Paiement: ${booking.payment.method}</p>
        </article>
      </section>

      <section class="receipt-lines">
        <div class="receipt-table-head"><span>Libelle</span><span>Montant</span></div>
        <div><span>Sous-total logement</span><strong>${fcfa(booking.payment.base)}</strong></div>
        <div><span>Frais de service</span><strong>${fcfa(booking.payment.serviceFee)}</strong></div>
        <div><span>Caution / garantie</span><strong>${fcfa(booking.payment.securityDeposit)}</strong></div>
        <div class="receipt-total"><span>Total a tracer</span><strong>${fcfa(booking.payment.total)}</strong></div>
      </section>

      <footer class="receipt-footer">
        <p>Ce recu confirme l'enregistrement de la demande. La confirmation finale depend de la disponibilite du bien et de la verification du paiement par l'equipe hebergementciv.</p>
        <small>Reference unique: ${booking.id}</small>
      </footer>
    </div>
  `;
}

function showReceipt(booking) {
  state.currentReceipt = booking;
  qs("#receiptContent").innerHTML = bookingReceipt(booking);
  qs("#receiptModal").showModal();
}

function downloadReceiptPdf() {
  if (!state.currentReceipt) {
    toast("Aucun recu a telecharger");
    return;
  }
  const link = document.createElement("a");
  link.href = `/api/bookings/${encodeURIComponent(state.currentReceipt.id)}/receipt.pdf`;
  link.download = `${state.currentReceipt.orderNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function showImageLightbox(image, caption = "") {
  const dialog = qs("#imageLightbox");
  const img = qs("#lightboxImage");
  const text = qs("#lightboxCaption");
  if (!dialog || !img) return;
  img.src = image;
  img.alt = caption || "Image du logement";
  text.textContent = caption;
  dialog.showModal();
}

function goPublicSection(target = "#accueil") {
  if (location.pathname !== "/") history.pushState({}, "", "/");
  showView("public");
  setTimeout(() => qs(target)?.scrollIntoView({ behavior: "smooth" }), 30);
}

function syncBookingNights() {
  const form = qs("#bookingForm");
  if (!form) return;
  const checkIn = form.elements.checkIn.value;
  const checkOut = form.elements.checkOut.value;
  const nightsInput = form.elements.nights;
  const intent = form.elements.intent.value;
  form.elements.checkOut.required = intent !== "vente";
  if (intent === "vente") {
    nightsInput.value = 1;
    return;
  }
  if (!checkIn || !checkOut) return;
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (nights < 1) {
    nightsInput.value = 1;
    toast("La date de depart doit etre apres la date d'arrivee");
    return;
  }
  nightsInput.value = nights;
}

async function submitBooking(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  syncBookingNights();
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.nights = Number(payload.nights || 1);
  payload.guests = Number(payload.guests || 1);
  try {
    const { booking } = await api("/api/bookings", { method: "POST", body: payload });
    form.reset();
    renderBookingOptions();
    renderBookingPreview(qs("#bookingProperty")?.value);
    showReceipt(booking);
    toast(`Reservation creee: ${booking.orderNumber}`);
    if (state.adminUnlocked) loadAdmin();
  } catch (error) {
    toast(error.message);
  }
}

async function submitContact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/messages", { method: "POST", body: payload });
    form.reset();
    toast("Demande envoyee a notre equipe");
    if (state.adminUnlocked) loadAdmin();
  } catch (error) {
    toast(error.message);
  }
}

function metricCard(label, value) {
  return `<article class="metric-card"><strong>${value}</strong><span>${label}</span></article>`;
}

function bookingAdminItem(booking) {
  return `
    <article class="admin-item">
      <header>
        <div>
          <strong>${booking.orderNumber}</strong>
          <small>${booking.propertyTitle} - ${booking.client.name}</small>
        </div>
        <span class="badge">${booking.status}</span>
      </header>
      <div class="receipt-line"><span>Total</span><strong>${fcfa(booking.payment.total)}</strong></div>
      <div class="receipt-line"><span>Paiement</span><strong>${booking.paymentStatus}</strong></div>
      <small>${booking.client.phone} - ${dateFr(booking.createdAt)}</small>
      <div class="admin-controls">
        <select data-booking-status="${booking.id}">
          ${["Nouvelle demande", "En verification", "Confirmee", "Refusee", "Terminee"].map(status => `<option ${status === booking.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <select data-payment-status="${booking.id}">
          ${["A regler", "Paiement initie", "A verifier", "Paye", "Rembourse"].map(status => `<option ${status === booking.paymentStatus ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
      <button class="outline-button" data-admin-receipt="${booking.id}">Voir recu</button>
    </article>
  `;
}

function messageAdminItem(message) {
  return `
    <article class="admin-item">
      <header>
        <div>
          <strong>${message.subject}</strong>
          <small>${message.name} - ${message.phone}</small>
        </div>
        <span class="badge secondary">${message.status}</span>
      </header>
      <p>${message.message}</p>
      <select data-message-status="${message.id}">
        ${["Nouveau", "En cours", "Traite", "Archive"].map(status => `<option ${status === message.status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <div class="admin-controls">
        <button class="outline-button" data-message-archive="${message.id}">Archiver</button>
        <button class="outline-button" data-message-done="${message.id}">Traiter</button>
        <button class="danger-button" data-message-delete="${message.id}">Supprimer</button>
      </div>
    </article>
  `;
}

function propertyAdminItem(property) {
  return `
    <article class="admin-item property-admin-item">
      <header>
        <div>
          <strong>${property.title}</strong>
          <small>${property.category} - ${property.district}, ${property.city}</small>
        </div>
        <span class="badge">${property.status}</span>
      </header>
      <div class="property-admin-media" style="background-image:url('${property.image}')"></div>
      <div class="receipt-line"><span>Location</span><strong>${fcfa(property.price)}</strong></div>
      <div class="receipt-line"><span>Vente</span><strong>${property.salePrice ? fcfa(property.salePrice) : "Non"}</strong></div>
      <small>${property.surface} m2 - ${property.beds} ch. - ${property.guests} pers.</small>
      <button class="outline-button" data-edit-property="${property.id}">Modifier la fiche</button>
    </article>
  `;
}

function cityTileAdminItem(tile) {
  return `
    <article class="admin-item city-admin-item">
      <header>
        <div>
          <strong>${tile.name}</strong>
          <small>Recherche: ${tile.search}</small>
        </div>
        <span class="badge">${tile.status}</span>
      </header>
      <div class="property-admin-media" style="background-image:url('${tile.image}')"></div>
      <p>${tile.subtitle}</p>
      <button class="outline-button" data-edit-city-tile="${tile.id}">Modifier la vignette</button>
    </article>
  `;
}

function syncCityTilePreview() {
  const form = qs("#cityTileForm");
  const preview = qs("#cityTileImagePreview");
  if (!form || !preview) return;
  const image = form.elements.image.value;
  preview.innerHTML = image
    ? `<span style="background-image:url('${image}')" title="Vignette ville"></span>`
    : "<small>Aucune image ajoutee.</small>";
}

function resetCityTileForm() {
  const form = qs("#cityTileForm");
  form.reset();
  form.elements.id.value = "";
  form.elements.status.value = "Destination";
  qs("#cityTileFormTitle").textContent = "Ajouter une ville";
  syncCityTilePreview();
}

function fillCityTileForm(tile) {
  const form = qs("#cityTileForm");
  form.elements.id.value = tile.id;
  form.elements.name.value = tile.name || "";
  form.elements.search.value = tile.search || tile.name || "";
  form.elements.status.value = tile.status || "Destination";
  form.elements.image.value = tile.image || "";
  form.elements.subtitle.value = tile.subtitle || "";
  qs("#cityTileFormTitle").textContent = `Modifier: ${tile.name}`;
  syncCityTilePreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleCityTileImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    qs("#cityTileForm").elements.image.value = await imageFileToDataUrl(file);
    syncCityTilePreview();
    toast("Image de ville ajoutee");
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = "";
  }
}

async function submitCityTile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(form).entries());
  const id = payload.id;
  const path = id ? `/api/admin/city-tiles/${encodeURIComponent(id)}` : "/api/admin/city-tiles";
  const method = id ? "PATCH" : "POST";
  try {
    await api(path, { method, admin: true, body: payload });
    toast(id ? "Vignette ville mise a jour" : "Vignette ville ajoutee");
    resetCityTileForm();
    const data = await api("/api/bootstrap");
    state.properties = data.properties;
    state.cityTiles = data.cityTiles || [];
    renderCityCarousel();
    loadAdmin();
  } catch (error) {
    toast(error.message);
  }
}

function resetPropertyForm() {
  const form = qs("#propertyAdminForm");
  form.reset();
  form.elements.id.value = "";
  form.elements.status.value = "Disponible";
  form.elements.city.value = "Abidjan";
  form.elements.beds.value = 1;
  form.elements.baths.value = 1;
  form.elements.rating.value = 4.8;
  form.elements.availability.value = "Disponible sur demande";
  form.elements.paymentMethods.value = "Mobile Money\nCarte bancaire\nVirement";
  qs("#propertyFormTitle").textContent = "Ajouter un logement";
  syncImagePreview();
}

function fillPropertyForm(property) {
  const form = qs("#propertyAdminForm");
  form.elements.id.value = property.id;
  form.elements.title.value = property.title || "";
  form.elements.category.value = property.category || "Appartement";
  form.elements.intent.value = property.intent || "location";
  form.elements.status.value = property.status || "Disponible";
  form.elements.district.value = property.district || "";
  form.elements.city.value = property.city || "Abidjan";
  form.elements.price.value = property.price || "";
  form.elements.salePrice.value = property.salePrice || "";
  form.elements.beds.value = property.beds ?? 1;
  form.elements.baths.value = property.baths ?? 1;
  form.elements.surface.value = property.surface || "";
  form.elements.guests.value = property.guests || "";
  form.elements.rating.value = property.rating || 4.8;
  form.elements.availability.value = property.availability || "Disponible sur demande";
  form.elements.image.value = property.image || "";
  form.elements.gallery.value = linesToText(property.gallery);
  form.elements.description.value = property.description || "";
  form.elements.amenities.value = linesToText(property.amenities);
  form.elements.highlights.value = linesToText(propertyHighlights(property));
  form.elements.houseRules.value = linesToText(propertyRules(property));
  form.elements.paymentMethods.value = linesToText(property.paymentMethods);
  qs("#propertyFormTitle").textContent = `Modifier: ${property.title}`;
  syncImagePreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitProperty(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(form).entries());
  const mainImage = payload.image;
  payload.gallery = uniqueList(splitLines(payload.gallery).filter(image => image !== mainImage)).join("\n");
  ["price", "salePrice", "beds", "baths", "surface", "guests", "rating"].forEach(key => {
    payload[key] = payload[key] === "" ? null : Number(payload[key]);
  });
  const id = payload.id;
  const path = id ? `/api/admin/properties/${encodeURIComponent(id)}` : "/api/admin/properties";
  const method = id ? "PATCH" : "POST";
  try {
    await api(path, { method, admin: true, body: payload });
    toast(id ? "Fiche logement mise a jour" : "Logement ajoute au catalogue");
    resetPropertyForm();
    const data = await api("/api/bootstrap");
    state.properties = data.properties;
    state.cityTiles = data.cityTiles || state.cityTiles;
    renderCityCarousel();
    renderProperties();
    renderBookingOptions();
    loadAdmin();
  } catch (error) {
    toast(error.message);
  }
}

function updateNotificationUi(data) {
  const count = Number(data.total || 0);
  const badge = qs("#notificationBadge");
  if (badge) {
    badge.textContent = `${count} demande${count > 1 ? "s" : ""}`;
    badge.classList.toggle("has-alert", count > 0);
  }
  document.title = count > 0 ? `(${count}) hebergementciv` : "hebergementciv";
  if (state.notificationCount && count > state.notificationCount && document.visibilityState !== "visible") {
    const delta = count - state.notificationCount;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("hebergementciv", {
        body: `${delta} nouvelle(s) demande(s) a traiter par l'equipe.`
      });
    }
  }
  state.notificationCount = count;
}

async function loadNotifications() {
  try {
    const data = await api("/api/notifications");
    updateNotificationUi(data);
  } catch (error) {
    console.warn(error.message);
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    toast("Notifications navigateur non disponibles");
    return;
  }
  const permission = await Notification.requestPermission();
  toast(permission === "granted" ? "Alertes activees" : "Alertes non autorisees");
}

function logoutAdmin(reason = "Session fermee") {
  if (!state.adminUnlocked) return;
  state.adminUnlocked = false;
  window.adminBookings = [];
  state.adminProperties = [];
  state.adminCityTiles = [];
  qs("#adminDashboard")?.classList.add("locked");
  qs("#metricGrid").innerHTML = "";
  qs("#bookingList").innerHTML = "";
  qs("#messageList").innerHTML = "";
  qs("#propertyAdminList").innerHTML = "";
  qs("#cityTileList").innerHTML = "";
  resetPropertyForm();
  resetCityTileForm();
  if (state.adminPollTimer) clearInterval(state.adminPollTimer);
  state.adminPollTimer = null;
  toast(reason);
}

function resetAdminIdleTimer() {
  if (!state.adminUnlocked) return;
  if (state.adminIdleTimer) clearTimeout(state.adminIdleTimer);
  state.adminIdleTimer = setTimeout(() => logoutAdmin("Deconnexion automatique apres 10 min d'inactivite"), 10 * 60 * 1000);
}

function unlockAdmin() {
  state.adminUnlocked = true;
  qs("#adminDashboard").classList.remove("locked");
  resetAdminIdleTimer();
  if (state.adminPollTimer) clearInterval(state.adminPollTimer);
  state.adminPollTimer = setInterval(() => {
    if (state.adminUnlocked) loadAdmin();
  }, 30000);
  loadAdmin();
}

async function loadAdmin() {
  const data = await api("/api/admin/dashboard", { admin: true });
  qs("#metricGrid").innerHTML = [
    metricCard("Chiffre d'affaires potentiel", fcfa(data.metrics.revenue)),
    metricCard("Reservations a suivre", data.metrics.pendingBookings),
    metricCard("Requetes ouvertes", data.metrics.openMessages),
    metricCard("Biens au catalogue", data.metrics.availableListings)
  ].join("");
  state.siteSettings = data.siteSettings || state.siteSettings;
  fillSiteSettingsForm(state.siteSettings);
  qs("#bookingList").innerHTML = data.bookings.length ? data.bookings.map(bookingAdminItem).join("") : "<p>Aucune reservation.</p>";
  qs("#messageList").innerHTML = data.messages.length ? data.messages.map(messageAdminItem).join("") : "<p>Aucune requete.</p>";
  qs("#propertyAdminList").innerHTML = data.properties.length ? data.properties.map(propertyAdminItem).join("") : "<p>Aucun logement.</p>";
  qs("#cityTileList").innerHTML = data.cityTiles.length ? data.cityTiles.map(cityTileAdminItem).join("") : "<p>Aucune vignette.</p>";
  window.adminBookings = data.bookings;
  state.adminProperties = data.properties;
  state.adminCityTiles = data.cityTiles;
}

async function updateBooking(id, payload) {
  await api(`/api/admin/bookings/${id}`, { method: "PATCH", admin: true, body: payload });
  toast("Reservation mise a jour");
  loadAdmin();
}

async function updateMessage(id, payload) {
  await api(`/api/admin/messages/${id}`, { method: "PATCH", admin: true, body: payload });
  toast("Requete mise a jour");
  loadAdmin();
  loadNotifications();
}

async function deleteMessage(id) {
  const confirmed = window.confirm("Supprimer definitivement cette requete ?");
  if (!confirmed) return;
  await api(`/api/admin/messages/${id}`, { method: "DELETE", admin: true });
  toast("Requete supprimee");
  loadAdmin();
  loadNotifications();
}

function bindEvents() {
  qs("#heroSearch").addEventListener("submit", event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    state.filters.category = payload.category;
    state.filters.location = payload.location;
    state.filters.intent = payload.intent;
    renderProperties();
    qs("#biens").scrollIntoView({ behavior: "smooth" });
  });

  qsa("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      state.filters.category = button.dataset.category;
      renderProperties();
      qs("#biens").scrollIntoView({ behavior: "smooth" });
    });
  });

  qsa("[data-intent]").forEach(button => {
    button.addEventListener("click", () => {
      qsa("[data-intent]").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      state.filters.intent = button.dataset.intent;
      renderProperties();
    });
  });

  qs("#priceRange").addEventListener("input", event => {
    state.filters.maxPrice = Number(event.target.value);
    qs("#priceOutput").textContent = fcfa(event.target.value);
    renderProperties();
  });

  qs("#quickSearch").addEventListener("input", event => {
    state.filters.location = event.target.value;
    qsa("[data-city]").forEach(item => item.classList.remove("active"));
    renderProperties();
  });

  document.addEventListener("click", event => {
    resetAdminIdleTimer();
    const detail = event.target.closest("[data-detail]");
    const reserve = event.target.closest("[data-reserve]");
    const scroll = event.target.closest("[data-scroll]");
    const detailScroll = event.target.closest("[data-scroll-detail]");
    const adminReceipt = event.target.closest("[data-admin-receipt]");
    const editProperty = event.target.closest("[data-edit-property]");
    const editCityTile = event.target.closest("[data-edit-city-tile]");
    const cityTrigger = event.target.closest("[data-city]");
    const carouselButton = event.target.closest("[data-city-carousel]");
    const lightboxImage = event.target.closest("[data-lightbox-image]");
    const publicTarget = event.target.closest("[data-go-public]");
    const archiveMessage = event.target.closest("[data-message-archive]");
    const doneMessage = event.target.closest("[data-message-done]");
    const deleteMessageButton = event.target.closest("[data-message-delete]");
    if (reserve) {
      event.stopPropagation();
      selectForBooking(reserve.dataset.reserve);
    } else if (detail) {
      openProperty(detail.dataset.detail);
    }
    if (scroll) qs(scroll.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    if (detailScroll) qs(detailScroll.dataset.scrollDetail)?.scrollIntoView({ behavior: "smooth" });
    if (lightboxImage) {
      showImageLightbox(lightboxImage.dataset.lightboxImage, lightboxImage.dataset.lightboxCaption);
    }
    if (publicTarget) {
      goPublicSection(publicTarget.dataset.goPublic);
    }
    if (adminReceipt) {
      const booking = (window.adminBookings || []).find(item => item.id === adminReceipt.dataset.adminReceipt);
      if (booking) showReceipt(booking);
    }
    if (cityTrigger && !cityTrigger.closest(".topbar")) {
      const city = cityTrigger.dataset.city || "";
      state.filters.location = city;
      const quickSearch = qs("#quickSearch");
      if (quickSearch) quickSearch.value = city;
      qsa("[data-city]").forEach(item => item.classList.toggle("active", item.dataset.city === city && city !== ""));
      renderProperties();
      qs("#biens").scrollIntoView({ behavior: "smooth" });
    }
    if (carouselButton) {
      const carousel = qs("#cityCarousel");
      const direction = carouselButton.dataset.cityCarousel === "next" ? 1 : -1;
      carousel?.scrollBy({ left: direction * 360, behavior: "smooth" });
    }
    if (archiveMessage) {
      updateMessage(archiveMessage.dataset.messageArchive, { status: "Archive" });
    }
    if (doneMessage) {
      updateMessage(doneMessage.dataset.messageDone, { status: "Traite" });
    }
    if (deleteMessageButton) {
      deleteMessage(deleteMessageButton.dataset.messageDelete);
    }
    if (editProperty) {
      const property = state.adminProperties.find(item => item.id === editProperty.dataset.editProperty);
      if (property) fillPropertyForm(property);
    }
    if (editCityTile) {
      const tile = state.adminCityTiles.find(item => item.id === editCityTile.dataset.editCityTile);
      if (tile) fillCityTileForm(tile);
    }
  });

  document.addEventListener("change", event => {
    resetAdminIdleTimer();
    if (event.target.matches("[data-booking-status]")) {
      updateBooking(event.target.dataset.bookingStatus, { status: event.target.value });
    }
    if (event.target.matches("[data-payment-status]")) {
      updateBooking(event.target.dataset.paymentStatus, { paymentStatus: event.target.value });
    }
    if (event.target.matches("[data-message-status]")) {
      updateMessage(event.target.dataset.messageStatus, { status: event.target.value });
    }
  });

  qs("[data-close-receipt]").addEventListener("click", () => qs("#receiptModal").close());
  qs("[data-close-lightbox]").addEventListener("click", () => qs("#imageLightbox").close());
  qs("#printReceipt").addEventListener("click", () => window.print());
  qs("#downloadReceipt").addEventListener("click", downloadReceiptPdf);
  qs("#bookingForm").addEventListener("submit", submitBooking);
  qs("#bookingProperty").addEventListener("change", event => renderBookingPreview(event.target.value));
  qs("#bookingProperty").addEventListener("change", event => renderPaymentOptions(event.target.value));
  qs("#bookingForm").addEventListener("input", event => {
    if (["checkIn", "checkOut", "intent"].includes(event.target.name)) syncBookingNights();
  });
  qs("#bookingForm").addEventListener("change", event => {
    if (["checkIn", "checkOut", "intent"].includes(event.target.name)) syncBookingNights();
  });
  qs("#contactForm").addEventListener("submit", submitContact);
  qs("#siteSettingsForm").addEventListener("submit", submitSiteSettings);
  qs("#heroImageFile").addEventListener("change", handleHeroImageFile);
  qs("#siteSettingsForm").addEventListener("input", event => {
    resetAdminIdleTimer();
    if (event.target.name === "heroImage") syncHeroImagePreview();
  });
  qs("#cityTileForm").addEventListener("submit", submitCityTile);
  qs("#newCityTileButton").addEventListener("click", resetCityTileForm);
  qs("#cityTileImageFile").addEventListener("change", handleCityTileImageFile);
  qs("#cityTileForm").addEventListener("input", event => {
    resetAdminIdleTimer();
    if (event.target.name === "image") syncCityTilePreview();
  });
  qs("#propertyAdminForm").addEventListener("submit", submitProperty);
  qs("#newPropertyButton").addEventListener("click", resetPropertyForm);
  qs("#mainImageFile").addEventListener("change", handleMainImageFile);
  qs("#galleryImageFiles").addEventListener("change", handleGalleryFiles);
  qs("#propertyAdminForm").addEventListener("input", event => {
    resetAdminIdleTimer();
    if (["image", "gallery"].includes(event.target.name)) syncImagePreview();
  });
  qs("#enableNotifications").addEventListener("click", enableNotifications);
  ["mousemove", "keydown", "touchstart", "scroll"].forEach(type => {
    document.addEventListener(type, resetAdminIdleTimer, { passive: true });
  });

  qs("#adminLogin").addEventListener("submit", event => {
    event.preventDefault();
    resetAdminIdleTimer();
    const password = new FormData(event.currentTarget).get("password");
    if (password !== "marymua123") {
      toast("Mot de passe incorrect");
      return;
    }
    unlockAdmin();
    toast("Espace prive ouvert");
  });

  window.addEventListener("popstate", renderRoute);
  loadNotifications();
  state.notificationTimer = setInterval(loadNotifications, 30000);
}

loadBootstrap()
  .then(bindEvents)
  .catch(error => toast(error.message));
