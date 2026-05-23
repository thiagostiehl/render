// ── Skeleton loader para posts ────────────────────────────────────────────────
function renderPostSkeleton(count = 3) {
  return Array.from({length: count}, () => `
    <article class="post post-skeleton">
      <div class="post-header">
        <div class="skel skel-avatar"></div>
        <div>
          <div class="skel skel-name"></div>
          <div class="skel skel-time"></div>
        </div>
      </div>
      <div class="skel skel-text"></div>
      <div class="skel skel-text skel-text-short"></div>
    </article>`).join("");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function extractYoutubeId(text) {
  const re = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;
  const m = (text || "").match(re);
  return m ? m[1] : null;
}

// ── Render post ───────────────────────────────────────────────────────────────

function renderPost(post, data, currentUser) {
  const author = data.userById[post.userId] || data.users.find((u) => u.id === post.userId);
  if (!author) return "";

  const liked    = post.likes.includes(currentUser.id);
  const disliked = post.dislikes.includes(currentUser.id);

  const likeCountLabel    = post.likes.length    > 0 ? ` <span class="reaction-count">${post.likes.length}</span>`    : "";
  const dislikeCountLabel = post.dislikes.length > 0 ? ` <span class="reaction-count">${post.dislikes.length}</span>` : "";

  const commentsHtml = post.comments.map((c) => {
    const cu = data.userById[c.userId];
    const cuAvatar = cu ? avatarUrl(cu) : `https://api.dicebear.com/7.x/initials/svg?seed=?`;
    return `<div class="comment" style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px">
      <img src="${cuAvatar}" style="width:24px;height:24px;border-radius:2px;flex-shrink:0;object-fit:cover" alt="">
      <div><strong><a href="profile.html?user=${c.userId}" style="color:#365899">${escapeHtml(cu ? cu.name : "Usuário")}</a></strong> ${escapeHtml(c.text)}<br><span style="font-size:10px;color:#90949c">${formatTime(c.createdAt)}</span></div>
    </div>`;
  }).join("");

  const community = post.communityId ? data.communityById?.[post.communityId] : null;
  const communityLabel = community ? `<span class="post-community">${escapeHtml(community.name)}</span> · ` : "";

  let mediaHtml = "";
  if (post.imageUrl) {
    mediaHtml = `<div class="post-media"><img src="${post.imageUrl}" alt="imagem do post" loading="lazy"></div>`;
  }
  const ytId = post.youtubeId || extractYoutubeId(post.text);
  if (ytId && !post.imageUrl) {
    mediaHtml = `<div class="post-media post-media-yt">
      <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  }

  let displayText = escapeHtml(post.text || "");
  if (ytId) {
    displayText = displayText.replace(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_\-?=&]+/g, "").trim();
  }

  const isOwner = post.userId === currentUser.id;

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
        <button type="button" class="btn-reaction btn-toggle-like ${liked ? "active-like" : ""}" data-id="${post.id}" title="Joinha">
          👍${likeCountLabel}
        </button>
        <button type="button" class="btn-reaction btn-toggle-dislike ${disliked ? "active-dislike" : ""}" data-id="${post.id}" title="Antijoinha">
          👎${dislikeCountLabel}
        </button>
        <button type="button" class="btn-link btn-toggle-comments" data-id="${post.id}">Comentar</button>
        ${isOwner ? `<button type="button" class="btn-link btn-delete-post" data-id="${post.id}" style="color:#e74c3c;margin-left:auto">Excluir</button>` : ""}
      </div>
      <div class="comments" id="comments-${post.id}" style="display:${post.comments.length > 0 ? 'block' : 'none'}">
        ${commentsHtml}
        <form class="comment-form" data-post-id="${post.id}">
          <input type="text" placeholder="Escreva um comentário..." required>
          <button type="submit" class="btn btn-small">Enviar</button>
        </form>
      </div>
    </article>
  `;
}

// ── Bind actions via delegação (evita listeners duplicados) ───────────────────

const _boundContainers = new WeakSet();

function bindPostActions(currentUser, onRefresh) {
  const containers = document.querySelectorAll("#feed-posts, #comm-posts, #profile-posts");

  containers.forEach(container => {
    if (_boundContainers.has(container)) return;
    _boundContainers.add(container);

    container.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn || btn.disabled) return;

      const postId = btn.dataset.id;

      if (btn.classList.contains("btn-toggle-like")) {
        btn.disabled = true;
        try {
          await toggleLike(postId, currentUser.id);
          await onRefresh();
        } catch {
          alert("Não foi possível curtir. Tente de novo.");
        } finally {
          btn.disabled = false;
        }
      }
      else if (btn.classList.contains("btn-toggle-dislike")) {
        btn.disabled = true;
        try {
          await toggleDislike(postId, currentUser.id);
          await onRefresh();
        } catch {
          alert("Não foi possível reagir. Tente de novo.");
        } finally {
          btn.disabled = false;
        }
      }
      else if (btn.classList.contains("btn-toggle-comments")) {
        const el = document.getElementById(`comments-${postId}`);
        if (el) el.style.display = el.style.display === "none" ? "block" : "none";
      }
      else if (btn.classList.contains("btn-delete-post")) {
        if (!confirm("Excluir esta publicação?")) return;
        btn.disabled = true;
        try {
          await deletePost(postId);
          await onRefresh();
        } catch {
          alert("Não foi possível excluir. Tente de novo.");
          btn.disabled = false;
        }
      }
    });

    container.addEventListener("submit", async (e) => {
      const form = e.target.closest(".comment-form");
      if (!form) return;
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
      } catch {
        alert("Não foi possível comentar. Tente de novo.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
}
