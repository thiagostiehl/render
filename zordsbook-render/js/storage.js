let cachedUser = null;
const COMMUNITY_KEY = "zords_selected_community";

function profileToUser(profile, email) {
  return {
    id: profile.id,
    name: profile.name,
    email: email || "",
    bio: profile.bio || "",
    avatar: profile.avatar_url || "",
    cover: profile.cover_url || "",
    spotify_connected: !!profile.spotify_refresh_token,
    spotify_refresh_token: profile.spotify_refresh_token || null,
  };
}

function getSelectedCommunityId() { return localStorage.getItem(COMMUNITY_KEY); }
function setSelectedCommunityId(id) { localStorage.setItem(COMMUNITY_KEY, id); }

async function getSessionUser() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const session = data?.session;
  if (!session?.user) { cachedUser = null; return null; }
  const { data: profile, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (error || !profile) return null;
  cachedUser = profileToUser(profile, session.user.email);
  return cachedUser;
}

function getCurrentUser() { return cachedUser; }

async function requireAuth() {
  const user = await getSessionUser();
  if (!user) { window.location.href = "index.html"; return null; }
  return user;
}

async function signIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  cachedUser = null;
  return data;
}

async function signUp(name, email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw error;
  return data;
}

async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
  cachedUser = null;
}

function getSiteBaseUrl() {
  const configured = getConfig()?.SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const origin = window.location.origin;
  if (!origin || origin === "null" || origin.startsWith("file:")) return "";
  const path = window.location.pathname.replace(/[^/]+$/, "");
  return `${origin}${path}`.replace(/\/$/, "");
}

function getPasswordResetRedirectUrl() {
  const base = getSiteBaseUrl();
  if (!base) throw new Error("Defina SITE_URL em js/config.js.");
  return `${base}/reset-password.html`;
}

async function resetPassword(email) {
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: getPasswordResetRedirectUrl() });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Dados globais ─────────────────────────────────────────────────────────────

async function fetchCommunityData() {
  const sb = getSupabase();
  const [profilesRes, communitiesRes, postsRes, likesRes, commentsRes, testimonialsRes, membersRes, friendsRes] = await Promise.all([
    sb.from("profiles").select("*").order("name"),
    sb.from("communities").select("*").order("name"),
    sb.from("posts").select("*").order("created_at", { ascending: false }),
    sb.from("post_likes").select("*"),
    sb.from("comments").select("*").order("created_at", { ascending: true }),
    sb.from("testimonials").select("*").order("created_at", { ascending: false }),
    sb.from("community_members").select("*"),
    sb.from("friendships").select("*"),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (communitiesRes.error) throw communitiesRes.error;
  if (postsRes.error) throw postsRes.error;

  const users = profilesRes.data.map(p => profileToUser(p));
  const userById = Object.fromEntries(users.map(u => [u.id, u]));

  const communities = (communitiesRes.data || []).map(c => ({
    id: c.id, name: c.name, slug: c.slug, description: c.description || "", creatorId: c.creator_id,
  }));
  const communityById = Object.fromEntries(communities.map(c => [c.id, c]));

  const communityMembers = membersRes.data || [];

  const posts = (postsRes.data || []).map(post => ({
    id: post.id, userId: post.user_id, communityId: post.community_id, text: post.text,
    createdAt: new Date(post.created_at).getTime(),
    likes: (likesRes.data || []).filter(l => l.post_id === post.id).map(l => l.user_id),
    comments: (commentsRes.data || []).filter(c => c.post_id === post.id).map(c => ({
      userId: c.user_id, text: c.text, createdAt: new Date(c.created_at).getTime(),
    })),
  }));

  const testimonials = (testimonialsRes.data || []).map(t => ({
    id: t.id, profileUserId: t.profile_user_id, authorUserId: t.author_user_id,
    text: t.text, createdAt: new Date(t.created_at).getTime(),
  }));

  const friendships = friendsRes.data || [];

  return {
    users, userById, posts, communities, communityById, communityMembers,
    testimonials, friendships, selectedCommunityId: getSelectedCommunityId(),
  };
}

// ── Amizades ─────────────────────────────────────────────────────────────────

function getFriendshipStatus(friendships, myId, otherId) {
  const f = friendships.find(f =>
    (f.requester_id === myId && f.addressee_id === otherId) ||
    (f.requester_id === otherId && f.addressee_id === myId)
  );
  if (!f) return null;
  return { status: f.status, iRequested: f.requester_id === myId, id: f.id };
}

function getMyFriendIds(friendships, myId) {
  return friendships
    .filter(f => f.status === "accepted" && (f.requester_id === myId || f.addressee_id === myId))
    .map(f => f.requester_id === myId ? f.addressee_id : f.requester_id);
}

async function sendFriendRequest(toUserId, fromUserId) {
  const sb = getSupabase();
  const { error } = await sb.from("friendships").insert({ requester_id: fromUserId, addressee_id: toUserId });
  if (error) throw error;
  // Notificação
  await sb.from("notifications").insert({ user_id: toUserId, actor_id: fromUserId, kind: "friend_request" }).catch(() => {});
}

async function acceptFriendRequest(friendshipId, actorId, myId) {
  const sb = getSupabase();
  const { error } = await sb.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
  if (error) throw error;
  await sb.from("notifications").insert({ user_id: actorId, actor_id: myId, kind: "friend_accepted" }).catch(() => {});
}

async function removeFriendship(friendshipId) {
  const sb = getSupabase();
  const { error } = await sb.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

// ── Notificações ──────────────────────────────────────────────────────────────

async function fetchNotifications(userId) {
  const sb = getSupabase();
  const { data, error } = await sb.from("notifications")
    .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  if (error) return [];
  return data;
}

async function markNotificationsRead(userId) {
  const sb = getSupabase();
  await sb.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

// ── Comunidades ───────────────────────────────────────────────────────────────

async function createCommunity(name, description, creatorId) {
  const sb = getSupabase();
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + Date.now().toString(36);
  const { data, error } = await sb.from("communities")
    .insert({ name, description, slug, creator_id: creatorId }).select().single();
  if (error) throw error;
  await sb.from("community_members").insert({ community_id: data.id, user_id: creatorId }).catch(() => {});
  return data;
}

async function joinCommunity(communityId, userId) {
  const sb = getSupabase();
  const { error } = await sb.from("community_members").insert({ community_id: communityId, user_id: userId });
  if (error && !error.message.includes("duplicate")) throw error;
}

async function leaveCommunity(communityId, userId) {
  const sb = getSupabase();
  const { error } = await sb.from("community_members").delete()
    .eq("community_id", communityId).eq("user_id", userId);
  if (error) throw error;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

async function createPost(userId, text, communityId) {
  const sb = getSupabase();
  const { error } = await sb.from("posts").insert({ user_id: userId, text, community_id: communityId || null });
  if (error) throw error;
}

async function toggleLike(postId, userId) {
  const sb = getSupabase();
  const { data: existing } = await sb.from("post_likes").select("*").eq("post_id", postId).eq("user_id", userId).maybeSingle();
  if (existing) {
    await sb.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await sb.from("post_likes").insert({ post_id: postId, user_id: userId });
  }
}

async function addComment(postId, userId, text) {
  const sb = getSupabase();
  const { error } = await sb.from("comments").insert({ post_id: postId, user_id: userId, text });
  if (error) throw error;
}

async function updateBio(userId, bio) {
  const sb = getSupabase();
  const { error } = await sb.from("profiles").update({ bio }).eq("id", userId);
  if (error) throw error;
  if (cachedUser && cachedUser.id === userId) cachedUser.bio = bio;
}

async function uploadProfileImage(userId, file, kind) {
  const sb = getSupabase();
  const maxMb = 3;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Imagem muito grande. Máximo ${maxMb} MB.`);
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const bucket = kind === "cover" ? "covers" : "avatars";
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg","jpeg","png","webp","gif"].includes(ext) ? ext : "jpg";
  const path = `${userId}/${Date.now()}.${safeExt}`;
  const { error: upErr } = await sb.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" });
  if (upErr) throw upErr;
  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;
  const field = kind === "cover" ? "cover_url" : "avatar_url";
  const { error } = await sb.from("profiles").update({ [field]: publicUrl }).eq("id", userId);
  if (error) throw error;
  if (cachedUser && cachedUser.id === userId) {
    if (kind === "cover") cachedUser.cover = publicUrl;
    else cachedUser.avatar = publicUrl;
  }
  return publicUrl;
}

async function createTestimonial(profileUserId, authorUserId, text) {
  const sb = getSupabase();
  const { error } = await sb.from("testimonials").insert({ profile_user_id: profileUserId, author_user_id: authorUserId, text });
  if (error) throw error;
  await sb.from("notifications").insert({ user_id: profileUserId, actor_id: authorUserId, kind: "testimonial" }).catch(() => {});
}

// ── Spotify friends ───────────────────────────────────────────────────────────

async function fetchFriendsNowPlaying(friendIds, nowPlayingUrl) {
  if (!friendIds.length) return [];
  const results = await Promise.allSettled(
    friendIds.map(id => fetch(`${nowPlayingUrl}?user_id=${id}`, { cache: "no-store" }).then(r => r.json()).then(d => ({ userId: id, ...d })))
  );
  return results.filter(r => r.status === "fulfilled" && r.value?.is_playing).map(r => r.value);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function formatTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(ts).toLocaleDateString("pt-BR");
}

function avatarUrl(user) {
  if (user && user.avatar) return user.avatar;
  const initial = ((user && user.name) || "?").charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%233b5998" width="80" height="80"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="36" font-family="Tahoma">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function coverStyle(user) {
  if (user && user.cover) return `background-image:url('${user.cover}');background-size:cover;background-position:center;`;
  return "";
}

function renderTopbar(activePage, user, unreadCount) {
  if (!user) return "";
  const badge = unreadCount > 0
    ? `<span class="notif-badge">${unreadCount > 9 ? "9+" : unreadCount}</span>`
    : "";
  const pages = [
    { id: "home", label: "Início", href: "home.html" },
    { id: "members", label: "Membros", href: "members.html" },
    { id: "communities", label: "Comunidades", href: "communities.html" },
    { id: "profile", label: "Perfil", href: "profile.html" },
  ];
  const links = pages.map(p =>
    `<a href="${p.href}" class="${activePage === p.id ? "active" : ""}">${p.label}</a>`
  ).join("");
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <a href="home.html" class="logo">Zords<span>Book</span></a>
        <nav>${links}</nav>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="notif-wrap" id="notif-wrap">
            <button class="notif-btn" id="notif-btn" title="Notificações">🔔${badge}</button>
            <div class="notif-dropdown" id="notif-dropdown" style="display:none"></div>
          </div>
          <span class="topbar-user">Olá, <strong>${user.name}</strong> · <a href="#" id="btn-logout" style="color:#fff">Sair</a></span>
        </div>
      </div>
    </header>`;
}

async function initNotifications(currentUser) {
  const notifs = await fetchNotifications(currentUser.id);
  const unread = notifs.filter(n => !n.read).length;

  // Re-renderiza topbar com badge
  const topbarEl = document.getElementById("topbar");
  if (topbarEl) {
    const activePage = document.body.dataset.page || "";
    topbarEl.innerHTML = renderTopbar(activePage, currentUser, unread);
    bindLogout();
    bindNotifDropdown(currentUser, notifs);
  }
}

async function bindNotifDropdown(currentUser, notifs) {
  const btn = document.getElementById("notif-btn");
  const dropdown = document.getElementById("notif-dropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display !== "none";
    dropdown.style.display = isOpen ? "none" : "block";
    if (!isOpen) {
      renderNotifDropdown(dropdown, notifs, currentUser);
      await markNotificationsRead(currentUser.id);
      const badge = document.querySelector(".notif-badge");
      if (badge) badge.remove();
    }
  });

  document.addEventListener("click", () => { dropdown.style.display = "none"; });
}

function renderNotifDropdown(dropdown, notifs, currentUser) {
  if (!notifs.length) {
    dropdown.innerHTML = `<div class="notif-empty">Nenhuma notificação ainda.</div>`;
    return;
  }
  const kindLabel = { friend_request: "quer ser seu amigo", friend_accepted: "aceitou sua amizade", testimonial: "escreveu um depoimento", post_on_wall: "publicou no seu mural" };
  dropdown.innerHTML = notifs.slice(0, 15).map(n => `
    <div class="notif-item ${n.read ? "" : "unread"}">
      <span class="notif-dot"></span>
      <div>
        <strong>alguém</strong> ${kindLabel[n.kind] || n.kind}
        <div class="notif-time">${formatTime(new Date(n.created_at).getTime())}</div>
      </div>
    </div>`).join("");
}

function bindLogout() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await signOut(); } finally { window.location.href = "index.html"; }
  });
}

function getFeedPosts(data, communityId) {
  return data.posts.filter(p => p.communityId === communityId || p.communityId == null);
}

function getInviteCode() { return getConfig()?.GROUP_INVITE_CODE || "ZORDS2026"; }
function validateInviteCode(input) { return input.trim().toUpperCase() === getInviteCode().toUpperCase(); }
function isConfigured() { return !!(getConfig()?.SUPABASE_URL && getConfig()?.SUPABASE_ANON_KEY); }


