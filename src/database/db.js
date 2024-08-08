const mysql = require('mysql2');
require('dotenv').config();

const conection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
});

conection.connect((error) =>{
    if (error) {
        console.error('No se puedo conectar a la base de datos' + error);
        return;
    }
    console.log('Conectado a la base de datos');
});

module.exports = conection;