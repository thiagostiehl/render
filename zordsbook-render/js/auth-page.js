(async function initAuthPage() {
  const setupBox = document.getElementById("setup-box");
  const authSection = document.getElementById("auth-section");

  if (!isConfigured()) {
    setupBox.style.display = "block";
    document.getElementById("box-login").style.display = "none";
    document.getElementById("box-register").style.display = "none";
    return;
  }

  setupBox.style.display = "none";

  const user = await getSessionUser();
  if (user) {
    window.location.href = "home.html";
    return;
  }

  const showError = (el, msg) => {
    el.textContent = msg;
    el.style.display = "block";
  };

  const hideAllAuthBoxes = () => {
    document.getElementById("box-login").style.display = "none";
    document.getElementById("box-register").style.display = "none";
    document.getElementById("box-forgot").style.display = "none";
    document.getElementById("forgot-error").style.display = "none";
    document.getElementById("forgot-success").style.display = "none";
  };

  const showLogin = () => {
    hideAllAuthBoxes();
    document.getElementById("box-login").style.display = "block";
  };

  document.getElementById("show-register").addEventListener("click", () => {
    hideAllAuthBoxes();
    document.getElementById("box-register").style.display = "block";
  });

  document.getElementById("show-login").addEventListener("click", showLogin);
  document.getElementById("show-login-from-forgot").addEventListener("click", showLogin);
  document.getElementById("show-forgot").addEventListener("click", () => {
    hideAllAuthBoxes();
    document.getElementById("box-forgot").style.display = "block";
  });
  document.getElementById("show-forgot-from-register").addEventListener("click", () => {
    hideAllAuthBoxes();
    document.getElementById("box-forgot").style.display = "block";
  });

  document.getElementById("form-forgot").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("forgot-error");
    const ok = document.getElementById("forgot-success");
    err.style.display = "none";
    ok.style.display = "none";
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const email = document.getElementById("forgot-email").value.trim().toLowerCase();
      await resetPassword(email);
      ok.textContent =
        "Se esse e-mail existir, você receberá um link em instantes. Confira a caixa de entrada e o spam.";
      ok.style.display = "block";
    } catch (error) {
      showError(err, translateAuthError(error));
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("login-error");
    err.style.display = "none";
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value;
      await signIn(email, password);
      window.location.href = "home.html";
    } catch (error) {
      showError(err, translateAuthError(error));
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("form-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("register-error");
    err.style.display = "none";
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const invite = document.getElementById("reg-invite").value;
      if (!validateInviteCode(invite)) {
        showError(err, "Código do grupo incorreto. Peça o código para quem criou o ZordsBook.");
        return;
      }

      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim().toLowerCase();
      const password = document.getElementById("reg-password").value;

      const result = await signUp(name, email, password);

      if (result?.user && !result.session) {
        showError(
          err,
          "Conta criada! Confirme o e-mail (se o Supabase pedir) e depois entre com login."
        );
        err.style.display = "block";
        err.style.background = "#e7f3ff";
        err.style.borderColor = "#365899";
        err.style.color = "#1d2129";
        return;
      }

      window.location.href = "home.html";
    } catch (error) {
      showError(err, translateAuthError(error));
    } finally {
      btn.disabled = false;
    }
  });
})();

function translateAuthError(error) {
  const msg = error?.message || "Erro desconhecido.";
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("User already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("Password")) return "Senha muito fraca (mínimo 6 caracteres no servidor).";
  return msg;
}
