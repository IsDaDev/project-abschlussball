const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const nodemailer = require("nodemailer");
require("dotenv").config();

const db = new sqlite3.Database("users.db", (err) => {
  if (err) {
    console.error("error connecting to db");
  }
});

const cookieParser = require("cookie-parser");

const app = express();

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(cookieParser());
app.use(bodyParser.urlencoded());

app.listen(3001, () => {
  console.log("up and running");
});

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/sponsoren", (req, res) => {
  fs.readFile("sponsors.csv", "utf8", (err, data) => {
    const lines = data
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");

    const dataArr = lines.map((line) => {
      if (line.startsWith("--")) {
        return [line];
      } else {
        return line.split(",");
      }
    });

    res.render("sponsors", { data: dataArr });
  });
});

app.get("/impressum", (req, res) => {
  res.render("impressum");
});

app.get("/privacy", (req, res) => {
  res.render("privacy");
});

app.get("/ticketverkauf", (req, res) => {
  let error = req.query.error;
  if (error) {
    console.log(error);
    res.render("stage1", { error });
  } else {
    res.render("stage1", { error: undefined });
  }
});

const checkID = (number) => {
  db.get("SELECT * FROM users WHERE referenz = ?", [number], (err, rows) => {
    if (!rows) {
      return 0;
    } else {
      return 1;
    }
  });
};

const sendBookingConfirmation = (email, ref, body) => {
  const transporter = nodemailer.createTransport({
    service: "outlook",
    auth: {
      user: process.env.acc,
      pass: process.env.pass,
    },
  });

  let templateUser = `
Vielen Dank für Ihre Bestellung!

Sobald wir den Zahlungseingang verbuchen konnten, werden die Tickets innerhalb von 2-3 Werktagen an die von Ihnen angegebene E-Mail-Adresse (${email}) versendet.

Bitte überprüfen Sie auch Ihren Spam-Ordner, falls Sie nach Ablauf der Frist keine E-Mail erhalten haben.

Bei Fragen oder Problemen können Sie sich jederzeit an uns wenden.

Ihre Referenznummer lautet: ${ref}
`;

  const templateAdmin = `
Neue Bestellung von ${body.vorname} ${body.nachname}!

Anzahl der Tickets: ${body.ticket_count}
Email: ${body.email}
Nummer: ${body.phone_number}
Adresse: ${body.address}
PLZ: ${body.plz}
Ref.Nr: ${ref}

Datum der Bestellung: ${new Date().toLocaleString()}
`;

  const mailOptionsUser = {
    from: "paul.mondl@tfs-haslach.at",
    to: email,
    subject: `Wichtige Information zur Ticketzustellung`,
    text: templateUser,
  };

  const mailOptionsAdmin = {
    from: "paul.mondl@tfs-haslach.at",
    to: "paul.mondl@tfs-haslach.at, leon.heitzinger@tfs-haslach.at",
    subject: "Neue Ticketbestellung",
    text: templateAdmin,
  };

  try {
    transporter.sendMail(mailOptionsUser);
    transporter.sendMail(mailOptionsAdmin);
  } catch (err) {
    console.log(err);
    throw new Error("Error");
  }
};

app.post("/buy-ticket", (req, res) => {
  let { vorname, nachname, email, phone_number, ticket_count, address, plz } =
    req.body;

  let ref = Math.floor(Math.random() * 1000000);

  if (!checkID(ref)) {
    ref = Math.floor(Math.random() * 1000000);
  }

  db.run(
    `INSERT INTO users (
    vorname, nachname, email, phone_number,
    adresse, plz, ticket_count, referenz
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [vorname, nachname, email, phone_number, address, plz, ticket_count, ref],
    function (err) {
      if (err) {
        console.error("Fehler beim Einfügen:", err.message);
        res.redirect("/ticketverkauf?error=Fehler+beim+Einfügen");
        return;
      }

      try {
        sendBookingConfirmation(email, ref, req.body);
      } catch (error) {
        console.error("Fehler beim Senden der Bestätigung:", error.message);
        res.json({ message: "Error bei der Bestellung" });
        return;
      }

      res.cookie("ref", ref);
      const amount = ticket_count * 19;
      res.render("stage2", { ref, amount });
    }
  );
});

app.get("/konto-informationen", (req, res) => {
  const ref =
    req.cookies.ref ||
    "Füll das Bestellformular um deinen Zahlungszweck zu generieren";

  res.render("stage2", { ref: ref, amount: undefined });
});

app.get("/kontakt", (req, res) => {
  let status = undefined;
  console.log(req.query.status);
  if (req.query.status) {
    status = req.query.status;
  }
  res.render("kontakt", { status: status, color: req.query.color });
});

app.post("/send-contact-form", (req, res) => {
  const { vorname, nachname, email, anliegen, message } = req.body;

  const to = "leon.heitzinger@tfs-haslach.at";

  const transporter = nodemailer.createTransport({
    service: "outlook",
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
    from: "paul.mondl@tfs-haslach.at",
    to,
    subject: `${anliegen} von ${vorname} ${nachname}`,
    text: template,
  };

  try {
    transporter.sendMail(mailOptions);
    res.redirect("/kontakt?status=Nachricht+gesendet&color=green");
  } catch (err) {
    console.log(err);
    res.redirect("/kontakt?status=Fehler+beim+senden+der+Nachricht&color=red");
  }
});

app.get("/jugendschutz", (req, res) => {
  res.render("jugendschutz");
});
