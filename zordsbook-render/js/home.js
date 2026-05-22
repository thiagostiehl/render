(async function initHome() {
  if (!isConfigured()) { window.location.href = "index.html"; return; }
  const currentUser = await requireAuth();
  if (!currentUser) return;

  document.body.dataset.page = "home";
  document.getElementById("topbar").innerHTML = renderTopbar("home", currentUser, 0);
  bindLogout();

  const NOW_PLAYING_URL = (window.ZORDSBOOK_CONFIG && window.ZORDSBOOK_CONFIG.NOW_PLAYING_URL) || "/api/now-playing";
  let allData = null;

  // ── Spotify connect ───────────────────────────────────────────────────────
  const connectUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${encodeURIComponent(window.ZORDSBOOK_CONFIG.SPOTIFY_CLIENT_ID)}&scope=${encodeURIComponent("user-read-currently-playing user-read-playback-state")}&redirect_uri=${encodeURIComponent((window.ZORDSBOOK_CONFIG.SITE_URL || "") + "/spotify/callback")}&state=${encodeURIComponent(currentUser.id)}&show_dialog=true`;

  // ── Sidebar ───────────────────────────────────────────────────────────────
  function renderSidebar() {
    const meInData = allData.userById[currentUser.id];
    const isSpotifyConnected = meInData ? meInData.spotify_connected : currentUser.spotify_connected;
    const spotifyBtn = isSpotifyConnected
      ? `<div style="background:#1DB954;color:#fff;padding:5px 10px;border-radius:3px;font-size:10px;font-weight:bold;display:inline-block;">✅ Spotify conectado</div>
         <br><a href="${connectUrl}" style="font-size:10px;color:#1DB954;">Reconectar</a>`
      : `<a href="${connectUrl}" style="background:#1DB954;color:#fff;padding:5px 10px;border-radius:3px;font-size:10px;font-weight:bold;text-decoration:none;display:inline-block;">🎵 Conectar Spotify</a>`;

    const friendIds = getMyFriendIds(allData.friendships, currentUser.id);
    const friends = friendIds.map(id => allData.userById[id]).filter(Boolean);

    document.getElementById("mini-profile").innerHTML = `
      <a href="profile.html"><img src="${avatarUrl(currentUser)}" alt=""></a>
      <p style="margin:6px 0 2px"><a href="profile.html"><strong>${currentUser.name}</strong></a></p>
      <p style="margin-bottom:6px">${spotifyBtn}</p>`;

    document.getElementById("friend-list").innerHTML = friends.length
      ? friends.map(f => `<li><img src="${avatarUrl(f)}" alt=""><a href="profile.html?user=${f.id}">${f.name}</a></li>`).join("")
      : `<li style="color:#90949c;font-size:10px">Adicione amigos na aba <a href="members.html">Membros</a>!</li>`;
  }

  // ── Now Playing – eu ──────────────────────────────────────────────────────
  function renderMyNowPlaying(np) {
    const container = document.getElementById("now-playing-status");
    if (!container) return;
    if (!np || !np.track_name) {
      container.innerHTML = `<h4>🎵 Agora tocando</h4>
        <p style="color:#90949c;font-size:10px">${np?.error === "no_token" ? 'Conecte o Spotify para exibir.' : 'Nenhuma faixa tocando.'}</p>`;
      return;
    }
    const artists = (np.artists || []).join(", ");
    const pct = np.duration_ms > 0 ? Math.min(100, Math.round(np.progress_ms / np.duration_ms * 100)) : 0;
    const bar = np.is_playing && pct > 0 ? `<div style="margin-top:5px;background:#ddd;border-radius:2px;height:3px;overflow:hidden"><div style="width:${pct}%;background:#1DB954;height:3px"></div></div>` : "";
    const img = np.album_image
      ? `<img src="${np.album_image}" style="width:52px;height:52px;border-radius:3px;flex-shrink:0;object-fit:cover;" alt="">`
      : `<div style="width:52px;height:52px;border-radius:3px;background:#1DB954;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;">🎵</div>`;
    container.innerHTML = `<h4>🎵 Agora tocando</h4>
      <div style="display:flex;gap:8px;align-items:center;margin-top:5px">
        ${np.track_url ? `<a href="${np.track_url}" target="_blank" rel="noreferrer">${img}</a>` : img}
        <div style="min-width:0;flex:1">
          <p style="font-weight:bold;font-size:11px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${np.track_url ? `<a href="${np.track_url}" target="_blank" rel="noreferrer" style="color:inherit;text-decoration:none">${np.track_name}</a>` : np.track_name}
          </p>
          <p style="font-size:10px;color:#555;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${artists}</p>
          <p style="font-size:10px;color:#90949c;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${np.album_name || ""}</p>
          ${bar}
        </div>
      </div>`;
  }

  // ── Now Playing – amigos ──────────────────────────────────────────────────
  function renderFriendsNowPlaying(list) {
    const container = document.getElementById("friends-playing");
    if (!container) return;
    if (!list.length) { container.innerHTML = ""; return; }
    container.innerHTML = `<div class="box" style="margin-top:0">
      <h3>Amigos ouvindo agora</h3>
      ${list.map(np => {
        const user = allData.userById[np.userId];
        if (!user) return "";
        const artists = (np.artists || []).join(", ");
        const img = np.album_image
          ? `<img src="${np.album_image}" style="width:36px;height:36px;border-radius:2px;object-fit:cover;flex-shrink:0" alt="">`
          : `<div style="width:36px;height:36px;border-radius:2px;background:#1DB954;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px">🎵</div>`;
        return `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #e9eaed">
          <img src="${avatarUrl(user)}" style="width:24px;height:24px;border-radius:2px" alt="">
          <div style="min-width:0;flex:1">
            <p style="font-size:10px;font-weight:bold;margin:0"><a href="profile.html?user=${user.id}" style="color:#365899">${user.name}</a></p>
            <div style="display:flex;gap:6px;align-items:center;margin-top:2px">
              ${np.track_url ? `<a href="${np.track_url}" target="_blank" rel="noreferrer">${img}</a>` : img}
              <div style="min-width:0">
                <p style="font-size:10px;font-weight:bold;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${np.track_url ? `<a href="${np.track_url}" target="_blank" rel="noreferrer" style="color:inherit;text-decoration:none">${np.track_name}</a>` : np.track_name}</p>
                <p style="font-size:10px;color:#90949c;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${artists}</p>
              </div>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  async function updateSpotify() {
    try {
      const [myNp, friendIds] = [
        await fetch(NOW_PLAYING_URL + "?user_id=" + currentUser.id, { cache: "no-store" }).then(r => r.json()),
        allData ? getMyFriendIds(allData.friendships, currentUser.id) : [],
      ];
      renderMyNowPlaying(myNp);
      if (friendIds.length && allData) {
        const friendsNp = await fetchFriendsNowPlaying(friendIds, NOW_PLAYING_URL);
        renderFriendsNowPlaying(friendsNp);
      }
    } catch (e) { console.warn("Spotify update error", e); }
  }

  // ── Feed (mural de amigos) ────────────────────────────────────────────────
  async function refreshFeed() {
    allData = await fetchCommunityData();
    renderSidebar();

    const friendIds = new Set(getMyFriendIds(allData.friendships, currentUser.id));
    friendIds.add(currentUser.id); // meus próprios posts também aparecem

    const feedPosts = allData.posts.filter(p => !p.communityId && friendIds.has(p.userId));
    const container = document.getElementById("feed-posts");

    if (feedPosts.length === 0) {
      container.innerHTML = `<p style="color:#90949c;padding:8px 0;font-size:11px">
        Nenhuma publicação ainda. Adicione amigos na aba <a href="members.html">Membros</a> para ver o mural deles!
      </p>`;
      return;
    }
    container.innerHTML = feedPosts.map(p => renderPost(p, allData, currentUser)).join("");
    bindPostActions(currentUser, refreshFeed);
  }

  // ── Composer ──────────────────────────────────────────────────────────────
  const LIMITE = 280;
  const postTextarea = document.getElementById("post-text");
  const postCounter = document.getElementById("post-counter");

  postTextarea.addEventListener("input", () => {
    const n = postTextarea.value.length;
    postCounter.textContent = `${n} / ${LIMITE} caracteres`;
    postCounter.classList.toggle("warning", n >= LIMITE - 20);
  });

  document.getElementById("form-post").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = postTextarea.value.trim();
    if (text.length > LIMITE) return;

    // Foto
    const imageInput = document.getElementById("post-image");
    const imageFile = imageInput?.files?.[0] || null;

    // YouTube: detecta no texto ou no campo dedicado
    const ytField = document.getElementById("post-youtube").value.trim();
    const ytId = extractYoutubeId(ytField) || extractYoutubeId(text);

    if (!text && !imageFile && !ytId) return;

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadPostImage(currentUser.id, imageFile);
      }
      await createPost(currentUser.id, text, null, imageUrl, ytId || null);

      postTextarea.value = "";
      postCounter.textContent = `0 / ${LIMITE} caracteres`;
      if (imageInput) imageInput.value = "";
      document.getElementById("post-youtube").value = "";
      document.getElementById("post-image-preview").innerHTML = "";
      await refreshFeed();
    } catch (err) {
      console.error(err);
      alert("Não foi possível publicar: " + (err.message || err));
    } finally {
      btn.disabled = false;
    }
  });

  // Preview da imagem antes de publicar
  document.getElementById("post-image")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById("post-image-preview");
    if (!preview) return;
    if (file) {
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:200px;border-radius:3px;margin-top:6px;" alt="preview">
        <button type="button" id="btn-remove-image" class="btn-link" style="display:block;margin-top:4px;font-size:10px;color:#e74c3c;">✕ Remover</button>`;
      document.getElementById("btn-remove-image").addEventListener("click", () => {
        e.target.value = "";
        preview.innerHTML = "";
      });
    } else {
      preview.innerHTML = "";
    }
  });

  // ── Spotify callback toast ────────────────────────────────────────────────
  function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);
    const sp = params.get("spotify");
    if (!sp) return;
    window.history.replaceState({}, "", window.location.pathname);
    const toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);color:#fff;padding:12px 24px;border-radius:6px;font-weight:bold;z-index:9999;font-size:12px";
    if (sp === "connected") { toast.style.background = "#1DB954"; toast.textContent = "✅ Spotify conectado!"; }
    else { toast.style.background = "#e74c3c"; toast.textContent = `⚠️ Falha ao conectar Spotify (${params.get("reason") || "erro"})`; }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  try {
    handleSpotifyCallback();
    await refreshFeed();
    await initNotifications(currentUser);
    await updateSpotify();
    setInterval(updateSpotify, 30000);
  } catch (err) {
    console.error(err);
    document.getElementById("feed-posts").innerHTML = '<p class="error-msg">Erro ao carregar.</p>';
  }
})();
