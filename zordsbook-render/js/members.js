(async function initMembers() {
  if (!isConfigured()) { window.location.href = "index.html"; return; }
  const currentUser = await requireAuth();
  if (!currentUser) return;

  document.body.dataset.page = "members";
  document.getElementById("topbar").innerHTML = renderTopbar("members", currentUser, 0);
  bindLogout();

  let allData = null;

  function renderMiniProfile() {
    document.getElementById("mini-profile").innerHTML = `
      <a href="profile.html"><img src="${avatarUrl(currentUser)}" alt=""></a>
      <p style="margin-top:6px"><a href="profile.html"><strong>${currentUser.name}</strong></a></p>`;
  }

  function renderPendingRequests() {
    const pending = allData.friendships.filter(f =>
      f.addressee_id === currentUser.id && f.status === "pending"
    );
    const container = document.getElementById("pending-requests");
    if (!pending.length) {
      container.innerHTML = `<p style="color:#90949c;font-size:11px">Nenhuma solicitação pendente.</p>`;
      return;
    }
    container.innerHTML = pending.map(f => {
      const requester = allData.userById[f.requester_id];
      if (!requester) return "";
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #e9eaed">
        <img src="${avatarUrl(requester)}" style="width:36px;height:36px;border-radius:2px">
        <div style="flex:1">
          <strong style="font-size:11px"><a href="profile.html?user=${requester.id}" style="color:#365899">${requester.name}</a></strong>
          <p style="font-size:10px;color:#90949c">quer ser seu amigo</p>
        </div>
        <button class="btn btn-small btn-accept" data-id="${f.id}" data-actor="${f.requester_id}">Aceitar</button>
        <button class="btn btn-small btn-reject" data-id="${f.id}" style="background:linear-gradient(#d9534f,#c9302c);border-color:#ac2925">Recusar</button>
      </div>`;
    }).join("");

    container.querySelectorAll(".btn-accept").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await acceptFriendRequest(btn.dataset.id, btn.dataset.actor, currentUser.id);
          await refresh();
        } catch (e) { alert("Erro ao aceitar."); btn.disabled = false; }
      });
    });
    container.querySelectorAll(".btn-reject").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await removeFriendship(btn.dataset.id);
          await refresh();
        } catch (e) { alert("Erro ao recusar."); btn.disabled = false; }
      });
    });
  }

  function renderMyFriends() {
    const friendIds = getMyFriendIds(allData.friendships, currentUser.id);
    const friends = friendIds.map(id => allData.userById[id]).filter(Boolean);
    const container = document.getElementById("my-friends-orkut");
    if (!container) return;
    container.innerHTML = friends.length
      ? friends.map(f => `
          <div class="member-orkut-cell">
            <a href="profile.html?user=${f.id}">
              <img src="${avatarUrl(f)}" alt="${f.name}">
            </a>
            <a href="profile.html?user=${f.id}" class="member-orkut-name">${f.name}</a>
          </div>`).join("")
      : `<p style="color:#90949c;font-size:10px">Nenhum amigo ainda.</p>`;
  }

  function renderMembersGrid(filter) {
    const others = allData.users.filter(u =>
      u.id !== currentUser.id && (!filter || u.name.toLowerCase().includes(filter.toLowerCase()))
    );
    const container = document.getElementById("members-grid");
    const countEl = document.getElementById("members-count");
    if (countEl) countEl.textContent = filter ? `${others.length} resultado${others.length!==1?"s":""}` : `${others.length} membro${others.length!==1?"s":""}`;
    if (!others.length) {
      container.innerHTML = `<p style="color:#90949c;font-size:11px">Nenhum membro encontrado.</p>`;
      return;
    }
    container.innerHTML = others.map(u => {
      const rel = getFriendshipStatus(allData.friendships, currentUser.id, u.id);
      let actionHtml = "";
      if (!rel) {
        actionHtml = `<button class="btn btn-small btn-add-friend" data-id="${u.id}">+ Adicionar</button>`;
      } else if (rel.status === "pending" && rel.iRequested) {
        actionHtml = `<span style="color:#90949c;font-size:10px">Solicitação enviada</span>`;
      } else if (rel.status === "pending" && !rel.iRequested) {
        actionHtml = `<button class="btn btn-small btn-accept" data-id="${rel.id}" data-actor="${u.id}">Aceitar</button>`;
      } else if (rel.status === "accepted") {
        actionHtml = `<span style="color:#5b9a3f;font-size:10px;font-weight:bold">✓ Amigos</span>
          <button class="btn-link btn-remove-friend" data-id="${rel.id}" style="font-size:10px;color:#90949c;margin-left:8px;background:none;border:none;cursor:pointer">Remover</button>`;
      }
      return `<div class="member-card">
        <a href="profile.html?user=${u.id}"><img src="${avatarUrl(u)}" alt=""></a>
        <div class="member-info">
          <strong><a href="profile.html?user=${u.id}" style="color:#365899">${filter ? u.name.replace(new RegExp("(" + filter.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")", "gi"), "<mark style=\'background:#fff3cd;padding:0 1px\'>$1</mark>") : u.name}</a></strong>
          <p style="font-size:10px;color:#90949c;margin:2px 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.bio || "Sem bio"}</p>
          ${actionHtml}
        </div>
      </div>`;
    }).join("");

    container.querySelectorAll(".btn-add-friend").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await sendFriendRequest(btn.dataset.id, currentUser.id);
          await refresh();
        } catch (e) { alert("Erro ao enviar solicitação."); btn.disabled = false; }
      });
    });
    container.querySelectorAll(".btn-accept").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await acceptFriendRequest(btn.dataset.id, btn.dataset.actor, currentUser.id);
          await refresh();
        } catch (e) { alert("Erro."); btn.disabled = false; }
      });
    });
    container.querySelectorAll(".btn-remove-friend").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remover amizade?")) return;
        btn.disabled = true;
        try {
          await removeFriendship(btn.dataset.id);
          await refresh();
        } catch (e) { alert("Erro."); btn.disabled = false; }
      });
    });
  }

  async function refresh() {
    allData = await fetchCommunityData();
    renderMiniProfile();
    renderPendingRequests();
    renderMyFriends();
    renderMembersGrid(document.getElementById("search-members").value);
  }

  const searchInput = document.getElementById("search-members");
  let searchTimeout;
  searchInput.addEventListener("input", e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderMembersGrid(e.target.value), 200);
  });

  await refresh();
  await initNotifications(currentUser);
})();
