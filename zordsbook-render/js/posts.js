// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Extrai o ID de um link do YouTube (vários formatos)
function extractYoutubeId(text) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

// ── Render post ───────────────────────────────────────────────────────────────

function renderPost(post, data, currentUser) {
  const author = data.userById[post.userId] || data.users.find((u) => u.id === post.userId);
  if (!author) return "";

  const liked    = post.likes.includes(currentUser.id);
  const disliked = post.dislikes.includes(currentUser.id);

  const likeCount    = post.likes.length;
  const dislikeCount = post.dislikes.length;

  const likeCountLabel    = likeCount    > 0 ? ` <span class="reaction-count">${likeCount}</span>`    : "";
  const dislikeCountLabel = dislikeCount > 0 ? ` <span class="reaction-count">${dislikeCount}</span>` : "";

  // Comentários
  const commentsHtml = post.comments
    .map((c) => {
      const cu = data.userById[c.userId];
      const name = cu ? cu.name : "Usuário";
      return `<div class="comment"><strong>${escapeHtml(name)}</strong> ${escapeHtml(c.text)}</div>`;
    })
    .join("");

  const community = post.communityId ? data.communityById?.[post.communityId] : null;
  const communityLabel = community
    ? `<span class="post-community">${escapeHtml(community.name)}</span> · `
    : "";

  // Mídia: imagem
  let mediaHtml = "";
  if (post.imageUrl) {
    mediaHtml = `<div class="post-media"><img src="${post.imageUrl}" alt="imagem do post" loading="lazy"></div>`;
  }
  // Mídia: YouTube (da coluna youtube_id ou detectado no texto)
  const ytId = post.youtubeId || extractYoutubeId(post.text || "");
  if (ytId && !post.imageUrl) {
    mediaHtml = `<div class="post-media post-media-yt">
      <iframe
        src="https://www.youtube.com/embed/${ytId}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>`;
  }

  // Texto limpo (remove a URL do YouTube se já virou embed)
  let displayText = escapeHtml(post.text || "");
  if (ytId) {
    displayText = displayText.replace(
      /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_\-?=&]+/g, ""
    ).trim();
  }

  return `
    <article class="post" data-post-id="${post.id}">
      <div class="post-header">
        <img class="post-avatar" src="${avatarUrl(author)}" alt="">
        <div>
          <a class="post-author" href="profile.html?user=${author.id}">${escapeHtml(author.name)}</a>
          <div class="post-time">${communityLabel}${formatTime(post.createdAt)}</div>
        </div>
      </div>
      ${displayText ? `<p class="post-text">${displayText}</p>` : ""}
      ${mediaHtml}
      <div class="post-actions">
        <button type="button"
          class="btn-reaction btn-toggle-like ${liked ? "active-like" : ""}"
          data-id="${post.id}"
          title="Joinha">
          👍${likeCountLabel}
        </button>
        <button type="button"
          class="btn-reaction btn-toggle-dislike ${disliked ? "active-dislike" : ""}"
          data-id="${post.id}"
          title="Antijoinha">
          👎${dislikeCountLabel}
        </button>
        <button type="button" class="btn-link btn-toggle-comments" data-id="${post.id}">Comentar</button>
      </div>
      <div class="comments" id="comments-${post.id}" style="display:none">
        ${commentsHtml}
        <form class="comment-form" data-post-id="${post.id}">
          <input type="text" placeholder="Escreva um comentário..." required>
          <button type="submit" class="btn btn-small">Enviar</button>
        </form>
      </div>
    </article>
  `;
}

// ── Bind actions ──────────────────────────────────────────────────────────────

function bindPostActions(currentUser, onRefresh) {
  // 👍 Like
  document.querySelectorAll(".btn-toggle-like").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await toggleLike(btn.dataset.id, currentUser.id);
        await onRefresh();
      } catch (e) {
        alert("Não foi possível curtir. Tente de novo.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  // 👎 Dislike
  document.querySelectorAll(".btn-toggle-dislike").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await toggleDislike(btn.dataset.id, currentUser.id);
        await onRefresh();
      } catch (e) {
        alert("Não foi possível reagir. Tente de novo.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Comentários — toggle visibilidade
  document.querySelectorAll(".btn-toggle-comments").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(`comments-${btn.dataset.id}`);
      if (el) el.style.display = el.style.display === "none" ? "block" : "none";
    });
  });

  // Formulário de comentário
  document.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await addComment(form.dataset.postId, currentUser.id, text);
        input.value = "";
        await onRefresh();
      } catch (err) {
        alert("Não foi possível comentar. Tente de novo.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
}
