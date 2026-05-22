const supabase = getSupabase();

// ── ID do destinatário ──────────────────────────────────────────
// Substitua por como você obtém o ID do amigo (URL, data-attribute, etc.)
// Exemplo: const receiverId = new URLSearchParams(location.search).get("user");
const receiverId = "COLOQUE_O_ID_REAL_AQUI";

// ── Som ────────────────────────────────────────────────────────
function playNotificationSound() {
  const sound = document.getElementById("notifSound");
  if (!sound) return;
  sound.volume = 0.35;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// ── Renderizar mensagem no DOM ─────────────────────────────────
function renderMessage(msg, currentUserId) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const div = document.createElement("div");
  div.className = msg.sender_id === currentUserId ? "msg msg-own" : "msg msg-other";
  div.textContent = msg.message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight; // scroll para o final
}

// ── Carregar histórico ─────────────────────────────────────────
async function loadMessages(currentUserId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),` +
      `and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`
    )
    .order("created_at", { ascending: true });

  if (error) { console.error("Erro ao carregar mensagens:", error); return; }
  data.forEach(msg => renderMessage(msg, currentUserId));
}

// ── Enviar mensagem ────────────────────────────────────────────
async function sendMessage(currentUserId, text) {
  const { error } = await supabase
    .from("messages")
    .insert({ sender_id: currentUserId, receiver_id: receiverId, message: text });

  if (error) console.error("Erro ao enviar:", error);
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.warn("Usuário não logado"); return; }

  await loadMessages(user.id);

  // Realtime com filtro apenas para esta conversa
  supabase
    .channel("chat-realtime")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `receiver_id=eq.${user.id}` // só mensagens para você
    }, payload => {
      // Filtra só mensagens desta conversa
      if (payload.new.sender_id !== receiverId) return;
      renderMessage(payload.new, user.id);
      playNotificationSound();
    })
    .subscribe();

  // Input
  const input = document.getElementById("chatInput");
  if (!input) return;
  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const text = input.value.trim();
    if (!text) return;
    const msg = { sender_id: user.id, receiver_id: receiverId, message: text, created_at: new Date().toISOString() };
    renderMessage(msg, user.id); // exibe imediatamente (optimistic UI)
    input.value = "";
    await sendMessage(user.id, text);
  });
}

init();
