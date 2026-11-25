const express = require('express');

const app = express();
const NAME = process.env.NAME || 'app';
const links = new Map();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ app: 'ShortLink', server: NAME });
});

app.post('/shorten', (req, res) => {
  const longUrl = req.query.url;
  if (!longUrl) return res.status(400).json({ error: 'url is required' });
  const code = Math.random().toString(36).slice(2, 8);
  links.set(code, longUrl);
  res.status(201).json({ short: `localhost:8080/${code}`, server: NAME });
});

app.get('/:code', (req, res) => {
  const longUrl = links.get(req.params.code);
  if (!longUrl) return res.status(404).json({ error: 'link not found', server: NAME });
  res.redirect(longUrl);
});

app.listen(3000, () => console.log(`${NAME} listening on 3000`));
