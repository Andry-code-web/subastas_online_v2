// Obtener todos los inputs con la clase 'keys'
const inputs = document.querySelectorAll('.keys');

// Agregar evento input a cada input
inputs.forEach((input, index) => {
    input.addEventListener('input', function () {
        // Limitar el valor ingresado a 0-99
        let val = parseInt(this.value);
        if (isNaN(val) || val < 0 || val > 99) {
            this.value = '';
        }

        // Mover el foco al siguiente input después de ingresar dos dígitos
        if (this.value.length === 2 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    // Agregar evento keydown para detectar la tecla Backspace
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && this.value === '') {
            // Mover el foco al input anterior si se presiona Backspace y el campo está vacío
            if (index > 0) {
                inputs[index - 1].focus();
            }
        }
    });
});

document.getElementById('sendEmailBtn').addEventListener('click', () => {
    const email = document.getElementById('exampleInputEmail1').value;

    fetch('/admin/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
        .then(response => response.text())
        .then(data => {
            if (data === 'Correo enviado') {
                document.getElementById('codeSection').style.display = 'block';
            } else {
                alert(data);
            }
        });
});

document.getElementById('validateCodeBtn').addEventListener('click', () => {
    const email = document.getElementById('exampleInputEmail1').value;
    const code = Array.from(document.querySelectorAll('.keys')).map(input => input.value).join('');

    fetch('/validarCodigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
    })
        .then(response => response.text())
        .then(data => {
            if (data === 'Código de verificación correcto') {
                document.getElementById('passwordSection').style.display = 'block';
            } else {
                alert(data);
            }
        });
});

document.getElementById('changePasswordBtn').addEventListener('click', () => {
    const email = document.getElementById('exampleInputEmail1').value;
    const code1 = document.getElementsByName('code1')[0].value;
    const code2 = document.getElementsByName('code2')[0].value;
    const code3 = document.getElementsByName('code3')[0].value;
    const code4 = document.getElementsByName('code4')[0].value;
    const code5 = document.getElementsByName('code5')[0].value;
    const newPassword = document.getElementById('exampleInputContraseña').value;
    const confirmPassword = document.getElementById('exampleInputConfirmContraseña').value;

    if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }

    const code = code1 + code2 + code3 + code4 + code5;

    fetch('/admin/validarCodigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
    })
        .then(response => response.text())
        .then(data => {
            if (data === 'Contraseña actualizada') {
                window.location.href = '/admin/loginAdminG';
            } else {
                alert(data);
            }
        });
});