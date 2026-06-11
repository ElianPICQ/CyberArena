let token = localStorage.getItem('token');
let currentUser = null;
let currentPosts = [];
let lastPostsIncludeAdmin = false;

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

async function loadCurrentUser() {
  if (!token) return null;
  const res = await fetch('/api/me', { headers: authHeaders() });
  if (!res.ok) return null;
  currentUser = await res.json();
  return currentUser;
}

function showResult(data) {
  document.getElementById('result-card').classList.remove('hidden');
  const result = document.getElementById('result');
  const title = document.getElementById('result-title');

  if (Array.isArray(data)) {
    currentPosts = data.filter(item => item && item.title);
    if (data.length === 0) {
      title.textContent = 'Aucun résultat';
    } else if (data[0] && data[0].title) {
      title.textContent = 'Posts';
    } else if (data[0] && data[0].username) {
      title.textContent = 'Utilisateurs';
    } else {
      title.textContent = 'Résultat';
    }
    result.textContent = data.map(item => renderItem(item)).join('');
  } else {
    if (data && data.title) {
      title.textContent = 'Post';
    } else if (data && data.username) {
      title.textContent = currentUser && currentUser._id === (data._id || data.id) ? 'Mon profil' : 'Utilisateur';
    } else {
      title.textContent = 'Résultat';
    }
    result.textContent = renderItem(data);
  }
}

function renderItem(item) {
  if (item.username) {
    const userId = item._id || item.id || '';
    return `<div class="profile">
      <img src="${item.avatar || '/uploads/default.svg'}" alt="avatar" />
      <div>
        <strong>${item.username}</strong> <span class="badge">${item.role || ''}</span><br>
        <small>${item.email || ''}</small>
        <p>${item.bio || ''}</p>
        <small>ID MongoDB : ${userId}</small>
      </div>
      ${renderUserActions(item)}
    </div>`;
  }
  if (item.title) {
    return `<div class="post">
      <div class="post-header">
        <img src="${item.authorAvatar || '/uploads/default.svg'}" alt="avatar" />
        <div>
          <h3>${item.title} <span class="badge">${item.visibility || 'public'}</span></h3>
          <small>Par ${item.authorUsername || 'inconnu'} - ${item.createdAt || ''}</small>
        </div>
      </div>
      <p>${item.content}</p>
      ${renderPostActions(item)}
    </div>`;
  }
  return `<pre>${JSON.stringify(item, null, 2)}</pre>`;
}

function renderUserActions(item) {
  if (!currentUser) return '';
  const targetId = item._id || item.id || '';
  const currentId = currentUser._id || currentUser.id || '';
  const canEdit = currentUser.role === 'admin' || currentId === targetId || currentUser.username === item.username;
  if (!canEdit) return '';
  return `<button class="action-btn" onclick="editUser('${targetId}')">Modifier</button>`;
}

function renderPostActions(item) {
  if (!currentUser) return '';
  const canEdit = currentUser.role === 'admin' || item.authorUsername === currentUser.username;
  if (!canEdit) return '';
  const postId = item._id || item.id || '';
  return `<button class="action-btn" onclick="editPost('${postId}')">Modifier</button>`;
}

function updateUi() {
  const registerCard = document.getElementById('register-card');
  if (token) {
    document.getElementById('login-card').classList.add('hidden');
    registerCard.classList.add('hidden');
    document.getElementById('app-card').classList.remove('hidden');
  } else {
    document.getElementById('login-card').classList.remove('hidden');
    registerCard.classList.remove('hidden');
    document.getElementById('app-card').classList.add('hidden');
    document.getElementById('result-card').classList.add('hidden');
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) return showResult(data);
  token = data.token;
  localStorage.setItem('token', token);
  updateUi();
  await loadCurrentUser();
  await loadPosts(false);
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();
  showResult(data);
  if (res.ok) {
    document.getElementById('register-form').reset();
  }
});

document.getElementById('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('post-title').value;
  const content = document.getElementById('post-content').value;
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content })
  });
  showResult(await res.json());
});

async function loadMe() {
  const user = await loadCurrentUser();
  if (!user) return showResult({ error: 'Impossible de charger votre profil.' });
  showProfileForm(user);
}

async function loadUsers() {
  const res = await fetch('/api/users', { headers: authHeaders() });
  if (!res.ok) return showResult(await res.json());
  const users = await res.json();
  showResult(users);
}

function showCreatePost() {
  document.getElementById('create-post-section').classList.toggle('hidden');
}

async function loadPosts(includeAdmin) {
  lastPostsIncludeAdmin = includeAdmin;
  document.getElementById('create-post-section').classList.add('hidden');
  const res = await fetch('/api/posts?includeAdmin=' + includeAdmin, { headers: authHeaders() });
  if (!res.ok) return showResult(await res.json());
  const posts = await res.json();
  showResult(posts);
}

async function loadAdmin() {
  const res = await fetch('/api/admin', { headers: authHeaders() });
  showResult(await res.json());
}

function showToken() {
  const parts = token ? token.split('.') : [];
  let decoded = null;
  try { decoded = JSON.parse(atob(parts[1])); } catch(e) {}
  showResult({ token, decodedPayload: decoded });
}

function logout() {
  token = null;
  currentUser = null;
  currentPosts = [];
  localStorage.removeItem('token');
  updateUi();
}

function showProfileForm(user) {
  if (!user) return showResult({ error: 'Utilisateur introuvable.' });
  const title = document.getElementById('result-title');
  const result = document.getElementById('result');
  const userId = user._id || user.id || '';
  const isMe = currentUser && (currentUser._id === userId || currentUser.id === userId);
  title.textContent = isMe ? 'Mon profil' : `Profil ${user.username}`;
  document.getElementById('result-card').classList.remove('hidden');
  result.textContent = `
    <form id="profile-form" enctype="multipart/form-data">
      <label>Nom utilisateur</label>
      <input id="profile-username" value="${user.username || ''}" />
      <label>Email</label>
      <input id="profile-email" type="email" value="${user.email || ''}" />
      <label>Bio</label>
      <textarea id="profile-bio">${user.bio || ''}</textarea>
      <label>Avatar actuel</label>
      <div class="avatar-preview-container">
        <img class="avatar-preview" src="${user.avatar || '/uploads/default.svg'}" alt="avatar actuel" />
      </div>
      <label>Nouvel avatar</label>
      <div class="file-input-wrapper">
        <input id="profile-avatar-file" type="file" accept="image/*" />
        <label for="profile-avatar-file" class="btn-browse">Parcourir</label>
        <span id="file-name" class="file-name">Aucun fichier s\u00e9lectionn\u00e9</span>
      </div>
      <label>Mot de passe (laisser vide pour ne pas changer)</label>
      <input id="profile-password" type="password" />
      <button type="submit">Enregistrer</button>
    </form>
  `;
  document.getElementById('profile-avatar-file').addEventListener('change', (e) => {
    const fileName = e.target.files[0] ? e.target.files[0].name : 'Aucun fichier s\u00e9lectionn\u00e9';
    document.getElementById('file-name').textContent = fileName;
  });
  document.getElementById('profile-form').addEventListener('submit', (e) => saveProfile(e, userId));
}

async function saveProfile(e, userId) {
  e.preventDefault();
  const username = document.getElementById('profile-username').value;
  const email = document.getElementById('profile-email').value;
  const bio = document.getElementById('profile-bio').value;
  const password = document.getElementById('profile-password').value;
  const avatarFile = document.getElementById('profile-avatar-file').files[0];

  const formData = new FormData();
  formData.append('username', username);
  formData.append('email', email);
  formData.append('bio', bio);
  if (password) formData.append('password', password);
  if (avatarFile) formData.append('avatar', avatarFile);

  const res = await fetch('/api/users/' + userId, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  });
  const data = await res.json();
  if (res.ok) {
    if (currentUser && (currentUser._id === userId || currentUser.id === userId)) {
      await loadCurrentUser();
    }
  }
  showResult(data);
}

async function editUser(userId) {
  const res = await fetch('/api/users/' + userId, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return showResult(data);
  showProfileForm(data);
}

function editPost(postId) {
  const post = currentPosts.find(item => {
    const id = item._id || item.id || '';
    return id === postId;
  });
  if (!post) return showResult({ error: 'Post introuvable pour édition.' });

  const title = document.getElementById('result-title');
  const result = document.getElementById('result');
  title.textContent = 'Modifier le post';
  document.getElementById('result-card').classList.remove('hidden');
  result.textContent = `
    <form id="edit-post-form">
      <label>Titre</label>
      <input id="edit-post-title" value="${post.title || ''}" />
      <label>Contenu</label>
      <textarea id="edit-post-content">${post.content || ''}</textarea>
      <button type="submit">Mettre à jour</button>
    </form>
  `;
  document.getElementById('edit-post-form').addEventListener('submit', (e) => savePostEdit(e, postId));
}

async function savePostEdit(e, postId) {
  e.preventDefault();
  const title = document.getElementById('edit-post-title').value;
  const content = document.getElementById('edit-post-content').value;
  const res = await fetch('/api/posts/' + postId, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title, content })
  });
  const data = await res.json();
  if (res.ok) {
    await loadPosts(lastPostsIncludeAdmin);
  } else {
    showResult(data);
  }
}

if (token) {
  loadCurrentUser();
}

updateUi();
