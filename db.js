const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const db = new Database(process.env.DB_FILE || "bigmarket.db");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 phone TEXT,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'client',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shops(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 category TEXT,
 description TEXT,
 status TEXT DEFAULT 'pending',
 commission_rate REAL DEFAULT 10,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 shop_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 category TEXT,
 price INTEGER NOT NULL,
 stock INTEGER DEFAULT 0,
 image TEXT,
 active INTEGER DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(shop_id) REFERENCES shops(id)
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 status TEXT DEFAULT 'pending',
 payment_status TEXT DEFAULT 'pending',
 payment_method TEXT,
 subtotal INTEGER NOT NULL,
 commission INTEGER DEFAULT 0,
 delivery_fee INTEGER DEFAULT 0,
 total INTEGER NOT NULL,
 delivery_name TEXT,
 delivery_phone TEXT,
 delivery_city TEXT,
 delivery_address TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS order_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL,
 product_id INTEGER NOT NULL,
 shop_id INTEGER NOT NULL,
 quantity INTEGER NOT NULL,
 unit_price INTEGER NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id),
 FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 read_at TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

function seed(){
 const adminEmail = process.env.ADMIN_EMAIL || "admin@highnessbigmarket.cm";
 const adminPass = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword";
 const exists = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
 if(!exists){
   const hash=bcrypt.hashSync(adminPass,12);
   db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run("Administrateur HIGHNESS",adminEmail,hash);
 }
 const count=db.prepare("SELECT COUNT(*) c FROM shops").get().c;
 if(count===0){
   const pass=bcrypt.hashSync("DemoSeller123!",12);
   const seller=db.prepare("INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?, 'seller')")
     .run("HIGHNESS Collection","seller@highnessbigmarket.cm","+237600000000",pass);
   const shop=db.prepare("INSERT INTO shops(owner_id,name,category,description,status) VALUES(?,?,?,?, 'approved')")
     .run(seller.lastInsertRowid,"HIGHNESS Collection","Mode","Boutique partenaire HIGHNESS","approved");
   const add=db.prepare("INSERT INTO products(shop_id,name,description,category,price,stock,image) VALUES(?,?,?,?,?,?,?)");
   [
    ["Sneakers Premium","Sneakers premium, confort et finition élégante.","Mode",55000,25,"👟"],
    ["Sac à main Gold","Sac premium avec détails dorés.","Mode",95000,12,"👜"],
    ["T-shirt Signature","T-shirt HIGHNESS édition signature.","Mode",25000,50,"👕"]
   ].forEach(p=>add.run(shop.lastInsertRowid,...p));
 }
}
seed();
module.exports=db;