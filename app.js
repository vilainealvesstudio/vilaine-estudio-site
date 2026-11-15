'use strict';
const cfg=window.VILAINE_CONFIG||{};
function applyContacts(settings){
  const digits=String(settings.phone||'').replace(/\D/g,'');
  if(/^55\d{10,11}$/.test(digits)) {
    for(const a of document.querySelectorAll('[data-whatsapp]'))a.href=`https://wa.me/${digits}`;
    for(const a of document.querySelectorAll('[data-phone]')){a.href=`tel:+${digits}`;a.textContent=settings.phone;}
  }
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email||''))for(const a of document.querySelectorAll('[data-email]')){a.href=`mailto:${settings.email}`;a.textContent=settings.email;}
}
if(cfg.adminUrl)for(const a of document.querySelectorAll('a[href="admin.html"]'))a.href=cfg.adminUrl;
fetch(`${cfg.apiBase||''}/api/public-settings`,{credentials:'omit',headers:{Accept:'application/json'}}).then(async r=>{
  if(r.ok&&r.headers.get('content-type')?.includes('application/json'))applyContacts(await r.json());
}).catch(()=>{/* O site mantém os contatos oficiais quando o backend está indisponível. */});
