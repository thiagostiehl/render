(async function initProfile() {
  if (!isConfigured()) {
    window.location.href = "index.html";
    return;
  }

  const currentUser = await requireAuth();
  if (!currentUser) return;

  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("user") || currentUser.id;

  let communityData = await fetchCommunityData();
  let profileUser = communityData.userById[profileId];

  if (!profileUser) {
    window.location.href = "home.html";
    return;
  }

  const isOwnProfile = profileUser.id === currentUser.id;

  document.getElementById("topbar").innerHTML = renderTopbar("profile", currentUser);
  bindLogout();
  document.title = `${profileUser.name} — ZordsBook`;

  function renderCover() {
    const coverEl = document.getElementById("profile-cover");
    const wrap = document.getElementById("upload-cover-wrap");
    const uploadHtml = isOwnProfile
      ? '<div class="profile-upload-cover" id="upload-cover-wrap"><label class="btn btn-small btn-upload">Trocar capa<input type="file" id="cover-file" accept="image/*" hidden></label></div>'
      : "";

    if (profileUser.cover) {
      coverEl.style.cssText = "position:relative;";
      coverEl.innerHTML = `<img src="${profileUser.cover}" alt="">${uploadHtml}`;
    } else {
      coverEl.style.cssText = (coverStyle(profileUser) || "") + "position:relative;min-height:200px;";
      coverEl.innerHTML = uploadHtml;
    }

  }

  async function onCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadProfileImage(currentUser.id, file, "cover");
      communityData = await fetchCommunityData();
      profileUser = communityData.userById[profileId] || profileUser;
      renderCover();
    } catch (err) {
      alert(err.message || "Erro ao enviar capa.");
    }
    e.target.value = "";
  }

  function renderAvatar() {
    document.getElementById("profile-avatar").src = avatarUrl(profileUser);
    if (isOwnProfile) {
      document.getElementById("upload-avatar-wrap").style.display = "inline-block";
    }
  }

  renderCover();
  renderAvatar();

  document.getElementById("profile-name").textContent = profileUser.name;
  document.getElementById("profile-bio").textContent =
    profileUser.bio || "Sem informações na bio ainda.";

  const members = communityData.users.filter((u) => u.id !== profileUser.id);

  document.getElementById("profile-about").innerHTML = `
    <h3>Sobre</h3>
    <p style="font-size:11px;line-height:1.5">${profileUser.bio || "Este usuário ainda não preencheu a bio."}</p>
    ${
      isOwnProfile
        ? `
      <form id="form-bio" style="margin-top:10px">
        <div class="form-group">
          <label>Editar bio</label>
          <textarea id="bio-input">${profileUser.bio || ""}</textarea>
        </div>
        <button type="submit" class="btn btn-small">Salvar bio</button>
      </form>
    `
        : ""
    }
  `;

  document.getElementById("profile-friends").innerHTML = members
    .map(
      (f) => `
    <li>
      <img src="${avatarUrl(f)}" alt="">
      <a href="profile.html?user=${f.id}">${f.name}</a>
    </li>
  `
    )
    .join("");

  document.getElementById("profile-meta").textContent = isOwnProfile
    ? "Seu perfil — troque foto e capa, receba depoimentos dos amigos."
    : `Perfil de ${profileUser.name}. Deixe um depoimento!`;

  document.getElementById("wall-title").textContent = isOwnProfile
    ? "Seu mural"
    : `Mural de ${profileUser.name}`;

  if (isOwnProfile) {
    document.getElementById("own-composer").style.display = "block";
  }

  function renderTestimonials() {
    const list = communityData.testimonials.filter(
      (t) => t.profileUserId === profileUser.id
    );
    const container = document.getElementById("testimonials-list");

    if (!list.length) {
      container.innerHTML =
        '<p style="color:#90949c;font-size:11px">Nenhum depoimento ainda.</p>';
      return;
    }

    container.innerHTML = list
      .map((t) => {
        const author = communityData.userById[t.authorUserId];
        const name = author ? author.name : "Alguém";
        return `
        <div class="testimonial">
          <p style="font-size:12px;line-height:1.4">"${escapeHtml(t.text)}"</p>
          <p style="margin-top:4px;color:#90949c;font-size:10px">— <strong>${escapeHtml(name)}</strong> · ${formatTime(t.createdAt)}</p>
        </div>
      `;
      })
      .join("");
  }

  if (!isOwnProfile) {
    document.getElementById("testimonial-form-wrap").style.display = "block";
  }

  async function refreshProfilePosts() {
    communityData = await fetchCommunityData();
    profileUser = communityData.userById[profileId] || profileUser;
    renderAvatar();
    renderCover();
    renderTestimonials();

    const posts = communityData.posts
      .filter((p) => p.userId === profileUser.id)
      .sort((a, b) => b.createdAt - a.createdAt);

    const container = document.getElementById("profile-posts");
    if (posts.length === 0) {
      container.innerHTML =
        '<p style="color:#90949c">Nenhuma publicação neste mural ainda.</p>';
      return;
    }

    container.innerHTML = posts
      .map((p) => renderPost(p, communityData, currentUser))
      .join("");
    bindPostActions(currentUser, refreshProfilePosts);
  }

  if (isOwnProfile) {
    document.getElementById("profile-cover").addEventListener("change", (e) => {
      if (e.target.id === "cover-file") onCoverChange(e);
    });

    document.getElementById("avatar-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await uploadProfileImage(currentUser.id, file, "avatar");
        await refreshProfilePosts();
      } catch (err) {
        alert(err.message || "Erro ao enviar foto.");
      }
      e.target.value = "";
    });

  }

  document.getElementById("form-testimonial")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("testimonial-text").value.trim();
    if (!text) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await createTestimonial(profileUser.id, currentUser.id, text);
      document.getElementById("testimonial-text").value = "";
      await refreshProfilePosts();
    } catch (err) {
      alert(err.message || "Não foi possível publicar o depoimento.");
    } finally {
      btn.disabled = false;
    }
  });

  if (isOwnProfile) {
    document.getElementById("form-profile-post").addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = document.getElementById("profile-post-text");
      const text = textarea.value.trim();
      if (!text) return;

      const communityId = getSelectedCommunityId();
      if (!communityId) {
        alert("Escolha uma comunidade na página Início primeiro.");
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await createPost(currentUser.id, text, communityId);
        textarea.value = "";
        await refreshProfilePosts();
      } catch (err) {
        alert("Não foi possível publicar.");
      } finally {
        btn.disabled = false;
      }
    });

    const bioForm = document.getElementById("form-bio");
    if (bioForm) {
      bioForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const bio = document.getElementById("bio-input").value.trim();
        const btn = bioForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
          await updateBio(currentUser.id, bio);
          document.getElementById("profile-bio").textContent =
            bio || "Sem informações na bio ainda.";
          profileUser.bio = bio;
        } catch (err) {
          alert("Não foi possível salvar a bio.");
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  await refreshProfilePosts();
})();
