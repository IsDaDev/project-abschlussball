const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser')
const sqlite3 = require('sqlite3')

const db = new sqlite3.Database('users.db', (err) => {
  if (err) {
    console.error('error connecting to db')
  }
})

const app = express();

app.set('view engine', 'ejs');

app.use(express.static('public'));

app.use(bodyParser.urlencoded())

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
  let error = req.query.error
  if (error) {
    console.log(error)
    res.render('stage1', {error})
  } else {
    res.render('stage1', {error: undefined})
  }
  
})

const checkID = (number) => {
    db.get('SELECT * FROM users WHERE referenz = ?', [number], (err, rows) => {
      if (!rows) {
        return 0
      } else {
        return 1
      }
    })
    
}

app.post('/buy-ticket', (req, res) => {
  let { vorname, nachname, email, phone_number, ticket_count, address, plz } = req.body;

  console.log('Body: ' ,req.body)

  let ref = Math.floor(Math.random() * 1000000);

  if (!checkID(ref)) {
    ref = Math.floor(Math.random() * 1000000);
  }

  db.run(
    `INSERT INTO users (
      vorname, nachname, email, phone_number,
      adresse, plz, ticket_count, referenz
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      vorname,
      nachname,
      email,
      phone_number,
      address,
      plz,
      ticket_count,
      ref
    ],
    function (err) {
      if (err) {
        console.error('Fehler beim Einfügen:', err.message);
        res.redirect('/ticketverkauf?error=Email+ist+bereits+registriert')
      } else {
        res.render('stage2', {ref})
      }
    }
  );
})

app.get('/kontakt', (req, res) => {
  res.render('kontakt')
})