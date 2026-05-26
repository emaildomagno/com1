// ─── WebRTC — Video, Audio & Screen Sharing ──────────────────────────────────
const WebRTC = (() => {
  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // peer map: username -> { pc, stream }
  const peers = new Map();
  let localStream    = null;
  let screenStream   = null;
  let isSharingScreen = false;
  let currentCall    = null; // { peer, roomId }
  let socket         = null;
  let myUsername     = null;

  // callbacks set by app.js
  let onRemoteStream  = () => {};
  let onPeerLeft      = () => {};
  let onCallEnded     = () => {};

  function init(sock, username) {
    socket     = sock;
    myUsername = username;

    socket.on('rtc:offer',  handleOffer);
    socket.on('rtc:answer', handleAnswer);
    socket.on('rtc:ice',    handleIce);
  }

  // ── Local media ─────────────────────────────────────────────────────────
  async function getLocalStream(video = true, audio = true) {
    if (localStream) return localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video, audio });
    } catch (e) {
      localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio });
    }
    return localStream;
  }

  async function startScreenShare() {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    isSharingScreen = true;

    // Replace video track in all peer connections
    const videoTrack = screenStream.getVideoTracks()[0];
    for (const { pc } of peers.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(videoTrack);
    }

    videoTrack.onended = stopScreenShare;
    return screenStream;
  }

  async function stopScreenShare() {
    if (!isSharingScreen) return;
    isSharingScreen = false;
    screenStream?.getTracks().forEach(t => t.stop());
    screenStream = null;

    // Restore camera track
    if (localStream) {
      const camTrack = localStream.getVideoTracks()[0];
      if (camTrack) {
        for (const { pc } of peers.values()) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(camTrack);
        }
      }
    }
    if (currentCall) {
      const target = currentCall.peer || null;
      if (target) socket.emit('screen:stop', { to: target });
    }
  }

  // ── Peer connection ──────────────────────────────────────────────────────
  function createPeerConnection(remoteUser, roomId = null) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    if (screenStream) {
      screenStream.getVideoTracks().forEach(track => pc.addTrack(track, screenStream));
    }

    pc.ontrack = e => {
      const [stream] = e.streams;
      onRemoteStream(remoteUser, stream, roomId);
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      if (roomId) {
        socket.emit('room:rtc:ice', { to: remoteUser, candidate, roomId });
      } else {
        socket.emit('rtc:ice', { to: remoteUser, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removePeer(remoteUser);
        onPeerLeft(remoteUser, roomId);
      }
    };

    peers.set(remoteUser, { pc, stream: null });
    return pc;
  }

  // ── Initiate call ────────────────────────────────────────────────────────
  async function callPeer(remoteUser, roomId = null) {
    await getLocalStream();
    currentCall = { peer: remoteUser, roomId };

    const pc = createPeerConnection(remoteUser, roomId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);

    if (roomId) {
      socket.emit('room:rtc:offer', { to: remoteUser, offer: pc.localDescription, roomId });
    } else {
      socket.emit('rtc:offer', { to: remoteUser, offer: pc.localDescription });
    }
  }

  // ── Signaling handlers ───────────────────────────────────────────────────
  async function handleOffer({ from, offer, roomId }) {
    await getLocalStream();
    if (!currentCall) currentCall = { peer: from, roomId: roomId || null };

    let entry = peers.get(from);
    if (!entry) {
      createPeerConnection(from, roomId);
      entry = peers.get(from);
    }
    const { pc } = entry;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (roomId) {
      socket.emit('room:rtc:answer', { to: from, answer: pc.localDescription, roomId });
    } else {
      socket.emit('rtc:answer', { to: from, answer: pc.localDescription });
    }
  }

  async function handleAnswer({ from, answer }) {
    const entry = peers.get(from);
    if (!entry) return;
    await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIce({ from, candidate }) {
    const entry = peers.get(from);
    if (!entry || !candidate) return;
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) { /* ignore stale candidates */ }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  function removePeer(username) {
    const entry = peers.get(username);
    if (entry) {
      entry.pc.close();
      peers.delete(username);
    }
  }

  function endCall() {
    if (currentCall?.peer) {
      socket.emit('call:end', { to: currentCall.peer });
    }
    cleanup();
    onCallEnded();
  }

  // Cleanup without emitting socket events (e.g. when peer ended the call)
  function cleanup() {
    stopScreenShare();
    for (const username of [...peers.keys()]) removePeer(username);
    localStream?.getTracks().forEach(t => t.stop());
    localStream = null;
    currentCall = null;
  }

  function toggleMute() {
    const track = localStream?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; return track.enabled; }
    return false;
  }

  function toggleCamera() {
    const track = localStream?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; return track.enabled; }
    return false;
  }

  function getLocalStream_() { return localStream; }
  function isScreenSharing() { return isSharingScreen; }
  function getCurrentCall()  { return currentCall; }
  function getPeers()        { return peers; }

  return {
    init,
    callPeer,
    handleOffer,
    endCall,
    cleanup,
    startScreenShare,
    stopScreenShare,
    toggleMute,
    toggleCamera,
    getLocalStream: getLocalStream_,
    isScreenSharing,
    getCurrentCall,
    getPeers,
    set onRemoteStream(fn) { onRemoteStream = fn; },
    set onPeerLeft(fn)     { onPeerLeft = fn; },
    set onCallEnded(fn)    { onCallEnded = fn; },
  };
})();
