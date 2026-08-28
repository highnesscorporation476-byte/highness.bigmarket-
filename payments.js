// Adaptateur de paiement. Le mode mock est volontairement sans débit réel.
// Remplacez createPayment/verifyPayment par l'API de votre fournisseur marchand
// (Mobile Money / carte) lorsque les clés et URLs officielles sont disponibles.
async function createPayment({orderId,amount,method,customer}){
 if((process.env.PAYMENT_PROVIDER||"mock")==="mock"){
   return {status:"success",transactionId:"DEMO-"+Date.now(),message:"Paiement de démonstration accepté"};
 }
 throw new Error("PAYMENT_PROVIDER non implémenté : configurez l'adaptateur officiel de votre fournisseur.");
}
async function verifyPayment(transactionId){return {status:"pending",transactionId};}
module.exports={createPayment,verifyPayment};