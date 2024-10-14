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

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    socket.on('joinRoom', (room) => {
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
                    socket.join(room);
                    console.log(`Cliente unido a la sala: ${room}`);

                    // Inicializar el estado de la subasta si no existe
                    if (!auctions[room]) {
                        auctions[room] = {
                            auctionEnded: false,
                            currentWinner: null,
                            clientDisconnected: false,
                            currentBid: 0,
                            winnerNotified: false,
                            auctionParticipants: 0 // Inicializar contador de participantes
                        };
                    }

                    // Incrementar el número de participantes
                    auctions[room].auctionParticipants++;
                    console.log(`Participantes en la sala ${room}: ${auctions[room].auctionParticipants}`);

                    // Emitir el número actual de participantes a todos en la sala
                    io.to(room).emit('participantCountUpdated', {
                        participants: auctions[room].auctionParticipants
                    });

                    // Emitir evento participantJoined
                    socket.to(room).emit('participantJoined', { message: `Un nuevo participante se ha unido. Total de participantes: ${auctions[room].auctionParticipants}` });

                    // Verificar si hay al menos dos usuarios en la sala
                    if (auctions[room].auctionParticipants >= 2) {
                        console.log(`Hay al menos dos participantes en la sala ${room}. La subasta puede comenzar.`);
                        io.to(room).emit('auctionCanStart', { message: 'La subasta puede comenzar' });
                    } else {
                        console.log(`Esperando más participantes en la sala ${room}`);
                        io.to(room).emit('waitingForParticipants', { message: 'Esperando al menos 2 participantes para comenzar la subasta' });
                    }
                }
            }
        });
    });


    socket.on('bid', (data) => {
        const room = data.room;
        const bidValue = parseInt(data.bid);

        if (!auctions[room]) {
            auctions[room] = {
                auctionEnded: false,
                currentWinner: null,
                clientDisconnected: false,
                currentBid: 0,
                winnerNotified: false,
                auctionParticipants: 0
            };
        }

        // Verificar si la subasta ha terminado o si el cliente se ha desconectado
        if (auctions[room].auctionEnded || auctions[room].clientDisconnected) {
            console.log('Subasta terminada o cliente desconectado.');
            return;
        }

        // Verificar si hay al menos 2 participantes
        if (auctions[room].auctionParticipants < 2) {
            console.log('No hay suficientes participantes para pujar.');
            return;
        }

        // Verificar si la puja es válida
        if (bidValue < (auctions[room].currentBid || 0)) {
            console.log('Puja inválida. Debe ser mayor que la puja actual.');
            return;
        }

        // Registrar la nueva puja
        console.log('Nueva puja recibida:', data);
        auctions[room].currentWinner = data.user;
        auctions[room].currentBid = bidValue;

        io.to(room).emit('newBid', data);

        const updateQuery = "UPDATE subastas SET currentWinner = ?, currentBid = ? WHERE id = ?";
        conection.query(updateQuery, [data.user, bidValue, room], (error) => {
            if (error) {
                console.error("Error al actualizar el ganador de la subasta:", error);
            } else {
                console.log(`Ganador y puja actualizados en la subasta ${room}:`, data.user, bidValue);
            }
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
        Object.keys(socket.rooms).forEach((room) => {
            if (auctions[room]) {
                // Decrementar el número de participantes al desconectar
                auctions[room].auctionParticipants--;
                console.log(`Participantes en la sala ${room} después de la desconexión: ${auctions[room].auctionParticipants}`);

                // Emitir el nuevo número de participantes a todos en la sala
                io.to(room).emit('participantCountUpdated', {
                    participants: auctions[room].auctionParticipants
                });

                // Emitir evento participantLeft
                io.to(room).emit('participantLeft', { message: `Un participante ha salido. Total de participantes: ${auctions[room].auctionParticipants}` });

                if (auctions[room].auctionParticipants < 2) {
                    io.to(room).emit('waitingForParticipants', { message: 'Esperando al menos 2 participantes para comenzar la subasta' });
                }
            }
        });
        console.log('Cliente desconectado');
    });


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
