const express = require('express');
const morgan = require('morgan');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Base de datos
require('./src/database/db');

// Routers
const usersRouter = require('./src/routes/user_routes');
const adminRouter = require('./src/routes/admin_routes');

app.use('/user', usersRouter);
app.use('/admin', adminRouter);

// Configuración
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));


app.listen(port, () => {
    console.log(`El servidor está corriendo en el puerto ${port}`);
});
