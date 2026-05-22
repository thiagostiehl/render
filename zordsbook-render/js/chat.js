/**
 * chat.js — Chat estilo MSN Messenger
 * Depende de: supabase-client.js (getSupabase)
 */

(async function () {
  const supabase = getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  const myName   = myProfile?.name   || "Você";
  const myAvatar = myProfile?.avatar_url
    ? myProfile.avatar_url
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&size=30&background=1a6fc4&color=fff`;

  // ── Som ──────────────────────────────────────────────────────
  function playNotificationSound() {
    let sound = document.getElementById("notifSound");
    if (!sound || !sound.currentSrc) {
      sound = new Audio("https://zrtcrowfyzbleiilxcej.supabase.co/storage/v1/object/public/assets/msn.mp3");
    }
    sound.volume = 0.5;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  // ── Barra lateral ────────────────────────────────────────────
  const sidebar = document.createElement("div");
  sidebar.className = "chat-sidebar";
  sidebar.id = "chat-sidebar";
  sidebar.innerHTML = `
    <div class="chat-sidebar-header" id="chat-sidebar-toggle">
      <span>💬 Contatos</span>
      <span class="chat-sidebar-toggle">▼</span>
    </div>
    <div class="chat-sidebar-body" id="chat-sidebar-body">
      <p class="chat-empty">Carregando...</p>
    </div>
  `;
  document.body.appendChild(sidebar);

  let sidebarOpen = true;
  document.getElementById("chat-sidebar-toggle").addEventListener("click", () => {
    const body = document.getElementById("chat-sidebar-body");
    sidebarOpen = !sidebarOpen;
    body.style.display = sidebarOpen ? "block" : "none";
    sidebar.querySelector(".chat-sidebar-toggle").textContent = sidebarOpen ? "▼" : "▲";
  });

  // ── Perfis ───────────────────────────────────────────────────
  let allProfiles = [];

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .neq("id", user.id)
      .order("name");

    if (error || !profiles) return;
    allProfiles = profiles;
    renderUserList([]);
  }

  function renderUserList(onlineIds) {
    const body = document.getElementById("chat-sidebar-body");
    if (!allProfiles.length) {
      body.innerHTML = `<p class="chat-empty">Nenhum contato encontrado.</p>`;
      return;
    }

    const sorted = [...allProfiles].sort((a, b) => {
      const aOn = onlineIds.includes(a.id) ? 0 : 1;
      const bOn = onlineIds.includes(b.id) ? 0 : 1;
      return aOn - bOn || (a.name || "").localeCompare(b.name || "");
    });

    const onlineCount  = sorted.filter(p => onlineIds.includes(p.id)).length;
    const offlineCount = sorted.length - onlineCount;

    body.innerHTML = "";

    if (onlineCount > 0) {
      const lbl = document.createElement("div");
      lbl.className = "chat-online-label";
      lbl.textContent = `Online (${onlineCount})`;
      body.appendChild(lbl);
    }

    let offlineLabelAdded = false;

    sorted.forEach(profile => {
      const isOnline = onlineIds.includes(profile.id);

      if (!isOnline && !offlineLabelAdded && offlineCount > 0) {
        const lbl = document.createElement("div");
        lbl.className = "chat-online-label";
        lbl.textContent = `Offline (${offlineCount})`;
        body.appendChild(lbl);
        offlineLabelAdded = true;
      }

      const avatarSrc = profile.avatar_url
        ? profile.avatar_url
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=36&background=1a6fc4&color=fff`;

      const div = document.createElement("div");
      div.className = "chat-user";
      div.innerHTML = `
        <img src="${avatarSrc}" alt="${profile.name}">
        <span class="chat-user-name">${profile.name || "Usuário"}</span>
        <span class="online-dot ${isOnline ? "is-online" : "is-offline"}"></span>
      `;
      div.addEventListener("click", () => openChatWindow(profile.id, profile.name, profile.avatar_url));
      body.appendChild(div);
    });
  }

  await loadUsers();

  // ── Presence ─────────────────────────────────────────────────
  const presenceChannel = supabase.channel("online-users", {
    config: { presence: { key: user.id } }
  });

  function getOnlineIds() {
    return Object.keys(presenceChannel.presenceState()).filter(id => id !== user.id);
  }

  presenceChannel
    .on("presence", { event: "sync"  }, () => renderUserList(getOnlineIds()))
    .on("presence", { event: "join"  }, () => renderUserList(getOnlineIds()))
    .on("presence", { event: "leave" }, () => renderUserList(getOnlineIds()))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ user_id: user.id, name: myName, online_at: new Date().toISOString() });
      }
    });

  // ── Janelas ──────────────────────────────────────────────────
  const openWindows = {};
  const windowOffset = 258;
  const windowWidth  = 328;

  function openChatWindow(receiverId, receiverName, receiverAvatar) {
    if (openWindows[receiverId]) {
      const win = openWindows[receiverId];
      win.querySelector(".chat-messages").style.display = "flex";
      win.querySelector(".chat-input").style.display    = "flex";
      win.querySelector(".chat-input input").focus();
      const badge = win.querySelector(".chat-notif-badge");
      if (badge) badge.remove();
      return;
    }

    const index    = Object.keys(openWindows).length;
    const rightPos = windowOffset + index * windowWidth;

    const avatarSrc = receiverAvatar
      ? receiverAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(receiverName || "U")}&size=30&background=1a6fc4&color=fff`;

    const win = document.createElement("div");
    win.className = "chat-window";
    win.style.right = rightPos + "px";
    win.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <img class="chat-header-avatar" src="${avatarSrc}" alt="${receiverName}">
          <span class="chat-header-name">${receiverName || "Chat"}</span>
        </div>
        <span class="chat-close" title="Fechar">✕</span>
      </div>
      <div class="chat-msn-stripe"></div>
      <div class="chat-messages" id="chat-msgs-${receiverId}"></div>
      <div class="chat-input">
        <input type="text" placeholder="Digite uma mensagem e pressione Enter..." autocomplete="off">
        <span class="chat-send-hint">Enter ↵</span>
      </div>
    `;

    document.body.appendChild(win);
    openWindows[receiverId] = win;

    win.querySelector(".chat-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeChatWindow(receiverId);
    });

    let minimized = false;
    win.querySelector(".chat-header").addEventListener("click", (e) => {
      if (e.target.classList.contains("chat-close")) return;
      minimized = !minimized;
      win.querySelector(".chat-messages").style.display = minimized ? "none" : "flex";
      win.querySelector(".chat-input").style.display    = minimized ? "none" : "flex";
      win.querySelector(".chat-msn-stripe").style.display = minimized ? "none" : "block";
      const badge = win.querySelector(".chat-notif-badge");
      if (!minimized && badge) badge.remove();
    });

    const inputEl = win.querySelector(".chat-input input");
    inputEl.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = "";
      appendMessage(receiverId, text, true, myName);
      const { error } = await supabase.from("messages").insert({
        sender_id:   user.id,
        receiver_id: receiverId,
        message:     text
      });
      if (error) console.error("Erro ao enviar:", error);
    });

    loadHistory(receiverId);
    inputEl.focus();
  }

  function closeChatWindow(receiverId) {
    const win = openWindows[receiverId];
    if (!win) return;
    win.remove();
    delete openWindows[receiverId];
    Object.values(openWindows).forEach((w, i) => {
      w.style.right = (windowOffset + i * windowWidth) + "px";
    });
  }

  // ── Histórico ────────────────────────────────────────────────
  async function loadHistory(receiverId) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),` +
        `and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) { console.error("Erro ao carregar histórico:", error); return; }

    // Busca nome do outro
    const other = allProfiles.find(p => p.id === receiverId);
    const otherName = other?.name || "Usuário";

    data.forEach(msg => {
      const isOwn = msg.sender_id === user.id;
      appendMessage(receiverId, msg.message, isOwn, isOwn ? myName : otherName);
    });
  }

  // ── Renderizar mensagem ──────────────────────────────────────
  function appendMessage(receiverId, text, isOwn, senderName) {
    const container = document.getElementById(`chat-msgs-${receiverId}`);
    if (!container) return;

    const label = document.createElement("div");
    label.className = `chat-msg-label ${isOwn ? "chat-msg-label-own" : ""}`;
    label.textContent = senderName || (isOwn ? "Você" : "Usuário");

    const bubble = document.createElement("div");
    bubble.className = `chat-msg ${isOwn ? "chat-msg-own" : "chat-msg-other"}`;
    bubble.textContent = text;

    container.appendChild(label);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  // ── Notificação ──────────────────────────────────────────────
  function notifyIncoming(senderId, senderName, senderAvatar, text) {
    playNotificationSound();

    if (openWindows[senderId]) {
      const win  = openWindows[senderId];
      const msgs = win.querySelector(".chat-messages");
      appendMessage(senderId, text, false, senderName);
      if (msgs.style.display === "none") {
        const header = win.querySelector(".chat-header-name");
        if (!win.querySelector(".chat-notif-badge")) {
          const badge = document.createElement("span");
          badge.className = "chat-notif-badge";
          badge.style.cssText = "background:#e03030;color:#fff;border-radius:50%;font-size:10px;padding:1px 5px;margin-left:6px;";
          badge.textContent = "●";
          header.appendChild(badge);
        }
      }
      return;
    }

    openChatWindow(senderId, senderName, senderAvatar);
    setTimeout(() => appendMessage(senderId, text, false, senderName), 80);
  }

  // ── Realtime ─────────────────────────────────────────────────
  supabase
    .channel(`inbox-${user.id}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  "messages",
      filter: `receiver_id=eq.${user.id}`
    }, async payload => {
      const senderId = payload.new.sender_id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", senderId)
        .single();

      notifyIncoming(senderId, profile?.name || "Usuário", profile?.avatar_url || null, payload.new.message);
    })
    .subscribe();

})();
