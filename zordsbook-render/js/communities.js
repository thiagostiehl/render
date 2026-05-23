(async function initCommunities() {
  if (!isConfigured()) { window.location.href = "index.html"; return; }
  const currentUser = await requireAuth();
  if (!currentUser) return;

  document.body.dataset.page = "communities";
  document.getElementById("topbar").innerHTML = renderTopbar("communities", currentUser, 0);
  bindLogout();

  let allData = null;
  let activeCommunityId = null;

  function renderMiniProfile() {
    document.getElementById("mini-profile").innerHTML = `
      <a href="profile.html"><img src="${avatarUrl(currentUser)}" alt=""></a>
      <p style="margin-top:6px"><a href="profile.html"><strong>${currentUser.name}</strong></a></p>`;
  }

  function isMember(communityId) {
    return allData.communityMembers.some(m => m.community_id === communityId && m.user_id === currentUser.id);
  }

  function communityCard(c) {
    const memberCount = allData.communityMembers.filter(m => m.community_id === c.id).length;
    const member = isMember(c.id);
    const initial = c.name.charAt(0).toUpperCase();
    return `<div class="community-orkut-card">
      <a href="#" class="open-community" data-id="${c.id}">
        <div class="community-orkut-icon">${initial}</div>
      </a>
      <div class="community-orkut-info">
        <p class="community-orkut-name">
          <a href="#" class="open-community" data-id="${c.id}">${c.name}</a>
        </p>
        <p class="community-orkut-meta">${memberCount} membro${memberCount !== 1 ? "s" : ""}</p>
        ${member
          ? `<button class="btn btn-small btn-leave" data-id="${c.id}" style="background:linear-gradient(#d9534f,#c9302c);border-color:#ac2925;margin-top:4px">Sair</button>`
          : `<button class="btn btn-small btn-join" data-id="${c.id}" style="margin-top:4px">Participar</button>`
        }
      </div>
    </div>`;
  }

  function renderLists() {
    const myComms = allData.communities.filter(c => isMember(c.id));
    const othersComms = allData.communities.filter(c => !isMember(c.id));

    document.getElementById("my-communities").innerHTML = myComms.length
      ? myComms.map(communityCard).join("")
      : `<p style="color:#90949c;font-size:11px">Você ainda não participa de nenhuma comunidade.</p>`;

    document.getElementById("all-communities").innerHTML = othersComms.length
      ? othersComms.map(communityCard).join("")
      : `<p style="color:#90949c;font-size:11px">Nenhuma outra comunidade disponível.</p>`;

    bindListActions();
  }

  function bindListActions() {
    document.querySelectorAll(".btn-join").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try { await joinCommunity(btn.dataset.id, currentUser.id); await refresh(); }
        catch (e) { alert("Erro ao participar."); btn.disabled = false; }
      });
    });
    document.querySelectorAll(".btn-leave").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Sair da comunidade?")) return;
        btn.disabled = true;
        try { await leaveCommunity(btn.dataset.id, currentUser.id); await refresh(); }
        catch (e) { alert("Erro ao sair."); btn.disabled = false; }
      });
    });
    document.querySelectorAll(".open-community").forEach(btn => {
      btn.addEventListener("click", (e) => { e.preventDefault(); openCommunity(btn.dataset.id); });
    });
  }

  async function openCommunity(communityId) {
    activeCommunityId = communityId;
    const c = allData.communityById[communityId];
    if (!c) return;
    // Atualiza URL sem recarregar — facilita compartilhar link da comunidade
    window.history.replaceState({}, "", `communities.html?id=${communityId}`);
    document.title = `${c.name} — ZordsBook`;

    document.getElementById("community-view").style.display = "none";
    document.getElementById("community-feed").style.display = "block";

    const member = isMember(communityId);
    const memberCount = allData.communityMembers.filter(m => m.community_id === communityId).length;

    document.getElementById("community-header").innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:64px;height:64px;border-radius:3px;background:#3b5998;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:bold">
          ${c.name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <h2 style="font-size:16px;color:#1d2129;margin:0">${c.name}</h2>
          <p style="font-size:11px;color:#90949c;margin:4px 0">${c.description || "Sem descrição"}</p>
          <p style="font-size:10px;color:#90949c;margin:4px 0">${memberCount} membro${memberCount !== 1 ? "s" : ""}</p>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-small" onclick="document.getElementById('community-view').style.display='';document.getElementById('community-feed').style.display='none'">← Voltar</button>
            ${member
              ? `<button class="btn btn-small btn-leave-comm" style="background:linear-gradient(#d9534f,#c9302c);border-color:#ac2925">Sair da comunidade</button>`
              : `<button class="btn btn-small btn-join-comm">Participar</button>`
            }
          </div>
        </div>
      </div>`;

    document.getElementById("comm-composer").style.display = member ? "block" : "none";
    document.getElementById("comm-feed-title").textContent = `Publicações em ${c.name}`;

    const members = allData.communityMembers.filter(m => m.community_id === communityId).map(m => allData.userById[m.user_id]).filter(Boolean);
    const membersGrid = document.getElementById("comm-members-grid");
    if (membersGrid) {
      membersGrid.innerHTML = members.length
        ? members.map(u => `
            <div class="member-orkut-cell">
              <a href="profile.html?user=${u.id}">
                <img src="${avatarUrl(u)}" alt="${u.name}">
              </a>
              <a href="profile.html?user=${u.id}" class="member-orkut-name">${u.name}</a>
            </div>`).join("")
        : `<p style="color:#90949c;font-size:10px">Nenhum membro ainda.</p>`;
    }

    renderCommunityPosts();

    document.querySelector(".btn-join-comm")?.addEventListener("click", async () => {
      try { await joinCommunity(communityId, currentUser.id); await refresh(); openCommunity(communityId); }
      catch (e) { alert("Erro ao participar."); }
    });
    document.querySelector(".btn-leave-comm")?.addEventListener("click", async () => {
      if (!confirm("Sair desta comunidade?")) return;
      try { await leaveCommunity(communityId, currentUser.id); await refresh(); document.getElementById("community-view").style.display = ""; document.getElementById("community-feed").style.display = "none"; }
      catch (e) { alert("Erro ao sair."); }
    });
  }

  function renderCommunityPosts() {
    const posts = allData.posts.filter(p => p.communityId === activeCommunityId);
    const container = document.getElementById("comm-posts");
    if (!posts.length) {
      container.innerHTML = `<p style="color:#90949c;font-size:11px">Nenhuma publicação ainda. Seja o primeiro!</p>`;
      return;
    }
    container.innerHTML = posts.map(p => renderPost(p, allData, currentUser)).join("");
    bindPostActions(currentUser, async () => { allData = await fetchCommunityData(); renderCommunityPosts(); });
  }

  // Composer da comunidade
  const LIMITE = 280;
  document.getElementById("comm-post-text").addEventListener("input", e => {
    const n = e.target.value.length;
    document.getElementById("comm-post-counter").textContent = `${n} / ${LIMITE} caracteres`;
  });

  document.getElementById("form-comm-post").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("comm-post-text").value.trim();
    if (!text || !activeCommunityId) return;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await createPost(currentUser.id, text, activeCommunityId);
      document.getElementById("comm-post-text").value = "";
      allData = await fetchCommunityData();
      renderCommunityPosts();
    } catch (err) { alert("Não foi possível publicar."); }
    finally { btn.disabled = false; }
  });

  // Criar comunidade
  document.getElementById("form-create-community").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("comm-name").value.trim();
    const desc = document.getElementById("comm-desc").value.trim();
    if (!name) return;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const c = await createCommunity(name, desc, currentUser.id);
      document.getElementById("comm-name").value = "";
      document.getElementById("comm-desc").value = "";
      await refresh();
      openCommunity(c.id);
    } catch (err) { alert("Não foi possível criar a comunidade. Tente outro nome."); }
    finally { btn.disabled = false; }
  });

  async function refresh() {
    allData = await fetchCommunityData();
    renderMiniProfile();
    renderLists();
  }

  // Abre comunidade se vier na URL
  const urlComm = new URLSearchParams(window.location.search).get("id");

  await refresh();
  await initNotifications(currentUser);

  if (urlComm && allData.communityById[urlComm]) openCommunity(urlComm);
})();
