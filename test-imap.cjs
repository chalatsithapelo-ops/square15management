const Imap = require('imap');

const accounts = [
  { label: 'Finance', user: 'finance@square15.co.za', password: 'Chalatsi123#' },
  { label: 'Orders', user: 'orders@square15.co.za', password: 'Chalatsi123#' },
  { label: 'Quotes', user: 'quotes@square15.co.za', password: 'Chalatsi123#' },
];

async function testAccount(acct) {
  return new Promise((resolve) => {
    const c = new Imap({
      user: acct.user,
      password: acct.password,
      host: 'mail.square15.co.za',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 15000,
    });

    const timeout = setTimeout(() => {
      console.log(`[${acct.label}] TIMEOUT after 15s`);
      try { c.end(); } catch(e) {}
      resolve(false);
    }, 16000);

    c.once('ready', () => {
      c.openBox('INBOX', true, (err, box) => {
        clearTimeout(timeout);
        if (err) {
          console.log(`[${acct.label}] Connected but INBOX error: ${err.message}`);
        } else {
          console.log(`[${acct.label}] OK - ${box.messages.total} messages in INBOX`);
        }
        c.end();
        resolve(true);
      });
    });

    c.once('error', (err) => {
      clearTimeout(timeout);
      console.log(`[${acct.label}] ERROR: ${err.message}`);
      resolve(false);
    });

    c.connect();
  });
}

(async () => {
  for (const acct of accounts) {
    await testAccount(acct);
  }
  process.exit(0);
})();
