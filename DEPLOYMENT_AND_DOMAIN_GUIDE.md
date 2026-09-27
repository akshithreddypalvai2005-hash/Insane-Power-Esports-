# INSANE POWER ESPORTS - DOMAIN PURCHASE & DEPLOYMENT GUIDE

This guide provides step-by-step instructions to buy a domain (e.g. `insanepoweresports.in`), deploy your Full-Stack website for free on Vercel / Render / Railway, link your custom domain with free automatic SSL (HTTPS), and configure Google Sign-In.

---

## 🌐 PART 1: HOW TO BUY A DOMAIN (.in / .com)

### Recommended Domain Registrars:
1. **Hostinger India** (Recommended for `.in` — around ₹399/year with UPI / RuPay payment support)
2. **GoDaddy India** (Accepts UPI, Netbanking, Cards)
3. **Namecheap** (Great for `.com`)

### Step-by-Step Purchase:
1. Visit [Hostinger.in](https://www.hostinger.in/domain-name-search) or [GoDaddy.in](https://www.godaddy.com/en-in/domains).
2. Search for available names, for example:
   - `insanepoweresports.in`
   - `insanepower.in`
   - `ipesports.in`
   - `insanepoweresports.com`
3. Add to cart and select **1 Year**.
4. Uncheck unnecessary add-ons like email hosting or website builders (unless you need them).
5. Complete payment using UPI, Credit/Debit card, or Net Banking.
6. Once purchased, you will have access to the **DNS Management** panel in your registrar dashboard.

---

## 🚀 PART 2: DEPLOYING THE WEBSITE (FREE 24/7 HOSTING)

### Method A: Deploy on Vercel (Fastest & Free)
1. Initialize a Git repository in `C:\Users\akshi\OneDrive\Desktop\Ip web` (or upload to GitHub):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Insane Power Esports Weekly Wars"
   ```
2. Create a new repository on [GitHub.com](https://github.com) named `insane-power-web` and push your code:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/insane-power-web.git
   git branch -M main
   git push -u origin main
   ```
3. Go to [Vercel.com](https://vercel.com) and log in with your GitHub account.
4. Click **"Add New..."** &rarr; **"Project"**.
5. Select your `insane-power-web` repository.
6. Click **Deploy**. Vercel will automatically detect `vercel.json` and deploy your Node.js backend and frontend in under 60 seconds!
7. You will receive a live URL like `https://insane-power-web.vercel.app`.

---

### Method B: Deploy on Render.com (Full-Stack Web Service)
1. Go to [Render.com](https://render.com) and sign up for free.
2. Click **"New +"** &rarr; **"Web Service"**.
3. Connect your GitHub repository.
4. Set:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **"Create Web Service"**.

---

## 🔗 PART 3: CONNECTING YOUR CUSTOM DOMAIN

Once your website is deployed on Vercel or Render:

### In Vercel:
1. In your Vercel project dashboard, go to **Settings** &rarr; **Domains**.
2. Type your purchased domain (e.g. `insanepoweresports.in`) and click **Add**.
3. Vercel will give you the exact DNS records to enter in your domain registrar:
   - **Type A Record**:
     - **Name / Host**: `@`
     - **Value / IP**: `76.76.21.21`
   - **CNAME Record** (for www subdomain):
     - **Name / Host**: `www`
     - **Value**: `cname.vercel-dns.com`

### In Hostinger / GoDaddy (DNS Panel):
1. Open Hostinger/GoDaddy and go to **Manage Domain** &rarr; **DNS / Nameservers**.
2. Add or edit the records:
   | Type | Name / Host | Value / Target | TTL |
   |------|-------------|----------------|-----|
   | `A` | `@` | `76.76.21.21` | `300` or `Auto` |
   | `CNAME` | `www` | `cname.vercel-dns.com` | `300` or `Auto` |
3. Save changes. DNS propagation takes between 5 minutes and 24 hours. Vercel automatically generates and renews a free **SSL certificate (HTTPS 🔒)**.

---

## 🔑 PART 4: CONFIGURING GOOGLE SIGN-IN FOR PRODUCTION

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Insane Power Esports`.
3. Go to **APIs & Services** &rarr; **OAuth consent screen**.
   - User Type: **External**
   - App Name: `Insane Power Esports`
   - User Support Email: your email
4. Go to **Credentials** &rarr; **Create Credentials** &rarr; **OAuth client ID**.
   - Application Type: **Web application**
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://your-vercel-domain.vercel.app`
     - `https://insanepoweresports.in`
     - `https://www.insanepoweresports.in`
5. Copy your **Client ID** and update `client_id` in `js/app.js` and `.env`.

---

## 💻 PART 5: LOCAL TESTING & DEVELOPMENT

To run the full-stack server on your local machine:
```bash
# In directory: C:\Users\akshi\OneDrive\Desktop\Ip web
npm start
```
Then open your browser at:
`http://localhost:3000`
