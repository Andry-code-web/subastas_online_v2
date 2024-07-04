const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Base de datos
const conexion = require('./src/database/db');
const sessionStore = require('./src/database/sessionStore');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb', parameterLimit: 5000000 }));
app.use(express.json());
app.use(morgan('dev'));

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'SUBASTASONLINE',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));

// Routers
const usersRouter = require('./src/routes/user_routes');
const adminRouter = require('./src/routes/admin_routes');

app.use('/user', usersRouter);
app.use('/admin', adminRouter);

// Configuración de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Estado de las subastas
const auctions = {}; // Objeto para almacenar el estado de cada subasta
const HEARTBEAT_TIMEOUT = 15000; // Tiempo en milisegundos para considerar que un cliente se desconectó (15 segundos)

// Socket.io - Manejo de subastas y persistencia en la base de datos
io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`Cliente unido a la sala: ${room}`);

        // Inicializar el estado de la subasta si no existe en la memoria
        if (!auctions[room]) {
            auctions[room] = {
                auctionEnded: false,
                currentWinner: null
            };
        }

        // Consultar el estado actual de la subasta desde la base de datos y restaurarlo si es necesario
        const query = "SELECT * FROM subastas WHERE id = ?";
        conexion.query(query, [room], (error, results) => {
            if (error) {
                console.error("Error al obtener estado de subasta:", error);
                return;
            }
            if (results.length > 0) {
                auctions[room].auctionEnded = results[0].auctionEnded;
                auctions[room].currentWinner = results[0].currentWinner;

                // Notificar al cliente sobre el estado de la subasta
                if (auctions[room].auctionEnded) {
                    socket.emit('auctionEnded', { winner: auctions[room].currentWinner });
                }
            } else {
                // Manejar el caso cuando no se encuentra la subasta en la base de datos
                console.error("No se encontró la subasta:", room);
            }
        });
    });

    socket.on('bid', (data) => {
        const room = data.room;
        if (auctions[room].auctionEnded) return; // No aceptar nuevas pujas si la subasta ha terminado

        console.log('Nueva puja recibida:', data);
        auctions[room].currentWinner = data.user; // Actualizar el ganador actual

        // Emitir la nueva puja a todos los clientes en la sala específica
        io.to(room).emit('newBid', data);

        // Actualizar el estado de la subasta en la base de datos
        const updateQuery = "UPDATE subastas SET currentWinner = ? WHERE id = ?";
        conexion.query(updateQuery, [data.user, room], (error, results) => {
            if (error) {
                console.error("Error al actualizar el ganador de la subasta:", error);
                return;
            }
            console.log(`Ganador actualizado en la subasta ${room}:`, data.user);
        });
    });

    socket.on('endAuction', (room) => {
        auctions[room].auctionEnded = true;

        const updateQuery = "UPDATE subastas SET auctionEnded = true WHERE id = ?";
        conexion.query(updateQuery, [room], (error, results) => {
            if (error) {
                console.error("Error al marcar la subasta como finalizada:", error);
                return;
            }
            io.to(room).emit('auctionEnded', { winner: auctions[room].currentWinner });
            console.log(`Subasta ${room} marcada como finalizada.`);
        });

    });

    // Manejar latidos de corazón para mantener la subasta activa
    let lastHeartbeat = {}; // Mantener un registro del último latido recibido por cada sala (subasta)

    socket.on('heartbeat', (room) => {
        console.log(`Latido recibido de la sala ${room}`);
        lastHeartbeat[room] = Date.now(); // Actualizar el tiempo del último latido recibido para esta sala
    });

    // Verificar el estado de los latidos de corazón y manejar desconexiones
    setInterval(() => {
        Object.keys(lastHeartbeat).forEach(room => {
            const timeSinceLastHeartbeat = Date.now() - lastHeartbeat[room];
            if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
                console.log(`Cliente en la sala ${room} desconectado`);
                // Puedes agregar lógica adicional aquí, como notificar que el cliente se desconectó
                // y manejar la lógica de la subasta según tus requerimientos.
            }
        });
    }, 5000); // Verificar cada 5 segundos el estado de los latidos de corazón (ajusta según tus necesidades)

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});


// Iniciar el servidor
server.listen(port, () => {
    console.log(`El servidor está corriendo en el puerto ${port}`);
});
