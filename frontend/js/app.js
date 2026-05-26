// ─── SecureChat App ───────────────────────────────────────────────────────────
const App = (() => {
  let socket = null;
  let me = { username: '', displayName: '' };
  let token = '';

  // State
  let activeConv   = null; // { type: 'dm'|'room', id: string }
  let onlineUsers  = new Set();
  let userList     = [];   // [{ username, displayName, online }]
  let roomList     = [];   // [{ id, name, memberCount }]
  let unreadDM     = {};   // username -> count
  let unreadRoom   = {};   // roomId   -> count
  let callState    = 'idle'; // idle | ringing | calling | in-call
  let callTimer    = null;
  let callSeconds  = 0;
  let currentPeer  = null;
  let roomMembers  = {};   // roomId -> [username]

  // ── DOM refs ───────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    setupLoginUI();

    // Auto-login if token saved
    const saved = Auth.load();
    if (saved.token) {
      try {
        const res = await apiFetch('/api/me', saved.token);
        me = { username: res.username, displayName: res.displayName };
        token = saved.token;
        showApp();
      } catch {
        Auth.clear();
      }
    }
  }

  // ── Login / Register UI ────────────────────────────────────────────────
  function setupLoginUI() {
    const tabs   = document.querySelectorAll('.login-tab');
    const form   = $('login-form');
    const errMsg = $('login-error');
    const btn    = $('login-btn');
    let mode = 'login';

    tabs.forEach(t => t.addEventListener('click', () => {
      mode = t.dataset.mode;
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      btn.textContent = mode === 'login' ? '🔐 Login com Biometria' : '📝 Registrar com Biometria';
      errMsg.textContent = '';
    }));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const username = $('input-username').value.trim();
      if (!username) return setError('Informe seu nome de usuário');

      btn.disabled = true;
      btn.innerHTML = `<span style="animation:blink 1s infinite">⏳ Aguardando biometria…</span>`;
      setError('');

      try {
        let result;
        if (mode === 'register') {
          result = await Auth.register(username);
          toast('Cadastro realizado!', 'success');
        } else {
          result = await Auth.login(username);
          toast('Login realizado!', 'success');
        }
        Auth.save(result.token, result.username, result.displayName);
        me = { username: result.username, displayName: result.displayName };
        token = result.token;
        showApp();
      } catch (err) {
        setError(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = mode === 'login' ? '🔐 Login com Biometria' : '📝 Registrar com Biometria';
      }
    });

    function setError(msg) { errMsg.textContent = msg; }
  }

  // ── App bootstrap ──────────────────────────────────────────────────────
  function showApp() {
    $('view-login').classList.add('hidden');
    $('view-app').classList.remove('hidden');

    // Me label
    $('me-avatar').textContent = initial(me.displayName);
    $('me-name').textContent   = me.displayName;

    connectSocket();
    setupAppEvents();
    loadUsers();
    loadRooms();
  }

  function connectSocket() {
    socket = io(BACKEND, { auth: { token } });

    socket.on('connect', () => {
      WebRTC.init(socket, me.username);
      setupWebRTCCallbacks();
    });

    socket.on('connect_error', e => {
      toast('Erro de conexão: ' + e.message, 'error');
    });

    // Presence
    socket.on('presence', ({ username, online }) => {
      if (online) onlineUsers.add(username);
      else        onlineUsers.delete(username);
      updateUserPresence(username, online);
    });

    socket.on('presence:list', list => {
      onlineUsers = new Set(list);
      renderUserList();
    });

    // Rooms
    socket.on('rooms:list', list => {
      roomList = list;
      renderRoomList();
    });

    socket.on('room:joined',  ({ roomId, username }) => addRoomSystemMsg(roomId, `${username} entrou na sala`));
    socket.on('room:left',    ({ roomId, username }) => {
      addRoomSystemMsg(roomId, `${username} saiu da sala`);
      if (roomMembers[roomId]) roomMembers[roomId] = roomMembers[roomId].filter(u => u !== username);
      if (activeConv?.type === 'room' && activeConv.id === roomId) updateRoomHeader(roomId);
      // End WebRTC with peer who left
      const peers = WebRTC.getPeers();
      if (peers.has(username)) {
        peers.get(username).pc.close();
        peers.delete(username);
        removeVideoTile(username);
      }
    });

    socket.on('room:members', ({ roomId, members }) => {
      roomMembers[roomId] = members;
      if (activeConv?.type === 'room' && activeConv.id === roomId) updateRoomHeader(roomId);
    });

    socket.on('room:history', ({ roomId, messages }) => {
      const el = $('messages-area');
      el.innerHTML = '';
      messages.forEach(m => appendMessage(m.from, m.text, m.ts, m.from === me.username));
      scrollToBottom();
    });

    socket.on('room:msg', ({ roomId, from, text, ts }) => {
      if (activeConv?.type === 'room' && activeConv.id === roomId) {
        appendMessage(from, text, ts, from === me.username);
        scrollToBottom();
      } else {
        unreadRoom[roomId] = (unreadRoom[roomId] || 0) + 1;
        renderRoomList();
        toast(`[#${getRoomName(roomId)}] ${from}: ${text.slice(0, 40)}`);
      }
    });

    // Direct messages
    socket.on('dm:msg', ({ from, to, text, ts }) => {
      const peer = from === me.username ? to : from;
      if (activeConv?.type === 'dm' && activeConv.id === peer) {
        appendMessage(from, text, ts, from === me.username);
        scrollToBottom();
      } else if (from !== me.username) {
        unreadDM[from] = (unreadDM[from] || 0) + 1;
        renderUserList();
        toast(`${getDisplayName(from)}: ${text.slice(0, 50)}`);
      }
    });

    // Call events
    socket.on('call:invite', ({ from }) => {
      if (callState !== 'idle') {
        socket.emit('call:reject', { to: from });
        return;
      }
      showIncomingCall(from);
    });

    socket.on('call:accepted', ({ from }) => {
      clearCallingState();
      startCall(from);
    });

    socket.on('call:rejected', ({ from }) => {
      clearCallingState();
      toast(`${getDisplayName(from)} recusou a chamada`);
    });

    socket.on('call:unavailable', ({ username }) => {
      clearCallingState();
      toast(`${getDisplayName(username)} está offline`);
    });

    socket.on('call:ended', ({ from }) => {
      if (callState === 'in-call' || callState === 'calling') {
        WebRTC.cleanup();
        endCallUI();
        toast(`Chamada encerrada por ${getDisplayName(from)}`);
      }
    });

    socket.on('screen:start', ({ from }) => toast(`${getDisplayName(from)} iniciou compartilhamento de tela`));
    socket.on('screen:stop',  ({ from }) => toast(`${getDisplayName(from)} parou o compartilhamento`));

    socket.on('app:error', msg => toast(msg, 'error'));
  }

  function setupWebRTCCallbacks() {
    WebRTC.onRemoteStream = (username, stream, roomId) => {
      let tile = document.querySelector(`.video-tile[data-user="${username}"]`);
      if (!tile) {
        tile = createVideoTile(username, false);
        $('video-grid').appendChild(tile);
      }
      tile.querySelector('video').srcObject = stream;
      callState = 'in-call';
      $('call-status').textContent = roomId ? 'Em reunião' : `Com ${getDisplayName(username)}`;
    };

    WebRTC.onPeerLeft = (username, roomId) => {
      removeVideoTile(username);
      toast(`${getDisplayName(username)} saiu da chamada`);
      if (WebRTC.getPeers().size === 0 && !roomId) endCallUI();
    };

    WebRTC.onCallEnded = () => endCallUI();
  }

  // ── App events setup ───────────────────────────────────────────────────
  function setupAppEvents() {
    // Logout
    $('btn-logout').addEventListener('click', () => {
      Auth.clear();
      location.reload();
    });

    // Create room
    $('btn-create-room').addEventListener('click', () => showModal('create-room'));

    // Message input
    $('msg-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    $('btn-send').addEventListener('click', sendMessage);

    // Call controls
    $('ctrl-mute').addEventListener('click', () => {
      const on = WebRTC.toggleMute();
      $('ctrl-mute').classList.toggle('off', !on);
      $('ctrl-mute').textContent = on ? '🎤' : '🔇';
    });

    $('ctrl-cam').addEventListener('click', () => {
      const on = WebRTC.toggleCamera();
      $('ctrl-cam').classList.toggle('off', !on);
      $('ctrl-cam').textContent = on ? '📷' : '🚫';
    });

    $('ctrl-screen').addEventListener('click', async () => {
      if (!WebRTC.isScreenSharing()) {
        try {
          await WebRTC.startScreenShare();
          $('ctrl-screen').classList.add('active');
          $('ctrl-screen').textContent = '🖥️';
          if (currentPeer) socket.emit('screen:start', { to: currentPeer });
          addLocalScreen();
        } catch (e) {
          toast('Compartilhamento cancelado', 'error');
        }
      } else {
        await WebRTC.stopScreenShare();
        $('ctrl-screen').classList.remove('active');
        removeVideoTile('screen-local');
      }
    });

    $('ctrl-end').addEventListener('click', () => {
      WebRTC.endCall();
    });

    // Search
    $('sidebar-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      filterLists(q);
    });
  }

  // ── Data loaders ───────────────────────────────────────────────────────
  async function loadUsers() {
    try {
      userList = await apiFetch('/api/users', token);
      renderUserList();
    } catch (e) {
      toast('Falha ao carregar usuários', 'error');
    }
  }

  async function loadRooms() {
    try {
      roomList = await apiFetch('/api/rooms', token);
      renderRoomList();
    } catch {}
  }

  async function loadDMHistory(peer) {
    try {
      const msgs = await apiFetch(`/api/dm/${peer}`, token);
      const area = $('messages-area');
      area.innerHTML = '';
      if (msgs.length === 0) {
        area.innerHTML = `<p style="text-align:center;color:var(--text3);margin-top:40px;font-size:13px">Nenhuma mensagem ainda. Diga olá! 👋</p>`;
      } else {
        msgs.forEach(m => appendMessage(m.from, m.text, m.ts, m.from === me.username));
      }
      scrollToBottom();
    } catch {}
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  function renderUserList(query = '') {
    const list = $('user-list');
    list.innerHTML = '';
    const filtered = userList.filter(u =>
      !query || u.displayName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query)
    );
    filtered.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

    filtered.forEach(u => {
      const isActive = activeConv?.type === 'dm' && activeConv.id === u.username;
      const unread = unreadDM[u.username] || 0;
      const div = ce('div', `contact-item ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`);
      div.dataset.user = u.username;
      div.innerHTML = `
        <div class="avatar sm">
          ${initial(u.displayName)}
          <div class="dot ${u.online || onlineUsers.has(u.username) ? '' : 'off'}"></div>
        </div>
        <div class="contact-info">
          <div class="contact-name ellipsis">${esc(u.displayName)}</div>
          <div class="contact-preview ellipsis">${u.online || onlineUsers.has(u.username) ? 'Online' : 'Offline'}</div>
        </div>
        ${unread > 0 ? `<div class="unread-badge">${unread}</div>` : ''}
      `;
      div.addEventListener('click', () => openDM(u.username, u.displayName));
      list.appendChild(div);
    });
  }

  function renderRoomList(query = '') {
    const list = $('room-list');
    list.innerHTML = '';
    const filtered = roomList.filter(r =>
      !query || r.name.toLowerCase().includes(query)
    );

    filtered.forEach(r => {
      const isActive = activeConv?.type === 'room' && activeConv.id === r.id;
      const unread = unreadRoom[r.id] || 0;
      const div = ce('div', `room-item ${isActive ? 'active' : ''}`);
      div.dataset.room = r.id;
      div.innerHTML = `
        <div class="room-icon">🏠</div>
        <div class="contact-info">
          <div class="room-name ellipsis">${esc(r.name)}</div>
          <div class="room-count">${r.memberCount} membro${r.memberCount !== 1 ? 's' : ''} • ${r.id}</div>
        </div>
        ${unread > 0 ? `<div class="unread-badge">${unread}</div>` : ''}
        ${r.createdBy === me.username ? `<button class="room-del" title="Deletar sala" data-id="${r.id}">🗑️</button>` : ''}
      `;
      div.addEventListener('click', e => {
        if (!e.target.closest('.room-del')) openRoom(r.id, r.name);
      });
      const del = div.querySelector('.room-del');
      if (del) del.addEventListener('click', e => { e.stopPropagation(); deleteRoom(r.id); });
      list.appendChild(div);
    });
  }

  function updateUserPresence(username, online) {
    const el = document.querySelector(`.contact-item[data-user="${username}"]`);
    if (!el) { loadUsers(); return; }
    const dot = el.querySelector('.dot');
    const preview = el.querySelector('.contact-preview');
    if (dot)     dot.className = `dot ${online ? '' : 'off'}`;
    if (preview) preview.textContent = online ? 'Online' : 'Offline';
  }

  // ── Conversations ──────────────────────────────────────────────────────
  function openDM(username, displayName) {
    activeConv = { type: 'dm', id: username };
    currentPeer = username;
    unreadDM[username] = 0;

    setActiveSidebar('dm', username);
    showChatView();
    $('chat-avatar').textContent = initial(displayName || username);
    $('chat-name').textContent   = displayName || username;
    $('chat-sub').textContent    = onlineUsers.has(username) ? '🟢 Online' : '⚫ Offline';
    $('btn-call-audio').classList.remove('hidden');
    $('btn-call-video').classList.remove('hidden');
    $('btn-join-video').classList.add('hidden');

    loadDMHistory(username);
  }

  function openRoom(roomId, name) {
    if (activeConv?.type === 'room' && activeConv.id !== roomId) {
      socket.emit('room:leave', { roomId: activeConv.id });
    }
    activeConv = { type: 'room', id: roomId };
    currentPeer = null;
    unreadRoom[roomId] = 0;

    setActiveSidebar('room', roomId);
    showChatView();
    $('chat-avatar').textContent = '🏠';
    $('chat-name').textContent   = name;
    $('btn-call-audio').classList.add('hidden');
    $('btn-call-video').classList.add('hidden');
    $('btn-join-video').classList.remove('hidden');

    socket.emit('room:join', { roomId });
    updateRoomHeader(roomId);
  }

  function updateRoomHeader(roomId) {
    const members = roomMembers[roomId] || [];
    $('chat-sub').textContent = `${members.length} membro${members.length !== 1 ? 's' : ''}`;
  }

  function showChatView() {
    $('view-welcome').classList.add('hidden');
    $('chat-view').classList.remove('hidden');
    $('msg-input').focus();
  }

  function setActiveSidebar(type, id) {
    document.querySelectorAll('.contact-item, .room-item').forEach(el => el.classList.remove('active'));
    const selector = type === 'dm'
      ? `.contact-item[data-user="${id}"]`
      : `.room-item[data-room="${id}"]`;
    document.querySelector(selector)?.classList.add('active');
    renderUserList();
    renderRoomList();
  }

  // ── Messaging ──────────────────────────────────────────────────────────
  function sendMessage() {
    const input = $('msg-input');
    const text = input.value.trim();
    if (!text || !activeConv) return;
    input.value = '';
    input.style.height = '';

    if (activeConv.type === 'dm') {
      socket.emit('dm:send', { to: activeConv.id, text });
    } else {
      socket.emit('room:msg', { roomId: activeConv.id, text });
    }
  }

  function appendMessage(from, text, ts, isMine) {
    const area = $('messages-area');
    // Remove empty state placeholder
    const placeholder = area.querySelector('p');
    if (placeholder) placeholder.remove();

    const wrap = ce('div', `msg-wrap ${isMine ? 'me' : 'them'}`);
    const name = isMine ? 'Você' : getDisplayName(from);
    const time = formatTime(ts);
    wrap.innerHTML = `
      <div class="avatar sm">${initial(from === me.username ? me.displayName : from)}</div>
      <div style="display:flex;flex-direction:column;gap:2px;${isMine ? 'align-items:flex-end' : ''}">
        <div class="msg-meta">
          <span class="msg-sender">${esc(name)}</span>
          <span class="msg-time">${time}</span>
        </div>
        <div class="msg-bubble">${esc(text)}</div>
      </div>
    `;
    area.appendChild(wrap);
  }

  function addRoomSystemMsg(roomId, text) {
    if (activeConv?.type === 'room' && activeConv.id === roomId) {
      const area = $('messages-area');
      const div = ce('div', 'msg-day');
      div.textContent = text;
      area.appendChild(div);
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    const a = $('messages-area');
    a.scrollTop = a.scrollHeight;
  }

  // ── Video calls ────────────────────────────────────────────────────────
  function initiateCall(video = true) {
    if (!currentPeer) return;
    if (callState !== 'idle') return toast('Você já está em uma chamada');

    callState = 'calling';
    showCallOverlay(`Ligando para ${getDisplayName(currentPeer)}…`, false);
    $('call-status').innerHTML = `<span class="calling-ring">Chamando ${getDisplayName(currentPeer)}…</span>`;
    socket.emit('call:invite', { to: currentPeer });

    // Auto-cancel after 30s
    setTimeout(() => {
      if (callState === 'calling') {
        socket.emit('call:end', { to: currentPeer });
        endCallUI();
        toast('Chamada sem resposta');
      }
    }, 30000);
  }

  function showIncomingCall(from) {
    callState = 'ringing';
    const el = $('incoming-call');
    el.classList.remove('hidden');
    el.innerHTML = `
      <div>
        <div class="incoming-from">📞 Chamada recebida</div>
        <div class="incoming-name">${esc(getDisplayName(from))}</div>
      </div>
      <div class="incoming-actions">
        <button class="btn-accept" id="call-accept">✅ Atender</button>
        <button class="btn-decline" id="call-decline">❌ Recusar</button>
      </div>
    `;
    $('call-accept').onclick = () => acceptCall(from);
    $('call-decline').onclick = () => {
      socket.emit('call:reject', { to: from });
      el.classList.add('hidden');
      callState = 'idle';
    };
  }

  function acceptCall(from) {
    $('incoming-call').classList.add('hidden');
    socket.emit('call:accept', { to: from });
    startCall(from);
  }

  async function startCall(peer) {
    callState = 'in-call';
    currentPeer = peer;
    showCallOverlay(`Com ${getDisplayName(peer)}`, true);
    startCallTimer();
    await addLocalVideo();
    await WebRTC.callPeer(peer);
  }

  async function joinRoomCall(roomId) {
    if (callState !== 'idle') return toast('Você já está em uma chamada');
    callState = 'in-call';
    showCallOverlay(`Sala: ${getRoomName(roomId)}`, true);
    startCallTimer();
    await addLocalVideo();

    const members = (roomMembers[roomId] || []).filter(u => u !== me.username);
    for (const peer of members) {
      await WebRTC.callPeer(peer, roomId);
    }
    if (members.length === 0) {
      $('call-status').textContent = 'Aguardando participantes…';
    }
  }

  function showCallOverlay(title, showControls) {
    $('call-title').textContent = title;
    $('call-overlay').classList.add('active');
    $('video-grid').innerHTML = '';
  }

  async function addLocalVideo() {
    const stream = await WebRTC.getLocalStream();
    const tile = createVideoTile(me.username, true);
    tile.querySelector('video').srcObject = stream;
    $('video-grid').appendChild(tile);
  }

  function addLocalScreen() {
    const stream = WebRTC.getLocalStream();
    if (!stream) return;
    const tile = createVideoTile('screen-local', true);
    tile.classList.add('screen-share');
    tile.querySelector('.video-tile-label').textContent = 'Sua tela';
    tile.querySelector('video').srcObject = stream;
    $('video-grid').appendChild(tile);
  }

  function createVideoTile(username, local) {
    const tile = ce('div', `video-tile ${local ? 'local' : ''}`);
    tile.dataset.user = username;
    tile.innerHTML = `
      <video autoplay ${local ? 'muted' : ''} playsinline></video>
      <div class="video-tile-label">${local ? 'Você' : esc(getDisplayName(username))}</div>
    `;
    return tile;
  }

  function removeVideoTile(username) {
    document.querySelector(`.video-tile[data-user="${username}"]`)?.remove();
  }

  function clearCallingState() {
    callState = 'idle';
  }

  function endCallUI() {
    stopCallTimer();
    callState = 'idle';
    $('call-overlay').classList.remove('active');
    $('video-grid').innerHTML = '';
    $('ctrl-screen').classList.remove('active');
    $('ctrl-mute').classList.remove('off');
    $('ctrl-mute').textContent = '🎤';
    $('ctrl-cam').classList.remove('off');
    $('ctrl-cam').textContent = '📷';
    $('incoming-call').classList.add('hidden');
  }

  function startCallTimer() {
    callSeconds = 0;
    $('call-timer').textContent = '00:00';
    callTimer = setInterval(() => {
      callSeconds++;
      const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
      const s = String(callSeconds % 60).padStart(2, '0');
      $('call-timer').textContent = `${m}:${s}`;
    }, 1000);
  }

  function stopCallTimer() {
    clearInterval(callTimer);
    callTimer = null;
    $('call-timer').textContent = '';
  }

  // ── Room management ────────────────────────────────────────────────────
  function showModal(type) {
    const backdrop = ce('div', 'modal-backdrop');
    backdrop.id = 'modal-backdrop';

    if (type === 'create-room') {
      backdrop.innerHTML = `
        <div class="modal">
          <h3>🏠 Nova Sala</h3>
          <div class="form-group">
            <label>Nome da sala</label>
            <input id="new-room-name" placeholder="ex: Projeto Alpha" maxlength="40" autocomplete="off">
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" id="modal-cancel">Cancelar</button>
            <button class="btn-confirm" id="modal-ok">Criar</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      $('new-room-name').focus();
      $('modal-cancel').onclick = () => backdrop.remove();
      $('modal-ok').onclick = createRoom;
      $('new-room-name').addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });
      backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
    }
  }

  async function createRoom() {
    const name = $('new-room-name')?.value?.trim();
    if (!name) return;
    $('modal-backdrop')?.remove();
    try {
      const r = await apiFetch('/api/rooms', token, 'POST', { name });
      toast(`Sala "${r.name}" criada!`, 'success');
      await loadRooms();
      openRoom(r.id, r.name);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteRoom(id) {
    if (!confirm('Deletar esta sala?')) return;
    try {
      await apiFetch(`/api/rooms/${id}`, token, 'DELETE');
      if (activeConv?.type === 'room' && activeConv.id === id) {
        activeConv = null;
        $('chat-view').classList.add('hidden');
        $('view-welcome').classList.remove('hidden');
      }
      toast('Sala deletada');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────
  function filterLists(query) {
    renderUserList(query);
    renderRoomList(query);
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function getDisplayName(username) {
    if (username === me.username) return me.displayName;
    return userList.find(u => u.username === username)?.displayName || username;
  }

  function getRoomName(roomId) {
    return roomList.find(r => r.id === roomId)?.name || roomId;
  }

  function initial(name) {
    return (name || '?')[0].toUpperCase();
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ce(tag, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function apiFetch(path, tok, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BACKEND}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  }

  // Expose call actions for inline HTML handlers
  window._callAudio    = () => initiateCall(false);
  window._callVideo    = () => initiateCall(true);
  window._joinRoomCall = () => {
    if (activeConv?.type === 'room') joinRoomCall(activeConv.id);
  };

  return { init };
})();

// ─── Global toast ─────────────────────────────────────────────────────────────
function toast(msg, type = '') {
  const container = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
