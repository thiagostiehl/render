const input = document.getElementById("chatInput");

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
