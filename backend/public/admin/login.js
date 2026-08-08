document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');

  errorEl.textContent = '';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password }),
    });

    const contentType = res.headers.get('content-type') || '';

    const data = contentType.includes('application/json')
      ? await res.json()
      : { error: await res.text() };

    if (!res.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
    }

    localStorage.setItem('admin_token', data.token);

    window.location.href = '/admin/index.html';

  } catch (err) {
    errorEl.textContent = err.message;
  }
});