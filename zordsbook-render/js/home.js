(async function initHome() {
  if (!isConfigured()) {
    window.location.href = "index.html";
    return;
  }

  const currentUser = await requireAuth();
  if (!currentUser) return;

  document.getElementById("topbar").innerHTML = renderTopbar("home", currentUser);
  bindLogout();

  let communityData = null;
  let selectedCommunityId = null;

  async function loadCommunity() {
    communityData = await fetchCommunityData();
    selectedCommunityId = communityData.selectedCommunityId;
    return communityData;
  }

  function renderSidebar() {
    const members = communityData.users.filter((u) => u.id !== currentUser.id);

    const connectUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${encodeURIComponent(window.ZORDSBOOK_CONFIG.SPOTIFY_CLIENT_ID)}&scope=${encodeURIComponent('user-read-currently-playing user-read-playback-state')}&redirect_uri=${encodeURIComponent((window.ZORDSBOOK_CONFIG.SITE_URL || '') + '/spotify/callback')}&state=${encodeURIComponent(currentUser.id)}&show_dialog=true`;

    // Verifica usuário atual nos dados da comunidade (tem spotify_connected atualizado)
    const meInData = communityData.userById[currentUser.id];
    const isSpotifyConnected = meInData ? meInData.spotify_connected : currentUser.spotify_connected;

    const spotifyBtn = isSpotifyConnected
      ? `<span style="background:#1DB954;color:white;padding:6px 12px;border-radius:4px;display:inline-block;font-size:12px;">
           ✅ Spotify conectado
         </span>
         <br><a href="${connectUrl}" style="font-size:11px;color:#1DB954;margin-top:4px;display:inline-block;">Reconectar</a>`
      : `<a class="btn-small" href="${connectUrl}" style="background:#1DB954;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;display:inline-block;">
           🎵 Conectar Spotify
         </a>`;

    document.getElementById("mini-profile").innerHTML = `
      <a href="profile.html">
        <img src="${avatarUrl(currentUser)}" alt="">
      </a>
      <p><a href="profile.html"><strong>${currentUser.name}</strong></a></p>
      <p style="margin-top:6px">${spotifyBtn}</p>
    `;

    document.getElementById("friend-list").innerHTML = members.length
      ? members
          .map((f) => `
        <li>
          <img src="${avatarUrl(f)}" alt="">
          <a href="profile.html?user=${f.id}">${f.name}</a>
        </li>
      `)
          .join("")
      : "<li style='color:#90949c'>Seja o primeiro da turma!</li>";
  }

  const NOW_PLAYING_URL = (window.ZORDSBOOK_CONFIG && window.ZORDSBOOK_CONFIG.NOW_PLAYING_URL) || "/api/now-playing";

  function renderNowPlaying(nowPlaying) {
    const container = document.getElementById("now-playing-status");
    if (!container) return;

    if (!nowPlaying || !nowPlaying.track_name) {
      const isNoToken = nowPlaying?.error === 'no_token';
      container.innerHTML = `
        <h4>🎵 Agora tocando</h4>
        <p class="now-playing-loading" style="color:#90949c;font-size:13px">
          ${isNoToken ? 'Conecte sua conta Spotify para ver o que está tocando.' : 'Nenhuma faixa tocando no momento.'}
        </p>
      `;
      return;
    }

    const artists = (nowPlaying.artists || []).join(", ");
    const albumImg = nowPlaying.album_image
      ? `<img src="${nowPlaying.album_image}" alt="Capa" style="width:56px;height:56px;border-radius:4px;flex-shrink:0;object-fit:cover;">`
      : `<div style="width:56px;height:56px;border-radius:4px;flex-shrink:0;background:#1DB954;display:flex;align-items:center;justify-content:center;font-size:24px;">🎵</div>`;

    const progressPct = nowPlaying.duration_ms > 0
      ? Math.min(100, Math.round((nowPlaying.progress_ms / nowPlaying.duration_ms) * 100))
      : 0;

    const progressBar = nowPlaying.is_playing && progressPct > 0 ? `
      <div style="margin-top:6px;background:#ddd;border-radius:3px;height:3px;overflow:hidden;">
        <div style="width:${progressPct}%;background:#1DB954;height:3px;border-radius:3px;"></div>
      </div>` : '';

    container.innerHTML = `
      <h4>🎵 Agora tocando</h4>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
        ${nowPlaying.track_url
          ? `<a href="${nowPlaying.track_url}" target="_blank" rel="noreferrer" style="display:block;">${albumImg}</a>`
          : albumImg}
        <div style="min-width:0;flex:1;">
          <p class="now-playing-track" style="font-weight:bold;font-size:13px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${nowPlaying.track_name}">
            ${nowPlaying.track_url
              ? `<a href="${nowPlaying.track_url}" target="_blank" rel="noreferrer" style="color:inherit;text-decoration:none;">${nowPlaying.track_name}</a>`
              : nowPlaying.track_name}
          </p>
          <p class="now-playing-artist" style="font-size:12px;color:#555;margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${artists || "Artista desconhecido"}</p>
          <p class="now-playing-album" style="font-size:11px;color:#90949c;margin:1px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nowPlaying.album_name || ""}</p>
          ${progressBar}
        </div>
      </div>
    `;
  }

  async function updateNowPlaying() {
    const container = document.getElementById("now-playing-status");
    if (!container) return;

    try {
      const response = await fetch(NOW_PLAYING_URL + '?user_id=' + currentUser.id, { 
        cache: "no-store" 
      });

      if (!response.ok) throw new Error("Erro ao carregar");

      const data = await response.json();
      renderNowPlaying(data);
    } catch (error) {
      container.innerHTML = `
        <h4>Agora tocando</h4>
        <p class="now-playing-loading">Erro ao carregar Spotify.<br><small>Verifique sua conexão ou se já conectou a conta.</small></p>
      `;
    }
  }

  async function startSpotifyAuth() {
    if (!window.ZORDSBOOK_CONFIG.SPOTIFY_CLIENT_ID) {
      alert('SPOTIFY_CLIENT_ID não configurado!');
      return;
    }

    const redirectUri = window.ZORDSBOOK_CONFIG.SITE_URL + '/spotify/callback';

    const authUrl = 'https://accounts.spotify.com/authorize?' +
      'response_type=code' +
      `&client_id=${encodeURIComponent(window.ZORDSBOOK_CONFIG.SPOTIFY_CLIENT_ID)}` +
      `&scope=${encodeURIComponent('user-read-currently-playing user-read-playback-state')}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(currentUser.id)}`;

    window.location.href = authUrl;
  }

  // --- Refresh Feed ---
  async function refreshFeed() {
    await loadCommunity();
    renderSidebar();

    renderCommunityTabs(communityData.communities, selectedCommunityId, async (id) => {
      setSelectedCommunityId(id);
      selectedCommunityId = id;
      await refreshFeed();
    });

    const active = communityData.communityById[selectedCommunityId];
    const feedTitle = document.getElementById("feed-title");
    if (feedTitle && active) {
      feedTitle.textContent = `Mural — ${active.name}`;
    }

    const posts = getFeedPosts(communityData, selectedCommunityId);
    const container = document.getElementById("feed-posts");

    if (posts.length === 0) {
      container.innerHTML = '<p style="color:#90949c;padding:8px 0">Nenhuma publicação nesta comunidade ainda. Seja o primeiro!</p>';
      return;
    }

    container.innerHTML = posts
      .map((p) => renderPost(p, communityData, currentUser))
      .join("");
    bindPostActions(currentUser, refreshFeed);
  }

  const LIMITE_CARACTERES = 280;
  const postTextarea = document.getElementById("post-text");
  const postCounter = document.getElementById("post-counter");

  function atualizarContador() {
    const quantidade = postTextarea.value.length;
    postCounter.textContent = `${quantidade} / ${LIMITE_CARACTERES} caracteres`;

    if (quantidade >= LIMITE_CARACTERES - 20) {
      postCounter.classList.add("warning");
    } else {
      postCounter.classList.remove("warning");
    }
  }

  postTextarea.addEventListener("input", atualizarContador);
  atualizarContador();

  document.getElementById("form-post").addEventListener("submit", async (e) => {
    e.preventDefault();
    const textarea = document.getElementById("post-text");
    const text = textarea.value.trim();
    if (!text) return;

    if (text.length > LIMITE_CARACTERES) {
      alert("Seu status é longo demais. Resuma um pouco.");
      return;
    }

    if (!selectedCommunityId) {
      alert("Escolha uma comunidade acima.");
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await createPost(currentUser.id, text, selectedCommunityId);
      textarea.value = "";
      atualizarContador();
      await refreshFeed();
    } catch (err) {
      alert("Não foi possível publicar. Verifique sua conexão.");
    } finally {
      btn.disabled = false;
    }
  });

  // Tratamento do retorno do Spotify OAuth
  function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get('spotify');
    if (!spotifyParam) return;

    // Limpa a URL sem recarregar
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (spotifyParam === 'connected') {
      const toast = document.createElement('div');
      toast.textContent = '✅ Spotify conectado com sucesso!';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1DB954;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.3);';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    } else if (spotifyParam === 'error') {
      const reason = params.get('reason') || 'desconhecido';
      const toast = document.createElement('div');
      toast.textContent = `⚠️ Falha ao conectar Spotify (${reason}). Tente novamente.`;
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#e74c3c;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.3);';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
    }
  }

  // Inicialização
  try {
    handleSpotifyCallback();
    await refreshFeed();
    await updateNowPlaying();
    setInterval(updateNowPlaying, 30000);
  } catch (err) {
    console.error(err);
    document.getElementById("feed-posts").innerHTML =
      '<p class="error-msg">Erro ao carregar. Verifique o console.</p>';
  }
})();