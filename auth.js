const jwt=require("jsonwebtoken");
const bcrypt=require("bcryptjs");
const db=require("./db");
const SECRET=process.env.JWT_SECRET||"dev-secret-change-me";
function token(user){return jwt.sign({id:user.id,role:user.role,name:user.name,email:user.email},SECRET,{expiresIn:"7d"})}
function requireAuth(req,res,next){
 try{req.user=jwt.verify((req.headers.authorization||"").replace(/^Bearer /,""),SECRET);next()}
 catch(e){return res.status(401).json({error:"Authentification requise"})}
}
function requireRole(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:"Accès refusé"})}
function createUser({name,email,phone,password,role="client"}){
 const hash=bcrypt.hashSync(password,12);
 const result=db.prepare("INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)").run(name,email,phone||"",hash,role);
 return db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(result.lastInsertRowid);
}
module.exports={db,token,requireAuth,requireRole,createUser};