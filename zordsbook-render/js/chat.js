/**
 * chat.js — Barra de amigos estilo Facebook clássico
 * com presença real via Supabase Realtime Presence
 * Depende de: supabase-client.js (getSupabase)
 */

(async function () {
  const supabase = getSupabase();

  // ── Usuário atual ────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Busca o perfil do usuário logado
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  const myName = myProfile?.name || "Usuário";

  // ── Som de notificação ───────────────────────────────────────
  function playNotificationSound() {
    let sound = document.getElementById("notifSound");
    if (!sound || !sound.src) {
      sound = new Audio("https://zrtcrowfyzbleiilxcej.supabase.co/storage/v1/object/public/assets/msn.mp3");
    }
    sound.volume = 0.5;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  // ── Cria a barra lateral ─────────────────────────────────────
  const sidebar = document.createElement("div");
  sidebar.className = "chat-sidebar";
  sidebar.id = "chat-sidebar";
  sidebar.innerHTML = `
    <div class="chat-sidebar-header" id="chat-sidebar-toggle">
      <span>● Chat</span>
      <span class="chat-sidebar-toggle">▼</span>
    </div>
    <div class="chat-sidebar-body" id="chat-sidebar-body">
      <p class="chat-empty">Carregando...</p>
    </div>
  `;
  document.body.appendChild(sidebar);

  // Recolher / expandir
  let sidebarOpen = true;
  document.getElementById("chat-sidebar-toggle").addEventListener("click", () => {
    const body = document.getElementById("chat-sidebar-body");
    sidebarOpen = !sidebarOpen;
    body.style.display = sidebarOpen ? "block" : "none";
    sidebar.querySelector(".chat-sidebar-toggle").textContent = sidebarOpen ? "▼" : "▲";
  });

  // ── Lista de todos os usuários ───────────────────────────────
  let allProfiles = [];

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .neq("id", user.id)
      .order("name");

    if (error || !profiles) return;
    allProfiles = profiles;
    renderUserList([]);  // começa sem ninguém online
  }

  // ── Renderiza lista com indicador de online/offline ──────────
  function renderUserList(onlineIds) {
    const body = document.getElementById("chat-sidebar-body");
    if (!allProfiles.length) {
      body.innerHTML = `<p class="chat-empty">Nenhum usuário encontrado.</p>`;
      return;
    }

    // Ordena: online primeiro, depois offline
    const sorted = [...allProfiles].sort((a, b) => {
      const aOnline = onlineIds.includes(a.id) ? 0 : 1;
      const bOnline = onlineIds.includes(b.id) ? 0 : 1;
      return aOnline - bOnline || a.name?.localeCompare(b.name);
    });

    body.innerHTML = "";
    sorted.forEach(profile => {
      const isOnline = onlineIds.includes(profile.id);
      const div = document.createElement("div");
      div.className = "chat-user";
      div.dataset.userId   = profile.id;
      div.dataset.userName = profile.name || "Usuário";

      const avatar = profile.avatar_url
        ? `<img src="${profile.avatar_url}" alt="${profile.name}">`
        : `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=28&background=8b9dc3&color=fff" alt="${profile.name}">`;

      const dot = isOnline
        ? `<span class="online-dot"></span>`
        : `<span class="online-dot" style="background:#ccc;box-shadow:none;"></span>`;

      div.innerHTML = `${avatar}<span class="chat-user-name">${profile.name || "Usuário"}</span>${dot}`;
      div.addEventListener("click", () => openChatWindow(profile.id, profile.name, profile.avatar_url));
      body.appendChild(div);
    });
  }

  await loadUsers();

  // ── Presence — rastreia quem está online ─────────────────────
  const presenceChannel = supabase.channel("online-users", {
    config: { presence: { key: user.id } }
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const onlineIds = Object.keys(state).filter(id => id !== user.id);
      renderUserList(onlineIds);
    })
    .on("presence", { event: "join" }, ({ key }) => {
      const state = presenceChannel.presenceState();
      const onlineIds = Object.keys(state).filter(id => id !== user.id);
      renderUserList(onlineIds);
    })
    .on("presence", { event: "leave" }, ({ key }) => {
      const state = presenceChannel.presenceState();
      const onlineIds = Object.keys(state).filter(id => id !== user.id);
      renderUserList(onlineIds);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ user_id: user.id, name: myName, online_at: new Date().toISOString() });
      }
    });

  // ── Janelas abertas ──────────────────────────────────────────
  const openWindows = {};
  const windowOffset = 210;
  const windowWidth  = 270;

  function openChatWindow(receiverId, receiverName, receiverAvatar) {
    if (openWindows[receiverId]) {
      const win = openWindows[receiverId];
      win.querySelector(".chat-messages").style.display = "flex";
      win.querySelector(".chat-input").style.display = "flex";
      win.querySelector(".chat-input input").focus();
      const badge = win.querySelector(".chat-notif-badge");
      if (badge) badge.remove();
      return;
    }

    const index    = Object.keys(openWindows).length;
    const rightPos = windowOffset + index * windowWidth;

    const win = document.createElement("div");
    win.className = "chat-window";
    win.style.right = rightPos + "px";

    win.innerHTML = `
      <div class="chat-header">
        <span>${receiverName || "Chat"}</span>
        <span class="chat-close" title="Fechar">×</span>
      </div>
      <div class="chat-messages" id="chat-msgs-${receiverId}"></div>
      <div class="chat-input">
        <input type="text" placeholder="Digite uma mensagem..." autocomplete="off">
      </div>
    `;

    document.body.appendChild(win);
    openWindows[receiverId] = win;

    // Fechar
    win.querySelector(".chat-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeChatWindow(receiverId);
    });

    // Minimizar
    let minimized = false;
    win.querySelector(".chat-header").addEventListener("click", (e) => {
      if (e.target.classList.contains("chat-close")) return;
      minimized = !minimized;
      win.querySelector(".chat-messages").style.display = minimized ? "none" : "flex";
      win.querySelector(".chat-input").style.display    = minimized ? "none" : "flex";
      const badge = win.querySelector(".chat-notif-badge");
      if (!minimized && badge) badge.remove();
    });

    // Enviar com Enter
    const inputEl = win.querySelector(".chat-input input");
    inputEl.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = "";
      appendMessage(receiverId, text, true);
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
    data.forEach(msg => appendMessage(receiverId, msg.message, msg.sender_id === user.id));
  }

  // ── Renderizar bolha ─────────────────────────────────────────
  function appendMessage(receiverId, text, isOwn) {
    const container = document.getElementById(`chat-msgs-${receiverId}`);
    if (!container) return;
    const div = document.createElement("div");
    div.className = `chat-msg ${isOwn ? "chat-msg-own" : "chat-msg-other"}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ── Notificação ao receber mensagem ──────────────────────────
  function notifyIncoming(senderId, senderName, senderAvatar, text) {
    playNotificationSound();

    if (openWindows[senderId]) {
      const win = openWindows[senderId];
      const msgs = win.querySelector(".chat-messages");
      appendMessage(senderId, text, false);
      if (msgs.style.display === "none") {
        // minimizada: mostra badge
        const header = win.querySelector(".chat-header span:first-child");
        if (!win.querySelector(".chat-notif-badge")) {
          const badge = document.createElement("span");
          badge.className = "chat-notif-badge";
          badge.style.cssText = "background:#c0392b;color:#fff;border-radius:50%;font-size:10px;padding:1px 5px;margin-left:6px;";
          badge.textContent = "1";
          header.appendChild(badge);
        }
      }
      return;
    }

    // Janela fechada: abre automaticamente
    openChatWindow(senderId, senderName, senderAvatar);
    setTimeout(() => appendMessage(senderId, text, false), 80);
  }

  // ── Realtime — escuta mensagens recebidas ────────────────────
  supabase
    .channel(`inbox-${user.id}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  "messages",
      filter: `receiver_id=eq.${user.id}`
    }, async payload => {
      const senderId = payload.new.sender_id;
      const text     = payload.new.message;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", senderId)
        .single();

      notifyIncoming(senderId, profile?.name || "Usuário", profile?.avatar_url || null, text);
    })
    .subscribe();

})();
