require("dotenv").config();
const express=require("express"),cors=require("cors");
const bcrypt=require("bcryptjs");
const {db,token,requireAuth,requireRole,createUser}=require("./auth");
const {createPayment}=require("./payments");
const app=express();
app.use(cors()); app.use(express.json({limit:"2mb"})); app.use(express.static("public"));
const PORT=process.env.PORT||3000;
const money=n=>Number(n||0);
function notify(userId,title,message){db.prepare("INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)").run(userId,title,message)}
function userPublic(id){return db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(id)}
function apiError(res,e){console.error(e);res.status(400).json({error:e.message||"Erreur"})}

app.get("/api/health",(req,res)=>res.json({ok:true,app:"HIGHNESS BIGMARKET"}));

app.post("/api/auth/register",(req,res)=>{try{
 const {name,email,phone,password}=req.body;if(!name||!email||!password)throw Error("Nom, email et mot de passe requis");
 const u=createUser({name,email:email.toLowerCase(),phone,password});res.status(201).json({user:u,token:token(u)});
}catch(e){apiError(res,e)}});

app.post("/api/auth/login",(req,res)=>{try{
 const u=db.prepare("SELECT * FROM users WHERE email=?").get((req.body.email||"").toLowerCase());
 if(!u||!bcrypt.compareSync(req.body.password||"",u.password_hash))throw Error("Identifiants incorrects");
 res.json({user:userPublic(u.id),token:token(u)});
}catch(e){res.status(401).json({error:e.message})}});

app.get("/api/me",requireAuth,(req,res)=>res.json(userPublic(req.user.id)));

app.get("/api/categories",(req,res)=>{
 res.json(db.prepare("SELECT category,COUNT(*) count FROM products WHERE active=1 GROUP BY category ORDER BY count DESC").all());
});

app.get("/api/products",(req,res)=>{
 const {q,category,shop}=req.query; let sql=`SELECT p.*,s.name shop_name,s.id shop_id FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.active=1 AND s.status='approved'`; const args=[];
 if(q){sql+=" AND (p.name LIKE ? OR p.description LIKE ? OR s.name LIKE ?)";const x="%"+q+"%";args.push(x,x,x)}
 if(category){sql+=" AND p.category=?";args.push(category)}
 if(shop){sql+=" AND p.shop_id=?";args.push(shop)}
 sql+=" ORDER BY p.created_at DESC";
 res.json(db.prepare(sql).all(...args));
});

app.get("/api/shops",(req,res)=>res.json(db.prepare(`SELECT s.*,u.name owner_name,(SELECT COUNT(*) FROM products p WHERE p.shop_id=s.id AND p.active=1) products FROM shops s JOIN users u ON u.id=s.owner_id WHERE s.status='approved' ORDER BY s.created_at DESC`).all()));

app.get("/api/shops/:id",(req,res)=>{
 const s=db.prepare(`SELECT s.*,u.name owner_name FROM shops s JOIN users u ON u.id=s.owner_id WHERE s.id=?`).get(req.params.id);
 if(!s)return res.status(404).json({error:"Boutique introuvable"});
 s.products=db.prepare("SELECT * FROM products WHERE shop_id=? AND active=1").all(s.id);res.json(s);
});

app.post("/api/seller/apply",requireAuth,(req,res)=>{try{
 if(req.user.role!=="client"&&req.user.role!=="seller")throw Error("Compte invalide");
 const exists=db.prepare("SELECT id FROM shops WHERE owner_id=? AND status IN ('pending','approved')").get(req.user.id);
 if(exists)throw Error("Une boutique existe déjà pour ce compte");
 const {name,category,description}=req.body;if(!name)throw Error("Nom de boutique requis");
 const r=db.prepare("INSERT INTO shops(owner_id,name,category,description,status) VALUES(?,?,?,?, 'pending')").run(req.user.id,name,category||"Autres",description||"");
 notify(req.user.id,"Demande de boutique","Votre demande de création de boutique est en attente de validation.");
 res.status(201).json(db.prepare("SELECT * FROM shops WHERE id=?").get(r.lastInsertRowid));
}catch(e){apiError(res,e)}});

app.post("/api/seller/products",requireAuth,requireRole("seller","admin"),(req,res)=>{
 try{
  let shop=db.prepare("SELECT * FROM shops WHERE owner_id=? AND status='approved'").get(req.user.id);
  if(req.user.role==="admin"&&req.body.shop_id)shop=db.prepare("SELECT * FROM shops WHERE id=?").get(req.body.shop_id);
  if(!shop)throw Error("Boutique approuvée introuvable");
  const {name,description,category,price,stock,image}=req.body;if(!name||!price)throw Error("Nom et prix requis");
  const r=db.prepare("INSERT INTO products(shop_id,name,description,category,price,stock,image) VALUES(?,?,?,?,?,?,?)").run(shop.id,name,description||"",category||shop.category,Math.round(money(price)),Math.max(0,Math.round(money(stock))),image||"🛍️");
  res.status(201).json(db.prepare("SELECT * FROM products WHERE id=?").get(r.lastInsertRowid));
 }catch(e){apiError(res,e)}
});

app.get("/api/seller/dashboard",requireAuth,requireRole("seller"),(req,res)=>{
 const shop=db.prepare("SELECT * FROM shops WHERE owner_id=?").get(req.user.id);
 if(!shop)return res.json({shop:null,stats:{}});
 const stats=db.prepare(`SELECT COALESCE(SUM(oi.quantity*oi.unit_price),0) gross,COUNT(DISTINCT o.id) orders FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.shop_id=?`).get(shop.id);
 const products=db.prepare("SELECT * FROM products WHERE shop_id=? ORDER BY id DESC").all(shop.id);
 const orders=db.prepare(`SELECT DISTINCT o.* FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.shop_id=? ORDER BY o.id DESC LIMIT 20`).all(shop.id);
 res.json({shop,stats,products,orders});
});

app.get("/api/orders",requireAuth,(req,res)=>{
 if(req.user.role==="client")return res.json(db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC").all(req.user.id));
 if(req.user.role==="seller")return res.json(db.prepare(`SELECT DISTINCT o.* FROM orders o JOIN order_items i ON i.order_id=o.id JOIN shops s ON s.id=i.shop_id WHERE s.owner_id=? ORDER BY o.id DESC`).all(req.user.id));
 res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all());
});

app.post("/api/orders",requireAuth,async(req,res)=>{
 try{
  const {items,delivery,paymentMethod}=req.body;if(!Array.isArray(items)||!items.length)throw Error("Panier vide");
  let subtotal=0;const normalized=[];
  for(const item of items){
   const p=db.prepare(`SELECT p.*,s.id shop_id,s.commission_rate FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=? AND p.active=1 AND s.status='approved'`).get(item.productId);
   if(!p)throw Error("Produit introuvable");const q=Math.max(1,Math.floor(item.quantity||1));
   if(p.stock<q)throw Error(`Stock insuffisant pour ${p.name}`);
   subtotal+=p.price*q;normalized.push({...p,quantity:q});
  }
  const commission=Math.round(normalized.reduce((sum,p)=>sum+p.price*p.quantity*(p.commission_rate/100),0));
  const deliveryFee=delivery?.city?.toLowerCase()==="douala"?0:1500,total=subtotal+deliveryFee;
  const create=db.transaction(()=>{
   const r=db.prepare(`INSERT INTO orders(user_id,status,payment_status,payment_method,subtotal,commission,delivery_fee,total,delivery_name,delivery_phone,delivery_city,delivery_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
   .run(req.user.id,"pending","pending",paymentMethod||"mobile_money",subtotal,commission,deliveryFee,total,delivery?.name||req.user.name,delivery?.phone||"",delivery?.city||"",delivery?.address||"");
   const add=db.prepare("INSERT INTO order_items(order_id,product_id,shop_id,quantity,unit_price) VALUES(?,?,?,?,?)");
   const dec=db.prepare("UPDATE products SET stock=stock-? WHERE id=?");
   normalized.forEach(p=>{add.run(r.lastInsertRowid,p.id,p.shop_id,p.quantity,p.price);dec.run(p.quantity,p.id)});
   notify(req.user.id,"Commande créée",`Votre commande #${r.lastInsertRowid} a été créée.`);
   return r.lastInsertRowid;
  });
  const orderId=create(); const payment=await createPayment({orderId,amount:total,method:paymentMethod,customer:req.user});
  db.prepare("UPDATE orders SET payment_status=?,status=? WHERE id=?").run(payment.status,payment.status==="success"?"confirmed":"pending",orderId);
  res.status(201).json({order:db.prepare("SELECT * FROM orders WHERE id=?").get(orderId),payment});
 }catch(e){apiError(res,e)}
});

app.get("/api/orders/:id",requireAuth,(req,res)=>{
 const o=db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);if(!o)return res.status(404).json({error:"Commande introuvable"});
 if(req.user.role==="client"&&o.user_id!==req.user.id)return res.status(403).json({error:"Accès refusé"});
 o.items=db.prepare(`SELECT i.*,p.name,p.image,s.name shop_name FROM order_items i JOIN products p ON p.id=i.product_id JOIN shops s ON s.id=i.shop_id WHERE i.order_id=?`).all(o.id);res.json(o);
});

app.get("/api/notifications",requireAuth,(req,res)=>res.json(db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50").all(req.user.id)));
app.patch("/api/notifications/:id/read",requireAuth,(req,res)=>{db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(req.params.id,req.user.id);res.json({ok:true})});

app.get("/api/admin/dashboard",requireAuth,requireRole("admin"),(req,res)=>{
 const stats={
 users:db.prepare("SELECT COUNT(*) c FROM users").get().c,
 shops:db.prepare("SELECT COUNT(*) c FROM shops").get().c,
 pendingShops:db.prepare("SELECT COUNT(*) c FROM shops WHERE status='pending'").get().c,
 products:db.prepare("SELECT COUNT(*) c FROM products WHERE active=1").get().c,
 orders:db.prepare("SELECT COUNT(*) c FROM orders").get().c,
 revenue:db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE payment_status='success'").get().n,
 commissions:db.prepare("SELECT COALESCE(SUM(commission),0) n FROM orders WHERE payment_status='success'").get().n
 };
 res.json({stats,pending:db.prepare(`SELECT s.*,u.name owner_name,u.email FROM shops s JOIN users u ON u.id=s.owner_id WHERE s.status='pending'`).all(),recentOrders:db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 20").all()});
});
app.patch("/api/admin/shops/:id",requireAuth,requireRole("admin"),(req,res)=>{
 const status=["approved","rejected","suspended"].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({error:"Statut invalide"});
 const s=db.prepare("SELECT * FROM shops WHERE id=?").get(req.params.id);if(!s)return res.status(404).json({error:"Boutique introuvable"});
 db.prepare("UPDATE shops SET status=? WHERE id=?").run(status,s.id);notify(s.owner_id,"Statut boutique",`Votre boutique "${s.name}" est maintenant ${status}.`);res.json(db.prepare("SELECT * FROM shops WHERE id=?").get(s.id));
});
app.patch("/api/admin/orders/:id",requireAuth,requireRole("admin"),(req,res)=>{
 const allowed=["pending","confirmed","processing","shipped","delivered","cancelled"];if(!allowed.includes(req.body.status))return res.status(400).json({error:"Statut invalide"});
 const o=db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);if(!o)return res.status(404).json({error:"Commande introuvable"});
 db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,o.id);notify(o.user_id,"Mise à jour commande",`Votre commande #${o.id} est maintenant : ${req.body.status}.`);res.json({ok:true});
});

app.use((req,res)=>res.sendFile(require("path").join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`HIGHNESS BIGMARKET: http://localhost:${PORT}`));