// Verificar se já está logado
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        // Se estiver na página de login, redireciona pro dashboard
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            window.location.href = 'dashboard.html';
        }
        return JSON.parse(user);
    } else {
        // Se não estiver logado e não estiver na página de login, redireciona
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
        return null;
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Se estiver na página de login
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Desabilitar botão
        loginButton.disabled = true;
        loginButton.innerHTML = '<span>Entrando...</span>';
        errorMessage.classList.add('hidden');

        try {
            const response = await API.login(email, password);

            // Salvar token e usuário
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));

            // Redirecionar
            window.location.href = 'dashboard.html';

        } catch (error) {
            errorMessage.textContent = error.message || 'Email ou senha inválidos';
            errorMessage.classList.remove('hidden');

            // Reabilitar botão
            loginButton.disabled = false;
            loginButton.innerHTML = '<span>Entrar</span>';
        }
    });
}
