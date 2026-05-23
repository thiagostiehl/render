(async function initProfile() {
  if (!isConfigured()) { window.location.href = "index.html"; return; }
  const currentUser = await requireAuth();
  if (!currentUser) return;

  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("user") || currentUser.id;

  let allData = await fetchCommunityData();
  let profileUser = allData.userById[profileId];

  if (!profileUser) { window.location.href = "home.html"; return; }

  const isOwnProfile = profileUser.id === currentUser.id;

  document.body.dataset.page = "profile";
  document.getElementById("topbar").innerHTML = renderTopbar("profile", currentUser, 0);
  bindLogout();
  document.title = `${profileUser.name} — ZordsBook`;
  // Meta description dinâmica (SEO / compartilhamento)
  let metaDesc = document.querySelector("meta[name=description]");
  if (!metaDesc) { metaDesc = document.createElement("meta"); metaDesc.name = "description"; document.head.appendChild(metaDesc); }
  metaDesc.content = profileUser.bio ? `${profileUser.name}: ${profileUser.bio}` : `Perfil de ${profileUser.name} no ZordsBook`;

  // ── Capa ──────────────────────────────────────────────────────────────────
  function renderCover() {
    const coverEl = document.getElementById("profile-cover");
    const uploadHtml = isOwnProfile
      ? `<div class="profile-upload-cover"><label class="btn btn-small btn-upload">Trocar capa<input type="file" id="cover-file" accept="image/*" hidden></label></div>`
      : "";
    if (profileUser.cover) {
      coverEl.style.cssText = "position:relative;";
      coverEl.innerHTML = `<img src="${profileUser.cover}" alt="" style="width:100%;height:200px;object-fit:cover;display:block">${uploadHtml}`;
    } else {
      coverEl.style.cssText = "position:relative;min-height:200px;background:#3b5998;";
      coverEl.innerHTML = uploadHtml;
    }
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  function renderAvatar() {
    document.getElementById("profile-avatar").src = avatarUrl(profileUser);
    if (isOwnProfile) document.getElementById("upload-avatar-wrap").style.display = "inline-block";
  }

  // ── Botão de amizade ──────────────────────────────────────────────────────
  function renderFriendButton() {
    const wrap = document.getElementById("friend-action-wrap");
    if (!wrap || isOwnProfile) return;
    const rel = getFriendshipStatus(allData.friendships, currentUser.id, profileUser.id);
    if (!rel) {
      wrap.innerHTML = `<button class="btn" id="btn-add-friend">+ Adicionar amigo</button>`;
      document.getElementById("btn-add-friend").addEventListener("click", async (e) => {
        e.target.disabled = true;
        try { await sendFriendRequest(profileUser.id, currentUser.id); allData = await fetchCommunityData(); renderFriendButton(); }
        catch (err) { alert("Erro ao enviar solicitação."); e.target.disabled = false; }
      });
    } else if (rel.status === "pending" && rel.iRequested) {
      wrap.innerHTML = `<span style="color:#90949c;font-size:11px">Solicitação enviada</span>`;
    } else if (rel.status === "pending" && !rel.iRequested) {
      wrap.innerHTML = `<button class="btn btn-small" id="btn-accept-friend">Aceitar amizade</button>`;
      document.getElementById("btn-accept-friend").addEventListener("click", async (e) => {
        e.target.disabled = true;
        try { await acceptFriendRequest(rel.id, profileUser.id, currentUser.id); allData = await fetchCommunityData(); renderFriendButton(); }
        catch (err) { alert("Erro."); e.target.disabled = false; }
      });
    } else if (rel.status === "accepted") {
      wrap.innerHTML = `<span style="color:#5b9a3f;font-weight:bold;font-size:11px">✓ Amigos</span>
        <button class="btn-link" id="btn-remove-friend" style="font-size:10px;color:#90949c;margin-left:10px;background:none;border:none;cursor:pointer">Remover amizade</button>`;
      document.getElementById("btn-remove-friend").addEventListener("click", async () => {
        if (!confirm("Remover amizade?")) return;
        try { await removeFriendship(rel.id); allData = await fetchCommunityData(); renderFriendButton(); }
        catch (err) { alert("Erro."); }
      });
    }
  }

  renderCover();
  renderAvatar();
  document.getElementById("profile-name").textContent = profileUser.name;
  document.getElementById("profile-bio").textContent = profileUser.bio || "Sem informações na bio ainda.";
  renderFriendButton();
  renderProfileStats();

  // ── Sobre + Bio edit ──────────────────────────────────────────────────────
  document.getElementById("profile-about").innerHTML = `
    <h3>Sobre</h3>
    <p style="font-size:11px;line-height:1.5">${profileUser.bio || "Este usuário ainda não preencheu a bio."}</p>
    ${isOwnProfile ? `
      <form id="form-bio" style="margin-top:10px">
        <div class="form-group">
          <label>Editar bio</label>
          <textarea id="bio-input">${profileUser.bio || ""}</textarea>
        </div>
        <button type="submit" class="btn btn-small">Salvar bio</button>
      </form>` : ""}`;

  // ── Estatísticas do perfil ──────────────────────────────────────────────
  function renderProfileStats() {
    const friendCount = getMyFriendIds(allData.friendships, profileUser.id).length;
    const commCount = allData.communities.filter(c =>
      allData.communityMembers.some(m => m.community_id === c.id && m.user_id === profileUser.id)
    ).length;
    const postCount = allData.posts.filter(p => p.userId === profileUser.id && !p.communityId).length;
    const statsEl = document.getElementById("profile-stats");
    if (statsEl) {
      statsEl.innerHTML = `
        <span><strong>${postCount}</strong> posts</span>
        <span style="margin:0 10px">·</span>
        <span><strong>${friendCount}</strong> amigos</span>
        <span style="margin:0 10px">·</span>
        <span><strong>${commCount}</strong> comunidades</span>`;
    }
  }

  // ── Amigos do perfil ──────────────────────────────────────────────────────
  function renderProfileFriends() {
    const friendIds = getMyFriendIds(allData.friendships, profileUser.id);
    const friends = friendIds.map(id => allData.userById[id]).filter(Boolean);
    const el = document.getElementById("profile-friends");
    if (friends.length) {
      el.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;list-style:none;padding:0;margin:0";
      el.innerHTML = friends.map(f => `
        <li style="text-align:center">
          <a href="profile.html?user=${f.id}" style="text-decoration:none;color:inherit">
            <img src="${avatarUrl(f)}" alt="" style="width:52px;height:52px;border-radius:4px;object-fit:cover;display:block;margin:0 auto 3px">
            <span style="font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name.split(" ")[0]}</span>
          </a>
        </li>`).join("");
    } else {
      el.innerHTML = `<li style="color:#90949c;font-size:10px">Nenhum amigo ainda.</li>`;
    }
  }

  function renderProfileCommunities() {
    const container = document.getElementById("profile-communities");
    if (!container || !allData) return;
    const myComms = allData.communities.filter(c =>
      allData.communityMembers.some(m => m.community_id === c.id && m.user_id === profileUser.id)
    ).slice(0, 6);
    if (!myComms.length) {
      container.innerHTML = `<p style="color:#90949c;font-size:10px">Nenhuma comunidade ainda.</p>`;
      return;
    }
    container.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:6px";
    container.innerHTML = myComms.map(c => `
      <div style="text-align:center">
        <a href="communities.html?id=${c.id}" style="text-decoration:none;color:inherit">
          <div style="width:52px;height:52px;background:#3b5998;color:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;margin:0 auto 3px">${c.name.charAt(0).toUpperCase()}</div>
          <span style="font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
        </a>
      </div>`).join("");
  }

  renderProfileFriends();
  renderProfileCommunities();

  document.getElementById("profile-meta").textContent = isOwnProfile
    ? "Seu perfil — troque foto e capa, receba depoimentos dos amigos."
    : `Perfil de ${profileUser.name}.`;
  document.getElementById("wall-title").textContent = isOwnProfile ? "Seu mural" : `Mural de ${profileUser.name}`;

  if (isOwnProfile) document.getElementById("own-composer").style.display = "block";

  // ── Depoimentos ───────────────────────────────────────────────────────────
  function renderTestimonials() {
    const list = allData.testimonials.filter(t => t.profileUserId === profileUser.id);
    const container = document.getElementById("testimonials-list");
    if (!list.length) { container.innerHTML = `<p style="color:#90949c;font-size:11px">Nenhum depoimento ainda.</p>`; return; }
    container.innerHTML = list.map(t => {
      const author = allData.userById[t.authorUserId];
      return `<div class="testimonial">
        <p style="font-size:12px;line-height:1.4">"${escapeHtml(t.text)}"</p>
        <p style="margin-top:4px;color:#90949c;font-size:10px">— <strong>${escapeHtml(author ? author.name : "Alguém")}</strong> · ${formatTime(t.createdAt)}</p>
      </div>`;
    }).join("");
  }

  if (!isOwnProfile) document.getElementById("testimonial-form-wrap").style.display = "block";

  // ── Posts do perfil ───────────────────────────────────────────────────────
  async function refreshProfilePosts() {
    allData = await fetchCommunityData();
    profileUser = allData.userById[profileId] || profileUser;
    renderAvatar();
    renderCover();
    renderTestimonials();
    renderProfileFriends();
    renderProfileCommunities();
    renderProfileStats();

    const posts = allData.posts.filter(p => p.userId === profileUser.id && !p.communityId).sort((a, b) => b.createdAt - a.createdAt);
    const container = document.getElementById("profile-posts");
    if (!posts.length) { container.innerHTML = `<p style="color:#90949c">Nenhuma publicação ainda.</p>`; return; }
    container.innerHTML = posts.map(p => renderPost(p, allData, currentUser)).join("");
    bindPostActions(currentUser, refreshProfilePosts);
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  if (isOwnProfile) {
    document.getElementById("profile-cover").addEventListener("change", async (e) => {
      if (e.target.id !== "cover-file") return;
      const file = e.target.files?.[0];
      if (!file) return;
      try { await uploadProfileImage(currentUser.id, file, "cover"); await refreshProfilePosts(); }
      catch (err) { alert(err.message || "Erro ao enviar capa."); }
      e.target.value = "";
    });

    document.getElementById("avatar-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try { await uploadProfileImage(currentUser.id, file, "avatar"); await refreshProfilePosts(); }
      catch (err) { alert(err.message || "Erro ao enviar foto."); }
      e.target.value = "";
    });

    document.getElementById("form-profile-post")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = document.getElementById("profile-post-text");
      const text = textarea.value.trim();
      if (!text) return;
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try { await createPost(currentUser.id, text, null); textarea.value = ""; await refreshProfilePosts(); }
      catch (err) { alert("Não foi possível publicar."); }
      finally { btn.disabled = false; }
    });

    document.getElementById("form-bio")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bio = document.getElementById("bio-input").value.trim();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try { await updateBio(currentUser.id, bio); document.getElementById("profile-bio").textContent = bio || "Sem informações na bio ainda."; profileUser.bio = bio; }
      catch (err) { alert("Não foi possível salvar a bio."); }
      finally { btn.disabled = false; }
    });
  }

  document.getElementById("form-testimonial")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("testimonial-text").value.trim();
    if (!text) return;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try { await createTestimonial(profileUser.id, currentUser.id, text); document.getElementById("testimonial-text").value = ""; await refreshProfilePosts(); }
    catch (err) { alert(err.message || "Não foi possível publicar o depoimento."); }
    finally { btn.disabled = false; }
  });

  await refreshProfilePosts();
  await initNotifications(currentUser);
})();
