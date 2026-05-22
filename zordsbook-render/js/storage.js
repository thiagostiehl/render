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
    friends: [],
    spotify_connected: !!profile.spotify_refresh_token,
  };
}

function getSelectedCommunityId() {
  return localStorage.getItem(COMMUNITY_KEY);
}

function setSelectedCommunityId(id) {
  localStorage.setItem(COMMUNITY_KEY, id);
}

function ensureDefaultCommunity(communities) {
  if (!communities.length) return null;
  const saved = getSelectedCommunityId();
  if (saved && communities.some((c) => c.id === saved)) return saved;
  setSelectedCommunityId(communities[0].id);
  return communities[0].id;
}

async function getSessionUser() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data } = await sb.auth.getSession();
  const session = data?.session;
  if (!session?.user) {
    cachedUser = null;
    return null;
  }

  const { data: profile, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) return null;

  cachedUser = profileToUser(profile, session.user.email);
  return cachedUser;
}

function getCurrentUser() {
  return cachedUser;
}

async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
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
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
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
  if (!base) {
    throw new Error(
      "Defina SITE_URL em js/config.js com seu link Netlify (ex.: https://zordsbook.netlify.app)."
    );
  }
  return `${base}/reset-password.html`;
}

async function resetPassword(email) {
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function fetchCommunityData() {
  const sb = getSupabase();
  const [
    profilesRes,
    communitiesRes,
    postsRes,
    likesRes,
    commentsRes,
    testimonialsRes,
  ] = await Promise.all([
    sb.from("profiles").select("*").order("name"),
    sb.from("communities").select("*").order("name"),
    sb.from("posts").select("*").order("created_at", { ascending: false }),
    sb.from("post_likes").select("*"),
    sb.from("comments").select("*").order("created_at", { ascending: true }),
    sb.from("testimonials").select("*").order("created_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (communitiesRes.error) throw communitiesRes.error;
  if (postsRes.error) throw postsRes.error;
  if (likesRes.error) throw likesRes.error;
  if (commentsRes.error) throw commentsRes.error;
  if (testimonialsRes.error) throw testimonialsRes.error;

  const communities = communitiesRes.data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const communityById = Object.fromEntries(communities.map((c) => [c.id, c]));
  ensureDefaultCommunity(communities);

  const users = profilesRes.data.map((p) => profileToUser(p));
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  const posts = postsRes.data.map((post) => ({
    id: post.id,
    userId: post.user_id,
    communityId: post.community_id,
    text: post.text,
    createdAt: new Date(post.created_at).getTime(),
    likes: likesRes.data
      .filter((l) => l.post_id === post.id)
      .map((l) => l.user_id),
    comments: commentsRes.data
      .filter((c) => c.post_id === post.id)
      .map((c) => ({
        userId: c.user_id,
        text: c.text,
        createdAt: new Date(c.created_at).getTime(),
      })),
  }));

  const testimonials = testimonialsRes.data.map((t) => ({
    id: t.id,
    profileUserId: t.profile_user_id,
    authorUserId: t.author_user_id,
    text: t.text,
    createdAt: new Date(t.created_at).getTime(),
  }));

  return {
    users,
    userById,
    posts,
    communities,
    communityById,
    testimonials,
    selectedCommunityId: getSelectedCommunityId(),
  };
}

async function createPost(userId, text, communityId) {
  const sb = getSupabase();
  const { error } = await sb.from("posts").insert({
    user_id: userId,
    text,
    community_id: communityId,
  });
  if (error) throw error;
}

async function toggleLike(postId, userId) {
  const sb = getSupabase();
  const { data: existing } = await sb
    .from("post_likes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await sb
      .from("post_likes")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

async function addComment(postId, userId, text) {
  const sb = getSupabase();
  const { error } = await sb
    .from("comments")
    .insert({ post_id: postId, user_id: userId, text });
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
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Imagem muito grande. Máximo ${maxMb} MB.`);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }

  const bucket = kind === "cover" ? "covers" : "avatars";
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${userId}/${Date.now()}.${safeExt}`;

  const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
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
  const { error } = await sb.from("testimonials").insert({
    profile_user_id: profileUserId,
    author_user_id: authorUserId,
    text,
  });
  if (error) throw error;
}

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
  if (user.avatar) return user.avatar;
  const initial = (user.name || "?").charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%233b5998" width="80" height="80"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="36" font-family="Tahoma">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function coverStyle(user) {
  if (user.cover) {
    return `background-image:url('${user.cover}');background-size:cover;background-position:center;`;
  }
  return "";
}

function renderTopbar(activePage, user) {
  if (!user) return "";

  const pages = [
    { id: "home", label: "Início", href: "home.html" },
    { id: "profile", label: "Perfil", href: "profile.html" },
  ];

  const links = pages
    .map(
      (p) =>
        `<a href="${p.href}" class="${activePage === p.id ? "active" : ""}">${p.label}</a>`
    )
    .join("");

  return `
    <header class="topbar">
      <div class="topbar-inner">
        <a href="home.html" class="logo">Zords<span>Book</span></a>
        <nav>${links}</nav>
        <span class="topbar-user">Olá, <strong>${user.name}</strong> · <a href="#" id="btn-logout" style="color:#fff">Sair</a></span>
      </div>
    </header>
  `;
}

function bindLogout() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut();
    } finally {
      window.location.href = "index.html";
    }
  });
}

function getFeedPosts(data, communityId) {
  return data.posts.filter(
    (p) => p.communityId === communityId || p.communityId == null
  );
}

function renderCommunityTabs(communities, selectedId, onSelect) {
  const container = document.getElementById("community-tabs");
  if (!container) return;

  container.innerHTML = communities
    .map(
      (c) => `
    <button type="button" class="community-tab ${c.id === selectedId ? "active" : ""}" data-id="${c.id}">
      ${c.name}
    </button>
  `
    )
    .join("");

  container.querySelectorAll(".community-tab").forEach((btn) => {
    btn.addEventListener("click", () => onSelect(btn.dataset.id));
  });
}

function getInviteCode() {
  return getConfig()?.GROUP_INVITE_CODE || "ZORDS2026";
}

function validateInviteCode(input) {
  return input.trim().toUpperCase() === getInviteCode().toUpperCase();
}
