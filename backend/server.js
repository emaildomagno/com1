'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
const server = http.createServer(app);

const PORT        = process.env.PORT         || 3001;
const RP_ID       = process.env.RP_ID        || 'localhost';
const RP_NAME     = process.env.RP_NAME      || 'SecureChat';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ─────────────────────────────── Storage ───────────────────────────────────
const users       = new Map(); // username -> User
const challenges  = new Map(); // username -> { challenge, userId?, displayName? }
const sessions    = new Map(); // token    -> username
const rooms       = new Map(); // roomId   -> Room
const sockets     = new Map(); // socketId -> { username }
const dmStore     = new Map(); // convKey  -> Message[]

// ─────────────────────────────── Helpers ───────────────────────────────────
const token    = ()  => uuidv4() + uuidv4();
const convKey  = (a, b) => [a, b].sort().join('::');

function socketOf(username) {
  for (const [sid, d] of sockets) {
    if (d.username === username) return io.sockets.sockets.get(sid);
  }
  return null;
}

function onlineList() {
  return [...new Set([...sockets.values()].map(d => d.username))];
}

function roomList() {
  return [...rooms.values()].map(r => ({
    id: r.id, name: r.name, createdBy: r.createdBy,
    memberCount: r.members.length,
  }));
}

// ─────────────────────────────── Auth MW ───────────────────────────────────
function auth(req, res, next) {
  const t = req.headers.authorization?.replace('Bearer ', '');
  if (!t || !sessions.has(t)) return res.status(401).json({ error: 'Unauthorized' });
  req.username = sessions.get(t);
  next();
}

// ═══════════════════════ WebAuthn — Registration ════════════════════════════
app.post('/auth/register/start', async (req, res) => {
  try {
    const raw = req.body.username?.trim();
    if (!raw) return res.status(400).json({ error: 'Username required' });
    const uname = raw.toLowerCase();
    if (users.has(uname)) return res.status(409).json({ error: 'Username already taken' });

    const userId = uuidv4();
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: uname,
      userDisplayName: raw,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    challenges.set(uname, { challenge: options.challenge, userId, displayName: raw });
    res.json(options);
  } catch (e) {
    console.error('[register/start]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/auth/register/finish', async (req, res) => {
  try {
    const { username, credential } = req.body;
    if (!username || !credential) return res.status(400).json({ error: 'Missing fields' });
    const uname = username.trim().toLowerCase();

    const cd = challenges.get(uname);
    if (!cd) return res.status(400).json({ error: 'Challenge expired — try again' });

    const origin = req.headers.origin || FRONTEND_URL;
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      credential,
      expectedChallenge: cd.challenge,
      expectedOrigin: origin,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verified || !registrationInfo)
      return res.status(400).json({ error: 'Biometric verification failed' });

    users.set(uname, {
      id: cd.userId,
      username: uname,
      displayName: cd.displayName,
      credentials: [registrationInfo],
      createdAt: Date.now(),
    });
    challenges.delete(uname);

    const tok = token();
    sessions.set(tok, uname);
    res.json({ verified: true, token: tok, username: uname, displayName: cd.displayName });
  } catch (e) {
    console.error('[register/finish]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ═══════════════════════ WebAuthn — Authentication ══════════════════════════
app.post('/auth/login/start', async (req, res) => {
  try {
    const raw = req.body.username?.trim();
    if (!raw) return res.status(400).json({ error: 'Username required' });
    const uname = raw.toLowerCase();

    const user = users.get(uname);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      timeout: 60000,
      allowCredentials: user.credentials.map(c => ({
        id: c.credentialID,
        type: 'public-key',
      })),
      userVerification: 'required',
    });

    challenges.set(uname, { challenge: options.challenge });
    res.json(options);
  } catch (e) {
    console.error('[login/start]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/auth/login/finish', async (req, res) => {
  try {
    const { username, credential } = req.body;
    if (!username || !credential) return res.status(400).json({ error: 'Missing fields' });
    const uname = username.trim().toLowerCase();

    const user = users.get(uname);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cd = challenges.get(uname);
    if (!cd) return res.status(400).json({ error: 'Challenge expired' });

    const authenticator = user.credentials.find(c => {
      try {
        return Buffer.from(c.credentialID).toString('base64url') === credential.id;
      } catch { return false; }
    });
    if (!authenticator) return res.status(400).json({ error: 'Credential not registered on this device' });

    const origin = req.headers.origin || FRONTEND_URL;
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      credential,
      expectedChallenge: cd.challenge,
      expectedOrigin: origin,
      expectedRPID: RP_ID,
      authenticator: {
        credentialPublicKey: authenticator.credentialPublicKey,
        credentialID: authenticator.credentialID,
        counter: authenticator.counter,
      },
      requireUserVerification: true,
    });

    if (!verified) return res.status(400).json({ error: 'Authentication failed' });

    authenticator.counter = authenticationInfo.newCounter;
    challenges.delete(uname);

    const tok = token();
    sessions.set(tok, uname);
    res.json({ verified: true, token: tok, username: uname, displayName: user.displayName });
  } catch (e) {
    console.error('[login/finish]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ═══════════════════════════════ User API ═══════════════════════════════════
app.get('/api/me', auth, (req, res) => {
  const u = users.get(req.username);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ username: u.username, displayName: u.displayName });
});

app.get('/api/users', auth, (req, res) => {
  const online = onlineList();
  res.json(
    [...users.values()]
      .filter(u => u.username !== req.username)
      .map(u => ({ username: u.username, displayName: u.displayName, online: online.includes(u.username) }))
  );
});

app.get('/api/dm/:peer', auth, (req, res) => {
  res.json(dmStore.get(convKey(req.username, req.params.peer)) || []);
});

// ═══════════════════════════════ Room API ═══════════════════════════════════
app.post('/api/rooms', auth, (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: 'Room name required' });

  const id = uuidv4().slice(0, 8).toUpperCase();
  rooms.set(id, { id, name, createdBy: req.username, members: [], messages: [], createdAt: Date.now() });

  io.emit('rooms:list', roomList());
  res.json({ id, name });
});

app.get('/api/rooms', auth, (req, res) => res.json(roomList()));

app.delete('/api/rooms/:id', auth, (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });
  if (room.createdBy !== req.username) return res.status(403).json({ error: 'Forbidden' });
  rooms.delete(req.params.id);
  io.emit('rooms:list', roomList());
  res.json({ ok: true });
});

// ═══════════════════════════════ Socket.io ══════════════════════════════════
io.use((socket, next) => {
  const t = socket.handshake.auth.token;
  if (!t || !sessions.has(t)) return next(new Error('Unauthorized'));
  socket.username = sessions.get(t);
  next();
});

io.on('connection', socket => {
  const { username } = socket;
  sockets.set(socket.id, { username });

  io.emit('presence', { username, online: true });
  socket.emit('presence:list', onlineList());
  socket.emit('rooms:list', roomList());

  // ── Direct messages ──────────────────────────────────────────────────────
  socket.on('dm:send', ({ to, text }) => {
    const key = convKey(username, to);
    const msg = { id: uuidv4(), from: username, to, text, ts: Date.now() };
    if (!dmStore.has(key)) dmStore.set(key, []);
    dmStore.get(key).push(msg);
    socket.emit('dm:msg', msg);
    const peer = socketOf(to);
    if (peer) peer.emit('dm:msg', msg);
  });

  // ── Room messaging ───────────────────────────────────────────────────────
  socket.on('room:join', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('app:error', 'Room not found');
    socket.join(`r:${roomId}`);
    if (!room.members.includes(username)) room.members.push(username);
    socket.emit('room:history', { roomId, messages: room.messages });
    socket.emit('room:members', { roomId, members: room.members });
    io.to(`r:${roomId}`).emit('room:joined', { roomId, username });
    io.emit('rooms:list', roomList());
  });

  socket.on('room:leave', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.members = room.members.filter(m => m !== username);
      io.emit('rooms:list', roomList());
    }
    socket.leave(`r:${roomId}`);
    io.to(`r:${roomId}`).emit('room:left', { roomId, username });
  });

  socket.on('room:msg', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = { id: uuidv4(), from: username, text, ts: Date.now() };
    room.messages.push(msg);
    io.to(`r:${roomId}`).emit('room:msg', { roomId, ...msg });
  });

  // ── WebRTC signaling (direct) ────────────────────────────────────────────
  socket.on('rtc:offer',  ({ to, offer })     => socketOf(to)?.emit('rtc:offer',  { from: username, offer }));
  socket.on('rtc:answer', ({ to, answer })    => socketOf(to)?.emit('rtc:answer', { from: username, answer }));
  socket.on('rtc:ice',    ({ to, candidate }) => socketOf(to)?.emit('rtc:ice',    { from: username, candidate }));

  // ── WebRTC signaling (room — targeted to a specific peer) ────────────────
  socket.on('room:rtc:offer',  ({ to, offer, roomId })     => socketOf(to)?.emit('rtc:offer',  { from: username, offer,     roomId }));
  socket.on('room:rtc:answer', ({ to, answer, roomId })    => socketOf(to)?.emit('rtc:answer', { from: username, answer,    roomId }));
  socket.on('room:rtc:ice',    ({ to, candidate, roomId }) => socketOf(to)?.emit('rtc:ice',    { from: username, candidate, roomId }));

  // ── Call control ─────────────────────────────────────────────────────────
  socket.on('call:invite',  ({ to }) => socketOf(to) ? socketOf(to).emit('call:invite',   { from: username }) : socket.emit('call:unavailable', { username: to }));
  socket.on('call:accept',  ({ to }) => socketOf(to)?.emit('call:accepted',  { from: username }));
  socket.on('call:reject',  ({ to }) => socketOf(to)?.emit('call:rejected',  { from: username }));
  socket.on('call:end',     ({ to }) => socketOf(to)?.emit('call:ended',     { from: username }));
  socket.on('screen:start', ({ to }) => socketOf(to)?.emit('screen:start',   { from: username }));
  socket.on('screen:stop',  ({ to }) => socketOf(to)?.emit('screen:stop',    { from: username }));

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    sockets.delete(socket.id);
    for (const [roomId, room] of rooms) {
      if (room.members.includes(username)) {
        room.members = room.members.filter(m => m !== username);
        io.to(`r:${roomId}`).emit('room:left', { roomId, username });
      }
    }
    io.emit('rooms:list', roomList());
    io.emit('presence', { username, online: false });
  });
});

// ────────────────────────────── Start ──────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n🔐 SecureChat Backend ready');
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   RP_ID       : ${RP_ID}`);
  console.log(`   Frontend URL: ${FRONTEND_URL}`);
  console.log('\n   To change settings, set environment variables:');
  console.log('   PORT, RP_ID, RP_NAME, FRONTEND_URL\n');
});
