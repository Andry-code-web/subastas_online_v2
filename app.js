const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Base de datos
const conection = require('./src/database/db');
const sessionStore = require('./src/database/sessionStore');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'SUBASSTASONLINE',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24 
    }
}))

// Routers
const usersRouter = require('./src/routes/user_routes');
const adminRouter = require('./src/routes/admin_routes');

app.use('/user', usersRouter);
app.use('/admin', adminRouter);

// Configuración
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`El servidor está corriendo en el puerto ${port}`);
});