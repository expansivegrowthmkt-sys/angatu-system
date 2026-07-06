require('dotenv').config();
const QRCode = require('qrcode');
const path   = require('path');
const fs     = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR  = path.join(__dirname, 'public', 'qrcodes');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const fontes = [
  { source: 'meta',      label: 'Meta Ads' },
  { source: 'google',    label: 'Google Ads' },
  { source: 'instagram', label: 'Instagram' },
  { source: 'organico',  label: 'Orgânico' },
  { source: 'walkin',    label: 'Walk-in' },
];

const opts = {
  width:           400,
  margin:          2,
  color: { dark: '#2D5A27', light: '#F9F4EC' },
  errorCorrectionLevel: 'H',
};

(async () => {
  for (const f of fontes) {
    const url  = `${BASE_URL}/checkin?utm_source=${f.source}`;
    const file = path.join(OUT_DIR, `qr-${f.source}.png`);
    await QRCode.toFile(file, url, opts);
    console.log(`✅ ${f.label}: ${file}`);
  }
  console.log('\nQR Codes gerados em /public/qrcodes/');
})();
