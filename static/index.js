const APPLICATION_ID = '';
const ENVIRONMENT = 'sandbox';
const BASE_URL = 'http://localhost:8001/api';

class TellerStore {
  constructor() {
    this.keys = {
      enrollment: 'teller:enrollment',
      user: 'teller:user',
    }
  }

  getUser() {
    return this.get(this.keys.user);
  }

  getEnrollment() {
    return this.get(this.keys.enrollment);
  }

  putUser(user) {
    return this.put(this.keys.user, user);
  }

  putEnrollment(enrollment) {
    return this.put(this.keys.enrollment, enrollment);
  }

  clear() {
    localStorage.clear();
  }

  get(key) {
    const raw = localStorage.getItem(key);
    return JSON.parse(raw);
  }

  put(key, value) {
    const raw = JSON.stringify(value);
    return localStorage.setItem(key, raw);
  }
}

class Client {
  constructor() {
    this.baseURL = BASE_URL;
    this.accessToken = null;
  }

  listAccounts() {
    return this.get('/accounts');
  }

  getAccountDetails(account) {
    return this.get(`/accounts/${account.id}/details`);
  }

  getAccountBalances(account) {
    return this.get(`/accounts/${account.id}/balances`);
  }

  listAccountTransactions(account) {
    return this.get(`/accounts/${account.id}/transactions`);
  }

  listAccountPayees(account) {
    return this.get(`/accounts/${account.id}/payments/zelle/payees`);
  }

  createAccountPayee(account, payee) {
    return this.post(`/accounts/${account.id}/payments/zelle/payees`, {payee});
  }

  createAccountPayment(account, payment) {
    return this.post(`/accounts/${account.id}/payments/zelle`, {payment});
  }

  get(path) {
    return this.request('GET', path, null);
  }

  post(path, data) {
    return this.request('POST', path, JSON.stringify(data));
  }

  request(method, path, data) {
    const request = new Request(this.baseURL + path, {
      method: method,
      headers: new Headers({
        'Authorization': this.accessToken,
        'Content-Type': 'application/json',
      }),
      body: data,
    });

    return fetch(request);
  }
}

class EnrollmentHandler {
  constructor(client, containers, templates) {
    this.client = client;
    this.containers = containers;
    this.templates = templates;
  }

  onEnrollment(enrollment) {
    this.client.accessToken = enrollment.accessToken;

    const container = this.containers.accounts;
    const template = this.templates.account;
    const spinner = new Spinner(container);
    const callbacks = this;

    spinner.show();

    this.client.listAccounts()
      .then(function(response) {
        return response.json();
      })
      .then(function(accounts) {
        accounts.forEach(function(account) {
          const node = template.render(account, callbacks);
          container.appendChild(node);
        });

        spinner.hide();
      });
  }

  onDetails(account) {
    const container = this.containers.logs;
    const template = this.templates.detail;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Details',
      path: `/accounts/${account.id}/details`,
    });

    spinner.show();

    this.client.getAccountDetails(account)
      .then(function(response) {
        return response.json();
      })
      .then(function(details) {
        container.prepend(template.render(details));
        container.prepend(header);

        spinner.hide();
      });
  }

  onBalances(account) {
    const container = this.containers.logs;
    const template = this.templates.balance;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Balances',
      path: `/accounts/${account.id}/balances`,
    });

    spinner.show();

    this.client.getAccountBalances(account)
      .then(function(response) {
        return response.json();
      })
      .then(function(balances) {
        container.prepend(template.render(balances));
        container.prepend(header);

        spinner.hide();
      });
  }

  onTransactions(account) {
    const container = this.containers.logs;
    const template = this.templates.transaction;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Transactions',
      path: `/accounts/${account.id}/transactions?count=30`,
    });

    spinner.show();

    this.client.listAccountTransactions(account)
      .then(function(response) {
        return response.json();
      })
      .then(function(transactions) {
        transactions.reverse().forEach(function(transaction) {
          container.prepend(template.render(transaction));
        });

        container.prepend(header);
        spinner.hide();
      });
  }

  onPayees(account) {
    const container = this.containers.logs;
    const template = this.templates.payee;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Payees',
      path: `/accounts/${account.id}/payments/zelle/payees`,
    });

    spinner.show();

    const onCreatePayment = this.onCreatePayment.bind(this);
    this.client.listAccountPayees(account)
      .then(function(response) {
        return response.json();
      })
      .then(function(payees) {
        payees.forEach(function(payee) {
          const callback = function() {
            onCreatePayment(account, payee);
          };
          container.prepend(template.render(payee, callback));
        });

        container.prepend(header);
        spinner.hide();
      });
  }

  onCreatePayee(account) {
    const container = this.containers.logs;
    const template = this.templates.payee;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'POST',
      name: 'Payees',
      path: `/accounts/${account.id}/payments/zelle/payees`,
    });

    spinner.show();

    const person = generatePerson();
    const payee = {
      name: person.name,
      type: 'person',
      address: {
        type: 'email',
        value: person.email,
      },
    };

    const enrollmentHandler = this;
    this.client.createAccountPayee(account, payee)
      .then(function(response) {
        return response.json();
      })
      .then(function(payee) {
        const callback = function() {
          enrollmentHandler.onCreatePayment(account, payee);
        };

        container.prepend(template.render(payee, callback));
        container.prepend(header);
        spinner.hide();
      });
  }

  onCreatePayment(account, payee) {
    const container = this.containers.logs;
    const template = this.templates.payment;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'POST',
      name: 'Payments',
      path: `/accounts/${account.id}/payments/zelle`,
    });

    spinner.show();

    const amount = Math.floor(Math.random() * 100);
    const payment = {
      payee_id: payee.id,
      amount: `${amount}.00`,
      memo: "Teller Test",
    };

    this.client.createAccountPayment(account, payment)
      .then(function(response) {
        container.prepend(template.render(payment, payee));
        container.prepend(header);
        spinner.hide();
      });
  }

  clear() {
    const parents = Object.values(this.containers);
    parents.forEach(function(parent) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
    });
  }
}

class UserHandler {
  constructor(labels) {
    this.labels = labels;
  }

  onEnrollment(enrollment) {
    this.labels.userId.textContent = enrollment.user.id;
    this.labels.accessToken.textContent = enrollment.accessToken;
  }

  clear() {
    const nodes = Object.values(this.labels);
    nodes.forEach(function(node) {
      node.textContent = 'not_available';
    });
  }
}

class LogTemplate {
  constructor(template) {
    this.template = template;
  }

  render(resource) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('.log .resource');
    const timestamp = node.querySelector('.log .timestamp');
    const http = node.querySelector('.log .http');

    name.textContent = resource.name;
    timestamp.textContent = new Date().toLocaleString();
    http.textContent = `${resource.method} ${resource.path}`;

    return node;
  }
}

class AccountTemplate {
  constructor(template) {
    this.template = template;
  }

  render(account, callbacks) {
    const node = this.template.content.cloneNode(true);

    const title = node.querySelector('.account .title');
    const institution = node.querySelector('.account .institution');
    const type = node.querySelector('.account .type');
    const subtype = node.querySelector('.account .subtype');
    const details = node.querySelector('.account .details');
    const balances = node.querySelector('.account .balances');
    const transactions = node.querySelector('.account .transactions');
    const payees = node.querySelector('.account .payees');
    const createPayee = node.querySelector('.account .create-payee');

    title.textContent = [account.name, account.last_four].join(', ');
    institution.textContent = account.institution.id;
    type.textContent = account.type;
    subtype.textContent = account.subtype;

    if (account.type == "depository") {
      details.addEventListener('click', function() {
        callbacks.onDetails(account);
      });
    } else {
      details.setAttribute('disabled', true);
    }

    balances.addEventListener('click', function() {
      callbacks.onBalances(account);
    });

    transactions.addEventListener('click', function() {
      callbacks.onTransactions(account);
    });

    if (account.subtype == 'checking') {
      payees.addEventListener('click', function() {
        callbacks.onPayees(account);
      });

      createPayee.addEventListener('click', function() {
        callbacks.onCreatePayee(account);
      });
    } else {
      payees.setAttribute('disabled', true);
      createPayee.setAttribute('disabled', true);
    }

    return node;
  }
}

class DetailTemplate {
  constructor(template) {
    this.template = template;
  }

  render(details) {
    const node = this.template.content.cloneNode(true);

    const number = node.querySelector('.detail .number');
    const ach = node.querySelector('.detail .ach');

    number.textContent = `${details.account_number}`;
    ach.textContent = `${details.routing_numbers.ach}`;

    return node;
  }
}

class BalanceTemplate {
  constructor(template) {
    this.template = template;
  }

  render(balances) {
    const node = this.template.content.cloneNode(true);

    const available = node.querySelector('.balance .available');
    const ledger = node.querySelector('.balance .ledger');

    available.textContent = `${balances.available}$`;
    ledger.textContent = `${balances.ledger}$`;

    return node;
  }
}

class TransactionTemplate {
  constructor(template) {
    this.template = template;
  }

  render(transaction) {
    const node = this.template.content.cloneNode(true);

    const description = node.querySelector('.transaction .description');
    const date = node.querySelector('.transaction .date');
    const amount = node.querySelector('.transaction .amount');

    description.textContent = transaction.description;
    date.textContent = transaction.date;
    amount.textContent = `${transaction.amount}$`;

    return node;
  }
}

class PayeeTemplate {
  constructor(template) {
    this.template = template;
  }

  render(payee, callback) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('.payee .name');
    const address = node.querySelector('.payee .address');
    const createPayment = node.querySelector('.payee .create-payment');

    name.textContent = payee.name;
    address.textContent = payee.address.value;
    createPayment.addEventListener('click', callback);

    return node;
  }
}

class PaymentTemplate {
  constructor(template) {
    this.template = template;
  }

  render(payment, payee) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('.payment .name');
    const amount = node.querySelector('.payment .amount');

    name.textContent = payee.name;
    amount.textContent = `${payment.amount}$`;

    return node;
  }
}

class StatusHandler {
  constructor(button) {
    this.connected = false;
    this.button = button;
  }

  onEnrollment(enrollment) {
    this.setConnected(true);
    this.button.textContent = 'Disconnect';
  }

  toggle(callbacks) {
    if (this.connected) {
      this.setConnected(false);
      this.button.textContent = 'Connect';

      callbacks.onDisconnect();
    } else {
      callbacks.onConnect();
    }
  }

  setConnected(connected) {
    this.connected = connected;
  }
}

class Spinner {
  constructor(parent) {
    this.parent = parent;
    this.node = document.createElement('div');
    this.node.classList.add('spinner');
  }

  show() {
    this.parent.prepend(this.node);
  }

  hide() {
    this.parent.removeChild(this.node);
  }
}

function generatePerson() {
  const pickRandom = function(choices) {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  const firstName = pickRandom([
    'William', 'James', 'Evelyn', 'Harper', 'Mason',
    'Ella', 'Jackson', 'Avery', 'Scarlett', 'Jack',
  ]);

  const middleLetter = pickRandom('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

  const lastName = pickRandom([
    'Adams', 'Wilson', 'Burton', 'Harris', 'Stevens',
    'Robinson', 'Lewis', 'Walker', 'Payne', 'Baker',
  ]);

  const username = (Math.random() + 1).toString(36).substring(2);

  return {
    name: `${firstName} ${middleLetter}. ${lastName}`,
    email: `${username}@teller.io`,
  }
}

document.addEventListener('DOMContentLoaded', function(event) {
  const containers = {
    accounts: document.getElementById('accounts'),
    logs: document.getElementById('logs'),
  };

  const templates = {
    log: new LogTemplate(document.getElementById('log-template')),
    account: new AccountTemplate(document.getElementById('account-template')),
    detail: new DetailTemplate(document.getElementById('detail-template')),
    balance: new BalanceTemplate(document.getElementById('balance-template')),
    transaction: new TransactionTemplate(document.getElementById('transaction-template')),
    payee: new PayeeTemplate(document.getElementById('payee-template')),
    payment: new PaymentTemplate(document.getElementById('payment-template')),
  };

  const labels = {
    userId: document.getElementById('user-id'),
    accessToken: document.getElementById('access-token'),
  };

  const store = new TellerStore();
  const client = new Client();
  const enrollmentHandler = new EnrollmentHandler(client, containers, templates);
  const userHandler = new UserHandler(labels);

  const connectButton = document.getElementById('teller-connect');
  const statusHandler = new StatusHandler(connectButton);

  const tellerConnect = TellerConnect.setup({
    applicationId: APPLICATION_ID,
    environment: ENVIRONMENT,
    onSuccess: function(enrollment) {
      store.putUser(enrollment.user);
      store.putEnrollment(enrollment);

      enrollmentHandler.onEnrollment(enrollment);
      userHandler.onEnrollment(enrollment);
      statusHandler.onEnrollment(enrollment);
    },
  });

  connectButton.addEventListener('click', function() {
    statusHandler.toggle({
      onConnect: function() {
        tellerConnect.open();
      },
      onDisconnect: function() {
        enrollmentHandler.clear();
        userHandler.clear();
        store.clear();
      },
    });
  });

  const enrollment = store.getEnrollment();
  if (enrollment) {
    enrollmentHandler.onEnrollment(enrollment);
    userHandler.onEnrollment(enrollment);
    statusHandler.onEnrollment(enrollment);
  }
})
