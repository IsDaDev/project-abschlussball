const express = require('express');
const fs = require('fs');

const app = express();

app.set('view engine', 'ejs');

app.use(express.static('public'));

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
