/**
 * chat.js — Barra de amigos estilo Facebook clássico
 * Depende de: supabase-client.js (getSupabase)
 */

(async function () {
  const supabase = getSupabase();

  // ── Usuário atual ────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // ── Som de notificação ───────────────────────────────────────
  function playNotificationSound() {
    // Tenta o elemento existente no HTML
    let sound = document.getElementById("notifSound");
    // Se não achou ou não tem source, cria um novo via URL absoluta
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

  // ── Carrega todos os usuários (sem bolinha, só lista) ────────
  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .neq("id", user.id)
      .order("name");

    const body = document.getElementById("chat-sidebar-body");

    if (error || !profiles || profiles.length === 0) {
      body.innerHTML = `<p class="chat-empty">Nenhum usuário encontrado.</p>`;
      return;
    }

    body.innerHTML = "";
    profiles.forEach(profile => {
      const div = document.createElement("div");
      div.className = "chat-user";
      div.dataset.userId   = profile.id;
      div.dataset.userName = profile.name || "Usuário";

      const avatar = profile.avatar_url
        ? `<img src="${profile.avatar_url}" alt="${profile.name}">`
        : `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&size=28&background=8b9dc3&color=fff" alt="${profile.name}">`;

      div.innerHTML = `
        ${avatar}
        <span class="chat-user-name">${profile.name || "Usuário"}</span>
      `;
      div.addEventListener("click", () => openChatWindow(profile.id, profile.name, profile.avatar_url));
      body.appendChild(div);
    });
  }

  await loadUsers();

  // ── Janelas abertas ──────────────────────────────────────────
  const openWindows = {};
  const windowOffset = 210;
  const windowWidth  = 270;

  function openChatWindow(receiverId, receiverName, receiverAvatar) {
    if (openWindows[receiverId]) {
      // Janela já aberta: desminimiza e foca
      const win = openWindows[receiverId];
      win.querySelector(".chat-messages").style.display = "flex";
      win.querySelector(".chat-input").style.display = "flex";
      win.querySelector(".chat-input input").focus();
      // Remove badge de notificação se tiver
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

    // Minimizar ao clicar no header
    let minimized = false;
    win.querySelector(".chat-header").addEventListener("click", (e) => {
      if (e.target.classList.contains("chat-close")) return;
      minimized = !minimized;
      win.querySelector(".chat-messages").style.display = minimized ? "none" : "flex";
      win.querySelector(".chat-input").style.display    = minimized ? "none" : "flex";
      // Remove badge ao abrir
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
    // Reposiciona restantes
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

  // ── Notificação visual quando janela está minimizada/fechada ─
  function notifyIncoming(senderId, senderName, senderAvatar, text) {
    playNotificationSound();

    // Se a janela já está aberta e visível, só adiciona a mensagem
    if (openWindows[senderId]) {
      const win = openWindows[senderId];
      const msgs = win.querySelector(".chat-messages");
      if (msgs.style.display !== "none") {
        appendMessage(senderId, text, false);
        return;
      }
      // Minimizada: mostra badge no header
      appendMessage(senderId, text, false);
      const header = win.querySelector(".chat-header span:first-child");
      if (!win.querySelector(".chat-notif-badge")) {
        const badge = document.createElement("span");
        badge.className = "chat-notif-badge";
        badge.style.cssText = "background:#c0392b;color:#fff;border-radius:50%;font-size:10px;padding:1px 5px;margin-left:6px;";
        badge.textContent = "1";
        header.appendChild(badge);
      }
      return;
    }

    // Janela fechada: abre automaticamente com a mensagem
    openChatWindow(senderId, senderName, senderAvatar);
    // Pequeno delay para o DOM criar o container antes de inserir
    setTimeout(() => appendMessage(senderId, text, false), 50);
  }

  // ── Realtime global — escuta TODAS as mensagens recebidas ────
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

      // Busca nome/avatar do remetente
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", senderId)
        .single();

      const senderName   = profile?.name   || "Usuário";
      const senderAvatar = profile?.avatar_url || null;

      notifyIncoming(senderId, senderName, senderAvatar, text);
    })
    .subscribe();

})();
