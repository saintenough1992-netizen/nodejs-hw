(() => {
  const params = new URLSearchParams(window.location.search);
  let token = params.get('token') || '';

  // Keep the reset credential in memory instead of the address bar or storage.
  if (params.has('token')) {
    params.delete('token');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }

  const views = ['request', 'reset', 'sent', 'expired', 'success'];
  const requestForm = document.querySelector('#request-form');
  const resetForm = document.querySelector('#reset-form');
  const emailInput = document.querySelector('#email');
  const passwordInput = document.querySelector('#password');
  const confirmationInput = document.querySelector('#password-confirmation');
  const visibilityButton = document.querySelector('#password-toggle');
  const loadingStatus = document.querySelector('#loading-status');

  const showView = (name, focus = true) => {
    for (const view of views) {
      document.querySelector(`#${view}-view`).hidden = view !== name;
    }
    document.querySelector('#request-message').hidden = true;
    document.querySelector('#reset-message').hidden = true;
    if (focus) document.querySelector(`#${name}-title`).focus();
  };

  const showError = (name, message) => {
    const element = document.querySelector(`#${name}-message`);
    element.textContent = message;
    element.hidden = false;
    element.focus();
  };

  const setLoading = (form, active, text) => {
    form.querySelector('fieldset').disabled = active;
    form.setAttribute('aria-busy', String(active));
    const label = form.querySelector('.button-text');
    label.textContent = active ? 'Зачекайте…' : text;
    loadingStatus.textContent = active ? 'Опрацьовуємо ваш запит.' : '';
  };

  const sendRequest = async (path, body) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      return { status: response.status, ok: response.ok };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const clearPassword = () => {
    resetForm.reset();
    confirmationInput.setCustomValidity('');
    passwordInput.type = 'password';
    confirmationInput.type = 'password';
    visibilityButton.textContent = 'Показати';
    visibilityButton.setAttribute('aria-pressed', 'false');
  };

  const showRequest = () => {
    token = '';
    clearPassword();
    showView('request');
    emailInput.focus();
  };

  for (const button of document.querySelectorAll('[data-request-link]')) {
    button.addEventListener('click', showRequest);
  }

  visibilityButton.addEventListener('click', () => {
    const visible = passwordInput.type === 'password';
    passwordInput.type = visible ? 'text' : 'password';
    confirmationInput.type = visible ? 'text' : 'password';
    visibilityButton.textContent = visible ? 'Приховати' : 'Показати';
    visibilityButton.setAttribute('aria-pressed', String(visible));
  });

  const validateConfirmation = () => {
    confirmationInput.setCustomValidity(
      confirmationInput.value && confirmationInput.value !== passwordInput.value
        ? 'Паролі не збігаються.'
        : '',
    );
  };
  passwordInput.addEventListener('input', validateConfirmation);
  confirmationInput.addEventListener('input', validateConfirmation);

  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    document.querySelector('#request-message').hidden = true;
    const email = emailInput.value.trim();
    setLoading(requestForm, true, 'Надіслати посилання');
    try {
      const response = await sendRequest('/auth/request-reset-email', {
        email,
      });
      if (response.ok) {
        document.querySelector('#sent-email').textContent = email;
        showView('sent');
      } else {
        showError(
          'request',
          response.status === 400
            ? 'Перевірте адресу електронної пошти.'
            : 'Не вдалося надіслати лист. Спробуйте ще раз трохи пізніше.',
        );
      }
    } catch {
      showError(
        'request',
        'Не вдалося зв’язатися із сервером. Перевірте з’єднання та повторіть спробу.',
      );
    } finally {
      setLoading(requestForm, false, 'Надіслати посилання');
    }
  });

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    document.querySelector('#reset-message').hidden = true;
    validateConfirmation();
    if (!resetForm.reportValidity()) return;
    if (!token) {
      showView('expired');
      return;
    }
    setLoading(resetForm, true, 'Зберегти новий пароль');
    try {
      const response = await sendRequest('/auth/reset-password', {
        token,
        password: passwordInput.value,
      });
      if (response.ok) {
        token = '';
        clearPassword();
        showView('success');
      } else if (response.status === 401) {
        token = '';
        clearPassword();
        showView('expired');
      } else {
        showError(
          'reset',
          response.status === 404
            ? 'Акаунт не знайдено. Спробуйте отримати нове посилання.'
            : response.status === 400
              ? 'Перевірте новий пароль та повторіть спробу.'
              : 'Не вдалося змінити пароль. Спробуйте ще раз трохи пізніше.',
        );
      }
    } catch {
      showError(
        'reset',
        'Не вдалося зв’язатися із сервером. Перевірте з’єднання та повторіть спробу.',
      );
    } finally {
      setLoading(resetForm, false, 'Зберегти новий пароль');
    }
  });

  showView(token ? 'reset' : 'request', false);
})();
