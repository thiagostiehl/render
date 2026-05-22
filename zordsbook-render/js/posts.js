function renderPost(post, data, currentUser) {
  const author = data.userById[post.userId] || data.users.find((u) => u.id === post.userId);
  if (!author) return "";

  const liked = post.likes.includes(currentUser.id);
  const likeLabel = liked ? "Descurtir" : "Curtir";
  const likeCount =
    post.likes.length > 0
      ? ` · ${post.likes.length} curtida${post.likes.length > 1 ? "s" : ""}`
      : "";

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

  return `
    <article class="post" data-post-id="${post.id}">
      <div class="post-header">
        <img class="post-avatar" src="${avatarUrl(author)}" alt="">
        <div>
          <a class="post-author" href="profile.html?user=${author.id}">${escapeHtml(author.name)}</a>
          <div class="post-time">${communityLabel}${formatTime(post.createdAt)}</div>
        </div>
      </div>
      <p class="post-text">${escapeHtml(post.text)}</p>
      <div class="post-actions">
        <button type="button" class="btn-link btn-toggle-like ${liked ? "liked" : ""}" data-id="${post.id}">${likeLabel}${likeCount}</button>
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function bindPostActions(currentUser, onRefresh) {
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

  document.querySelectorAll(".btn-toggle-comments").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(`comments-${btn.dataset.id}`);
      if (el) el.style.display = el.style.display === "none" ? "block" : "none";
    });
  });

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
