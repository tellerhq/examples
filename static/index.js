const { applicationId: APPLICATION_ID, environment: ENVIRONMENT } = window.TELLER_CONFIG;
const BASE_URL = 'http://localhost:8001/api';

/* ---------------- Store ---------------- */
class TellerStore {
  constructor() {
    this.keys = { enrollment: 'teller:enrollment', user: 'teller:user' };
  }
  getUser() { return this.get(this.keys.user); }
  getEnrollment() { return this.get(this.keys.enrollment); }
  putUser(user) { this.put(this.keys.user, user); }
  putEnrollment(enrollment) { this.put(this.keys.enrollment, enrollment); }
  clear() { localStorage.clear(); }
  get(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
  put(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
}

/* ---------------- Client ---------------- */
class Client {
  constructor() {
    this.baseURL = BASE_URL;
    this.accessToken = null;
  }

  normalizeUrl(url) {
    if (!url) return null;
    if (url.startsWith('https://api.teller.io')) {
      return url.replace('https://api.teller.io', this.baseURL);
    }
    if (url.startsWith('/')) {
      return `${this.baseURL}${url}`;
    }
    return url;
  }

  async request(method, url, body = null, extraHeaders = {}) {
    const finalUrl = this.normalizeUrl(url);
    const res = await fetch(finalUrl, {
      method,
      headers: {
        'Authorization': this.accessToken,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      let msg;
      try { msg = await res.json(); } catch { msg = await res.text(); }
      throw new Error(`${method} ${finalUrl} -> ${res.status}: ${JSON.stringify(msg)}`);
    }
    return res.json();
  }

  listAccounts() { return this.request('GET', '/accounts'); }
  getDetails(account) { return this.request('GET', `/accounts/${account.id}/details`); }
  getBalances(account) { return this.request('GET', `/accounts/${account.id}/balances`); }
  getTransactions(account) { return this.request('GET', `/accounts/${account.id}/transactions`); }
  listPayees(account) { return this.request('GET', `/accounts/${account.id}/payees`); }
  createPayee(account, payee) { return this.request('POST', `/accounts/${account.id}/payees`, payee); }
  createPayment(account, payment) { return this.request('POST', `/accounts/${account.id}/payments`, payment); }
  discoverSchemes(account) { return this.request('OPTIONS', `/accounts/${account.id}/payments`); }
}

/* ---------------- Templates ---------------- */
class LogTemplate { constructor(t) { this.t = t; } render(r) { const n = this.t.content.cloneNode(true); n.querySelector('.resource').textContent = r.name; n.querySelector('.timestamp').textContent = new Date().toLocaleString(); n.querySelector('.http').textContent = `${r.method} ${r.path}`; return n; } }
class AccountTemplate {
  constructor(t) { this.t = t; }
  render(account, cb) {
    const n = this.t.content.cloneNode(true);
    n.querySelector('.title').textContent = [account.name, account.last_four].join(', ');
    n.querySelector('.institution').textContent = account.institution.id;
    n.querySelector('.type').textContent = account.type;
    n.querySelector('.subtype').textContent = account.subtype;

    const detailsBtn = n.querySelector('.details');
    const balancesBtn = n.querySelector('.balances');
    const txBtn = n.querySelector('.transactions');
    const payeesBtn = n.querySelector('.payees');
    const newPayeeBtn = n.querySelector('.create-payee');

    detailsBtn.onclick = () => cb.onDetails(account);
    balancesBtn.onclick = () => cb.onBalances(account);
    txBtn.onclick = () => cb.onTransactions(account);

    if (account.links && account.links.payments) {
      payeesBtn.onclick = () => cb.onPayees(account);
      newPayeeBtn.onclick = () => cb.onCreatePayee(account);
    } else {
      payeesBtn.setAttribute('disabled', true);
      newPayeeBtn.setAttribute('disabled', true);
    }
    return n;
  }
}
class DetailTemplate { constructor(t) { this.t = t; } render(d) { const n = this.t.content.cloneNode(true); n.querySelector('.number').textContent = d.account_number; n.querySelector('.ach').textContent = d.routing_numbers.ach; return n; } }
class BalanceTemplate { constructor(t) { this.t = t; } render(b) { const n = this.t.content.cloneNode(true); n.querySelector('.available').textContent = `${b.available}$`; n.querySelector('.ledger').textContent = `${b.ledger}$`; return n; } }
class TransactionTemplate { constructor(t) { this.t = t; } render(tr) { const n = this.t.content.cloneNode(true); n.querySelector('.description').textContent = tr.description; n.querySelector('.date').textContent = tr.date; n.querySelector('.amount').textContent = `${tr.amount}$`; return n; } }
class PayeeModalTemplate { constructor(t) { this.t = t; } render(nm, em) { const n = this.t.content.cloneNode(true); n.querySelector('#payee-name').value = nm; n.querySelector('#payee-email').value = em; return n; } }
class PayeeTemplate { constructor(t) { this.t = t; } render(payee, cb) { const n = this.t.content.cloneNode(true); n.querySelector('.name').textContent = payee.name; n.querySelector('.address').textContent = payee.address; n.querySelector('.create-payment').onclick = cb; return n; } }
class PaymentModalTemplate { constructor(t) { this.t = t; } render(memo, amt) { const n = this.t.content.cloneNode(true); n.querySelector('#payment-memo').value = memo; n.querySelector('#payment-amount').value = amt; return n; } }
class PaymentTemplate { constructor(t) { this.t = t; } render(payment, payee) { const n = this.t.content.cloneNode(true); n.querySelector('.name').textContent = payee.name; n.querySelector('.amount').textContent = `${payment.amount}$`; return n; } }

/* ---------------- Spinner ---------------- */
class Spinner { constructor(p){ this.parent=p; this.node=document.createElement('div'); this.node.classList.add('spinner'); } show(){ this.parent.prepend(this.node);} hide(){if(this.node.parentNode) this.parent.removeChild(this.node);} }

/* ---------------- Handlers ---------------- */
class EnrollmentHandler {
  constructor(client, containers, templates) {
    this.client = client;
    this.containers = containers;
    this.templates = templates;
  }

  onEnrollment(enrollment) {
    this.client.accessToken = enrollment.accessToken;
    const c = this.containers.accounts;
    const t = this.templates.account;
    const s = new Spinner(c);
    s.show();
    this.client.listAccounts()
      .then(accs => { accs.forEach(a => c.appendChild(t.render(a,this))); })
      .finally(() => s.hide());
  }

  onDetails(account) {
    const c = this.containers.logs;
    const t = this.templates.detail;
    const s = new Spinner(c);
    s.show();
    this.client.getDetails(account)
      .then(d => {
        c.prepend(t.render(d));
        c.prepend(this.templates.log.render({method:'GET',name:'Details',path:`/accounts/${account.id}/details`}));
      })
      .finally(() => s.hide());
  }

  onBalances(account) {
    const c = this.containers.logs;
    const t = this.templates.balance;
    const s = new Spinner(c);
    s.show();
    this.client.getBalances(account)
      .then(b => {
        c.prepend(t.render(b));
        c.prepend(this.templates.log.render({method:'GET',name:'Balances',path:`/accounts/${account.id}/balances`}));
      })
      .finally(() => s.hide());
  }

  onTransactions(account) {
    const c = this.containers.logs;
    const t = this.templates.transaction;
    const s = new Spinner(c);
    s.show();
    this.client.getTransactions(account)
      .then(txs => {
        txs.reverse().forEach(tx => c.prepend(t.render(tx)));
        c.prepend(this.templates.log.render({method:'GET',name:'Transactions',path:`/accounts/${account.id}/transactions`}));
      })
      .finally(() => s.hide());
  }

  onPayees(account) {
    const c = this.containers.logs;
    const t = this.templates.payee;
    const s = new Spinner(c);
    s.show();
    this.client.listPayees(account)
      .then(payees => {
        payees.forEach(payee => {
          const cb = () => this.onCreatePayment(account,payee);
          c.prepend(t.render(payee,cb));
        });
        c.prepend(this.templates.log.render({method:'GET',name:'Payees',path:`/accounts/${account.id}/payees`}));
      })
      .finally(() => s.hide());
  }

  onCreatePayee(account) {
    const c = this.containers.logs;
    const root = this.containers.root;
    const mt = this.templates.payeeModal;
    const s = new Spinner(c);
    const p = generatePerson();
    const m = mt.render(p.name,p.email);
    root.append(m);

    const close=()=>{const el=document.getElementById('payee-modal');if(el)el.remove();};
    document.getElementById('submit-payee').onclick=()=>{
      const name=document.getElementById('payee-name').value;
      const email=document.getElementById('payee-email').value;
      close();
      s.show();
      const payee={scheme:'zelle',address:email,name,type:'person'};
      this.client.createPayee(account,payee)
        .then(resp=>this.onPayeeResponse(account,payee,resp))
        .finally(()=>s.hide());
    };
    document.getElementById('payee-modal').onclick=()=>close();
    document.getElementById('payee-modal-content').onclick=e=>e.stopPropagation();
  }

  onCreatePayment(account,payee) {
    const c = this.containers.logs;
    const root = this.containers.root;
    const mt = this.templates.paymentModal;
    const s = new Spinner(c);
    const m = mt.render('Teller test',`${Math.ceil(Math.random()*100)}.00`);
    root.append(m);

    const close=()=>{const el=document.getElementById('payment-modal');if(el)el.remove();};
    document.getElementById('submit-payment').onclick=()=>{
      const memo=document.getElementById('payment-memo').value;
      const amount=document.getElementById('payment-amount').value;
      close();
      s.show();
      const payment={amount,memo,payee:{scheme:'zelle',address:payee.address}};
      this.client.createPayment(account,payment)
        .then(resp=>this.onPaymentResponse(account,payee,payment,resp))
        .finally(()=>s.hide());
    };
    document.getElementById('payment-modal').onclick=()=>close();
    document.getElementById('payment-modal-content').onclick=e=>e.stopPropagation();
  }

  onPayeeResponse(account,payee,resp) {
    const c = this.containers.logs;
    const t = this.templates.payee;
    const h = this.templates.log.render({method:'POST',name:'Payees',path:`/accounts/${account.id}/payees`});
    const cb = () => this.onCreatePayment(account,payee);

    if(resp.connect_token){
      const s = new Spinner(c); s.show();
      const tc = TellerConnect.setup({
        applicationId: APPLICATION_ID,
        environment: ENVIRONMENT,
        connectToken: resp.connect_token,
        onSuccess: ()=>{c.prepend(t.render(payee,cb));c.prepend(h);s.hide();},
        onFailure: ()=>s.hide()
      });
      tc.open();
    } else {
      c.prepend(t.render(payee,cb));
      c.prepend(h);
    }
  }

  onPaymentResponse(account,payee,payment,resp) {
    const c = this.containers.logs;
    const t = this.templates.payment;
    const h = this.templates.log.render({method:'POST',name:'Payments',path:`/accounts/${account.id}/payments`});

    if(resp.connect_token){
      const s = new Spinner(c); s.show();
      const tc = TellerConnect.setup({
        applicationId: APPLICATION_ID,
        environment: ENVIRONMENT,
        connectToken: resp.connect_token,
        onSuccess: ()=>{c.prepend(t.render(payment,payee));c.prepend(h);s.hide();},
        onFailure: ()=>s.hide()
      });
      tc.open();
    } else {
      c.prepend(t.render(payment,payee));
      c.prepend(h);
    }
  }

  clear(){Object.values(this.containers).forEach(p=>{while(p.firstChild)p.removeChild(p.firstChild);});}
}

/* ---------------- User + Status ---------------- */
class UserHandler { constructor(l){this.labels=l;} onEnrollment(e){this.labels.userId.textContent=e.user.id;this.labels.accessToken.textContent=e.accessToken;} clear(){Object.values(this.labels).forEach(n=>n.textContent='not_available');} }
class StatusHandler { constructor(b){this.connected=false;this.button=b;} onEnrollment(){this.setConnected(true);this.button.textContent='Disconnect';} toggle(cb){if(this.connected){this.setConnected(false);this.button.textContent='Connect';cb.onDisconnect();}else{cb.onConnect();}} setConnected(c){this.connected=c;} }

/* ---------------- Utilities ---------------- */
function generatePerson(){const pick=a=>a[Math.floor(Math.random()*a.length)];const fn=pick(['William','James','Evelyn','Harper','Mason','Ella','Jackson','Avery','Scarlett','Jack']);const ml=pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ');const ln=pick(['Adams','Wilson','Burton','Harris','Stevens','Robinson','Lewis','Walker','Payne','Baker']);const user=(Math.random()+1).toString(36).substring(2);return{name:`${fn} ${ml}. ${ln}`,email:`${user}@teller.io`};}

/* ---------------- Bootstrap ---------------- */
document.addEventListener('DOMContentLoaded',function(){
  const containers={accounts:document.getElementById('accounts'),logs:document.getElementById('logs'),root:document.body};
  const templates={
    log:new LogTemplate(document.getElementById('log-template')),
    account:new AccountTemplate(document.getElementById('account-template')),
    detail:new DetailTemplate(document.getElementById('detail-template')),
    balance:new BalanceTemplate(document.getElementById('balance-template')),
    transaction:new TransactionTemplate(document.getElementById('transaction-template')),
    payee:new PayeeTemplate(document.getElementById('payee-template')),
    payment:new PaymentTemplate(document.getElementById('payment-template')),
    payeeModal:new PayeeModalTemplate(document.getElementById('payee-modal-template')),
    paymentModal:new PaymentModalTemplate(document.getElementById('payment-modal-template'))
  };
  const labels={userId:document.getElementById('user-id'),accessToken:document.getElementById('access-token')};
  const store=new TellerStore(),client=new Client(),enrollmentHandler=new EnrollmentHandler(client,containers,templates),userHandler=new UserHandler(labels),statusHandler=new StatusHandler(document.getElementById('teller-connect'));

  const tc=TellerConnect.setup({
    applicationId:APPLICATION_ID,
    environment:ENVIRONMENT,
    selectAccount:'multiple',
    onSuccess:e=>{store.putUser(e.user);store.putEnrollment(e);enrollmentHandler.onEnrollment(e);userHandler.onEnrollment(e);statusHandler.onEnrollment(e);}
  });

  document.getElementById('teller-connect').onclick=()=>statusHandler.toggle({
    onConnect:()=>tc.open(),
    onDisconnect:()=>{enrollmentHandler.clear();userHandler.clear();store.clear();location.reload();}
  });

  const e=store.getEnrollment();if(e){enrollmentHandler.onEnrollment(e);userHandler.onEnrollment(e);statusHandler.onEnrollment(e);}
});