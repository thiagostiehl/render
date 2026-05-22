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
    return allData.communityMembers.some(
      m => m.community_id === communityId && m.user_id === currentUser.id
    );
  }

  // 🔴 DELETE FUNCTION (NOVO)
  async function deleteCommunity(id) {
    const sb = getSupabase();

    const { error } = await sb
      .from("communities")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  function communityCard(c) {
    const memberCount = allData.communityMembers.filter(
      m => m.community_id === c.id
    ).length;

    const member = isMember(c.id);

    return `
      <div class="community-card" style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e9eaed">
        <div style="width:48px;height:48px;border-radius:3px;background:#3b5998;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:bold">
          ${c.name.charAt(0).toUpperCase()}
        </div>

        <div style="flex:1;min-width:0">
          <p style="font-weight:bold;font-size:12px;margin:0">
            <a href="#" class="open-community" data-id="${c.id}" style="color:#365899">${c.name}</a>
          </p>

          <p style="font-size:10px;color:#90949c;margin:2px 0">${c.description || "Sem descrição"}</p>
          <p style="font-size:10px;color:#90949c;margin:2px 0">${memberCount} membro${memberCount !== 1 ? "s" : ""}</p>

          ${member
            ? `<button class="btn btn-small btn-leave" data-id="${c.id}" style="margin-top:4px;background:linear-gradient(#d9534f,#c9302c);border-color:#ac2925">Sair</button>
               <button class="btn btn-small open-community" data-id="${c.id}" style="margin-top:4px;margin-left:4px">Ver</button>`
            : `<button class="btn btn-small btn-join" data-id="${c.id}" style="margin-top:4px">Participar</button>`
          }

          ${c.creator_id === currentUser.id
            ? `<button class="btn btn-small btn-delete" data-id="${c.id}" style="margin-top:6px;background:#333;border-color:#222">
                Deletar
              </button>`
            : ""
          }
        </div>
      </div>
    `;
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
        try {
          await joinCommunity(btn.dataset.id, currentUser.id);
          await refresh();
        } catch (e) {
          alert("Erro ao participar.");
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll(".btn-leave").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Sair da comunidade?")) return;
        btn.disabled = true;
        try {
          await leaveCommunity(btn.dataset.id, currentUser.id);
          await refresh();
        } catch (e) {
          alert("Erro ao sair.");
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll(".open-community").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openCommunity(btn.dataset.id);
      });
    });

    // 🔴 DELETE ACTION (NOVO)
    document.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Tem certeza que quer deletar essa comunidade?")) return;

        btn.disabled = true;

        try {
          await deleteCommunity(btn.dataset.id);
          await refresh();
        } catch (e) {
          console.error(e);
          alert("Erro ao deletar comunidade");
          btn.disabled = false;
        }
      });
    });
  }

  async function openCommunity(communityId) {
    activeCommunityId = communityId;
    const c = allData.communityById[communityId];
    if (!c) return;

    document.getElementById("community-view").style.display = "none";
    document.getElementById("community-feed").style.display = "block";

    const member = isMember(communityId);
    const memberCount = allData.communityMembers.filter(
      m => m.community_id === communityId
    ).length;

    document.getElementById("community-header").innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:64px;height:64px;border-radius:3px;background:#3b5998;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:bold">
          ${c.name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <h2 style="font-size:16px;color:#1d2129;margin:0">${c.name}</h2>
          <p style="font-size:11px;color:#90949c;margin:4px 0">${c.description || "Sem descrição"}</p>
          <p style="font-size:10px;color:#90949c;margin:4px 0">${memberCount} membro${memberCount !== 1 ? "s" : ""}</p>
        </div>
      </div>`;

    document.getElementById("comm-composer").style.display = member ? "block" : "none";
    document.getElementById("comm-feed-title").textContent = `Publicações em ${c.name}`;

    renderCommunityPosts();
  }

  await refresh();
})();
