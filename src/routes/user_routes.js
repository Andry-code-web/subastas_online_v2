const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const conexion = require('../database/db'); // Asegúrate de que el nombre del archivo y la ruta sean correctos

router.use(bodyParser.urlencoded({ extended: true }));

router.get('/', (req, res) => {
    res.render('home');
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/registro', (req, res) => {
    res.render('registro');
});

router.get('/subasta', (req, res) => {
    res.render('subastas');
});

router.get('/inmueble', (req, res) => {
    res.render('inmueble');
})

router.post('/login', (req, res) => {
    const consulta = 'SELECT nombre, contraseña FROM usuarios;';
    const { usuario, contra } = req.body;

    conexion.query(consulta, function (err, result, fields) {
        if (err) {
            console.error('Error al realizar la consulta: ', err);
            res.status(500).json({ message: 'Error interno del servidor' });
            return;
        }

        console.log('Datos de usuario:', usuario);
        console.log('Datos de contraseña:', contra);
        console.log('Resultado de la consulta:', result);

        // Comprobar si se encontró un usuario con la contraseña correcta
        const usuarioEncontrado = result.find(user => user.nombre === usuario && user.contraseña === contra);
        if (usuarioEncontrado) {
            res.json({ success: true, redirect: '/user/' });
            //res.render('home', { usuario });
        } else {
            console.log('Usuario o contraseña incorrectos');
            res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }
    });
});

router.post('/registro', (req, res) => {
    const consulta = 'INSERT INTO subastaonline.usuarios (nombre, apellidos, dni, celular, correo_electronico, contraseña, boleta, factura, numero_factura, terminos_y_condiciones, uso_datos_personales) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
    const {
        nombre,
        apellidos,
        dni,
        celular,
        correo_electronico,
        contraseña,
        boleta,
        factura,
        numero_factura,
        terminos_y_condiciones,
        uso_datos_personales,
    } = req.body;

    const valores = [
        nombre,
        apellidos,
        dni,
        celular,
        correo_electronico,
        contraseña,
        boleta,
        factura,
        numero_factura,
        terminos_y_condiciones,
        uso_datos_personales,
    ];

    conexion.query(consulta, valores, function (err, result, fields) {
        if (err) {
            console.error('Error al realizar la inserción: ', err);
            res.status(500).send('Error interno del servidor');
            return;
        }

        console.log('Registro insertado correctamente:', result);
        res.render('login');
    });
});

module.exports = router;
