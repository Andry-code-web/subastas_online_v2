const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();
const bcrypt = require('bcrypt');
const moment = require('moment');
const momenT = require('moment-timezone'); // Asegúrate de tener moment-timezone instalado

const { conection } = require("../database/db"); // Asegúrate de que el nombre del archivo y la ruta sean correctos

router.use(bodyParser.urlencoded({ extended: true }));

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.usuario) {
    return next();
  } else {
    res.redirect('/login');
  }
};

router.get("/", (req, res) => {
  // Consulta para obtener todas las subastas, incluyendo likes
  let querySubastas = `
    SELECT s.*, IFNULL(l.like_count, 0) AS like_count
    FROM subastas s
    LEFT JOIN (
      SELECT subasta_id, COUNT(*) AS like_count
      FROM likes
      GROUP BY subasta_id
    ) l ON s.id = l.subasta_id
    ORDER BY like_count DESC, s.id ASC;
  `;

  const queryImagenes = "SELECT id_subasta, imagen FROM imagenes_propiedad";

  const queryConteoCategorias = `
    SELECT categoria, COUNT(*) AS cantidad
    FROM subastas
    GROUP BY categoria;
  `;

  conection.query(querySubastas, (error, subastas) => {
    if (error) {
      console.error("Error al obtener datos de subasta", error);
      return res.status(500).send("Error al obtener datos de subasta");
    }

    conection.query(queryImagenes, (error, imagenes) => {
      if (error) {
        console.error("Error al obtener imágenes de subasta", error);
        return res.status(500).send("Error al obtener imágenes de subasta");
      }

      conection.query(queryConteoCategorias, (error, conteoCategorias) => {
        if (error) {
          console.error("Error al obtener el conteo de categorías", error);
          return res.status(500).send("Error al obtener el conteo de categorías");
        }

        // Función para formatear el precio
        function formatearPrecio(precio) {
          if (precio >= 1000) {
            return (precio / 1000).toFixed(precio >= 10000 ? 0 : 1) + "/mil";
          }
          return precio;
        }

        // Combina las imágenes con las subastas y formatea el precio
        const subastasConImagenes = subastas.map((subasta) => {
          const imagenesSubasta = imagenes.filter(
            (imagen) => imagen.id_subasta === subasta.id
          );
          return {
            ...subasta,
            precio_base: formatearPrecio(subasta.precio_base), // Formatea el precio aquí
            imagenes: imagenesSubasta.map((img) => img.imagen.toString("base64")),
          };
        });

        // Filtra subastas por categoría y limita a un máximo de 10 subastas por categoría
        const camionetas = subastasConImagenes.filter(subasta => subasta.categoria === 'camioneta').slice(0, 10);
        const autos = subastasConImagenes.filter(subasta => subasta.categoria === 'auto').slice(0, 10);
        const motos = subastasConImagenes.filter(subasta => subasta.categoria === 'moto').slice(0, 10);
        const piezas = subastasConImagenes.filter(subasta => subasta.categoria === 'piezas');

        // Obtener las cantidades de subastas por categoría
        const cantidades = conteoCategorias.reduce((acc, categoria) => {
          acc[categoria.categoria] = categoria.cantidad;
          return acc;
        }, {});

        res.render("home", {
          usuario: req.session.usuario,
          camionetas,
          autos,
          motos,
          piezas,
          cantidades // Objeto con la cantidad de subastas por categoría
        });
      });
    });
  });
});

router.post("/", (req, res) => {
  const { nombre, texto, rating } = req.body;

  if (!nombre || !texto || !rating) {
    console.error("Todos los campos son obligatorios");
    return res.status(400).send("Todos los campos son obligatorios");
  }

  const query =
    "INSERT INTO comentarios (nombre, comentario, rating) VALUES (?, ?, ?)";
  const values = [nombre, texto, rating];

  conection.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al subir los datos del formulario:", error);
      return res.status(500).send("Error al subir los datos del formulario");
    }
    res.redirect("/");
  });
});

/* LOGIN, LOGOUT GET POST */
router.get("/login", (req, res) => {
  res.render("login");
});

// Ruta de inicio de sesión
router.post('/login', (req, res) => {
  const { usuario, contra } = req.body;

  // Consulta parametrizada para evitar inyecciones SQL
  const sql = "SELECT id, usuario, contraseña FROM usuarios WHERE usuario = ?";

  conection.query(sql, [usuario], (err, result) => {
    if (err) {
      console.error("Error al realizar la consulta: ", err);
      return res.status(500).json({ message: "Error interno del servidor" });
    }

    if (result.length > 0) {
      const usuarioEncontrado = result[0];

      // Comparar la contraseña proporcionada con la almacenada
      bcrypt.compare(contra, usuarioEncontrado.contraseña, (err, isMatch) => {
        if (err) {
          console.error("Error al comparar contraseñas: ", err);
          return res.status(500).json({ message: "Error interno del servidor" });
        }

        if (isMatch) {
          req.session.usuario = {
            id: usuarioEncontrado.id,
            nombre: usuarioEncontrado.usuario,
          };
          res.json({ success: true, redirect: "/" });
        } else {
          console.log("Usuario o contraseña incorrectos");
          res.status(401).json({ message: "Usuario o contraseña incorrectos" });
        }
      });
    } else {
      console.log("Usuario o contraseña incorrectos");
      res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }
  });
});

// Ruta para obtener información del usuario
router.get('/usuario', (req, res) => {
  if (req.session.usuario) {
    res.json({ success: true, id: req.session.usuario.id });
  } else {
    res.status(401).json({ success: false, message: 'No estás autenticado' });
  }
});


router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión: ", err);
      res.status(500).send("Error al cerrar sesión");
    } else {
      res.redirect("/");
    }
  });
});

/* REGISTRO GET POST */
router.get("/registro", (req, res) => {
  res.render("registro");
});

const saltRounds = 10; // Puedes ajustar el número de rondas de sal

router.post('/registro', (req, res) => {
  const datos = req.body;

  // Determinar el tipo de persona y asignar valores predeterminados
  if (datos.tipo_persona === 'natural') {
    // Persona Natural
    const valores = {
      tipo_persona: datos.tipo_persona,
      email: datos.email || '0',
      confirmacion_email: datos.confirmacion_email || '0',
      celular: datos.celular || '0',
      telefono: datos.telefono || '0',
      nombre_apellidos: datos.nombre_apellidos || '0',
      dni_ce: datos.dni_ce || '0',
      fecha_nacimiento: datos.fecha_nacimiento || '0000-00-00',
      sexo: datos.sexo || '0',
      estado_civil: datos.estado_civil || '0',
      ruc: null,
      nombre_comercial: null,
      actividad_comercial: null,
      departamento: datos.departamento || '0',
      provincia: datos.provincia || '0',
      distrito: datos.distrito || '0',
      direccion: datos.direccion || '0',
      numero: datos.numero || '0',
      complemento: datos.complemento || '0',
      usuario: datos.usuario || '0',
      contraseña: datos.contraseña || '0',
      terminos_y_condiciones: parseInt(datos.terminos_y_condiciones) ? 1 : 0
    };

    // Encriptar la contraseña
    bcrypt.hash(valores.contraseña, saltRounds, (err, hashedPassword) => {
      if (err) {
        console.error('Error al encriptar la contraseña:', err);
        return res.status(500).send('Error al encriptar la contraseña');
      }

      // Actualizar el valor de la contraseña con el hash
      valores.contraseña = hashedPassword;

      const sql = `
        INSERT INTO usuarios (
            tipo_persona, email, confirmacion_email, celular, telefono,
            nombre_apellidos, dni_ce, fecha_nacimiento, sexo, estado_civil,
            ruc, nombre_comercial, actividad_comercial,
            departamento, provincia, distrito, direccion, numero, complemento,
            usuario, contraseña, terminos_y_condiciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      conection.query(sql, [
        valores.tipo_persona, valores.email, valores.confirmacion_email, valores.celular, valores.telefono,
        valores.nombre_apellidos, valores.dni_ce, valores.fecha_nacimiento, valores.sexo, valores.estado_civil,
        valores.ruc, valores.nombre_comercial, valores.actividad_comercial,
        valores.departamento, valores.provincia, valores.distrito, valores.direccion, valores.numero, valores.complemento,
        valores.usuario, valores.contraseña, valores.terminos_y_condiciones
      ], (err, results) => {
        if (err) {
          console.error('Error al realizar la inserción:', err);
          return res.status(500).send('Error al realizar la inserción');
        }
        res.redirect('/login');
      });
    });
  } else if (datos.tipo_persona === 'juridica') {
    // Persona Jurídica
    const valores = {
      tipo_persona: datos.tipo_persona,
      email: datos.email || '0',
      confirmacion_email: datos.confirmacion_email || '0',
      celular: datos.celular || '0',
      telefono: datos.telefono || '0',
      nombre_apellidos: null,
      dni_ce: null,
      fecha_nacimiento: null,
      sexo: null,
      estado_civil: null,
      ruc: datos.ruc || '0',
      nombre_comercial: datos.nombre_comercial || '0',
      actividad_comercial: datos.actividad_comercial || '0',
      departamento: datos.departamento || '0',
      provincia: datos.provincia || '0',
      distrito: datos.distrito || '0',
      direccion: datos.direccion || '0',
      numero: datos.numero || '0',
      complemento: datos.complemento || '0',
      usuario: datos.usuario || '0',
      contraseña: datos.contraseña || '0',
      terminos_y_condiciones: parseInt(datos.terminos_y_condiciones) ? 1 : 0
    };

    // Encriptar la contraseña
    bcrypt.hash(valores.contraseña, saltRounds, (err, hashedPassword) => {
      if (err) {
        console.error('Error al encriptar la contraseña:', err);
        return res.status(500).send('Error al encriptar la contraseña');
      }

      // Actualizar el valor de la contraseña con el hash
      valores.contraseña = hashedPassword;

      const sql = `
        INSERT INTO usuarios (
            tipo_persona, email, confirmacion_email, celular, telefono,
            nombre_apellidos, dni_ce, fecha_nacimiento, sexo, estado_civil,
            ruc, nombre_comercial, actividad_comercial,
            departamento, provincia, distrito, direccion, numero, complemento,
            usuario, contraseña, terminos_y_condiciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      conection.query(sql, [
        valores.tipo_persona, valores.email, valores.confirmacion_email, valores.celular, valores.telefono,
        valores.nombre_apellidos, valores.dni_ce, valores.fecha_nacimiento, valores.sexo, valores.estado_civil,
        valores.ruc, valores.nombre_comercial, valores.actividad_comercial,
        valores.departamento, valores.provincia, valores.distrito, valores.direccion, valores.numero, valores.complemento,
        valores.usuario, valores.contraseña, valores.terminos_y_condiciones
      ], (err, results) => {
        if (err) {
          console.error('Error al realizar la inserción:', err);
          return res.status(500).send('Error al realizar la inserción');
        }
        res.redirect('/login');
      });
    });
  } else {
    res.status(400).send('Tipo de persona no válido');
  }
});


//hasta aiqui funciona
// Catálogo con funcionalidad de búsqueda
router.get("/catalogo", (req, res) => {
  const { categoria, page = 1, estado, search } = req.query; // Parámetros de la consulta
  const usuario_id = req.session.usuario ? req.session.usuario.id : null;
  const limit = 12; // Número de subastas por página
  const offset = (page - 1) * limit; // Calcular el desplazamiento

  let querySubastas = "SELECT * FROM subastas";
  const queryParams = []; // arrays

  // Filtro por categoría si se proporciona
  if (categoria) {
    querySubastas += " WHERE categoria = ?";
    queryParams.push(categoria);
  }

  // Filtro por estado de subasta basado en la columna act_fina
  if (estado === "finalizadas") {
    querySubastas += (categoria ? " AND" : " WHERE") + " act_fina = 'finalizada'";
  } else if (estado === "activas") {
    querySubastas += (categoria ? " AND" : " WHERE") + " act_fina = 'activa'";
  }

  // Filtro por búsqueda si se proporciona
  if (search) {
    querySubastas += (categoria || estado ? " AND" : " WHERE") + `(
      categoria LIKE ? OR marca LIKE ? OR modelo LIKE ? OR ubicacion LIKE ? OR importante LIKE ?
    )`;
    const searchQuery = `%${search}%`; // Definición de searchQuery
    queryParams.push(searchQuery, searchQuery, searchQuery, searchQuery, searchQuery);
  }

  console.log(querySubastas); // Imprimir la consulta SQL para verificar

  querySubastas += " ORDER BY id ASC LIMIT ? OFFSET ?"; // Agregar paginación
  queryParams.push(limit, offset); // Agregar limit y offset a los parámetros de consulta

  const queryImagenes = "SELECT id_subasta, imagen FROM imagenes_propiedad";

  conection.query(querySubastas, queryParams, (error, subastas) => {
    if (error) {
      console.error("Error al obtener datos de subasta", error);
      return res.status(500).send("Error al obtener datos de subasta");
    }

    // Formatear la fecha de subasta antes de continuar
    const subastasFormateadas = subastas.map((subasta) => {
      const fecha = new Date(subasta.fecha_subasta); // Convertir a objeto Date
      subasta.fecha_formateada = fecha.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      });
      return subasta;
    });

    // Si no se encontraron subastas, buscar sugerencia
    if (subastas.length === 0 && search) {
      buscarSugerencia(search, conection, (sugerencia) => {
        const mensaje = sugerencia ? `El vehículo que busca la marca o modelo "${search}" no encontramos".` : `El vehículo que busca la marca o modelo "${search}" no encontramos y no hay sugerencias disponibles.`;

        return res.render("catalogo", {
          usuario: req.session.usuario,
          subastas: [],
          categoria,
          estado,
          search,
          page: Number(page),
          totalPages: 0,
          mensaje, // Pasar el mensaje a la vista
        });
      });
    } else {
      conection.query(queryImagenes, (error, imagenes) => {
        if (error) {
          console.error("Error al obtener imágenes de subasta", error);
          return res.status(500).send("Error al obtener imágenes de subasta");
        }

        const subastasConImagenes = subastasFormateadas.map((subasta) => {
          const imagenesSubasta = imagenes.filter(
            (imagen) => imagen.id_subasta === subasta.id
          );
          return {
            ...subasta,
            imagenes: imagenesSubasta.map((img) => img.imagen.toString("base64")),
          };
        });

        // Consulta adicional para contar el total de subastas
        let totalSubastasQuery = "SELECT COUNT(*) AS total FROM subastas";
        const totalParams = [];

        // Contar también basado en el estado seleccionado
        if (categoria) {
          totalSubastasQuery += " WHERE categoria = ?";
          totalParams.push(categoria);
        }

        if (estado === "finalizadas") {
          totalSubastasQuery += (categoria ? " AND" : " WHERE") + " act_fina = 'finalizada'";
        } else if (estado === "activas") {
          totalSubastasQuery += (categoria ? " AND" : " WHERE") + " act_fina = 'activa'";
        }

        // Filtro de búsqueda para contar total de subastas
        if (search) {
          const searchQuery = `%${search}%`; // Definición de searchQuery
          totalSubastasQuery += (categoria || estado ? " AND" : " WHERE") + `(
            categoria LIKE ? OR marca LIKE ? OR modelo LIKE ? OR ubicacion LIKE ? OR importante LIKE ?
          )`;
          totalParams.push(searchQuery, searchQuery, searchQuery, searchQuery, searchQuery);
        }

        conection.query(totalSubastasQuery, totalParams, (error, totalResult) => {
          if (error) {
            console.error("Error al contar subastas", error);
            return res.status(500).send("Error al contar subastas");
          }

          const totalSubastas = totalResult[0].total;
          const totalPages = Math.ceil(totalSubastas / limit); // Calcular el total de páginas

          if (usuario_id) {
            // Consulta adicional para verificar los likes del usuario
            const queryLikes = "SELECT subasta_id FROM likes WHERE user_id = ?";
            conection.query(queryLikes, [usuario_id], (error, likes) => {
              if (error) {
                console.error("Error al obtener likes del usuario", error);
                return res.status(500).send("Error al obtener likes del usuario");
              }

              const likedSubastas = likes.map((like) => like.subasta_id);

              subastasConImagenes.forEach((subasta) => {
                subasta.liked_by_user = likedSubastas.includes(subasta.id);
              });

              res.render("catalogo", {
                usuario: req.session.usuario,
                subastas: subastasConImagenes,
                categoria,
                estado,
                search,
                page: Number(page),
                totalPages,
                mensaje: null, // Sin mensaje si hay subastas
              });
            });
          } else {
            res.render("catalogo", {
              usuario: req.session.usuario,
              subastas: subastasConImagenes,
              categoria,
              estado,
              search,
              page: Number(page),
              totalPages,
              mensaje: null, // Sin mensaje si hay subastas
            });
          }
        });
      });
    }
  });
});


// Función para buscar sugerencias de marcas
function buscarSugerencia(busqueda, conexion, callback) {
  const query = "SELECT DISTINCT marca FROM subastas"; // Consulta para obtener marcas únicas

  conexion.query(query, (error, resultados) => {
    if (error) {
      console.error("Error al obtener marcas:", error);
      return callback(null); // Retorna null en caso de error
    }

    // Extraer las marcas de los resultados
    const marcasConocidas = resultados.map(row => row.marca);

    // Filtrar marcas que comienzan con la búsqueda
    const sugerencias = marcasConocidas.filter(marca => marca.toLowerCase().startsWith(busqueda.toLowerCase()));

    if (sugerencias.length > 0) {
      return callback(`¿Quiso decir "${sugerencias[0]}"?`); // Devuelve la primera sugerencia
    }

    return callback("No hay sugerencias disponibles.");
  });
}




// Subastas
router.get('/subasta/:id', (req, res) => {
  const subastaId = req.params.id;
  const usuarioId = req.session.usuario ? req.session.usuario.id : null; // ID del usuario si está autenticado

  const querySubasta = `
    SELECT s.*, 
      DATE_FORMAT(s.fecha_subasta, '%W %d') AS fecha_formateada, 
      DATE_FORMAT(s.hora_subasta, '%h:%i %p') AS hora_formateada, 
      CONCAT(s.fecha_subasta, ' ', s.hora_subasta) AS fecha_hora_subasta,
      IFNULL(l.like_count, 0) AS like_count
    FROM subastas s
    LEFT JOIN (
      SELECT subasta_id, COUNT(*) AS like_count
      FROM likes
      GROUP BY subasta_id
    ) l ON s.id = l.subasta_id
    WHERE s.id = ?`;

  const queryImagenes = 'SELECT imagen FROM imagenes_propiedad WHERE id_subasta = ?';
  const queryAnexos = 'SELECT id, anexo FROM anexos_propiedad WHERE id_subasta = ?';

  // Consulta para registrar la visita
  const queryRegistrarVisita = 'INSERT INTO visitas_subasta (subasta_id, usuario_id) VALUES (?, ?)';

  // Consulta para contar visitas
  const queryContarVisitas = 'SELECT COUNT(*) AS total_visitas FROM visitas_subasta WHERE subasta_id = ?';

  // Formato de número
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Traducción de días
  function translateDay(day) {
    const days = {
      'Sunday': 'Domingo',
      'Monday': 'Lunes',
      'Tuesday': 'Martes',
      'Wednesday': 'Miércoles',
      'Thursday': 'Jueves',
      'Friday': 'Viernes',
      'Saturday': 'Sábado'
    };
    return days[day] || day;
  }

  const now = momenT().tz("America/Lima"); // Ajusta a la zona horaria de Perú
  // Nueva variable para la fecha actual
  const fechaActual = now.format('YYYY-MM-DD HH:mm:ss'); // Formato de fecha que necesites

  // Registrar la visita
  conection.query(queryRegistrarVisita, [subastaId, usuarioId], (error) => {
    if (error) {
      console.error("Error al registrar la visita", error);
    }

    // Obtener los datos de la subasta
    conection.query(querySubasta, [subastaId], (error, resultadoSubasta) => {
      if (error) {
        console.error("Error al obtener datos de subasta", error);
        return res.status(500).send("Error al obtener datos de subasta");
      }

      if (resultadoSubasta.length === 0) {
        return res.status(404).send("Subasta no encontrada");
      }

      const subasta = resultadoSubasta[0];
      const fechaHoraSubasta = momenT(subasta.fecha_hora_subasta).tz("America/Lima");

      // Lógica para verificar el estado de la subasta
      const duracionSubasta = 5; // duración en minutos
      const fechaHoraFinSubasta = fechaHoraSubasta.clone().add(duracionSubasta, 'minutes');
      const estaEnCurso = now.isBetween(fechaHoraSubasta, fechaHoraFinSubasta, null, '[]');
      const estaTerminada = now.isAfter(fechaHoraFinSubasta); // Nueva variable que indica si ha terminado

      // Logs para verificar las fechas y el estado de la subasta
      console.log("Fecha y hora de la subasta:", fechaHoraSubasta.format());
      console.log("Fecha y hora de fin de subasta:", fechaHoraFinSubasta.format());
      console.log("Fecha y hora actual en producción:", now.format());
      console.log("¿Subasta en curso?:", estaEnCurso);
      console.log("¿Subasta terminada?:", estaTerminada);

      // Calcular la oferta actual
      const precioBase = parseInt(subasta.precio_base);
      const ofertaActual = formatNumber(precioBase + 100);

      const fechaFormateada = subasta.fecha_formateada;
      const [day, dayNumber] = fechaFormateada.split(' ');
      const fechaFormateadaEsp = `${translateDay(day)} ${dayNumber}`;

      // Obtener imágenes de la subasta
      conection.query(queryImagenes, [subastaId], (error, resultadoImagenes) => {
        if (error) {
          console.error("Error al obtener imágenes de subasta", error);
          return res.status(500).send("Error al obtener imágenes de subasta");
        }

        // Obtener anexos de la subasta
        conection.query(queryAnexos, [subastaId], (error, resultadoAnexos) => {
          if (error) {
            console.error("Error al obtener anexos de subasta", error);
            return res.status(500).send("Error al obtener anexos de subasta");
          }

          // Contar cuántas personas han visto la subasta
          conection.query(queryContarVisitas, [subastaId], (error, resultadoVisitas) => {
            if (error) {
              console.error("Error al contar visitas de la subasta", error);
              return res.status(500).send("Error al contar visitas de la subasta");
            }

            const totalVisitas = resultadoVisitas[0].total_visitas;

            // Renderizar la vista con los datos de la subasta y el contador de visitas
            res.render("subasta", {
              usuario: req.session.usuario,
              subasta,
              imagenes: resultadoImagenes.map(img => img.imagen.toString('base64')),
              anexos: resultadoAnexos.map(anexo => ({ id: anexo.id, url: anexo.anexo })),
              estaEnCurso, // Indica si la subasta está en curso
              estaTerminada, // Nueva variable que indica si la subasta ha terminado
              fechaFormateadaEsp, // Fecha traducida a español
              formatNumber, // Función para formatear números
              totalVisitas, // Total de visitas
              ofertaActual, // Nueva variable que contiene el precio base + 100
              fechaHoraSubasta: fechaHoraSubasta.format(), // Pasar la fecha y hora de la subasta
              fechaHoraFinSubasta: fechaHoraFinSubasta.format(), // Pasar la fecha y hora de fin de la subasta
              fechaActual
            });
          });
        });
      });
    });
  });
});


// Ruta para descargar un anexo
router.get('/descargar-anexo/:id', isAuthenticated, (req, res) => {
  const anexoId = req.params.id;

  // Consulta para recuperar el anexo
  const query = 'SELECT anexo FROM anexos_propiedad WHERE id = ?';
  conection.query(query, [anexoId], (err, results) => {
    if (err) {
      console.error('Error al obtener el anexo:', err);
      return res.status(500).send('Error al obtener el anexo');
    }

    if (results.length > 0) {
      const { anexo } = results[0];

      if (anexo) {
        // Usa res.download para descargar el archivo
        const filePath = path.join(__dirname, 'public', anexo); // Asegúrate de ajustar el path según tu estructura
        res.download(filePath, (err) => {
          if (err) {
            console.error('Error al descargar el anexo:', err);
            res.status(500).send('Error al descargar el anexo');
          }
        });
      } else {
        res.status(404).send('Anexo no encontrado');
      }
    } else {
      res.status(404).send('Anexo no encontrado');
    }
  });
});


// Ruta para actualizar oportunidades cuando el cliente gana una subasta
/* router.post('/ganarSubasta/:idSubasta', (req, res) => {
  const usuarioId = req.session.usuario.id; // Obtener el ID del usuario desde la sesión
  const subastaId = req.params.idSubasta;

  // Primero, marca la subasta como ganada en la base de datos
  conection.query(
    'UPDATE subastas SET estado = "ganada", id_ganador = ? WHERE id = ?',
    [usuarioId, subastaId],
    (error, results) => {
      if (error) {
        console.error('Error al marcar la subasta como ganada:', error);
        return res.status(500).json({ success: false, message: 'Error al marcar la subasta como ganada' });
      }

      // Luego, resta una oportunidad al usuario que ganó
      conection.query(
        'UPDATE usuarios SET oportunidades = oportunidades - 1 WHERE id = ? AND oportunidades > 0',
        [usuarioId],
        (error, results) => {
          if (error) {
            console.error('Error al actualizar oportunidades:', error);
            return res.status(500).json({ success: false, message: 'Error al actualizar oportunidades' });
          }

          if (results.affectedRows > 0) {
            res.json({ success: true, message: 'Subasta ganada y oportunidad restada' });
          } else {
            res.json({ success: false, message: 'No se pudo actualizar las oportunidades' });
          }
        }
      );
    }
  );
}); */


// Ruta para obtener oportunidades
router.get('/oportunidades/:id', (req, res) => {
  const usuarioId = req.params.id;

  // Consulta para obtener el número de oportunidades
  conection.query(
    'SELECT oportunidades FROM usuarios WHERE id = ?',
    [usuarioId],
    (error, results) => {
      if (error) {
        console.error('Error al obtener oportunidades:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener oportunidades' });
      }

      if (results.length > 0) {
        res.json({ success: true, oportunidades: results[0].oportunidades });
      } else {
        res.json({ success: false, message: 'Usuario no encontrado' });
      }
    }
  );
});

//
// Like
router.post("/like", (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ success: false, message: "Usuario no autenticado", redirect: "/login" });
  }

  const { subasta_id } = req.body;
  const usuario_id = req.session.usuario.id;

  conection.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener la conexión:", err);
      return res.status(500).json({ success: false });
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error al iniciar la transacción:", err);
        connection.release();
        return res.status(500).json({ success: false });
      }

      // Verificar si el usuario ya ha dado like a la subasta
      const checkLikeQuery = "SELECT * FROM likes WHERE user_id = ? AND subasta_id = ?";
      connection.query(checkLikeQuery, [usuario_id, subasta_id], (error, results) => {
        if (error) {
          return connection.rollback(() => {
            console.error("Error al verificar el like:", error);
            connection.release();
            return res.status(500).json({ success: false });
          });
        }

        if (results.length > 0) {
          // El usuario ya ha dado like, eliminar el like y decrementar el like_count
          const deleteLikeQuery = "DELETE FROM likes WHERE user_id = ? AND subasta_id = ?";
          connection.query(deleteLikeQuery, [usuario_id, subasta_id], (error) => {
            if (error) {
              return connection.rollback(() => {
                console.error("Error al eliminar el like:", error);
                connection.release();
                return res.status(500).json({ success: false });
              });
            }

            const decrementLikeCountQuery = "UPDATE subastas SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?";
            connection.query(decrementLikeCountQuery, [subasta_id], (error) => {
              if (error) {
                return connection.rollback(() => {
                  console.error("Error al decrementar el like_count:", error);
                  connection.release();
                  return res.status(500).json({ success: false });
                });
              }

              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    console.error("Error al hacer commit:", err);
                    connection.release();
                    return res.status(500).json({ success: false });
                  });
                }
                connection.release(); // Libera la conexión de vuelta al pool
                res.json({ success: true });
              });
            });
          });
        } else {
          // El usuario no ha dado like, agregar el like y incrementar el like_count
          const addLikeQuery = "INSERT INTO likes (user_id, subasta_id) VALUES (?, ?)";
          connection.query(addLikeQuery, [usuario_id, subasta_id], (error) => {
            if (error) {
              return connection.rollback(() => {
                console.error("Error al agregar el like:", error);
                connection.release();
                return res.status(500).json({ success: false });
              });
            }

            const incrementLikeCountQuery = "UPDATE subastas SET like_count = like_count + 1 WHERE id = ?";
            connection.query(incrementLikeCountQuery, [subasta_id], (error) => {
              if (error) {
                return connection.rollback(() => {
                  console.error("Error al incrementar el like_count:", error);
                  connection.release();
                  return res.status(500).json({ success: false });
                });
              }

              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    console.error("Error al hacer commit:", err);
                    connection.release();
                    return res.status(500).json({ success: false });
                  });
                }
                connection.release(); // Libera la conexión de vuelta al pool
                res.json({ success: true });
              });
            });
          });
        }
      });
    });
  });
});


//Info page vender
router.get('/info-vender', (req, res) => {
  res.render("vender", {
    usuario: req.session.usuario
  })
});

//Info page comprar
router.get('/info-comprar', (req, res) => {
  res.render('comprar', {
    usuario: req.session.usuario
  })
});

//politica de cookies
router.get('/politicasDEcookies', (req, res) => {
  res.render('politica_cookies', {
    usuario: req.session.usuario
  })
});

//terminos y condiciones
router.get('/politicasDEprivacidad', (req, res) => {
  res.render('politicas_privacidad', {
    usuario: req.session.usuario
  })
});

//condicionesYterminos
router.get('/condicionesYterminos', (req, res) => {
  res.render('terminos_condiciones', {
    usuario: req.session.usuario
  })
});


//chat prueva subasta
router.get('/chat', (req, res) => {
  res.render('chat');
});


//Buscador por categorias
/* router.post('/buscador', (req, res) => {
  const { search } = req.body; // Capturamos lo que el usuario busca

  // La consulta SQL para buscar por marca, modelo o precio
  const sql = `
      SELECT * FROM subastas 
      WHERE (marca LIKE ? OR modelo LIKE ? OR precio_base <= ?)
  `;

  const searchTerm = `%${search}%`; // Para que busque coincidencias parciales
  const maxPrice = parseFloat(search) || Number.MAX_SAFE_INTEGER; // Si el usuario introduce un número, lo tomamos como precio

  conection.query(sql, [searchTerm, searchTerm, maxPrice], (err, results) => {
    if (err) {
      return res.status(500).send('Error en la consulta');
    }

    // Enviar los resultados al frontend
    res.render('catalogo', {
      usuario: req.session.usuario,
      subastas: results
    });
  });
}); */



router.get('/editar_user/:id', (req, res) => {
  const userId = req.params.id;

  const query = 'SELECT * FROM usuarios WHERE id = ?';
  conection.query(query, [userId], (error, result) => {
    if (error) {
      console.error("Error al obtener el usuario para editar: ", error);
      return res.status(500).send("Error el usuario para editar");
    }

    if (result.length === 0) {
      return res.status(404).send("Usuario no encontrado");
    }

    const usuario = result[0];
    res.render('editar_user', { usuario: req.session.usuario});
  });
})

router.post('/editar_user/:id', (req, res) => {
  const userId = req.params.id;
  const { email, confirmacion_email, celular, usuario } = req.body;

  const query = 'UPDATE usuarios SET email = ?, confirmacion_email = ?, celular = ?, usuario = ? WHERE id = ?';
  conection.query(query, [email, confirmacion_email, celular, usuario, userId], (error, results) => {
    if (error) {
      console.error('Error al actualizar los datos:', error);
      return res.status(500).json({ success: false, message: 'Error en la base de datos.' });
    }

    // Aquí puedes buscar los datos del usuario actualizado para pasarlos a la vista
    const userQuery = 'SELECT * FROM usuarios WHERE id = ?';
    conection.query(userQuery, [userId], (err, userResults) => {
      if (err) {
        console.error('Error al obtener los datos del usuario:', err);
        return res.status(500).json({ success: false, message: 'Error en la base de datos.' });
      }

      const usuario = userResults[0]; // Suponiendo que solo hay un usuario con ese ID
      res.redirect('/login');
    });
  });
});
//ingreso al correo
router.get('/confirmar/datos',(req, res)=>{
  res.render('Verificar_por_DNI')
})

//verificamos correo
router.post('/verificar/email', (req, res) => {
  const { email } = req.body;
  const sql = "SELECT email FROM usuarios WHERE email = ?";
  conection.query(sql, [email], (err, result) => {
    if (err) {
      console.error("Error al realizar la consulta: ", err);
      return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
    if (result.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });
});

router.post('/actualizar/contraseña', (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  // Lógica para actualizar la contraseña aquí...
  // Asegúrate de verificar que newPassword y confirmPassword coincidan y actualiza la base de datos
});



module.exports = router;