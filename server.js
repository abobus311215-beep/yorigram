const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret-before-deploying";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_PATH = path.join(DATA_DIR, "db.json");

const ADMIN_USERNAMES = ["yori"];
const NFT_USERNAME_PRICE = 500;
const BLOCKED_PREFIXES = ["+888", "+777", "+666"];
const DROP_SIZE = 5;
const DROP_INTERVAL_MS = 20 * 60 * 1000;
const SYSTEM_BOT_USERNAME = "yoriplayrobot";
const SYSTEM_BOT_NAME = "YoriPlay Robot";
const MINES_TOTAL = 25;
const MINES_HOUSE_EDGE = 0.03;

const GIFT_TYPES = [
  "cyber_dog", "neon_heart", "neon_cat", "crystal_fox"
];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const UPGRADE_MODELS = {
  cyber_dog: [
    { name: "Cyber Dog", image: "/images/models/model1.png", rarity: "3%" },
    { name: "Pickme Dog", image: "/images/models/model2.png", rarity: "5%" }
  ],
  neon_heart: [
    { name: "Neon Heart", image: "/images/models/m1.png", rarity: "5%" },
    { name: "Meow Heart", image: "/images/models/m2.png", rarity: "6%" }
  ],
  galaxy_ufo: [{ name: "Galaxy UFO", image: "/images/models/m1.png", rarity: "4%" }],
  neon_cat: [
    { name: "Cat B.", image: "/images/models/mdai1.png", rarity: "4%" },
    { name: "Cat B.", image: "/images/models/mdai2.png", rarity: "6%" }
  ],
  crystal_fox: [
    { name: "Rich Frog", image: "/images/models/md1.png", rarity: "3%" },
    { name: "Rich Frog", image: "/images/models/mda1.png", rarity: "5%" }
  ],
  
};

const BG_POOL = [
  { name: "Sunset", color: "#ff7e5f", rarity: "15%" },
  { name: "Matrix", color: "#0f9b0f", rarity: "10%" },
  { name: "Midnight", color: "#374a5c", rarity: "25%" },
  { name: "Neon", color: "#8e2de2", rarity: "5%" }
  { name: "Sweat", color: "#54632b", rarity: "8%" }
];
const PATTERN_POOL = [{ name: "Dog Silhouette", url: "/images/patterns/dog_silhouette.png", rarity: "5%" }];

const PLINKO_TABLES = {
  low:    [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  high:   [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
};
const UPGRADER_TARGETS = [
  { giftType: "neon_heart", chance: 0.50 },
  { giftType: "cyber_dog", chance: 0.33 },
  { giftType: "neon_cat", chance: 0.20 },
  { giftType: "crystal_fox", chance: 0.15 }
];

const GIFT_ICONS = {
  heart: "💖", bear: "🧸", gift: "🎁", rose: "🌹", cake: "🎂", bouquet: "💐",
  rocket: "🚀", trophy: "🏆", ring: "💍",
  neon_heart: "💖", cyber_dog: "🐶",
  neon_cat: "🐱", crystal_fox: "🐸"
};
function getGiftIcon(type) { return GIFT_ICONS[type] || "🎁"; }

function generateCatAddress() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = 'EQ';
  const bytes = crypto.randomBytes(46);
  for (let i = 0; i < 46; i++) result += chars[bytes[i] % chars.length];
  return result;
}

function calculateCustomNumberPrice(number) {
  const digits = number.replace(/[^\d]/g, '');
  if (digits.length < 7) return null;
  let price = 10;
  if (digits.length <= 8) price += 50;
  else if (digits.length <= 9) price += 30;
  else if (digits.length <= 10) price += 15;
  const uniqueDigits = new Set(digits.split('')).size;
  if (uniqueDigits === 1) price += 200;
  else if (uniqueDigits === 2) price += 80;
  else if (uniqueDigits === 3) price += 30;
  if (/0123456|1234567|2345678|3456789|9876543|8765432|7654321/.test(digits)) price += 80;
  if (/(\d)\1{4,}/.test(digits)) price += 40;
  if (/(\d{2})\1{2,}/.test(digits)) price += 25;
  return Math.max(10, Math.floor(price));
}

function initSystemNumbers() {
  const now = Date.now();
  let counter = 0;
  const arr = [];
  BLOCKED_PREFIXES.forEach(prefix => {
    for (let i = 1; i <= 10; i++) {
      const suffix = String(i).padStart(7, '0');
      let dropAt = null;
      if (counter >= DROP_SIZE) dropAt = now + Math.floor(counter / DROP_SIZE) * DROP_INTERVAL_MS;
      arr.push({
        id: crypto.randomUUID(), number: prefix + suffix, prefix,
        ownerId: null, purchasedAt: null, purchasePriceCAT: null,
        forSale: true, salePriceCAT: 5 + i, soldBySystem: true, dropAt, custom: false
      });
      counter++;
    }
  });
  return arr;
}

function processBotReply(bot, text) {
  if (!Array.isArray(bot.rules) || !bot.rules.length) return null;
  const tl = String(text || "").toLowerCase().trim();
  for (const rule of bot.rules) {
    const trig = String(rule.trigger || "").trim();
    if (!trig) continue;
    const resp = String(rule.response || "");
    if (trig.startsWith("/")) { if (tl === trig.toLowerCase()) return resp; }
    else if (trig.startsWith("=")) { if (tl === trig.slice(1).toLowerCase()) return resp; }
    else if (trig.startsWith("contains:")) { if (tl.includes(trig.slice(9).toLowerCase())) return resp; }
    else if (trig.startsWith("startswith:")) { if (tl.startsWith(trig.slice(11).toLowerCase())) return resp; }
  }
  const def = bot.rules.find(r => String(r.trigger || "").toLowerCase() === "default");
  return def ? def.response : null;
}

function isSystemBot(username) {
  return String(username || "").toLowerCase().replace(/^@/, "") === SYSTEM_BOT_USERNAME;
}

function estimateAssetValue(type, asset) {
  if (type === "nft_username") return 500;
  if (type === "nft_number") {
    const digits = String(asset.number || "").replace(/\D/g, '');
    if (digits.length <= 7) return 12000;
    if (digits.length <= 8) return 8000;
    if (digits.length <= 9) return 6000;
    if (digits.length <= 10) return 5000;
    return 4000;
  }
  if (type === "gift") {
    if (asset.level === 2) return 300;
    return Math.floor((asset.price || 15) * 0.5);
  }
  return 0;
}

function minesMultiplier(mines, revealed) {
  if (revealed === 0) return 1;
  let prob = 1;
  for (let i = 0; i < revealed; i++) prob *= (MINES_TOTAL - mines - i) / (MINES_TOTAL - i);
  if (prob <= 0) return 0;
  return (1 - MINES_HOUSE_EDGE) / prob;
}

function loadDb() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.messages)) data.messages = [];
    if (!Array.isArray(data.gifts)) data.gifts = [];
    if (!Array.isArray(data.channels)) data.channels = [];
    if (!Array.isArray(data.nftUsernames)) data.nftUsernames = [];
    if (!Array.isArray(data.nftNumbers)) data.nftNumbers = [];
    if (!Array.isArray(data.usedPhones)) data.usedPhones = [];
    if (!Array.isArray(data.bots)) data.bots = [];
    if (!Array.isArray(data.botInventory)) data.botInventory = [];
    if (!Array.isArray(data.activeGames)) data.activeGames = [];
    data.users.forEach(u => {
      if (typeof u.nftUsername === "string" && u.nftUsername) u.nftUsernames = [u.nftUsername];
      else if (!Array.isArray(u.nftUsernames)) u.nftUsernames = [];
      delete u.nftUsername;
      if (!Array.isArray(u.subscribedChannels)) u.subscribedChannels = [];
      if (typeof u.catBalance !== "number") u.catBalance = 0;
      if (typeof u.casinoBalance !== "number") u.casinoBalance = 0;
      if (!u.catAddress) u.catAddress = generateCatAddress();
      if (!u.nftPhone) u.nftPhone = null;
      if (typeof u.phoneLockedToNft !== "boolean") u.phoneLockedToNft = false;
    });
    if (!data.giftCounters) data.giftCounters = {};
    GIFT_TYPES.forEach(t => { if (typeof data.giftCounters[t] !== "number") data.giftCounters[t] = 0; });
    if (data.nftNumbers.length === 0) data.nftNumbers = initSystemNumbers();
    return data;
  } catch {
    const gc = {};
    GIFT_TYPES.forEach(t => gc[t] = 0);
    return {
      users: [], messages: [], gifts: [], channels: [], nftUsernames: [],
      nftNumbers: initSystemNumbers(), usedPhones: [],
      giftCounters: gc, bots: [], botInventory: [], activeGames: []
    };
  }
}

let db = loadDb();
const saveDb = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

const publicUser = (user) => ({
  id: user.id, username: user.username, phone: user.phone, wallet: user.wallet || 0,
  bio: user.bio || "", avatarColor: user.avatarColor || "", isPremium: user.isPremium || false,
  displayName: user.displayName || user.username, channel: user.channel || "", birthday: user.birthday || "",
  profileBgGiftId: user.profileBgGiftId || null, isAdmin: Boolean(user.isAdmin),
  nftUsernames: user.nftUsernames || [], subscribedChannels: user.subscribedChannels || [],
  catBalance: user.catBalance || 0, casinoBalance: user.casinoBalance || 0,
  catAddress: user.catAddress || null, nftPhone: user.nftPhone || null,
  phoneLockedToNft: Boolean(user.phoneLockedToNft)
});

const normalizePhone = (v) => String(v || "").replace(/[^\d+]/g, "");
const signToken = (user) => jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find((u) => u.id === payload.id);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    req.user = user; next();
  } catch { res.status(401).json({ error: "Войдите в аккаунт" }); }
}
function adminMiddleware(req, res, next) {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Нет прав администратора" });
  next();
}

app.use(express.json({ limit: "1mb" }));
app.use("/css", express.static(path.join(PUBLIC_DIR, "css")));
app.use("/js", express.static(path.join(PUBLIC_DIR, "js")));
app.use("/images", express.static(path.join(PUBLIC_DIR, "images")));
app.use("/uploads", express.static(UPLOAD_DIR));

const page = (file) => (_req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
app.get("/", page("index.html"));
app.get("/login", page("login.html"));
app.get("/register", page("register.html"));
app.get("/app", page("app.html"));

// ═══════════════ UPLOAD ═══════════════
app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Нет файла" });
  const kind = req.file.mimetype.startsWith("audio") ? "audio" :
               req.file.mimetype.startsWith("image") ? "photo" : "file";
  res.json({ ok: true, url: "/uploads/" + req.file.filename, kind });
});

// ═══════════════ РЕГИСТРАЦИЯ ═══════════════
app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Юзернейм: 3–24 символа" });
    if (!/^\+?\d{7,15}$/.test(phone)) return res.status(400).json({ error: "Проверьте номер" });
    if (password.length < 6) return res.status(400).json({ error: "Пароль — минимум 6 символов" });
    if (BLOCKED_PREFIXES.some(p => phone.startsWith(p))) return res.status(400).json({ error: "Номера +888/+777/+666 доступны только как NFT" });
    if (db.usedPhones.includes(phone)) return res.status(409).json({ error: "Этот номер был заменён на NFT и заблокирован" });
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase() || u.phone === phone)) return res.status(409).json({ error: "Занято" });
    if (db.nftNumbers.some(n => n.number === phone)) return res.status(409).json({ error: "Этот номер уже NFT" });

    const user = {
      id: crypto.randomUUID(), username, phone, passwordHash: await bcrypt.hash(password, 10),
      wallet: 0, bio: "Привет!", avatarColor: "", isPremium: false,
      displayName: username, channel: "", birthday: "", profileBgGiftId: null,
      isAdmin: ADMIN_USERNAMES.map(u => u.toLowerCase()).includes(username.toLowerCase()),
      nftUsernames: [], subscribedChannels: [],
      catBalance: 0, casinoBalance: 0, catAddress: generateCatAddress(), nftPhone: null,
      phoneLockedToNft: false, createdAt: Date.now()
    };
    db.users.push(user); saveDb();
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch { res.status(500).json({ error: "Ошибка" }); }
});

app.post("/api/login", async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");
  const user = db.users.find((u) => u.username.toLowerCase() === identifier.toLowerCase() || u.phone === normalizePhone(identifier));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Неверный логин или пароль" });
  if (ADMIN_USERNAMES.map(u => u.toLowerCase()).includes(user.username.toLowerCase()) && !user.isAdmin) { user.isAdmin = true; saveDb(); }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/me", authMiddleware, (req, res) => {
  if (ADMIN_USERNAMES.map(u => u.toLowerCase()).includes(req.user.username.toLowerCase()) && !req.user.isAdmin) { req.user.isAdmin = true; saveDb(); }
  res.json({ user: publicUser(req.user) });
});

app.post("/api/profile", authMiddleware, (req, res) => {
  const { username, displayName, bio, avatarColor, birthday } = req.body;
  if (username && username !== req.user.username) {
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Некорректный юзернейм" });
    if (db.users.some(u => u.id !== req.user.id && u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Занято" });
    if (db.nftUsernames.some(n => n.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Ник занят NFT" });
    req.user.username = username;
  }
  if (displayName !== undefined) req.user.displayName = String(displayName).slice(0, 64);
  if (bio !== undefined) req.user.bio = String(bio).slice(0, 120);
  if (avatarColor !== undefined) req.user.avatarColor = String(avatarColor);
  if (birthday !== undefined) req.user.birthday = String(birthday).slice(0, 32);
  saveDb();
  io.emit("user:updated", publicUser(req.user));
  res.json({ ok: true, user: publicUser(req.user) });
});

app.post("/api/profile/toggle-nft", authMiddleware, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Не указан" });
  const nft = db.nftUsernames.find(n => n.username.toLowerCase() === username.toLowerCase() && n.ownerId === req.user.id);
  if (!nft) return res.status(404).json({ error: "У вас нет этого NFT" });
  req.user.nftUsernames = req.user.nftUsernames || [];
  const idx = req.user.nftUsernames.findIndex(u => u.toLowerCase() === username.toLowerCase());
  if (idx === -1) req.user.nftUsernames.push(nft.username);
  else req.user.nftUsernames.splice(idx, 1);
  saveDb();
  io.emit("user:updated", publicUser(req.user));
  res.json({ ok: true, user: publicUser(req.user) });
});

app.post("/api/profile/clear-nft", authMiddleware, (req, res) => {
  req.user.nftUsernames = [];
  saveDb();
  io.emit("user:updated", publicUser(req.user));
  res.json({ ok: true, user: publicUser(req.user) });
});

app.get("/api/my-nfts", authMiddleware, (req, res) => {
  const myNfts = db.nftUsernames.filter(n => n.ownerId === req.user.id);
  res.json({ nfts: myNfts, equipped: req.user.nftUsernames || [] });
});

app.get("/api/nft/:username", authMiddleware, (req, res) => {
  const nft = db.nftUsernames.find(n => n.username.toLowerCase() === req.params.username.toLowerCase());
  if (!nft) return res.status(404).json({ error: "NFT не найден" });
  const owner = db.users.find(u => u.id === nft.ownerId);
  res.json({ nft: { ...nft, ownerUsername: owner ? owner.username : "Unknown" }, isMine: nft.ownerId === req.user.id });
});

app.post("/api/nft/:username/list", authMiddleware, (req, res) => {
  const { price } = req.body;
  const nft = db.nftUsernames.find(n => n.username.toLowerCase() === req.params.username.toLowerCase() && n.ownerId === req.user.id);
  if (!nft) return res.status(404).json({ error: "Не найден" });
  if (price < 1) return res.status(400).json({ error: "Цена > 0" });
  nft.forSale = true; nft.salePrice = price;
  saveDb(); io.emit("market:update"); res.json({ ok: true, nft });
});

app.post("/api/nft/:username/unlist", authMiddleware, (req, res) => {
  const nft = db.nftUsernames.find(n => n.username.toLowerCase() === req.params.username.toLowerCase() && n.ownerId === req.user.id);
  if (!nft) return res.status(404).json({ error: "Не найден" });
  nft.forSale = false; nft.salePrice = null;
  saveDb(); io.emit("market:update"); res.json({ ok: true, nft });
});

app.post("/api/nft/:username/transfer", authMiddleware, (req, res) => {
  const { toUsername } = req.body;
  if (!toUsername) return res.status(400).json({ error: "Укажите @username" });
  const nft = db.nftUsernames.find(n => n.username.toLowerCase() === req.params.username.toLowerCase() && n.ownerId === req.user.id);
  if (!nft) return res.status(404).json({ error: "NFT не найден" });
  if (isSystemBot(toUsername)) {
    if (nft.forSale) { nft.forSale = false; nft.salePrice = null; }
    if (req.user.nftUsernames && req.user.nftUsernames.includes(nft.username)) {
      req.user.nftUsernames = req.user.nftUsernames.filter(u => u !== nft.username);
    }
    const inv = { id: crypto.randomUUID(), userId: req.user.id, type: "nft_username", assetId: nft.id, assetSnapshot: { ...nft, ownerId: null }, depositedAt: Date.now(), status: "inventory" };
    db.botInventory.push(inv);
    nft.ownerId = "SYSTEM"; nft.isInBot = true;
    saveDb();
    io.emit("user:updated", publicUser(req.user)); io.emit("market:update");
    return res.json({ ok: true, sentToBot: true, inventory: inv });
  }
  const recipient = db.users.find(u => u.username.toLowerCase() === toUsername.toLowerCase().replace(/^@/, ""));
  if (!recipient) return res.status(404).json({ error: "Получатель не найден" });
  if (recipient.id === req.user.id) return res.status(400).json({ error: "Нельзя себе" });
  if (recipient.nftUsernames && recipient.nftUsernames.includes(nft.username)) return res.status(409).json({ error: "У получателя уже есть" });
  nft.ownerId = recipient.id; nft.forSale = false; nft.salePrice = null;
  if (req.user.nftUsernames && req.user.nftUsernames.includes(nft.username)) {
    req.user.nftUsernames = req.user.nftUsernames.filter(u => u !== nft.username);
  }
  saveDb();
  io.emit("user:updated", publicUser(req.user)); io.emit("user:updated", publicUser(recipient)); io.emit("market:update");
  res.json({ ok: true, nft, recipient: publicUser(recipient) });
});

app.post("/api/profile/wear-nft-number", authMiddleware, (req, res) => {
  const { numberId } = req.body;
  if (req.user.phoneLockedToNft) return res.status(400).json({ error: "Уже заменён" });
  if (!numberId) return res.status(400).json({ error: "Нельзя вернуть номер" });
  const nftNum = db.nftNumbers.find(n => n.id === numberId && n.ownerId === req.user.id);
  if (!nftNum) return res.status(404).json({ error: "Нет номера" });
  if (req.user.phone && !db.usedPhones.includes(req.user.phone)) db.usedPhones.push(req.user.phone);
  req.user.phone = nftNum.number; req.user.nftPhone = nftNum.number; req.user.phoneLockedToNft = true;
  saveDb();
  io.emit("user:updated", publicUser(req.user));
  res.json({ ok: true, user: publicUser(req.user) });
});

app.get("/api/nft-number/:id", authMiddleware, (req, res) => {
  const nftNum = db.nftNumbers.find(n => n.id === req.params.id || n.number === req.params.id);
  if (!nftNum) return res.status(404).json({ error: "Не найден" });
  const owner = nftNum.ownerId ? db.users.find(u => u.id === nftNum.ownerId) : null;
  res.json({ nftNum: { ...nftNum, ownerUsername: owner ? owner.username : "YoriGram" }, isMine: nftNum.ownerId === req.user.id });
});

app.get("/api/cat/info", authMiddleware, (req, res) => {
  const ownedNumbers = db.nftNumbers.filter(n => n.ownerId === req.user.id);
  res.json({ balance: req.user.catBalance || 0, address: req.user.catAddress, ownedNumbers, nftPhone: req.user.nftPhone || null });
});

app.post("/api/cat/exchange", authMiddleware, (req, res) => {
  const amount = Number(req.body.stars);
  if (!Number.isInteger(amount) || amount < 10000) return res.status(400).json({ error: "Мин 10 000 ⭐" });
  if ((req.user.wallet || 0) < amount) return res.status(400).json({ error: "Мало" });
  const catAmount = Math.floor(amount / 10000);
  req.user.wallet -= catAmount * 10000;
  req.user.catBalance = (req.user.catBalance || 0) + catAmount;
  saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  io.to(req.user.id).emit("cat:update", { balance: req.user.catBalance });
  res.json({ ok: true, catBalance: req.user.catBalance, wallet: req.user.wallet });
});

app.post("/api/cat/transfer", authMiddleware, (req, res) => {
  const { toAddress, amount } = req.body;
  const num = Number(amount);
  if (!Number.isInteger(num) || num < 1) return res.status(400).json({ error: "Некорректная сумма" });
  if ((req.user.catBalance || 0) < num) return res.status(400).json({ error: "Мало" });
  const target = db.users.find(u => u.catAddress === toAddress);
  if (!target) return res.status(404).json({ error: "Адрес не найден" });
  if (target.id === req.user.id) return res.status(400).json({ error: "Себе нельзя" });
  req.user.catBalance -= num; target.catBalance = (target.catBalance || 0) + num;
  saveDb();
  io.to(req.user.id).emit("cat:update", { balance: req.user.catBalance });
  io.to(target.id).emit("cat:update", { balance: target.catBalance });
  res.json({ ok: true, catBalance: req.user.catBalance });
});

app.get("/api/market/nft-numbers", authMiddleware, (req, res) => {
  const now = Date.now();
  const availableSystem = db.nftNumbers.filter(n => n.forSale && n.soldBySystem && (n.dropAt === null || n.dropAt <= now));
  const userListings = db.nftNumbers.filter(n => n.forSale && !n.soldBySystem && n.ownerId).map(n => {
    const owner = db.users.find(u => u.id === n.ownerId);
    return { ...n, ownerUsername: owner ? owner.username : "Unknown" };
  });
  const nextDrop = db.nftNumbers.filter(n => n.forSale && n.soldBySystem && n.dropAt && n.dropAt > now).sort((a, b) => a.dropAt - b.dropAt)[0];
  res.json({ systemListings: availableSystem, userListings, nextDropAt: nextDrop ? nextDrop.dropAt : null });
});

app.post("/api/market/nft-number/register-custom", authMiddleware, (req, res) => {
  const raw = String(req.body.number || "").trim();
  const formatted = raw.startsWith('+') ? raw : '+' + raw;
  if (!/^\+(888|777|666)\d{5,11}$/.test(formatted)) return res.status(400).json({ error: "Начинается с +888/+777/+666" });
  if (db.nftNumbers.some(n => n.number === formatted)) return res.status(409).json({ error: "Уже есть" });
  if (db.users.some(u => u.phone === formatted)) return res.status(409).json({ error: "Уже занят" });
  const price = calculateCustomNumberPrice(formatted);
  if (!price) return res.status(400).json({ error: "Слишком короткий" });
  if ((req.user.catBalance || 0) < price) return res.status(400).json({ error: `Нужно ${price} $CAT` });
  req.user.catBalance -= price;
  const nftNum = { id: crypto.randomUUID(), number: formatted, prefix: formatted.slice(0, 4), ownerId: req.user.id, purchasedAt: Date.now(), purchasePriceCAT: price, forSale: false, salePriceCAT: null, soldBySystem: false, dropAt: null, custom: true };
  db.nftNumbers.push(nftNum);
  saveDb();
  io.to(req.user.id).emit("cat:update", { balance: req.user.catBalance }); io.emit("market:update");
  res.json({ ok: true, nftNum, catBalance: req.user.catBalance });
});

app.post("/api/market/nft-number/buy", authMiddleware, (req, res) => {
  const { numberId } = req.body;
  const nftNum = db.nftNumbers.find(n => n.id === numberId && n.forSale);
  if (!nftNum) return res.status(404).json({ error: "Не найден" });
  if (nftNum.dropAt && nftNum.dropAt > Date.now()) return res.status(400).json({ error: "Недоступен" });
  if (nftNum.ownerId === req.user.id) return res.status(400).json({ error: "Уже ваш" });
  if ((req.user.catBalance || 0) < nftNum.salePriceCAT) return res.status(400).json({ error: "Мало" });
  const price = nftNum.salePriceCAT;
  req.user.catBalance -= price;
  if (nftNum.ownerId) {
    const seller = db.users.find(u => u.id === nftNum.ownerId);
    if (seller) { seller.catBalance = (seller.catBalance || 0) + price; io.to(seller.id).emit("cat:update", { balance: seller.catBalance }); io.emit("user:updated", publicUser(seller)); }
  }
  nftNum.ownerId = req.user.id; nftNum.purchasedAt = Date.now(); nftNum.purchasePriceCAT = price;
  nftNum.forSale = false; nftNum.salePriceCAT = null; nftNum.soldBySystem = false;
  saveDb();
  io.to(req.user.id).emit("cat:update", { balance: req.user.catBalance }); io.emit("market:update");
  res.json({ ok: true, nftNum, catBalance: req.user.catBalance });
});

app.post("/api/market/nft-number/list", authMiddleware, (req, res) => {
  const { numberId, priceCAT } = req.body;
  const nftNum = db.nftNumbers.find(n => n.id === numberId && n.ownerId === req.user.id);
  if (!nftNum) return res.status(404).json({ error: "Не найден" });
  if (req.user.phoneLockedToNft && req.user.nftPhone === nftNum.number) return res.status(400).json({ error: "Активирован — нельзя продать" });
  if (priceCAT < 1) return res.status(400).json({ error: "> 0" });
  nftNum.forSale = true; nftNum.salePriceCAT = Number(priceCAT); nftNum.soldBySystem = false;
  saveDb(); io.emit("market:update"); res.json({ ok: true, nftNum });
});

app.post("/api/market/nft-number/unlist", authMiddleware, (req, res) => {
  const { numberId } = req.body;
  const nftNum = db.nftNumbers.find(n => n.id === numberId && n.ownerId === req.user.id);
  if (!nftNum) return res.status(404).json({ error: "Не найден" });
  nftNum.forSale = false; nftNum.salePriceCAT = null;
  saveDb(); io.emit("market:update"); res.json({ ok: true, nftNum });
});

app.post("/api/nft-number/:id/transfer", authMiddleware, (req, res) => {
  const { toUsername } = req.body;
  if (!toUsername) return res.status(400).json({ error: "Укажите @username" });
  const nftNum = db.nftNumbers.find(n => n.id === req.params.id && n.ownerId === req.user.id);
  if (!nftNum) return res.status(404).json({ error: "Не найден" });
  if (req.user.phoneLockedToNft && req.user.nftPhone === nftNum.number) return res.status(400).json({ error: "Активирован — нельзя" });
  if (isSystemBot(toUsername)) {
    if (nftNum.forSale) { nftNum.forSale = false; nftNum.salePriceCAT = null; }
    const inv = { id: crypto.randomUUID(), userId: req.user.id, type: "nft_number", assetId: nftNum.id, assetSnapshot: { ...nftNum, ownerId: null }, depositedAt: Date.now(), status: "inventory" };
    db.botInventory.push(inv);
    nftNum.ownerId = "SYSTEM"; nftNum.isInBot = true;
    saveDb();
    io.emit("user:updated", publicUser(req.user)); io.emit("market:update");
    return res.json({ ok: true, sentToBot: true, inventory: inv });
  }
  const recipient = db.users.find(u => u.username.toLowerCase() === toUsername.toLowerCase().replace(/^@/, ""));
  if (!recipient) return res.status(404).json({ error: "Не найден" });
  if (recipient.id === req.user.id) return res.status(400).json({ error: "Себе нельзя" });
  nftNum.ownerId = recipient.id; nftNum.forSale = false; nftNum.salePriceCAT = null;
  nftNum.purchasedAt = Date.now(); nftNum.purchasePriceCAT = 0;
  saveDb();
  io.emit("user:updated", publicUser(req.user)); io.emit("user:updated", publicUser(recipient)); io.emit("market:update");
  res.json({ ok: true, nftNum, recipient: publicUser(recipient) });
});

app.post("/api/bots/create", authMiddleware, (req, res) => {
  const { name, username, description, rules } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Введите имя" });
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(String(username || ""))) return res.status(400).json({ error: "Username: 3–24" });
  if (isSystemBot(username)) return res.status(409).json({ error: "Зарезервирован" });
  if (db.bots.some(b => b.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Занят" });
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Занят" });
  const bot = { id: crypto.randomUUID(), ownerId: req.user.id, name: String(name).slice(0, 64), username: String(username), description: String(description || "").slice(0, 256), avatarColor: "#7c4dff", rules: Array.isArray(rules) ? rules.slice(0, 100) : [], createdAt: Date.now() };
  db.bots.push(bot); saveDb();
  res.json({ ok: true, bot });
});

app.get("/api/bots", authMiddleware, (req, res) => {
  res.json({ bots: db.bots.filter(b => b.ownerId === req.user.id) });
});

app.post("/api/bots/:id/update", authMiddleware, (req, res) => {
  const bot = db.bots.find(b => b.id === req.params.id && b.ownerId === req.user.id);
  if (!bot) return res.status(404).json({ error: "Не найден" });
  const { name, description, rules } = req.body;
  if (name !== undefined && String(name).trim()) bot.name = String(name).slice(0, 64);
  if (description !== undefined) bot.description = String(description).slice(0, 256);
  if (Array.isArray(rules)) bot.rules = rules.slice(0, 100);
  saveDb();
  res.json({ ok: true, bot });
});

app.post("/api/bots/:id/delete", authMiddleware, (req, res) => {
  const idx = db.bots.findIndex(b => b.id === req.params.id && b.ownerId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Не найден" });
  db.bots.splice(idx, 1); saveDb();
  res.json({ ok: true });
});

app.post("/api/channels/create", authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Введите название" });
  if (!req.user.isPremium) {
    const existing = db.channels.find(c => c.ownerId === req.user.id);
    if (existing) return res.status(400).json({ error: "Уже есть канал. Premium для безлимита." });
  }
  const channel = { id: crypto.randomUUID(), ownerId: req.user.id, name: name.slice(0, 64), description: "", username: null, posts: [], avatarColor: req.user.avatarColor || "#3390ec", createdAt: Date.now() };
  db.channels.push(channel);
  if (!req.user.channel) req.user.channel = channel.name;
  req.user.subscribedChannels = req.user.subscribedChannels || [];
  if (!req.user.subscribedChannels.includes(channel.id)) req.user.subscribedChannels.push(channel.id);
  saveDb();
  io.emit("user:updated", publicUser(req.user));
  res.json({ ok: true, channel });
});

app.get("/api/channels/:id", authMiddleware, (req, res) => {
  const channel = db.channels.find(c => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: "Не найден" });
  const subscribersCount = db.users.filter(u => (u.subscribedChannels || []).includes(channel.id)).length;
  const isSubscribed = (req.user.subscribedChannels || []).includes(channel.id);
  const isOwner = channel.ownerId === req.user.id;
  res.json({ channel: { ...channel, subscribersCount, isSubscribed, isOwner } });
});

app.post("/api/channels/:id/subscribe", authMiddleware, (req, res) => {
  const channel = db.channels.find(c => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: "Не найден" });
  req.user.subscribedChannels = req.user.subscribedChannels || [];
  if (!req.user.subscribedChannels.includes(channel.id)) { req.user.subscribedChannels.push(channel.id); saveDb(); io.emit("user:updated", publicUser(req.user)); io.emit("channel:updated", channel); }
  res.json({ ok: true });
});

app.post("/api/channels/:id/unsubscribe", authMiddleware, (req, res) => {
  const channel = db.channels.find(c => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: "Не найден" });
  req.user.subscribedChannels = (req.user.subscribedChannels || []).filter(id => id !== channel.id);
  saveDb(); io.emit("user:updated", publicUser(req.user)); io.emit("channel:updated", channel);
  res.json({ ok: true });
});

app.post("/api/channels/:id/post", authMiddleware, (req, res) => {
  const channel = db.channels.find(c => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: "Не найден" });
  if (channel.ownerId !== req.user.id) return res.status(403).json({ error: "Нет прав" });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Пустой" });
  const post = { id: crypto.randomUUID(), text, createdAt: Date.now() };
  channel.posts.unshift(post); saveDb();
  io.emit("channel:post", { channelId: channel.id, post });
  res.json({ ok: true, channel });
});

app.post("/api/channels/:id/set-username", authMiddleware, (req, res) => {
  const { username } = req.body;
  const channel = db.channels.find(c => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: "Не найден" });
  if (channel.ownerId !== req.user.id) return res.status(403).json({ error: "Нет прав" });
  if (channel.username) return res.status(400).json({ error: "Уже есть" });
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Некорректный" });
  if (db.nftUsernames.some(n => n.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Занят" });
  if (db.users.some(n => n.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Занят" });
  if (req.user.wallet < NFT_USERNAME_PRICE) return res.status(400).json({ error: `Нужно ${NFT_USERNAME_PRICE} ⭐` });
  req.user.wallet -= NFT_USERNAME_PRICE;
  const nft = { id: crypto.randomUUID(), username, ownerId: req.user.id, forSale: false, salePrice: null, channelId: channel.id, createdAt: Date.now() };
  db.nftUsernames.push(nft); channel.username = username; saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  io.emit("channel:updated", channel);
  res.json({ ok: true, channel, nft, wallet: req.user.wallet });
});

app.get("/api/market", authMiddleware, (req, res) => {
  const listings = db.gifts.filter(g => g.forSale).map(g => {
    const owner = db.users.find(u => u.id === g.toId);
    return { ...g, ownerUsername: owner ? owner.username : "Unknown" };
  });
  const nftListings = db.nftUsernames.filter(n => n.forSale).map(n => {
    const owner = db.users.find(u => u.id === n.ownerId);
    return { ...n, ownerUsername: owner ? owner.username : "Unknown" };
  });
  res.json({ listings, nftListings });
});

app.post("/api/market/unlist-gift", authMiddleware, (req, res) => {
  const { giftId } = req.body;
  const gift = db.gifts.find(g => g.id === giftId && g.toId === req.user.id);
  if (!gift) return res.status(404).json({ error: "Не найден" });
  gift.forSale = false; gift.salePrice = null; saveDb(); res.json({ ok: true, gift });
});

app.post("/api/market/list", authMiddleware, (req, res) => {
  const { giftId, price } = req.body;
  const gift = db.gifts.find(g => g.id === giftId && g.toId === req.user.id);
  if (!gift) return res.status(404).json({ error: "Не найден" });
  if (gift.level !== 2) return res.status(400).json({ error: "Только уникальные" });
  if (price < 1) return res.status(400).json({ error: "> 0" });
  gift.forSale = true; gift.salePrice = price; saveDb(); res.json({ ok: true, gift });
});

app.post("/api/market/buy", authMiddleware, (req, res) => {
  const { giftId } = req.body;
  const gift = db.gifts.find(g => g.id === giftId && g.forSale);
  if (!gift) return res.status(404).json({ error: "Не найден" });
  if (gift.toId === req.user.id) return res.status(400).json({ error: "Свой" });
  if (req.user.wallet < gift.salePrice) return res.status(400).json({ error: "Мало" });
  const seller = db.users.find(u => u.id === gift.toId);
  if (!seller) return res.status(404).json({ error: "?" });
  req.user.wallet -= gift.salePrice; seller.wallet += gift.salePrice;
  gift.toId = req.user.id; gift.fromId = req.user.id; gift.forSale = false; gift.salePrice = null;
  saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  io.to(seller.id).emit("wallet:update", { wallet: seller.wallet });
  io.emit("market:update"); res.json({ ok: true, gift });
});

app.post("/api/market/buy-nft", authMiddleware, (req, res) => {
  const { nftId } = req.body;
  const nft = db.nftUsernames.find(n => n.id === nftId && n.forSale);
  if (!nft) return res.status(404).json({ error: "Не найден" });
  if (nft.ownerId === req.user.id) return res.status(400).json({ error: "Свой" });
  if (req.user.wallet < nft.salePrice) return res.status(400).json({ error: "Мало" });
  const seller = db.users.find(u => u.id === nft.ownerId);
  if (!seller) return res.status(404).json({ error: "?" });
  req.user.wallet -= nft.salePrice; seller.wallet += nft.salePrice;
  if (seller.nftUsernames && seller.nftUsernames.includes(nft.username)) seller.nftUsernames = seller.nftUsernames.filter(u => u !== nft.username);
  nft.ownerId = req.user.id; nft.forSale = false; nft.salePrice = null;
  saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  io.to(seller.id).emit("wallet:update", { wallet: seller.wallet });
  io.emit("user:updated", publicUser(seller));
  io.emit("market:update"); res.json({ ok: true, nft });
});

app.post("/api/wallet/topup", authMiddleware, (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount < 1) return res.status(400).json({ error: "Ошибка" });
  req.user.wallet = (req.user.wallet || 0) + amount; saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  res.json({ ok: true, wallet: req.user.wallet });
});

app.post("/api/premium/buy", authMiddleware, (req, res) => {
  const PRICE = 500;
  if (req.user.isPremium) return res.status(400).json({ error: "Уже есть" });
  if ((req.user.wallet || 0) < PRICE) return res.status(400).json({ error: "Мало" });
  req.user.wallet -= PRICE; req.user.isPremium = true; saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  io.emit("user:updated", publicUser(req.user));
  res.json({ ok: true, user: publicUser(req.user) });
});

app.get("/api/admin/pools", authMiddleware, adminMiddleware, (req, res) => {
  const flatModels = [];
  for (const [giftType, models] of Object.entries(UPGRADE_MODELS)) {
    for (const m of models) flatModels.push({ ...m, giftType });
  }
  res.json({ models: flatModels, backgrounds: BG_POOL, patterns: PATTERN_POOL, giftTypes: Object.keys(UPGRADE_MODELS) });
});

app.get("/api/admin/users", authMiddleware, adminMiddleware, (req, res) => {
  const usersWithGifts = db.users.map(u => ({ ...publicUser(u), gifts: db.gifts.filter(g => g.toId === u.id) }));
  res.json({ users: usersWithGifts });
});

app.post("/api/admin/gift/create", authMiddleware, adminMiddleware, (req, res) => {
  const { toId, giftType, modelImage, modelName, modelRarity, bgName, bgColor, bgRarity, patternName, patternUrl, patternRarity, uniqueNumber } = req.body;
  const targetUser = db.users.find(u => u.id === toId);
  if (!targetUser) return res.status(404).json({ error: "?" });
  let num = uniqueNumber ? Number(uniqueNumber) : null;
  if (!num) { db.giftCounters[giftType] = (db.giftCounters[giftType] || 0) + 1; num = db.giftCounters[giftType]; }
  const gift = { id: crypto.randomUUID(), fromId: req.user.id, toId, giftType: giftType || "cyber_dog", price: 0, message: "От админа", hideName: false, createdAt: Date.now(), isCollectible: true, level: 2, uniqueNumber: num, maxSupply: 500000, modelData: { model: { name: modelName, image: modelImage, rarity: modelRarity || "?" }, background: { name: bgName, color: bgColor, rarity: bgRarity || "?" }, pattern: { name: patternName, url: patternUrl, rarity: patternRarity || "?" } }, forSale: false, salePrice: null };
  db.gifts.push(gift); saveDb();
  io.to(toId).emit("gift:received", { gift });
  res.json({ ok: true, gift });
});

app.post("/api/admin/gift/delete", authMiddleware, adminMiddleware, (req, res) => {
  const idx = db.gifts.findIndex(g => g.id === req.body.giftId);
  if (idx === -1) return res.status(404).json({ error: "?" });
  const gift = db.gifts[idx];
  db.gifts.splice(idx, 1); saveDb();
  io.to(gift.toId).emit("gift:removed", { giftId: gift.id });
  res.json({ ok: true });
});

app.post("/api/admin/gift/change-number", authMiddleware, adminMiddleware, (req, res) => {
  const gift = db.gifts.find(g => g.id === req.body.giftId);
  if (!gift) return res.status(404).json({ error: "?" });
  gift.uniqueNumber = Number(req.body.newNumber); saveDb();
  io.to(gift.toId).emit("gift:updated", { gift });
  res.json({ ok: true, gift });
});

app.post("/api/admin/user/add-stars", authMiddleware, adminMiddleware, (req, res) => {
  const { userId, amount } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return res.status(404).json({ error: "?" });
  targetUser.wallet = (targetUser.wallet || 0) + Number(amount);
  if (targetUser.wallet < 0) targetUser.wallet = 0;
  saveDb();
  io.to(targetUser.id).emit("wallet:update", { wallet: targetUser.wallet });
  io.emit("user:updated", publicUser(targetUser));
  res.json({ ok: true, user: publicUser(targetUser) });
});

app.post("/api/admin/user/add-cat", authMiddleware, adminMiddleware, (req, res) => {
  const { userId, amount } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return res.status(404).json({ error: "?" });
  targetUser.catBalance = (targetUser.catBalance || 0) + Number(amount);
  if (targetUser.catBalance < 0) targetUser.catBalance = 0;
  saveDb();
  io.to(targetUser.id).emit("cat:update", { balance: targetUser.catBalance });
  io.emit("user:updated", publicUser(targetUser));
  res.json({ ok: true, user: publicUser(targetUser) });
});

app.post("/api/admin/user/toggle-premium", authMiddleware, adminMiddleware, (req, res) => {
  const { userId } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return res.status(404).json({ error: "?" });
  targetUser.isPremium = !targetUser.isPremium; saveDb();
  io.emit("user:updated", publicUser(targetUser));
  res.json({ ok: true, user: publicUser(targetUser) });
});

app.post("/api/admin/grant-nft-username", authMiddleware, adminMiddleware, (req, res) => {
  const { userId, username } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return res.status(404).json({ error: "?" });
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Некорректный" });
  if (db.nftUsernames.some(n => n.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Занят" });
  const nft = { id: crypto.randomUUID(), username, ownerId: userId, forSale: false, salePrice: null, createdAt: Date.now(), grantedByAdmin: true };
  db.nftUsernames.push(nft); saveDb();
  io.emit("user:updated", publicUser(targetUser));
  io.emit("market:update");
  res.json({ ok: true, nft });
});

app.post("/api/admin/grant-nft-number", authMiddleware, adminMiddleware, (req, res) => {
  const { userId, number } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return res.status(404).json({ error: "?" });
  const formatted = String(number || "").trim();
  if (!/^\+?\d{7,15}$/.test(formatted)) return res.status(400).json({ error: "Некорректный" });
  if (db.nftNumbers.some(n => n.number === formatted)) return res.status(409).json({ error: "Уже есть" });
  const nftNum = { id: crypto.randomUUID(), number: formatted, prefix: formatted.slice(0, 4), ownerId: userId, purchasedAt: Date.now(), purchasePriceCAT: 0, forSale: false, salePriceCAT: null, soldBySystem: false, dropAt: null, grantedByAdmin: true };
  db.nftNumbers.push(nftNum); saveDb();
  io.emit("user:updated", publicUser(targetUser));
  res.json({ ok: true, nftNum });
});

// ═══════════════ КАЗИНО ═══════════════
app.get("/api/casino/state", authMiddleware, (req, res) => {
  const myInv = db.botInventory.filter(i => i.userId === req.user.id);
  const inventory = myInv.map(i => ({ ...i, estimatedValue: estimateAssetValue(i.type, i.assetSnapshot) }));
  const activeGame = db.activeGames.find(g => g.userId === req.user.id && g.type === "mines") || null;
  res.json({
    casinoBalance: req.user.casinoBalance || 0, wallet: req.user.wallet || 0, inventory,
    activeMinesGame: activeGame ? { id: activeGame.id, bet: activeGame.bet, mines: activeGame.mines, revealed: activeGame.revealed, multiplier: activeGame.multiplier } : null,
    plinkoTables: PLINKO_TABLES,
    upgraderTargets: UPGRADER_TARGETS.map(t => ({ ...t, modelImage: (UPGRADE_MODELS[t.giftType] || [{}])[0].image || "", modelName: (UPGRADE_MODELS[t.giftType] || [{}])[0].name || t.giftType, rarity: (UPGRADE_MODELS[t.giftType] || [{}])[0].rarity || "?" }))
  });
});

app.post("/api/casino/convert", authMiddleware, (req, res) => {
  const { invId } = req.body;
  const inv = db.botInventory.find(i => i.id === invId && i.userId === req.user.id);
  if (!inv) return res.status(404).json({ error: "Не найден" });
  const value = estimateAssetValue(inv.type, inv.assetSnapshot);
  if (!value) return res.status(400).json({ error: "Ошибка" });
  db.botInventory.splice(db.botInventory.indexOf(inv), 1);
  req.user.casinoBalance = (req.user.casinoBalance || 0) + value;
  saveDb();
  res.json({ ok: true, casinoBalance: req.user.casinoBalance, value });
});

app.post("/api/casino/deposit", authMiddleware, (req, res) => {
  const { invId } = req.body;
  const inv = db.botInventory.find(i => i.id === invId && i.userId === req.user.id);
  if (!inv) return res.status(404).json({ error: "Не найден" });
  const value = estimateAssetValue(inv.type, inv.assetSnapshot);
  if (!value) return res.status(400).json({ error: "Ошибка" });
  db.botInventory.splice(db.botInventory.indexOf(inv), 1);
  req.user.casinoBalance = (req.user.casinoBalance || 0) + value;
  saveDb();
  res.json({ ok: true, casinoBalance: req.user.casinoBalance, value });
});

app.post("/api/casino/withdraw", authMiddleware, (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount < 1) return res.status(400).json({ error: "Ошибка" });
  if ((req.user.casinoBalance || 0) < amount) return res.status(400).json({ error: "Мало" });
  req.user.casinoBalance -= amount;
  req.user.wallet = (req.user.wallet || 0) + amount;
  saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  res.json({ ok: true, wallet: req.user.wallet, casinoBalance: req.user.casinoBalance });
});

app.post("/api/casino/mines/start", authMiddleware, (req, res) => {
  const bet = Number(req.body.bet), mines = Number(req.body.mines);
  if (!Number.isInteger(bet) || bet < 1) return res.status(400).json({ error: "Ставка ≥ 1" });
  if (!Number.isInteger(mines) || mines < 1 || mines > 24) return res.status(400).json({ error: "Мины 1-24" });
  if ((req.user.casinoBalance || 0) < bet) return res.status(400).json({ error: "Мало" });
  if (db.activeGames.find(g => g.userId === req.user.id && g.type === "mines")) return res.status(400).json({ error: "Уже есть игра" });
  req.user.casinoBalance -= bet;
  const positions = Array.from({ length: MINES_TOTAL }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [positions[i], positions[j]] = [positions[j], positions[i]]; }
  const game = { id: crypto.randomUUID(), userId: req.user.id, type: "mines", bet, mines, revealed: [], minePositions: positions.slice(0, mines).sort((a, b) => a - b), multiplier: 1, createdAt: Date.now() };
  db.activeGames.push(game); saveDb();
  res.json({ ok: true, gameId: game.id, casinoBalance: req.user.casinoBalance, bet, mines, multiplier: 1 });
});

app.post("/api/casino/mines/reveal", authMiddleware, (req, res) => {
  const { gameId, cell } = req.body;
  const game = db.activeGames.find(g => g.id === gameId && g.userId === req.user.id && g.type === "mines");
  if (!game) return res.status(404).json({ error: "Не найдена" });
  if (!Number.isInteger(cell) || cell < 0 || cell >= MINES_TOTAL) return res.status(400).json({ error: "Плохая клетка" });
  if (game.revealed.includes(cell)) return res.status(400).json({ error: "Уже открыта" });
  if (game.minePositions.includes(cell)) {
    const mp = game.minePositions;
    db.activeGames.splice(db.activeGames.indexOf(game), 1); saveDb();
    return res.json({ ok: true, lost: true, minePositions: mp, casinoBalance: req.user.casinoBalance });
  }
  game.revealed.push(cell);
  game.multiplier = minesMultiplier(game.mines, game.revealed.length);
  saveDb();
  res.json({ ok: true, safe: true, revealed: game.revealed, multiplier: game.multiplier, potentialWin: Math.floor(game.bet * game.multiplier) });
});

app.post("/api/casino/mines/cashout", authMiddleware, (req, res) => {
  const { gameId } = req.body;
  const game = db.activeGames.find(g => g.id === gameId && g.userId === req.user.id && g.type === "mines");
  if (!game) return res.status(404).json({ error: "Не найдена" });
  if (!game.revealed.length) return res.status(400).json({ error: "Откройте клетку" });
  const win = Math.floor(game.bet * game.multiplier);
  req.user.casinoBalance = (req.user.casinoBalance || 0) + win;
  db.activeGames.splice(db.activeGames.indexOf(game), 1); saveDb();
  res.json({ ok: true, win, casinoBalance: req.user.casinoBalance, multiplier: game.multiplier });
});

app.post("/api/casino/plinko/play", authMiddleware, (req, res) => {
  const bet = Number(req.body.bet), risk = String(req.body.risk || "medium");
  if (!Number.isInteger(bet) || bet < 1) return res.status(400).json({ error: "Ставка ≥ 1" });
  if (!PLINKO_TABLES[risk]) return res.status(400).json({ error: "Неверный риск" });
  if ((req.user.casinoBalance || 0) < bet) return res.status(400).json({ error: "Мало" });
  const positions = [0]; let pos = 0;
  for (let i = 0; i < 16; i++) { pos += Math.random() < 0.5 ? 0 : 1; positions.push(pos); }
  const multiplier = PLINKO_TABLES[risk][pos];
  const win = Math.floor(bet * multiplier);
  req.user.casinoBalance = (req.user.casinoBalance || 0) - bet + win;
  saveDb();
  res.json({ ok: true, positions, slot: pos, multiplier, win, bet, casinoBalance: req.user.casinoBalance, table: PLINKO_TABLES[risk] });
});

app.post("/api/casino/upgrader/play", authMiddleware, (req, res) => {
  const { invId, targetGiftType } = req.body;
  const target = UPGRADER_TARGETS.find(t => t.giftType === targetGiftType);
  if (!target) return res.status(400).json({ error: "Неверная цель" });
  const inv = db.botInventory.find(i => i.id === invId && i.userId === req.user.id);
  if (!inv) return res.status(404).json({ error: "Не найден" });
  const value = estimateAssetValue(inv.type, inv.assetSnapshot);
  if (!value) return res.status(400).json({ error: "Ошибка" });
  db.botInventory.splice(db.botInventory.indexOf(inv), 1);
  const success = Math.random() < target.chance;
  if (success) {
    const pool = UPGRADE_MODELS[targetGiftType] || [];
    const randomModel = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { name: "Unknown", image: "", rarity: "0%" };
    const randomBg = BG_POOL[Math.floor(Math.random() * BG_POOL.length)];
    const randomPattern = PATTERN_POOL[Math.floor(Math.random() * PATTERN_POOL.length)];
    db.giftCounters[targetGiftType] = (db.giftCounters[targetGiftType] || 0) + 1;
    const gift = { id: crypto.randomUUID(), fromId: "SYSTEM", toId: req.user.id, giftType: targetGiftType, price: 0, message: "Апгрейд", hideName: false, createdAt: Date.now(), isCollectible: true, level: 2, uniqueNumber: db.giftCounters[targetGiftType], maxSupply: 500000, modelData: { model: randomModel, background: randomBg, pattern: randomPattern }, forSale: false, salePrice: null };
    db.gifts.push(gift); saveDb();
    io.to(req.user.id).emit("gift:received", { gift });
    return res.json({ ok: true, success: true, gift, assetValue: value, targetGiftType });
  }
  saveDb();
  res.json({ ok: true, success: false, assetValue: value, targetGiftType });
});

// ═══════════════ СПИСОК ЧАТОВ ═══════════════
const onlineUsers = new Map();

app.get("/api/users", authMiddleware, (req, res) => {
  try {
    const meId = req.user.id;

    const userChats = db.users.filter(u => {
      if (u.id === meId) return false;
      return db.messages.some(m => (m.from === meId && m.to === u.id) || (m.from === u.id && m.to === meId));
    }).map(user => {
      let lastMessage = null;
      for (let i = db.messages.length - 1; i >= 0; i--) {
        const m = db.messages[i];
        if ((m.from === meId && m.to === user.id) || (m.from === user.id && m.to === meId)) {
          lastMessage = { type: m.type, body: m.body, createdAt: m.createdAt, fromMe: m.from === meId }; break;
        }
      }
      return { chatType: "user", ...publicUser(user), online: (onlineUsers.get(user.id) || 0) > 0, lastMessage };
    });

    const subs = req.user.subscribedChannels || [];
    const channelChats = db.channels.filter(ch => ch.ownerId === meId || subs.includes(ch.id)).map(ch => {
      const lastPost = ch.posts[0];
      const owner = db.users.find(u => u.id === ch.ownerId);
      return { chatType: "channel", id: ch.id, displayName: ch.name, username: ch.username || null, avatarColor: ch.avatarColor || "#3390ec", ownerId: ch.ownerId, ownerUsername: owner ? owner.username : "?", isMine: ch.ownerId === meId, lastMessage: lastPost ? { body: lastPost.text, createdAt: lastPost.createdAt, fromMe: false, isChannel: true } : null };
    });

    const botChats = db.bots.filter(b => b.ownerId === meId).map(b => {
      let lastMessage = null;
      for (let i = db.messages.length - 1; i >= 0; i--) {
        const m = db.messages[i];
        if ((m.from === meId && m.to === b.id) || (m.from === b.id && m.to === meId)) {
          lastMessage = { type: m.type, body: m.body, createdAt: m.createdAt, fromMe: m.from === meId }; break;
        }
      }
      return { chatType: "bot", id: b.id, displayName: b.name, username: b.username, avatarColor: b.avatarColor || "#7c4dff", online: true, lastMessage };
    });

    // Системный бот
    const systemBotChat = { chatType: "system_bot", id: SYSTEM_BOT_USERNAME, displayName: SYSTEM_BOT_NAME, username: SYSTEM_BOT_USERNAME, avatarColor: "#ff9800", online: true, lastMessage: { body: "🎰 Заходи в казино!", createdAt: Date.now(), fromMe: false } };

    // ИЗБРАННОЕ (сохранённые)
    const savedChat = { chatType: "saved", id: meId, displayName: "Избранное", username: null, avatarColor: "#54a9eb", online: false, lastMessage: null };
    for (let i = db.messages.length - 1; i >= 0; i--) {
      const m = db.messages[i];
      if (m.from === meId && m.to === meId) {
        savedChat.lastMessage = { type: m.type, body: m.body, createdAt: m.createdAt, fromMe: true };
        break;
      }
    }

    const otherChats = [...userChats, ...channelChats, ...botChats].sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
    const chats = [systemBotChat, savedChat, ...otherChats];
    res.json({ users: chats });
  } catch (err) { res.status(500).json({ error: "Ошибка" }); }
});

app.get("/api/users/search", authMiddleware, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ users: [] });
  const matchedUsers = db.users.filter(u => u.id !== req.user.id && u.username.toLowerCase().includes(q));
  res.json({ users: matchedUsers.map(u => ({ chatType: "user", ...publicUser(u), online: (onlineUsers.get(u.id) || 0) > 0, lastMessage: null })) });
});

app.get("/api/users/:id/profile", authMiddleware, (req, res) => {
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "?" });
  const userGifts = db.gifts.filter(g => g.toId === target.id && !g.forSale);
  const userChannels = db.channels.filter(c => c.ownerId === target.id);
  const nftPhoneInfo = target.nftPhone ? db.nftNumbers.find(n => n.number === target.nftPhone) : null;
  res.json({ user: { ...publicUser(target), online: (onlineUsers.get(target.id) || 0) > 0 }, gifts: userGifts, channels: userChannels, nftPhoneInfo });
});

// ═══════════════ СООБЩЕНИЯ ═══════════════
app.get("/api/messages/:userId", authMiddleware, (req, res) => {
  const otherId = req.params.userId;
  const meId = req.user.id;
  let messages;
  if (otherId === meId) {
    messages = db.messages.filter(m => m.from === meId && m.to === meId);
  } else {
    messages = db.messages.filter(m => (m.from === meId && m.to === otherId) || (m.from === otherId && m.to === meId));
  }
  res.json({ messages: messages.slice(-150) });
});

app.post("/api/gifts/buy", authMiddleware, (req, res) => {
  const { giftId, price, isCollectible } = req.body;
  if (req.user.wallet < price) return res.status(400).json({ error: "Мало" });
  req.user.wallet -= price;
  const newGift = { id: crypto.randomUUID(), fromId: req.user.id, toId: req.user.id, giftType: giftId, price, message: "Куплено", hideName: false, createdAt: Date.now(), isCollectible: Boolean(isCollectible), level: 1, uniqueNumber: null, modelData: null, forSale: false, salePrice: null };
  db.gifts.push(newGift); saveDb();
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  res.json({ ok: true, gift: newGift, wallet: req.user.wallet });
});

app.post("/api/gifts/upgrade", authMiddleware, (req, res) => {
  const { giftId } = req.body;
  const gift = db.gifts.find(g => g.id === giftId && g.toId === req.user.id);
  if (!gift || !gift.isCollectible || gift.level >= 2) return res.status(400).json({ error: "?" });
  const UPGRADE_PRICE = 50;
  if (req.user.wallet < UPGRADE_PRICE) return res.status(400).json({ error: "Мало" });
  req.user.wallet -= UPGRADE_PRICE;
  gift.level = 2;
  const pool = UPGRADE_MODELS[gift.giftType] || [];
  const randomModel = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { name: "Unknown", image: "", rarity: "0%" };
  const randomBg = BG_POOL[Math.floor(Math.random() * BG_POOL.length)];
  const randomPattern = PATTERN_POOL[Math.floor(Math.random() * PATTERN_POOL.length)];
  gift.modelData = { model: randomModel, background: randomBg, pattern: randomPattern };
  db.giftCounters[gift.giftType] = (db.giftCounters[gift.giftType] || 0) + 1;
  gift.uniqueNumber = db.giftCounters[gift.giftType];
  gift.maxSupply = 500000;
  saveDb();
  const giftMsg = db.messages.find(m => m.giftId === gift.id && m.type === "gift_card");
  if (giftMsg) { giftMsg.level = 2; giftMsg.modelData = gift.modelData; giftMsg.gift = gift; saveDb(); io.to(giftMsg.from).emit("chat:message:update", giftMsg); io.to(giftMsg.to).emit("chat:message:update", giftMsg); }
  io.to(req.user.id).emit("wallet:update", { wallet: req.user.wallet });
  res.json({ ok: true, gift, wallet: req.user.wallet });
});

app.post("/api/gifts/:id/transfer", authMiddleware, (req, res) => {
  const { toUsername, text, hideName } = req.body;
  if (!toUsername) return res.status(400).json({ error: "Укажите @username" });
  const gift = db.gifts.find(g => g.id === req.params.id && g.toId === req.user.id);
  if (!gift) return res.status(404).json({ error: "Не найден" });
  if (isSystemBot(toUsername)) {
    if (gift.forSale) { gift.forSale = false; gift.salePrice = null; }
    if (req.user.profileBgGiftId === gift.id) req.user.profileBgGiftId = null;
    const inv = { id: crypto.randomUUID(), userId: req.user.id, type: "gift", assetId: gift.id, assetSnapshot: { ...gift, toId: null, fromId: null }, depositedAt: Date.now(), status: "inventory" };
    db.botInventory.push(inv);
    gift.toId = "SYSTEM"; gift.isInBot = true;
    saveDb();
    io.emit("user:updated", publicUser(req.user)); io.emit("market:update");
    return res.json({ ok: true, sentToBot: true, inventory: inv });
  }
  const recipient = db.users.find(u => u.username.toLowerCase() === toUsername.toLowerCase().replace(/^@/, ""));
  if (!recipient) return res.status(404).json({ error: "Не найден" });
  if (recipient.id === req.user.id) return res.status(400).json({ error: "Себе нельзя" });
  gift.toId = recipient.id; gift.fromId = req.user.id; gift.forSale = false; gift.salePrice = null;
  if (req.user.profileBgGiftId === gift.id) req.user.profileBgGiftId = null;

  const recipientName = hideName ? "Anonymous" : (recipient.displayName || recipient.username);
  const senderName = hideName ? "Anonymous" : (req.user.displayName || req.user.username);
  const giftCard = {
    id: crypto.randomUUID(), from: req.user.id, to: recipient.id, type: "gift_card",
    body: text || `Gift from ${senderName}`, createdAt: Date.now(),
    giftId: gift.id, gift: gift, giftType: gift.giftType,
    giftIcon: getGiftIcon(gift.giftType), giftPrice: gift.price || 0,
    recipientName, senderName, isCollectible: gift.isCollectible,
    level: gift.level, modelData: gift.modelData,
    replyTo: null, reactions: []
  };
  db.messages.push(giftCard);
  saveDb();
  io.emit("user:updated", publicUser(req.user)); io.emit("user:updated", publicUser(recipient)); io.emit("market:update");
  io.to(req.user.id).emit("chat:message", giftCard);
  io.to(recipient.id).emit("chat:message", giftCard);
  io.to(recipient.id).emit("gift:received", { gift });
  res.json({ ok: true, gift, recipient: publicUser(recipient), message: giftCard });
});

// ═══════════════ SOCKET ═══════════════
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find((u) => u.id === payload.id);
    if (!user) return next(new Error("?"));
    socket.user = user; next();
  } catch { next(new Error("?")); }
});

io.on("connection", (socket) => {
  const user = socket.user;
  socket.join(user.id);
  onlineUsers.set(user.id, (onlineUsers.get(user.id) || 0) + 1);
  io.emit("presence:update", { userId: user.id, online: true });

  socket.on("chat:send", (data, cb = () => {}) => {
    try {
      const { to, type, body, replyTo } = data;
      const replyObj = replyTo ? { id: replyTo.id, from: replyTo.from, fromUsername: replyTo.fromUsername, type: replyTo.type, body: replyTo.body } : null;

      // Saved messages (to self)
      if (to === user.id) {
        const message = { id: crypto.randomUUID(), from: user.id, to: user.id, type: type || "text", body, createdAt: Date.now(), replyTo: replyObj, reactions: [] };
        db.messages.push(message); saveDb();
        io.to(user.id).emit("chat:message", message);
        return cb({ ok: true, message });
      }

      // Bot
      const bot = db.bots.find(b => b.id === to && b.ownerId === user.id);
      if (bot) {
        const userMsg = { id: crypto.randomUUID(), from: user.id, to: bot.id, type: type || "text", body, createdAt: Date.now(), replyTo: replyObj, reactions: [] };
        db.messages.push(userMsg); saveDb();
        io.to(user.id).emit("chat:message", userMsg);
        const reply = processBotReply(bot, body);
        if (reply) {
          const botMsg = { id: crypto.randomUUID(), from: bot.id, to: user.id, type: "text", body: reply, createdAt: Date.now() + 50, replyTo: null, reactions: [] };
          db.messages.push(botMsg); saveDb();
          setTimeout(() => io.to(user.id).emit("chat:message", botMsg), 350);
        }
        return cb({ ok: true, message: userMsg });
      }

      // Normal user
      const recipient = db.users.find(u => u.id === to);
      if (!recipient) return cb({ error: "?" });
      const message = { id: crypto.randomUUID(), from: user.id, to, type: type || "text", body, createdAt: Date.now(), replyTo: replyObj, reactions: [] };
      db.messages.push(message); saveDb();
      io.to(user.id).emit("chat:message", message);
      io.to(to).emit("chat:message", message);
      cb({ ok: true, message });
    } catch (e) { cb({ error: e.message }); }
  });

  socket.on("chat:reaction", (data, cb = () => {}) => {
    try {
      const { messageId, emoji } = data;
      if (!messageId || !emoji) return cb({ error: "?" });
      const message = db.messages.find(m => m.id === messageId);
      if (!message) return cb({ error: "Не найдено" });
      const isParticipant = message.from === user.id || message.to === user.id;
      if (!isParticipant) return cb({ error: "Нет доступа" });
      if (!Array.isArray(message.reactions)) message.reactions = [];
      const idx = message.reactions.findIndex(r => r.userId === user.id);
      if (idx >= 0) {
        if (message.reactions[idx].emoji === emoji) message.reactions.splice(idx, 1);
        else message.reactions[idx].emoji = emoji;
      } else {
        message.reactions.push({ userId: user.id, username: user.username, emoji });
      }
      saveDb();
      io.to(message.from).emit("chat:message:update", message);
      if (message.to !== message.from) io.to(message.to).emit("chat:message:update", message);
      cb({ ok: true, message });
    } catch (e) { cb({ error: e.message }); }
  });

  socket.on("channel:post", (data, cb = () => {}) => {
    try {
      const { channelId, text } = data;
      const channel = db.channels.find(c => c.id === channelId);
      if (!channel) return cb({ error: "?" });
      if (channel.ownerId !== user.id) return cb({ error: "Только владелец" });
      if (!text || !text.trim()) return cb({ error: "Пусто" });
      const post = { id: crypto.randomUUID(), text: text.trim(), createdAt: Date.now() };
      channel.posts.unshift(post); saveDb();
      io.emit("channel:post", { channelId: channel.id, post });
      cb({ ok: true, post });
    } catch (e) { cb({ error: e.message }); }
  });

  socket.on("gift:send", (data, cb = () => {}) => {
    try {
      const GIFTS = {
  heart: { name: "Heart", icon: "💖", price: 15 },
  bear: { name: "Bear", icon: "🧸", price: 15 },
  gift: { name: "Gift", icon: "🎁", price: 15 },
  rose: { name: "Rose", icon: "🌹", price: 25 },
  cake: { name: "Cake", icon: "🎂", price: 50 },
  bouquet: { name: "Bouquet", icon: "💐", price: 50 },
  rocket: { name: "Rocket", icon: "🚀", price: 50 },
  trophy: { name: "Trophy", icon: "🏆", price: 100 },
  ring: { name: "Ring", icon: "💍", price: 100 },
  neon_heart: { name: "Neon Heart", icon: "💖", price: 100, isCollectible: true },
  cyber_dog: { name: "Cyber Dog", icon: "🐶", price: 150, isCollectible: true },
  neon_cat: { name: "Cat B.", icon: "🐱", price: 200, isCollectible: true },
  crystal_fox: { name: "Rich Frog", icon: "🐸", price: 250, isCollectible: true }
};
      const gift = GIFTS[data.giftId];
      if (!gift) return cb({ error: "?" });
      if (user.wallet < gift.price) return cb({ error: "Мало" });
      const recipient = db.users.find(u => u.id === data.to);
      if (!recipient) return cb({ error: "?" });
      user.wallet -= gift.price;
      recipient.wallet = (recipient.wallet || 0) + Math.floor(gift.price * 0.8);
      const newGift = { id: crypto.randomUUID(), fromId: user.id, toId: data.to, giftType: data.giftId, price: gift.price, message: data.text, hideName: data.hideName, createdAt: Date.now(), isCollectible: Boolean(gift.isCollectible), level: 1, uniqueNumber: null, modelData: null, forSale: false, salePrice: null };
      db.gifts.push(newGift);
      const recipientName = data.hideName ? "Anonymous" : (recipient.displayName || recipient.username);
      const sysMsgSender = { id: crypto.randomUUID(), from: user.id, to: data.to, type: "system", body: `Вы отправили подарок за ${gift.price} ⭐`, createdAt: Date.now() };
      const sysMsgReceiver = { id: crypto.randomUUID(), from: user.id, to: data.to, type: "system", body: `${user.displayName || user.username} отправил вам подарок за ${gift.price} ⭐`, createdAt: Date.now() };
      db.messages.push(sysMsgSender, sysMsgReceiver);
      const giftCard = { id: crypto.randomUUID(), from: user.id, to: data.to, type: "gift_card", body: `Gift for ${recipientName}`, createdAt: Date.now() + 1, giftId: newGift.id, gift: newGift, giftType: newGift.giftType, giftIcon: gift.icon, giftPrice: gift.price, recipientName, isCollectible: newGift.isCollectible, level: 1, modelData: null, replyTo: null, reactions: [] };
      db.messages.push(giftCard); saveDb();
      io.to(user.id).emit("wallet:update", { wallet: user.wallet });
      io.to(data.to).emit("wallet:update", { wallet: recipient.wallet });
      io.to(user.id).emit("chat:message", sysMsgSender); io.to(user.id).emit("chat:message", giftCard);
      io.to(data.to).emit("chat:message", sysMsgReceiver); io.to(data.to).emit("chat:message", giftCard);
      cb({ ok: true, message: giftCard });
    } catch (e) { cb({ error: e.message }); }
  });

  socket.on("disconnect", () => {
    const count = (onlineUsers.get(user.id) || 1) - 1;
    if (count <= 0) { onlineUsers.delete(user.id); io.emit("presence:update", { userId: user.id, online: false }); }
    else onlineUsers.set(user.id, count);
  });
});

server.listen(PORT, () => console.log(`Messenger → http://localhost:${PORT}`));