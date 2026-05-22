# ZordsBook — Deploy no Render

## O que mudou (Netlify → Render)

O servidor Flask (`spotify_server.py`) agora faz tudo:
- Serve os arquivos estáticos (HTML, CSS, JS)
- Rota `/spotify/callback` — troca o code OAuth pelo refresh_token e salva no Supabase
- Rota `/api/now-playing` — busca a música tocando do usuário
- Rota `/health` — health check

---

## Passo a passo

### 1. Crie o Web Service no Render

1. Acesse [render.com](https://render.com) → **New → Web Service**
2. Conecte seu repositório GitHub (ou faça upload do zip)
3. Configure:
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn spotify_server:app`

### 2. Configure as variáveis de ambiente no Render

No painel do Web Service → **Environment**:

| Variável | Valor |
|---|---|
| `SPOTIPY_CLIENT_ID` | Client ID do app Spotify |
| `SPOTIPY_CLIENT_SECRET` | Client Secret do app Spotify |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role do Supabase |
| `SITE_URL` | URL do seu Render sem barra final (ex: `https://zordsbook.onrender.com`) |

### 3. Atualize o js/config.js

Substitua `SEU-APP` pelo nome real do seu serviço Render:

```js
SITE_URL: "https://zordsbook.onrender.com",
NOW_PLAYING_URL: "https://zordsbook.onrender.com/api/now-playing",
```

### 4. Configure o app no Spotify Developer

No [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):
- Abra seu app → **Edit Settings**
- Em **Redirect URIs**, adicione:
  ```
  https://SEU-APP.onrender.com/spotify/callback
  ```
- Remova a antiga URL do Netlify (se ainda estiver lá)

### 5. Configure o Supabase

No Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://SEU-APP.onrender.com`
- **Redirect URLs:** adicione `https://SEU-APP.onrender.com/**`

---

## Estrutura de rotas

```
GET  /                     → index.html (login)
GET  /home.html            → feed principal
GET  /profile.html         → perfil
GET  /reset-password.html  → redefinir senha
GET  /spotify/callback     → OAuth Spotify (troca code → refresh_token)
GET  /api/now-playing      → música tocando agora
GET  /health               → health check
```

---

## Observação sobre o plano gratuito do Render

O serviço gratuito "dorme" após 15 min sem uso. A primeira requisição após o sleep demora ~30s.
Para evitar isso, faça upgrade para o plano Starter ($7/mês) ou use um serviço de ping externo.
