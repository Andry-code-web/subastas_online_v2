const mysql = require('mysql2');
require('dotenv').config();

/* const conection = mysql.createConnection({
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
}); */

const conection = mysql.createPool({
    connectionLimit: 20,  // Número máximo de conexiones en el conection
    waitForConnections: true,  // Esperar si el conection está vacío
    queueLimit: 0,  // Sin límite en la cola de espera
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD
});

// Función para ajustar el tamaño del conection
const adjustConectionSize = (newLimit) => {
    conection.config.connectionLimit = newLimit;
}

// Manejo de eventos del conection
conection.on('connection', (connection) => {
    console.log('Nueva conexión establecida a la base de datos');
});

conection.on('error', (err) => {
    console.error('Error en el pool de conexiones:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('La conexión a la base de datos se ha perdido. Intentando reconectar...');
        // Aquí puedes intentar reconectar o implementar una lógica adicional
    } else {
        throw err; // Lanza el error si no es manejable
    }
});


module.exports = { conection, adjustConectionSize };
