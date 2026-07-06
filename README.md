# Angatu Check-in System

Sistema de check-in para o Angatu Restaurante — identifica clientes recorrentes e novos, rastreia origem de campanhas e envia dados para o CRM via n8n.

---

## Requisitos

- Node.js 18+
- npm

---

## Instalação local

```bash
git clone https://github.com/expansivegrowthmkt-sys/angatu-system.git
cd angatu-system
npm install
cp .env.example .env
# editar .env com suas credenciais
node server.js
```

Acesse: `http://localhost:3000/checkin`

---

## Deploy na VPS (Ubuntu 22.04 + Nginx)

### 1. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clonar e instalar

```bash
cd /var/www
git clone https://github.com/expansivegrowthmkt-sys/angatu-system.git
cd angatu-system
npm install --production
cp .env.example .env
nano .env
```

### 3. Configurar PM2

```bash
sudo npm install -g pm2
pm2 start server.js --name angatu-checkin
pm2 save
pm2 startup
```

### 4. Nginx

```bash
sudo nano /etc/nginx/sites-available/angatu-checkin
```

Cole a config:

```nginx
server {
    listen 80;
    server_name checkin.angatu.com.br;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/angatu-checkin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d checkin.angatu.com.br
```

---

## Gerar QR Codes

```bash
# Configure BASE_URL no .env antes
node generate-qr.js
# QR Codes salvos em /public/qrcodes/
```

QR Codes gerados:
- `qr-meta.png` → `?utm_source=meta`
- `qr-google.png` → `?utm_source=google`
- `qr-instagram.png` → `?utm_source=instagram`
- `qr-organico.png` → `?utm_source=organico`
- `qr-walkin.png` → `?utm_source=walkin`

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/checkin` | Tela de check-in |
| POST | `/api/checkin/buscar` | Busca cliente por telefone |
| POST | `/api/checkin/novo` | Registra novo cliente |
| POST | `/api/checkin/recorrente` | Registra visita recorrente |

---

## Variáveis de ambiente

Ver `.env.example` para documentação completa.

---

## Estrutura

```
angatu-system/
├── server.js              # Entry point Express
├── routes/checkin.js      # Rotas de check-in
├── services/tabletcloud.js # Integração Tablet Cloud PDV
├── services/n8n.js        # Webhook n8n
├── middleware/rateLimit.js # Rate limiting
├── database/db.js         # SQLite — log local
├── public/checkin/        # Frontend mobile
└── generate-qr.js         # Gerador de QR Codes
```
