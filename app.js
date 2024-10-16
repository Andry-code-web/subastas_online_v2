const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
//const MySQLStore = require('express-mysql-session')(session);
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Conección a la base de datos
const { conection } = require('./src/database/db');
const sessionStore = require('./src/database/sessionStore');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false, limit: '120mb', parameterLimit: 5000000 }));
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

app.use('/', usersRouter);
app.use('/admin', adminRouter);

// Configuración de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.static(path.join(__dirname, 'public')));


const auctions = {}; // Objeto para almacenar el estado de cada subasta
const HEARTBEAT_TIMEOUT = 5000; // Tiempo en milisegundos para considerar que un cliente se desconectó (5 segundos)
const lastHeartbeat = {}; // Mantener un registro del último latido recibido por cada sala (subasta)
const auctionRooms = {}; // Objeto para almacenar participantes por sala

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado:', socket.id);

    // Cuando un usuario se une a una sala, recibe su nombre
    socket.on('joinRoom', (room, userName) => {
        // Asignar el nombre de usuario al socket
        socket.userName = userName; 

        if (!auctionRooms[room]) {
            auctionRooms[room] = new Set(); // Usamos un Set para evitar duplicados
        }

        // Unirse a la sala
        socket.join(room);

        const query = "SELECT auctionEnded, currentWinner FROM subastas WHERE id = ?";
        conection.query(query, [room], (error, results) => {
            if (error) {
                console.error("Error al obtener el estado de la subasta:", error);
                return;
            }

            if (results.length > 0) {
                const auctionEnded = results[0].auctionEnded;
                const currentWinner = results[0].currentWinner;

                if (auctionEnded && currentWinner) {
                    // Emitir evento endAuction para el cliente que acaba de unirse
                    socket.emit('endAuction', { winner: currentWinner });
                    console.log(`Cliente se unió a una subasta ya terminada en la sala ${room}`);
                } else {
                    auctionRooms[room].add(socket.userName); // Añadir el usuario al Set

                    // Emitir el número de participantes a todos en la sala
                    const participantCount = auctionRooms[room].size;
                    io.to(room).emit('updateParticipantCount', participantCount);

                    // Emitir evento participantJoined
                    socket.to(room).emit('participantJoined', { message: `${socket.userName} se ha unido.` });

                    // Log para el servidor
                    console.log(`Participante ${socket.userName} se ha unido a la subasta ${room}. Total de participantes: ${participantCount}`);
                }
            }
        });
    });

    socket.on('heartbeat', (room) => {
        // Actualizar el tiempo del último latido recibido
        lastHeartbeat[room] = Date.now();
    });

    socket.on('bid', (data) => {
        const room = data.room;
        const bidValue = parseInt(data.bid);

        // Verificar si la subasta ha terminado o si el cliente se ha desconectado
        if (auctions[room]?.auctionEnded || auctions[room]?.clientDisconnected) {
            console.log('Subasta terminada o cliente desconectado.');
            return;
        }

        // Verificar si la puja es válida
        if (isNaN(bidValue) || bidValue <= auctions[room].currentBid) {
            console.log('Puja inválida. Debe ser un número mayor que la puja actual.');
            return;
        }

        // Registrar la nueva puja
        console.log('Nueva puja recibida:', data);
        auctions[room].currentWinner = data.user;
        auctions[room].currentBid = bidValue;

        // Emitir la nueva puja a todos los usuarios en la sala
        io.to(room).emit('newBid', {
            user: data.user,
            bid: bidValue,
            message: `${data.user} ha pujado con ${bidValue}`
        });
    });

    socket.on('endAuction', (room) => {
        if (!auctions[room].auctionEnded) {
            auctions[room].auctionEnded = true;

            const updateQuery = "UPDATE subastas SET auctionEnded = true WHERE id = ?";
            conection.query(updateQuery, [room], (error) => {
                if (error) {
                    console.error("Error al marcar la subasta como finalizada:", error);
                    return;
                }

                const username = auctions[room].currentWinner;
                const getUserIdQuery = "SELECT id FROM usuarios WHERE usuario = ?";

                conection.query(getUserIdQuery, [username], (error, results) => {
                    if (error) {
                        console.error('Error al obtener el ID del usuario:', error);
                        return;
                    }

                    if (results.length > 0) {
                        const userId = results[0].id;
                        const updateOpportunitiesQuery = "UPDATE usuarios SET oportunidades = oportunidades - 1 WHERE id = ? AND oportunidades > 0";

                        conection.query(updateOpportunitiesQuery, [userId], (error) => {
                            if (error) {
                                console.error('Error al actualizar oportunidades:', error);
                            } else {
                                console.log('Oportunidad restada correctamente.');
                            }
                        });
                    } else {
                        console.error('No se encontró el usuario con el nombre de usuario:', username);
                    }
                });

                io.to(room).emit('auctionEnded', { winner: auctions[room].currentWinner });
                auctions[room].winnerNotified = true;
                console.log(`Subasta ${room} marcada como finalizada.`);
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);

        // Reducir el contador de participantes si el cliente estaba en una sala
        const rooms = Object.keys(socket.rooms);
        rooms.forEach(room => {
            if (auctionRooms[room]) {
                auctionRooms[room].delete(socket.userName); // Suponiendo que has guardado el nombre de usuario en socket.userName
                io.to(room).emit('updateParticipantCount', auctionRooms[room].size);
            }
        });
    });

    // Intervalo para verificar los latidos
    setInterval(() => {
        Object.keys(lastHeartbeat).forEach(room => {
            const timeSinceLastHeartbeat = Date.now() - lastHeartbeat[room];
            if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
                auctions[room].clientDisconnected = true;
                io.to(room).emit('clientDisconnected', { message: `Cliente desconectado de la subasta ${room}` });
            }
        });
    }, 5000);
});










server.timeout = 0;

// Iniciar el servidor
server.listen(port, () => {
    console.log(`El servidor está corriendo en el puerto ${port}`);
});
