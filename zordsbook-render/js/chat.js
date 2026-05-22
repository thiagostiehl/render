//const supabase = window.supabaseClient;
const supabase = getSupabase();

/* ── Som ───────────────────────── */

function playNotificationSound() {

  const sound = document.getElementById("notifSound");

  if (!sound) return;

  sound.volume = 0.35;

  sound.currentTime = 0;

  sound.play().catch(() => {});

}

/* ── Enviar mensagem ───────────────────────── */

async function sendMessage(receiverId, text) {

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: text
    });

  if (error) {
    console.error(error);
  }

}

/* ── Realtime ───────────────────────── */

supabase
  .channel("chat-realtime")

  .on(
    "postgres_changes",

    {
      event: "INSERT",
      schema: "public",
      table: "messages"
    },

    payload => {

      console.log("Nova mensagem:", payload);

      playNotificationSound();

    }

  )

  .subscribe();

/* ── Input ───────────────────────── */

const input = document.getElementById("chatInput");

if (input) {

  input.addEventListener("keydown", async (e) => {

    if (e.key !== "Enter") return;

    const text = input.value.trim();

    if (!text) return;

    await sendMessage(
      "ID_DO_USUARIO_DESTINO",
      text
    );

    input.value = "";

  });

}
