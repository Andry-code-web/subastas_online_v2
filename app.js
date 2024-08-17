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
app.set('views', path.join(__dirname, 'views'));
app.set('views', '/opt/render/project/src/views');
app.use(express.static(path.join(__dirname, 'public')));

const auctions = {}; // Objeto para almacenar el estado de cada subasta
const HEARTBEAT_TIMEOUT = 5000; // Tiempo en milisegundos para considerar que un cliente se desconectó (5 segundos)
const lastHeartbeat = {}; // Mantener un registro del último latido recibido por cada sala (subasta)

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`Cliente unido a la sala: ${room}`);

        // Inicializar el estado de la subasta si no existe en la memoria
        if (!auctions[room]) {
            auctions[room] = {
                auctionEnded: false,
                currentWinner: null,
                clientDisconnected: false,
                winnerNotified: false // Controlar si el ganador ha sido notificado
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
        const bidValue = parseInt(data.bid);
        
        // Verificar que la puja no sea menor que la puja mínima permitida
        if (auctions[room].auctionEnded || auctions[room].clientDisconnected || bidValue < (auctions[room].currentBid || 0)) {
            console.log('Puja inválida o subasta terminada.');
            return; // No aceptar nuevas pujas si la subasta ha terminado o si la puja es menor que la actual
        }
    
        console.log('Nueva puja recibida:', data);
        auctions[room].currentWinner = data.user; // Actualizar el ganador actual
        auctions[room].currentBid = bidValue; // Actualizar la puja actual
    
        // Emitir la nueva puja a todos los clientes en la sala específica
        io.to(room).emit('newBid', data);
    
        // Actualizar el estado de la subasta en la base de datos
        const updateQuery = "UPDATE subastas SET currentWinner = ?, currentBid = ? WHERE id = ?";
        conexion.query(updateQuery, [data.user, data.bid, room], (error, results) => {
            if (error) {
                console.error("Error al actualizar el ganador de la subasta:", error);
                return;
            }
            console.log(`Ganador y puja actualizados en la subasta ${room}:`, data.user, data.bid);
        });
    });

    socket.on('endAuction', (room) => {
        if (!auctions[room].auctionEnded) {
            auctions[room].auctionEnded = true;
    
            // Marca la subasta como finalizada en la base de datos
            const updateQuery = "UPDATE subastas SET auctionEnded = true WHERE id = ?";
            conexion.query(updateQuery, [room], (error, results) => {
                if (error) {
                    console.error("Error al marcar la subasta como finalizada:", error);
                    return;
                }
                
                // Obtener el nombre de usuario del ganador
                const username = auctions[room].currentWinner;
    
                // Consulta para obtener el ID del usuario basado en su nombre de usuario
                const getUserIdQuery = "SELECT id FROM usuarios WHERE usuario = ?";
                conexion.query(getUserIdQuery, [username], (error, results) => {
                    if (error) {
                        console.error('Error al obtener el ID del usuario:', error);
                        return;
                    }
    
                    if (results.length > 0) {
                        const userId = results[0].id;
    
                        // Actualizar oportunidades
                        const updateOpportunitiesQuery = "UPDATE usuarios SET oportunidades = oportunidades - 1 WHERE id = ? AND oportunidades > 0";
                        conexion.query(updateOpportunitiesQuery, [userId], (error, results) => {
                            if (error) {
                                console.error('Error al actualizar oportunidades:', error);
                                return;
                            }
    
                            // Verificar si se realizó la actualización
                            if (results.affectedRows > 0) {
                                console.log('Oportunidad restada correctamente.');
    
                                // Consultar el número de oportunidades restantes
                                const getOpportunitiesQuery = "SELECT oportunidades FROM usuarios WHERE id = ?";
                                conexion.query(getOpportunitiesQuery, [userId], (error, results) => {
                                    if (error) {
                                        console.error('Error al obtener el número de oportunidades restantes:', error);
                                        return;
                                    }
    
                                    if (results.length > 0) {
                                        const remainingOpportunities = results[0].oportunidades;
                                        console.log(`El usuario con ID ${userId} ahora tiene ${remainingOpportunities} oportunidades restantes.`);
                                    } else {
                                        console.log('No se encontró el usuario para obtener las oportunidades restantes.');
                                    }
                                });
                            } else {
                                console.log('No se pudo restar la oportunidad o el usuario no tenía oportunidades.');
                            }
                        });
                    } else {
                        console.error('No se encontró el usuario con el nombre de usuario:', username);
                    }
                });
    
                // Notificar a todos los clientes que la subasta ha terminado
                io.to(room).emit('auctionEnded', { winner: auctions[room].currentWinner });
                auctions[room].winnerNotified = true; // Marcar que el ganador ha sido notificado
                console.log(`Subasta ${room} marcada como finalizada.`);
            });
        }
    });

    // Manejar latidos de corazón para mantener la subasta activa
    socket.on('heartbeat', (room) => {
        console.log(`Latido recibido de la sala ${room}`);
        
        // Inicializar el estado de la subasta si no existe en la memoria
        if (!auctions[room]) {
            auctions[room] = {
                auctionEnded: false,
                currentWinner: null,
                clientDisconnected: false,
                winnerNotified: false
            };
        }

        lastHeartbeat[room] = Date.now(); // Actualizar el tiempo del último latido recibido para esta sala
        auctions[room].clientDisconnected = false; // Marcar al cliente como conectado
    });

    // Verificar el estado de los latidos de corazón y manejar desconexiones
    setInterval(() => {
        Object.keys(lastHeartbeat).forEach(room => {
            const timeSinceLastHeartbeat = Date.now() - lastHeartbeat[room];
            if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
                console.log(`Cliente en la sala ${room} desconectado`);
                auctions[room].clientDisconnected = true; // Marcar al cliente como desconectado

                // Notificar a todos los clientes en la sala que un cliente se desconectó
                io.to(room).emit('clientDisconnected', { message: `Cliente desconectado de la subasta ${room}` });
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
