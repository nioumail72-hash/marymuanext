const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { v2: cloudinary } = require("cloudinary");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "hebergementciv";
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "site_state";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "hebergementciv";
const hasMongo = Boolean(MONGODB_URI);
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const ADMIN_TOKEN = "hebergementciv-admin";
const PAYMENT_METHODS = new Set([
  "Mobile Money",
  "Carte bancaire",
  "Virement",
  "Paiement a l'agence",
  "Especes a l'agence",
  "Cheque certifie",
  "Paiement echelonne"
]);
const PROPERTY_CATEGORIES = new Set(["Appartement", "Studio", "Suite", "Penthouse", "Logement etudiant"]);
const PROPERTY_INTENTS = new Set(["location", "vente"]);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const seedProperties = [
  {
    id: "prop-cocody-riviera-suite",
    title: "Suite Riviera Palm",
    category: "Suite",
    intent: "location",
    district: "Cocody Riviera",
    city: "Abidjan",
    price: 85000,
    salePrice: null,
    rating: 4.9,
    beds: 2,
    baths: 2,
    surface: 92,
    guests: 4,
    availability: "Disponible aujourd'hui",
    status: "Disponible",
    image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Climatisation", "WiFi fibre", "Parking", "Piscine", "Menage"],
    paymentMethods: ["Mobile Money", "Carte bancaire", "Virement"],
    description: "Suite haut standing proche des restaurants, ambassades et axes rapides de Cocody."
  },
  {
    id: "prop-plateau-penthouse",
    title: "Penthouse Lagune Plateau",
    category: "Penthouse",
    intent: "location",
    district: "Plateau",
    city: "Abidjan",
    price: 260000,
    salePrice: null,
    rating: 5,
    beds: 4,
    baths: 4,
    surface: 260,
    guests: 8,
    availability: "Visite sur rendez-vous",
    status: "Premium",
    image: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Vue lagune", "Conciergerie", "Salle de sport", "Ascenseur prive", "Securite 24/7"],
    paymentMethods: ["Carte bancaire", "Virement", "Cheque certifie"],
    description: "Adresse signature avec terrasse panoramique, service concierge et securite renforcee."
  },
  {
    id: "prop-marcory-appartement",
    title: "Appartement Marcory Business",
    category: "Appartement",
    intent: "location",
    district: "Marcory Zone 4",
    city: "Abidjan",
    price: 65000,
    salePrice: null,
    rating: 4.7,
    beds: 3,
    baths: 2,
    surface: 118,
    guests: 6,
    availability: "Disponible cette semaine",
    status: "Populaire",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Cuisine equipee", "WiFi", "Groupe electrogene", "Parking", "Gardien"],
    paymentMethods: ["Mobile Money", "Especes a l'agence", "Carte bancaire"],
    description: "Appartement meuble ideal pour missions professionnelles, familles et sejours moyens."
  },
  {
    id: "prop-angre-studio",
    title: "Studio Angre Connect",
    category: "Studio",
    intent: "location",
    district: "Angre 8e Tranche",
    city: "Abidjan",
    price: 28000,
    salePrice: null,
    rating: 4.6,
    beds: 1,
    baths: 1,
    surface: 36,
    guests: 2,
    availability: "Entree autonome",
    status: "Budget",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["WiFi fibre", "Climatisation", "Cuisine compacte", "Netflix", "Eau chaude"],
    paymentMethods: ["Mobile Money", "Carte bancaire"],
    description: "Studio pratique pour jeunes actifs, consultants et courts sejours a Cocody-Angre."
  },
  {
    id: "prop-bingerville-etudiant",
    title: "Residence Etudiante Bingerville",
    category: "Logement etudiant",
    intent: "location",
    district: "Bingerville",
    city: "Abidjan",
    price: 15000,
    salePrice: null,
    rating: 4.4,
    beds: 1,
    baths: 1,
    surface: 22,
    guests: 1,
    availability: "Dossiers ouverts",
    status: "Etudiant",
    image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Bureau", "WiFi", "Buanderie", "Gardien", "Proche campus"],
    paymentMethods: ["Mobile Money", "Virement"],
    description: "Chambres equipees avec forfait mensuel, suivi dossier garant et proximite campus."
  },
  {
    id: "prop-assinie-villa-vente",
    title: "Villa Assinie Signature",
    category: "Appartement",
    intent: "vente",
    district: "Assinie Mafia",
    city: "Sud-Comoe",
    price: 180000,
    salePrice: 185000000,
    rating: 4.8,
    beds: 5,
    baths: 5,
    surface: 420,
    guests: 10,
    availability: "Vente et location",
    status: "A vendre",
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1600607688960-e095ff83135c?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Piscine", "Jardin", "Acces plage", "Cuisine equipee", "Titre foncier"],
    paymentMethods: ["Virement", "Cheque certifie", "Paiement echelonne"],
    description: "Bien d'exception disponible a l'achat avec accompagnement juridique et fiscal."
  },
  {
    id: "prop-bouake-appartement-centre",
    title: "Appartement Bouake Centre",
    category: "Appartement",
    intent: "location",
    district: "Bouake Centre",
    city: "Bouake",
    price: 42000,
    salePrice: null,
    rating: 4.6,
    beds: 3,
    baths: 2,
    surface: 96,
    guests: 5,
    availability: "Disponible cette semaine",
    status: "Nouveau",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["WiFi", "Parking", "Cuisine equipee", "Gardien", "Balcon"],
    paymentMethods: ["Mobile Money", "Carte bancaire", "Virement"],
    description: "Appartement meuble au centre de Bouake pour missions professionnelles, familles et sejours moyens."
  },
  {
    id: "prop-san-pedro-studio-port",
    title: "Studio San Pedro Port",
    category: "Studio",
    intent: "location",
    district: "Quartier Port",
    city: "San Pedro",
    price: 32000,
    salePrice: null,
    rating: 4.5,
    beds: 1,
    baths: 1,
    surface: 38,
    guests: 2,
    availability: "Entree autonome",
    status: "Business",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Climatisation", "WiFi", "Eau chaude", "Proche port", "Menage"],
    paymentMethods: ["Mobile Money", "Virement"],
    description: "Studio pratique pour consultants, equipes portuaires et courts sejours a San Pedro."
  },
  {
    id: "prop-daloa-etudiant",
    title: "Logement Etudiant Daloa Campus",
    category: "Logement etudiant",
    intent: "location",
    district: "Quartier Campus",
    city: "Daloa",
    price: 12000,
    salePrice: null,
    rating: 4.3,
    beds: 1,
    baths: 1,
    surface: 20,
    guests: 1,
    availability: "Dossiers ouverts",
    status: "Etudiant",
    image: "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=900&q=80"
    ],
    amenities: ["Bureau", "WiFi", "Buanderie", "Gardien", "Proche campus"],
    paymentMethods: ["Mobile Money", "Virement"],
    description: "Chambre equipee pour etudiants a Daloa, avec suivi du dossier et proximite du campus."
  }
];

const seedCityTiles = [
  {
    id: "city-abidjan",
    name: "Abidjan",
    search: "Abidjan",
    subtitle: "Cocody, Plateau, Marcory, Angre",
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80",
    status: "Capitale economique"
  },
  {
    id: "city-bouake",
    name: "Bouake",
    search: "Bouake",
    subtitle: "Centre, commerce et missions interieures",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    status: "Centre du pays"
  },
  {
    id: "city-san-pedro",
    name: "San Pedro",
    search: "San Pedro",
    subtitle: "Port, affaires et courts sejours",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    status: "Zone portuaire"
  },
  {
    id: "city-daloa",
    name: "Daloa",
    search: "Daloa",
    subtitle: "Campus, sejours et logements accessibles",
    image: "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=1200&q=80",
    status: "Ville universitaire"
  },
  {
    id: "city-yamoussoukro",
    name: "Yamoussoukro",
    search: "Yamoussoukro",
    subtitle: "Sejours administratifs et visites",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    status: "Capitale politique"
  },
  {
    id: "city-korhogo",
    name: "Korhogo",
    search: "Korhogo",
    subtitle: "Nord, affaires et missions longues",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
    status: "Grand Nord"
  }
];

const seedSiteSettings = {
  heroImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80",
  heroAlt: "Vue moderne d'Abidjan et logements premium"
};

const seedDb = {
  properties: seedProperties,
  cityTiles: seedCityTiles,
  siteSettings: seedSiteSettings,
  ownerSubmissions: [],
  bookings: [],
  messages: [
    {
      id: "msg-demo-1",
      createdAt: new Date().toISOString(),
      name: "Awa K.",
      phone: "+225 07 00 00 00 00",
      email: "awa@example.com",
      subject: "Visite a Cocody",
      message: "Bonjour, je veux visiter une suite a Cocody ce week-end.",
      status: "Nouveau",
      priority: "Normale"
    }
  ],
  payments: []
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedDb, null, 2));
  }
}

function normalizeDb(db = {}) {
  return {
    properties: Array.isArray(db.properties) ? db.properties : seedProperties,
    cityTiles: Array.isArray(db.cityTiles) ? db.cityTiles : seedCityTiles,
    siteSettings: db.siteSettings || seedSiteSettings,
    ownerSubmissions: Array.isArray(db.ownerSubmissions) ? db.ownerSubmissions : [],
    bookings: Array.isArray(db.bookings) ? db.bookings : [],
    messages: Array.isArray(db.messages) ? db.messages : [],
    payments: Array.isArray(db.payments) ? db.payments : []
  };
}

function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let mongoClientPromise = null;

async function getMongoCollection() {
  if (!hasMongo) return null;
  if (!mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    mongoClientPromise = client.connect();
  }
  const client = await mongoClientPromise;
  return client.db(MONGODB_DB_NAME).collection(MONGODB_COLLECTION);
}

async function loadDb() {
  if (!hasMongo) return readDb();
  const collection = await getMongoCollection();
  const stored = await collection.findOne({ _id: "main" });
  if (stored) {
    const { _id, ...db } = stored;
    return normalizeDb(db);
  }
  const initialDb = readDb();
  await collection.updateOne(
    { _id: "main" },
    { $set: { ...initialDb, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
  return initialDb;
}

async function saveDb(db) {
  const normalized = normalizeDb(db);
  if (!hasMongo) {
    writeDb(normalized);
    return normalized;
  }
  const collection = await getMongoCollection();
  await collection.updateOne(
    { _id: "main" },
    { $set: { ...normalized, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
  return normalized;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 24_000_000) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function formatDateCode(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function createOrderNumber() {
  return `HBCIV-${formatDateCode()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function createInvoiceNumber() {
  return `FAC-${formatDateCode()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value, max = 200) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function cleanList(value, maxItems = 12, maxItemLength = 120) {
  const items = Array.isArray(value)
    ? value
    : String(value || "").split(/\r?\n|,/);
  return items
    .map(item => cleanText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanLines(value, maxItems = 12, maxItemLength = 600) {
  const items = Array.isArray(value)
    ? value
    : String(value || "").split(/\r?\n/);
  return items
    .map(item => cleanText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanUrl(value, max = 600) {
  const url = cleanText(value, max);
  if (!url) return "";
  if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(url) && url.length <= 1_200_000) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function isDataImage(value) {
  return /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(String(value || ""));
}

async function uploadImageIfNeeded(value, folder, label = "image") {
  const image = String(value || "").trim();
  if (!image || !isDataImage(image)) return image;
  if (!hasCloudinary && hasMongo) {
    throw new Error(`Cloudinary doit etre configure pour importer ${label}`);
  }
  if (!hasCloudinary) return image;
  try {
    const result = await cloudinary.uploader.upload(image, {
      folder: `${CLOUDINARY_FOLDER}/${folder}`,
      resource_type: "image",
      overwrite: false,
      use_filename: false,
      unique_filename: true,
      transformation: [
        { width: 1800, height: 1400, crop: "limit" },
        { quality: "auto:good", fetch_format: "auto" }
      ]
    });
    return result.secure_url;
  } catch (error) {
    throw new Error(`Upload Cloudinary impossible pour ${label}`);
  }
}

async function preparePropertyMediaPayload(payload) {
  const prepared = { ...payload };
  prepared.image = await uploadImageIfNeeded(prepared.image, "properties", "l'image principale");
  const gallery = cleanLines(prepared.gallery, 12, 1_200_000);
  prepared.gallery = (await Promise.all(
    gallery.map((image, index) => uploadImageIfNeeded(image, "properties/gallery", `l'image galerie ${index + 1}`))
  )).join("\n");
  return prepared;
}

async function prepareCityTileMediaPayload(payload) {
  return {
    ...payload,
    image: await uploadImageIfNeeded(payload.image, "cities", "l'image de ville")
  };
}

async function prepareSiteSettingsMediaPayload(payload) {
  return {
    ...payload,
    heroImage: await uploadImageIfNeeded(payload.heroImage, "site", "l'image d'accueil")
  };
}

async function prepareOwnerSubmissionPayload(payload) {
  return preparePropertyMediaPayload(payload);
}

function numberInRange(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function uniqueImages(images, mainImage = "") {
  const seen = new Set(mainImage ? [mainImage] : []);
  return images.filter(image => {
    if (!image || seen.has(image)) return false;
    seen.add(image);
    return true;
  });
}

function isValidPersonName(value) {
  const name = cleanText(value, 80);
  return name.length >= 2 && name.length <= 80 && /[A-Za-z]/.test(name) && !/\d/.test(name);
}

function isValidPhone(value) {
  const phone = cleanText(value, 24);
  const digits = phone.replace(/\D/g, "");
  return /^[+0-9][0-9 +().-]{7,23}$/.test(phone) && digits.length >= 8 && digits.length <= 15;
}

function isValidEmail(value) {
  const email = cleanText(value, 120);
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidSimpleText(value, min, max, allowEmpty = false) {
  const text = cleanText(value, max);
  if (!text) return allowEmpty;
  return text.length >= min && text.length <= max;
}

function validatePaymentMethod(value) {
  const method = cleanText(value || "Mobile Money", 60);
  if (!PAYMENT_METHODS.has(method)) {
    throw new Error("Moyen de paiement invalide");
  }
  return method;
}

function normalizePropertyPayload(payload, existingProperty = null) {
  const title = cleanText(payload.title, 120);
  const district = cleanText(payload.district, 80);
  const city = cleanText(payload.city || "Abidjan", 80);
  const category = cleanText(payload.category, 40);
  const intent = normalizeText(payload.intent || "location");
  const image = cleanUrl(payload.image, 1_200_000);
  const gallery = uniqueImages(
    cleanLines(payload.gallery, 12, 1_200_000).map(url => cleanUrl(url, 1_200_000)).filter(Boolean),
    image
  );
  const amenities = cleanList(payload.amenities, 16, 80);
  const highlights = cleanList(payload.highlights, 12, 120);
  const houseRules = cleanList(payload.houseRules, 12, 140);
  const paymentMethods = cleanList(payload.paymentMethods, 8, 60).filter(method => PAYMENT_METHODS.has(method));

  if (!title || title.length < 3) throw new Error("Titre du logement invalide");
  if (!PROPERTY_CATEGORIES.has(category)) throw new Error("Categorie de logement invalide");
  if (!PROPERTY_INTENTS.has(intent)) throw new Error("Type d'operation invalide");
  if (!district || district.length < 2) throw new Error("Quartier invalide");
  if (!city || city.length < 2) throw new Error("Ville invalide");
  if (!image) throw new Error("Image principale invalide");
  if (!amenities.length) throw new Error("Ajoutez au moins un equipement");

  const price = numberInRange(payload.price, 1000, 500000000, 0);
  const salePrice = payload.salePrice ? numberInRange(payload.salePrice, 0, 5000000000, 0) : null;
  if (price < 1000) throw new Error("Prix par nuit invalide");
  if (intent === "vente" && !salePrice) throw new Error("Prix de vente requis pour un bien a vendre");

  const baseId = existingProperty?.id || payload.id || `prop-${slugify(`${district}-${title}`) || crypto.randomUUID()}`;
  return {
    id: cleanText(baseId, 90),
    title,
    category,
    intent,
    district,
    city,
    price,
    salePrice,
    rating: Math.min(5, Math.max(1, Number(payload.rating || existingProperty?.rating || 4.8))),
    beds: numberInRange(payload.beds, 0, 30, 1),
    baths: numberInRange(payload.baths, 0, 30, 1),
    surface: numberInRange(payload.surface, 1, 5000, 30),
    guests: numberInRange(payload.guests, 1, 100, 2),
    availability: cleanText(payload.availability || "Disponible sur demande", 120),
    status: cleanText(payload.status || "Disponible", 60),
    image,
    gallery,
    amenities,
    highlights: highlights.length ? highlights : amenities.slice(0, 6),
    houseRules: houseRules.length ? houseRules : [
      "Piece d'identite requise",
      "Confirmation de paiement avant entree",
      "Respect du voisinage",
      "Etat des lieux a l'arrivee"
    ],
    paymentMethods: paymentMethods.length ? paymentMethods : ["Mobile Money", "Carte bancaire", "Virement"],
    description: cleanText(payload.description, 1200)
  };
}

function normalizeOwnerSubmissionPayload(payload) {
  if (!isValidPersonName(payload.ownerName)) throw new Error("Nom du proprietaire invalide");
  if (!isValidPhone(payload.ownerPhone)) throw new Error("Telephone du proprietaire invalide");
  if (!isValidEmail(payload.ownerEmail)) throw new Error("Adresse email du proprietaire invalide");
  if (!isValidSimpleText(payload.ownerType || "Proprietaire", 2, 60)) throw new Error("Profil proprietaire invalide");

  const property = normalizePropertyPayload({
    ...payload,
    status: "En attente validation",
    availability: payload.availability || "A verifier avec le proprietaire"
  });

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "En attente",
    owner: {
      name: cleanText(payload.ownerName, 80),
      phone: cleanText(payload.ownerPhone, 24),
      email: cleanText(payload.ownerEmail, 120),
      type: cleanText(payload.ownerType || "Proprietaire", 60)
    },
    property,
    notes: cleanText(payload.ownerNotes || "", 800)
  };
}

function normalizeCityTilePayload(payload, existingTile = null) {
  const name = cleanText(payload.name, 80);
  const search = cleanText(payload.search || name, 80);
  const subtitle = cleanText(payload.subtitle, 160);
  const status = cleanText(payload.status || "Destination", 80);
  const image = cleanUrl(payload.image, 1_200_000);

  if (!name || name.length < 2) throw new Error("Nom de ville invalide");
  if (!search || search.length < 2) throw new Error("Zone de recherche invalide");
  if (!subtitle || subtitle.length < 4) throw new Error("Sous-titre invalide");
  if (!image) throw new Error("Image de ville invalide");

  const baseId = existingTile?.id || payload.id || `city-${slugify(name) || crypto.randomUUID()}`;
  return {
    id: cleanText(baseId, 90),
    name,
    search,
    subtitle,
    image,
    status
  };
}

function normalizeSiteSettingsPayload(payload, existingSettings = {}) {
  const heroImage = cleanUrl(payload.heroImage || existingSettings.heroImage, 1_200_000);
  const heroAlt = cleanText(payload.heroAlt || existingSettings.heroAlt || "Image d'accueil hebergementciv", 160);
  if (!heroImage) throw new Error("Image d'accueil invalide");
  if (heroAlt.length < 4) throw new Error("Description de l'image invalide");
  return {
    ...existingSettings,
    heroImage,
    heroAlt
  };
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getBookingIntent(payload, property) {
  const intent = normalizeText(payload.intent);
  if (intent === "vente" || intent === "location") return intent;
  return property.intent === "vente" ? "vente" : "location";
}

function deriveStay(payload, property) {
  const intent = getBookingIntent(payload, property);
  const checkIn = parseIsoDate(payload.checkIn);
  if (!checkIn) {
    throw new Error("Date d'arrivee invalide");
  }

  let checkOut = parseIsoDate(payload.checkOut);
  let nights = 1;
  if (intent === "location") {
    if (!checkOut) {
      throw new Error("Date de depart requise pour une location");
    }
    const diffMs = checkOut.getTime() - checkIn.getTime();
    nights = Math.round(diffMs / 86400000);
    if (nights < 1) {
      throw new Error("La date de depart doit etre apres la date d'arrivee");
    }
    if (nights > 365) {
      throw new Error("La duree de location ne peut pas depasser 365 nuits");
    }
  } else if (checkOut && checkOut.getTime() <= checkIn.getTime()) {
    checkOut = null;
  }

  const requestedGuests = Number(payload.guests || 1);
  if (!Number.isInteger(requestedGuests) || requestedGuests < 1) {
    throw new Error("Nombre de voyageurs invalide");
  }
  if (requestedGuests > (property.guests || 20)) {
    throw new Error(`Ce logement accepte au maximum ${property.guests} voyageur(s)`);
  }
  return {
    intent,
    checkIn: payload.checkIn,
    checkOut: checkOut ? payload.checkOut : "",
    nights,
    guests: requestedGuests
  };
}

function calculateTotal(property, stay) {
  const nights = stay.nights;
  const serviceFee = Math.round(property.price * nights * 0.08);
  const securityDeposit = stay.intent === "vente" ? 0 : Math.round(property.price * 0.35);
  const base = stay.intent === "vente" && property.salePrice ? property.salePrice : property.price * nights;
  return {
    nights,
    base,
    serviceFee,
    securityDeposit,
    total: base + serviceFee + securityDeposit
  };
}

function requireAdmin(req, res) {
  if (req.headers.authorization === `Bearer ${ADMIN_TOKEN}`) return true;
  sendJson(res, 401, { error: "Acces prive requis" });
  return false;
}

function publicSnapshot(db) {
  return {
    properties: db.properties,
    cityTiles: db.cityTiles || [],
    siteSettings: db.siteSettings || seedSiteSettings,
    stats: {
      listings: db.properties.length,
      bookings: db.bookings.length,
      districts: [...new Set(db.properties.map(item => item.district))].length,
      averageRating: 4.8
    }
  };
}

function notificationSnapshot(db) {
  const pendingBookings = db.bookings.filter(item => !["Confirmee", "Refusee", "Terminee"].includes(item.status)).length;
  const openMessages = db.messages.filter(item => !["Traite", "Archive"].includes(item.status)).length;
  const pendingOwnerSubmissions = (db.ownerSubmissions || []).filter(item => !["Publie", "Refuse"].includes(item.status)).length;
  return {
    pendingBookings,
    openMessages,
    pendingOwnerSubmissions,
    total: pendingBookings + openMessages + pendingOwnerSubmissions,
    updatedAt: new Date().toISOString()
  };
}

function asciiText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function pdfEscape(value) {
  return asciiText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function fcfaText(value) {
  const amount = String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${amount} FCFA`;
}

function dateText(value) {
  if (!value) return "Non precise";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function wrapPdfText(value, maxChars = 76) {
  const words = asciiText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function makePdfObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function buildPdf(objects) {
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

function generateReceiptPdf(booking, property) {
  const width = 595.28;
  const height = 841.89;
  const commands = [];
  const text = (value, x, y, size = 10, font = "F1", color = "0 0 0") => {
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
  };
  const rect = (x, y, w, h, color) => {
    commands.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
  };
  const strokeRect = (x, y, w, h, color = "0.84 0.88 0.88") => {
    commands.push(`${color} RG ${x} ${y} ${w} ${h} re S`);
  };
  const line = (x1, y1, x2, y2, color = "0.84 0.88 0.88") => {
    commands.push(`${color} RG ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  rect(0, 746, width, 96, "0 0.21 0.2");
  rect(42, 777, 38, 38, "0.71 0.93 0.91");
  text("hc", 54, 790, 14, "F2", "0 0.21 0.2");
  text("hebergementciv", 94, 795, 22, "F2", "1 1 1");
  text("Location et vente de logements - Cote d'Ivoire", 94, 776, 10, "F1", "0.91 0.95 1");
  rect(408, 782, 145, 28, "1 1 1");
  text(asciiText(booking.status).toUpperCase(), 421, 791, 10, "F2", "0 0.21 0.2");
  text(asciiText(booking.paymentStatus), 421, 765, 9, "F1", "0.91 0.95 1");

  text("RECU DE RESERVATION", 42, 706, 10, "F2", "0.67 0.2 0");
  text(booking.orderNumber, 42, 678, 24, "F2", "0 0.21 0.2");
  text("Document de tracabilite genere automatiquement apres la demande client.", 42, 658, 10, "F1", "0.25 0.28 0.28");

  rect(382, 650, 171, 75, "0.97 0.98 1");
  strokeRect(382, 650, 171, 75);
  text("Facture", 398, 700, 9, "F2", "0.33 0.38 0.37");
  text(booking.invoiceNumber, 398, 680, 15, "F2", "0 0.21 0.2");
  text(dateText(booking.createdAt), 398, 662, 9, "F1", "0.33 0.38 0.37");
  line(42, 632, 553, 632);

  const cardTop = 600;
  const cardW = 158;
  const cards = [
    {
      title: "Client",
      rows: [booking.client.name, booking.client.phone, booking.client.email || "Email non precise", booking.client.nationality]
    },
    {
      title: "Logement",
      rows: [booking.propertyTitle, booking.propertyCategory, `Operation: ${booking.intent === "vente" ? "Achat" : "Location"}`, `Zone: ${property?.district || "Non precise"}`]
    },
    {
      title: "Sejour",
      rows: [`Arrivee: ${dateText(booking.stay.checkIn)}`, `Depart: ${dateText(booking.stay.checkOut)}`, `Nuits: ${booking.stay.nights}`, `Paiement: ${booking.payment.method}`]
    }
  ];
  cards.forEach((card, index) => {
    const x = 42 + index * (cardW + 18);
    rect(x, cardTop - 108, cardW, 108, "1 1 1");
    strokeRect(x, cardTop - 108, cardW, 108);
    text(card.title, x + 12, cardTop - 24, 12, "F2", "0 0.21 0.2");
    card.rows.forEach((row, rowIndex) => {
      text(row, x + 12, cardTop - 44 - rowIndex * 16, rowIndex === 0 ? 9.5 : 9, rowIndex === 0 ? "F2" : "F1", "0.07 0.11 0.16");
    });
  });

  const tableX = 42;
  let tableY = 448;
  rect(tableX, tableY, 511, 32, "0 0.21 0.2");
  text("Libelle", tableX + 16, tableY + 12, 11, "F2", "1 1 1");
  text("Montant", tableX + 390, tableY + 12, 11, "F2", "1 1 1");
  tableY -= 34;
  const lines = [
    ["Sous-total logement", fcfaText(booking.payment.base)],
    ["Frais de service", fcfaText(booking.payment.serviceFee)],
    ["Caution / garantie", fcfaText(booking.payment.securityDeposit)]
  ];
  lines.forEach(([label, amount]) => {
    rect(tableX, tableY, 511, 31, "1 1 1");
    strokeRect(tableX, tableY, 511, 31);
    text(label, tableX + 16, tableY + 11, 10, "F1", "0.07 0.11 0.16");
    text(amount, tableX + 390, tableY + 11, 10, "F2", "0.07 0.11 0.16");
    tableY -= 31;
  });
  rect(tableX, tableY - 4, 511, 40, "1 0.86 0.82");
  strokeRect(tableX, tableY - 4, 511, 40, "0.67 0.2 0");
  text("TOTAL A TRACER", tableX + 16, tableY + 10, 13, "F2", "0.36 0.1 0");
  text(fcfaText(booking.payment.total), tableX + 358, tableY + 10, 14, "F2", "0.36 0.1 0");

  let noteY = 260;
  text("Note de tracabilite", 42, noteY, 12, "F2", "0 0.21 0.2");
  noteY -= 20;
  wrapPdfText("Ce recu confirme l'enregistrement de la demande. La confirmation finale depend de la disponibilite du bien et de la verification du paiement par l'equipe hebergementciv.", 92).forEach((row) => {
    text(row, 42, noteY, 9.5, "F1", "0.25 0.28 0.28");
    noteY -= 14;
  });
  text(`Reference unique: ${booking.id}`, 42, 86, 8.5, "F1", "0.33 0.38 0.37");
  text("hebergementciv - recu genere automatiquement", 42, 66, 8.5, "F1", "0.33 0.38 0.37");
  text("Contact: Abidjan, Cote d'Ivoire", 372, 66, 8.5, "F1", "0.33 0.38 0.37");

  const content = commands.join("\n");
  const objects = [
    makePdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    makePdfObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    makePdfObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`),
    makePdfObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    makePdfObject(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    makePdfObject(6, `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`)
  ];
  return buildPdf(objects);
}

function serveStatic(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split("?")[0]);
  let requestPath = cleanUrl === "/" ? "/index.html" : cleanUrl;
  if (requestPath.endsWith("/app.js")) requestPath = "/app.js";
  if (requestPath.endsWith("/styles.css")) requestPath = "/styles.css";
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
        res.end(fallbackContent);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    const db = await loadDb();

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      sendJson(res, 200, publicSnapshot(db));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/notifications") {
      sendJson(res, 200, notificationSnapshot(db));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/properties") {
      const category = normalizeText(url.searchParams.get("category"));
      const location = normalizeText(url.searchParams.get("location"));
      const intent = normalizeText(url.searchParams.get("intent"));
      const maxPrice = Number(url.searchParams.get("maxPrice") || 0);
      const properties = db.properties.filter(property => {
        const matchesCategory = !category || normalizeText(property.category) === category;
        const matchesLocation = !location || normalizeText(`${property.district} ${property.city}`).includes(location);
        const matchesIntent = !intent || normalizeText(property.intent) === intent || (intent === "mixte" && property.salePrice);
        const matchesPrice = !maxPrice || property.price <= maxPrice || (property.salePrice && property.salePrice <= maxPrice);
        return matchesCategory && matchesLocation && matchesIntent && matchesPrice;
      });
      sendJson(res, 200, { properties });
      return;
    }

    if (req.method === "GET" && url.pathname.match(/^\/api\/bookings\/[^/]+\/receipt\.pdf$/)) {
      const id = url.pathname.split("/")[3];
      const booking = db.bookings.find(item => item.id === id);
      if (!booking) {
        sendJson(res, 404, { error: "Reservation introuvable" });
        return;
      }
      const property = db.properties.find(item => item.id === booking.propertyId);
      const pdf = generateReceiptPdf(booking, property);
      const filename = `${asciiText(booking.orderNumber || "recu-hebergementciv")}.pdf`;
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdf.length,
        "Cache-Control": "no-store"
      });
      res.end(pdf);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bookings") {
      const payload = await parseBody(req);
      const property = db.properties.find(item => item.id === payload.propertyId);
      if (!property) {
        sendJson(res, 404, { error: "Bien introuvable" });
        return;
      }
      if (!payload.name || !payload.phone || !payload.checkIn) {
        sendJson(res, 400, { error: "Nom, telephone et date d'arrivee sont requis" });
        return;
      }
      if (!isValidPersonName(payload.name)) {
        sendJson(res, 400, { error: "Nom complet invalide" });
        return;
      }
      if (!isValidPhone(payload.phone)) {
        sendJson(res, 400, { error: "Numero de telephone invalide" });
        return;
      }
      if (!isValidEmail(payload.email)) {
        sendJson(res, 400, { error: "Adresse email invalide" });
        return;
      }
      if (!isValidSimpleText(payload.nationality || "Cote d'Ivoire", 2, 60)) {
        sendJson(res, 400, { error: "Nationalite invalide" });
        return;
      }
      if (!isValidSimpleText(payload.message || "", 0, 800, true)) {
        sendJson(res, 400, { error: "La requete est trop longue" });
        return;
      }

      let stay;
      let paymentMethod;
      try {
        stay = deriveStay(payload, property);
        paymentMethod = validatePaymentMethod(payload.paymentMethod);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      const totals = calculateTotal(property, stay);
      const booking = {
        id: crypto.randomUUID(),
        orderNumber: createOrderNumber(),
        invoiceNumber: createInvoiceNumber(),
        createdAt: new Date().toISOString(),
        status: "Nouvelle demande",
        paymentStatus: payload.paymentMethod === "Paiement a l'agence" ? "A regler" : "Paiement initie",
        propertyId: property.id,
        propertyTitle: property.title,
        propertyCategory: property.category,
        intent: stay.intent,
        client: {
          name: cleanText(payload.name, 80),
          phone: cleanText(payload.phone, 24),
          email: cleanText(payload.email, 120),
          nationality: cleanText(payload.nationality || "Cote d'Ivoire", 60)
        },
        stay: {
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          nights: stay.nights,
          guests: stay.guests
        },
        payment: {
          method: paymentMethod,
          reference: cleanText(payload.paymentReference, 80),
          base: totals.base,
          serviceFee: totals.serviceFee,
          securityDeposit: totals.securityDeposit,
          total: totals.total,
          currency: "FCFA"
        },
        request: cleanText(payload.message, 800),
        adminNotes: []
      };
      db.bookings.unshift(booking);
      db.payments.unshift({
        id: crypto.randomUUID(),
        bookingId: booking.id,
        orderNumber: booking.orderNumber,
        amount: totals.total,
        method: booking.payment.method,
        status: booking.paymentStatus,
        createdAt: booking.createdAt
      });
      await saveDb(db);
      sendJson(res, 201, { booking });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/messages") {
      const payload = await parseBody(req);
      if (!payload.name || !payload.phone || !payload.message) {
        sendJson(res, 400, { error: "Nom, telephone et message sont requis" });
        return;
      }
      if (!isValidPersonName(payload.name)) {
        sendJson(res, 400, { error: "Nom invalide" });
        return;
      }
      if (!isValidPhone(payload.phone)) {
        sendJson(res, 400, { error: "Numero de telephone invalide" });
        return;
      }
      if (!isValidEmail(payload.email)) {
        sendJson(res, 400, { error: "Adresse email invalide" });
        return;
      }
      if (!isValidSimpleText(payload.message, 5, 1000)) {
        sendJson(res, 400, { error: "Message invalide" });
        return;
      }
      const message = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        name: cleanText(payload.name, 80),
        phone: cleanText(payload.phone, 24),
        email: cleanText(payload.email, 120),
        subject: cleanText(payload.subject || "Demande client", 120),
        message: cleanText(payload.message, 1000),
        status: "Nouveau",
        priority: payload.priority || "Normale"
      };
      db.messages.unshift(message);
      await saveDb(db);
      sendJson(res, 201, { message });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/owner/properties") {
      const payload = await prepareOwnerSubmissionPayload(await parseBody(req));
      let submission;
      try {
        submission = normalizeOwnerSubmissionPayload(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      db.ownerSubmissions = db.ownerSubmissions || [];
      db.ownerSubmissions.unshift(submission);
      await saveDb(db);
      sendJson(res, 201, {
        submission: {
          id: submission.id,
          status: submission.status,
          propertyTitle: submission.property.title,
          createdAt: submission.createdAt
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/dashboard") {
      if (!requireAdmin(req, res)) return;
      const revenue = db.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      sendJson(res, 200, {
        bookings: db.bookings,
        messages: db.messages,
        payments: db.payments,
        properties: db.properties,
        ownerSubmissions: db.ownerSubmissions || [],
        cityTiles: db.cityTiles || [],
        siteSettings: db.siteSettings || seedSiteSettings,
        metrics: {
          revenue,
          pendingBookings: db.bookings.filter(item => item.status !== "Confirmee").length,
          openMessages: db.messages.filter(item => !["Traite", "Archive"].includes(item.status)).length,
          pendingOwnerSubmissions: (db.ownerSubmissions || []).filter(item => !["Publie", "Refuse"].includes(item.status)).length,
          availableListings: db.properties.length
        }
      });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/admin/settings") {
      if (!requireAdmin(req, res)) return;
      const payload = await prepareSiteSettingsMediaPayload(await parseBody(req));
      let siteSettings;
      try {
        siteSettings = normalizeSiteSettingsPayload(payload, db.siteSettings || seedSiteSettings);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      db.siteSettings = siteSettings;
      await saveDb(db);
      sendJson(res, 200, { siteSettings });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/city-tiles") {
      if (!requireAdmin(req, res)) return;
      const payload = await prepareCityTileMediaPayload(await parseBody(req));
      let cityTile;
      try {
        cityTile = normalizeCityTilePayload(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      db.cityTiles = db.cityTiles || [];
      if (db.cityTiles.some(item => item.id === cityTile.id)) {
        cityTile.id = `${cityTile.id}-${crypto.randomBytes(2).toString("hex")}`;
      }
      db.cityTiles.unshift(cityTile);
      await saveDb(db);
      sendJson(res, 201, { cityTile });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/city-tiles/")) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(url.pathname.split("/").pop());
      db.cityTiles = db.cityTiles || [];
      const index = db.cityTiles.findIndex(item => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Vignette ville introuvable" });
        return;
      }
      const payload = await prepareCityTileMediaPayload(await parseBody(req));
      let cityTile;
      try {
        cityTile = normalizeCityTilePayload({ ...db.cityTiles[index], ...payload }, db.cityTiles[index]);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      db.cityTiles[index] = cityTile;
      await saveDb(db);
      sendJson(res, 200, { cityTile });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/properties") {
      if (!requireAdmin(req, res)) return;
      const payload = await preparePropertyMediaPayload(await parseBody(req));
      let property;
      try {
        property = normalizePropertyPayload(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      if (db.properties.some(item => item.id === property.id)) {
        property.id = `${property.id}-${crypto.randomBytes(2).toString("hex")}`;
      }
      db.properties.unshift(property);
      await saveDb(db);
      sendJson(res, 201, { property });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/properties/")) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const index = db.properties.findIndex(item => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Logement introuvable" });
        return;
      }
      const payload = await preparePropertyMediaPayload(await parseBody(req));
      let property;
      try {
        property = normalizePropertyPayload({ ...db.properties[index], ...payload }, db.properties[index]);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      db.properties[index] = property;
      db.bookings.forEach(booking => {
        if (booking.propertyId === property.id) {
          booking.propertyTitle = property.title;
          booking.propertyCategory = property.category;
          booking.intent = property.intent;
        }
      });
      await saveDb(db);
      sendJson(res, 200, { property });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/owner-submissions/")) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(url.pathname.split("/").pop());
      db.ownerSubmissions = db.ownerSubmissions || [];
      const submission = db.ownerSubmissions.find(item => item.id === id);
      if (!submission) {
        sendJson(res, 404, { error: "Proposition proprietaire introuvable" });
        return;
      }
      const payload = await parseBody(req);
      const status = cleanText(payload.status, 40);
      if (!["En attente", "En verification", "Publie", "Refuse"].includes(status)) {
        sendJson(res, 400, { error: "Statut de proposition invalide" });
        return;
      }
      submission.status = status;
      submission.reviewedAt = new Date().toISOString();
      if (payload.note) {
        submission.reviewNote = cleanText(payload.note, 800);
      }
      if (status === "Publie" && !submission.propertyId) {
        const property = normalizePropertyPayload({
          ...submission.property,
          status: payload.catalogStatus || "Disponible"
        });
        if (db.properties.some(item => item.id === property.id)) {
          property.id = `${property.id}-${crypto.randomBytes(2).toString("hex")}`;
        }
        db.properties.unshift(property);
        submission.propertyId = property.id;
      }
      await saveDb(db);
      sendJson(res, 200, { submission });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/owner-submissions/")) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(url.pathname.split("/").pop());
      db.ownerSubmissions = db.ownerSubmissions || [];
      const index = db.ownerSubmissions.findIndex(item => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Proposition proprietaire introuvable" });
        return;
      }
      const [submission] = db.ownerSubmissions.splice(index, 1);
      await saveDb(db);
      sendJson(res, 200, { submission, deleted: true });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/bookings/")) {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const payload = await parseBody(req);
      const booking = db.bookings.find(item => item.id === id);
      if (!booking) {
        sendJson(res, 404, { error: "Reservation introuvable" });
        return;
      }
      if (payload.status) booking.status = payload.status;
      if (payload.paymentStatus) booking.paymentStatus = payload.paymentStatus;
      if (payload.note) {
        booking.adminNotes.unshift({
          note: String(payload.note).trim(),
          createdAt: new Date().toISOString()
        });
      }
      const payment = db.payments.find(item => item.bookingId === booking.id);
      if (payment && payload.paymentStatus) payment.status = payload.paymentStatus;
      await saveDb(db);
      sendJson(res, 200, { booking });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/messages/")) {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const payload = await parseBody(req);
      const message = db.messages.find(item => item.id === id);
      if (!message) {
        sendJson(res, 404, { error: "Message introuvable" });
        return;
      }
      if (payload.status) message.status = payload.status;
      if (payload.priority) message.priority = payload.priority;
      await saveDb(db);
      sendJson(res, 200, { message });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/messages/")) {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const index = db.messages.findIndex(item => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Message introuvable" });
        return;
      }
      const [message] = db.messages.splice(index, 1);
      await saveDb(db);
      sendJson(res, 200, { message, deleted: true });
      return;
    }

    sendJson(res, 404, { error: "Route API introuvable" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur" });
  }
}

ensureDb();

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`hebergementciv running on http://localhost:${PORT}`);
});
