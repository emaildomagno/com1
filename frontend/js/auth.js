// ─── WebAuthn (Passwordless) Auth ────────────────────────────────────────────
const Auth = (() => {
  const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

  async function apiPost(path, body) {
    const res = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function register(username) {
    // 1. Get options from server
    const options = await apiPost('/auth/register/start', { username });

    // 2. Trigger browser biometric prompt (fingerprint / FaceID / Windows Hello)
    let credential;
    try {
      credential = await startRegistration(options);
    } catch (e) {
      if (e.name === 'InvalidStateError') throw new Error('Authenticator already registered');
      throw new Error('Biometric registration cancelled or failed: ' + e.message);
    }

    // 3. Verify on server
    const result = await apiPost('/auth/register/finish', { username, credential });
    if (!result.verified) throw new Error('Server verification failed');
    return result; // { token, username, displayName }
  }

  async function login(username) {
    // 1. Get challenge from server
    const options = await apiPost('/auth/login/start', { username });

    // 2. Trigger browser biometric prompt
    let credential;
    try {
      credential = await startAuthentication(options);
    } catch (e) {
      throw new Error('Biometric authentication cancelled: ' + e.message);
    }

    // 3. Verify on server
    const result = await apiPost('/auth/login/finish', { username, credential });
    if (!result.verified) throw new Error('Server verification failed');
    return result;
  }

  function save(token, username, displayName) {
    localStorage.setItem('sc_token', token);
    localStorage.setItem('sc_user', username);
    localStorage.setItem('sc_display', displayName);
  }

  function load() {
    return {
      token:       localStorage.getItem('sc_token'),
      username:    localStorage.getItem('sc_user'),
      displayName: localStorage.getItem('sc_display'),
    };
  }

  function clear() {
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    localStorage.removeItem('sc_display');
  }

  return { register, login, save, load, clear };
})();
