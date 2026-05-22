/**
 * chat.js — Barra de amigos online estilo Facebook clássico
 *
 * Depende de: supabase-client.js (getSupabase)
 * Injeta no <body>: .chat-sidebar + .chat-window(s)
 */

(async function () {
  const supabase = getSupabase();

  // ── Usuário atual ────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // não logado, não exibe chat

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

  // Recolher / expandir a barra
  let sidebarOpen = true;
  document.getElementById("chat-sidebar-toggle").addEventListener("click", () => {
    const body = document.getElementById("chat-sidebar-body");
    sidebarOpen = !sidebarOpen;
    body.style.display = sidebarOpen ? "block" : "none";
    sidebar.querySelector(".chat-sidebar-toggle").textContent = sidebarOpen ? "▼" : "▲";
  });

  // ── Carrega todos os usuários ────────────────────────────────
  async function loadOnlineFriends() {
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
        <span class="online-dot"></span>
      `;
      div.addEventListener("click", () => openChatWindow(profile.id, profile.name, profile.avatar_url));
      body.appendChild(div);
    });
  }

  await loadOnlineFriends();

  // ── Janelas de chat abertas ──────────────────────────────────
  const openWindows = {}; // { userId: windowElement }
  const windowOffset = 210; // px — espaço da barra de amigos
  const windowWidth  = 270; // px — largura de cada janela

  function openChatWindow(receiverId, receiverName, receiverAvatar) {
    // Se já está aberta, foca no input
    if (openWindows[receiverId]) {
      openWindows[receiverId].querySelector(".chat-input input").focus();
      return;
    }

    // Posição horizontal: empilha janelas da direita para a esquerda
    const index  = Object.keys(openWindows).length;
    const rightPos = windowOffset + index * windowWidth;

    const win = document.createElement("div");
    win.className = "chat-window";
    win.style.right = rightPos + "px";

    const avatarSrc = receiverAvatar
      ? receiverAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(receiverName || "U")}&size=28&background=8b9dc3&color=fff`;

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

    // Fechar janela
    win.querySelector(".chat-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeChatWindow(receiverId);
    });

    // Minimizar ao clicar no header
    let minimized = false;
    win.querySelector(".chat-header").addEventListener("click", (e) => {
      if (e.target.classList.contains("chat-close")) return;
      minimized = !minimized;
      const msgs  = win.querySelector(".chat-messages");
      const input = win.querySelector(".chat-input");
      msgs.style.display  = minimized ? "none" : "flex";
      input.style.display = minimized ? "none" : "flex";
    });

    // Enviar mensagem com Enter
    const inputEl = win.querySelector(".chat-input input");
    inputEl.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = "";

      // Exibe otimisticamente
      appendMessage(receiverId, text, true);

      // Envia para o Supabase
      const { error } = await supabase.from("messages").insert({
        sender_id:   user.id,
        receiver_id: receiverId,
        message:     text
      });
      if (error) console.error("Erro ao enviar mensagem:", error);
    });

    // Carrega histórico
    loadHistory(receiverId);

    // Realtime: recebe mensagens desta conversa
    subscribeToConversation(receiverId);

    inputEl.focus();
  }

  function closeChatWindow(receiverId) {
    const win = openWindows[receiverId];
    if (!win) return;
    win.remove();
    delete openWindows[receiverId];

    // Reposiciona as janelas restantes
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

  // ── Realtime ─────────────────────────────────────────────────
  const channels = {}; // { receiverId: channel }

  function subscribeToConversation(receiverId) {
    if (channels[receiverId]) return;

    const ch = supabase
      .channel(`chat-${user.id}-${receiverId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
        filter: `receiver_id=eq.${user.id}`
      }, payload => {
        if (payload.new.sender_id !== receiverId) return;
        appendMessage(receiverId, payload.new.message, false);
        playNotificationSound();
      })
      .subscribe();

    channels[receiverId] = ch;
  }

  // ── Som de notificação ───────────────────────────────────────
  function playNotificationSound() {
    const sound = document.getElementById("notifSound");
    if (!sound) return;
    sound.volume = 0.35;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

})();
