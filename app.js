const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const nodemailer = require('nodemailer');
require('dotenv').config();

const db = new sqlite3.Database('users.db', (err) => {
  if (err) {
    console.error('error connecting to db');
  }
});

const app = express();

app.set('view engine', 'ejs');

app.use(express.static('public'));

app.use(bodyParser.urlencoded());

app.listen(3000, () => {
  console.log('up and running');
});

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/sponsoren', (req, res) => {
  fs.readFile('sponsors.csv', 'utf8', (err, data) => {
    const lines = data
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '');

    const dataArr = lines.map((line) => {
      if (line.startsWith('--')) {
        return [line];
      } else {
        return line.split(',');
      }
    });

    console.log(dataArr);
    res.render('sponsors', { data: dataArr });
  });
});

app.get('/impressum', (req, res) => {
  res.render('impressum');
});

app.get('/privacy', (req, res) => {
  res.render('privacy');
});

app.get('/ticketverkauf', (req, res) => {
  let error = req.query.error;
  if (error) {
    console.log(error);
    res.render('stage1', { error });
  } else {
    res.render('stage1', { error: undefined });
  }
});

const checkID = (number) => {
  db.get('SELECT * FROM users WHERE referenz = ?', [number], (err, rows) => {
    if (!rows) {
      return 0;
    } else {
      return 1;
    }
  });
};

const sendBookingConfirmation = (email, ref) => {
  const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: process.env.acc,
      pass: process.env.pass,
    },
  });

  let template = `
Vielen Dank für Ihre Bestellung!

Sobald wir den Zahlungseingang verbuchen konnten, werden die Tickets innerhalb von 2-3 Werktagen an die von Ihnen angegebene E-Mail-Adresse (${email}) versendet.

Bitte überprüfen Sie auch Ihren Spam-Ordner, falls Sie nach Ablauf der Frist keine E-Mail erhalten haben.

Bei Fragen oder Problemen können Sie sich jederzeit an uns wenden.

Ihre Referenznummer lautet: ${ref}
`;

  const mailOptions = {
    from: 'paul.mondl@tfs-haslach.at',
    to: email,
    subject: `Wichtige Information zur Ticketzustellung`,
    text: template,
  };

  try {
    transporter.sendMail(mailOptions);
  } catch (err) {
    console.log(err);
    throw new Error('Error');
  }
};

app.post('/buy-ticket', (req, res) => {
  let { vorname, nachname, email, phone_number, ticket_count, address, plz } =
    req.body;

  let ref = Math.floor(Math.random() * 1000000);

  if (!checkID(ref)) {
    ref = Math.floor(Math.random() * 1000000);
  }

  try {
    sendBookingConfirmation(email, ref);
  } catch (error) {
    res.json({ message: 'Error bei der Bestellung' });
  }

  db.run(
    `INSERT INTO users (
      vorname, nachname, email, phone_number,
      adresse, plz, ticket_count, referenz
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [vorname, nachname, email, phone_number, address, plz, ticket_count, ref],
    function (err) {
      if (err) {
        console.error('Fehler beim Einfügen:', err.message);
        res.redirect('/ticketverkauf?error=Email+ist+bereits+registriert');
      } else {
        res.render('stage2', { ref });
      }
    }
  );
});

app.get('/kontakt', (req, res) => {
  res.render('kontakt');
});

app.post('/send-contact-form', (req, res) => {
  const { vorname, nachname, email, anliegen, message } = req.body;

  const to = 'leon.heitzinger@tfs-haslach.at';

  const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: process.env.acc,
      pass: process.env.pass,
    },
  });

  let template = `
    Email: ${email}
    Message: ${message}
  `;

  const mailOptions = {
    from: 'paul.mondl@tfs-haslach.at',
    to,
    subject: `${anliegen} von ${vorname} ${nachname}`,
    text: template,
  };

  try {
    transporter.sendMail(mailOptions);
    res.json({ message: 'success' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'nope' });
  }
});
