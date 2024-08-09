const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();
const conexion = require("../database/db"); // Asegúrate de que el nombre del archivo y la ruta sean correctos

router.use(bodyParser.urlencoded({ extended: true }));

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.usuario) {
    return next();
  } else {
    res.redirect('/login');
  }
};

router.get("/", (req, res) => {
  let querySubastas = `
    SELECT s.*, IFNULL(l.like_count, 0) AS like_count
    FROM subastaonline.subastas s
    LEFT JOIN (
      SELECT subasta_id, COUNT(*) AS like_count
      FROM subastaonline.likes
      GROUP BY subasta_id
    ) l ON s.id = l.subasta_id
    ORDER BY like_count DESC, s.id ASC
    LIMIT 5
  `;

  const queryImagenes = "SELECT id_subasta, imagen FROM subastaonline.imagenes_propiedad";
  const queryComentarios = "SELECT * FROM subastaonline.comentarios ORDER BY id DESC";

  conexion.query(querySubastas, (error, subastas) => {
    if (error) {
      console.error("Error al obtener datos de subasta", error);
      return res.status(500).send("Error al obtener datos de subasta");
    }

    conexion.query(queryImagenes, (error, imagenes) => {
      if (error) {
        console.error("Error al obtener imágenes de subasta", error);
        return res.status(500).send("Error al obtener imágenes de subasta");
      }

      conexion.query(queryComentarios, (error, comentarios) => {
        if (error) {
          console.error("Error al obtener comentarios de subasta", error);
          return res.status(500).send("Error al obtener comentarios de subasta");
        }

        // Combinamos las imágenes con las subastas
        const subastasConImagenes = subastas.map((subasta) => {
          const imagenesSubasta = imagenes.filter(
            (imagen) => imagen.id_subasta === subasta.id
          );
          return {
            ...subasta,
            imagenes: imagenesSubasta.map((img) => img.imagen.toString("base64")),
          };
        });

        res.render("home", { 
          usuario: req.session.usuario,
          subastas: subastasConImagenes,
          comentarios: comentarios
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
    "INSERT INTO subastaonline.comentarios (nombre, comentario, rating) VALUES (?, ?, ?)";
  const values = [nombre, texto, rating];

  conexion.query(query, values, (error, results) => {
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
  const consulta = "SELECT id, usuario, contraseña FROM usuarios;";
  const { usuario, contra } = req.body;

  console.log(usuario, contra);

  conexion.query(consulta, function (err, result, fields) {
    if (err) {
      console.error("Error al realizar la consulta: ", err);
      res.status(500).json({ message: "Error interno del servidor" });
      return;
    }

    const usuarioEncontrado = result.find(
      (user) => user.usuario === usuario && user.contraseña === contra
    );
    if (usuarioEncontrado) {
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

      console.log(typeof(valores.terminos_y_condiciones));

      const sql = `
          INSERT INTO subastaonline.usuarios (
              tipo_persona, email, confirmacion_email, celular, telefono,
              nombre_apellidos, dni_ce, fecha_nacimiento, sexo, estado_civil,
              ruc, nombre_comercial, actividad_comercial,
              departamento, provincia, distrito, direccion, numero, complemento,
              usuario, contraseña, terminos_y_condiciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      conexion.query(sql, [
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

      const sql = `
          INSERT INTO subastaonline.usuarios (
              tipo_persona, email, confirmacion_email, celular, telefono,
              nombre_apellidos, dni_ce, fecha_nacimiento, sexo, estado_civil,
              ruc, nombre_comercial, actividad_comercial,
              departamento, provincia, distrito, direccion, numero, complemento,
              usuario, contraseña, terminos_y_condiciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      conexion.query(sql, [
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
  } else {
      res.status(400).send('Tipo de persona no válido');
  }
});

// Catalogo
router.get("/catalogo", (req, res) => {
  const { categoria } = req.query;
  const usuario_id = req.session.usuario ? req.session.usuario.id : null;

  let querySubastas = "SELECT * FROM subastaonline.subastas";
  const queryParams = [];

  if (categoria) {
    querySubastas += " WHERE categoria = ?";
    queryParams.push(categoria);
  }
  querySubastas += " ORDER BY id ASC";

  const queryImagenes = "SELECT id_subasta, imagen FROM subastaonline.imagenes_propiedad";

  conexion.query(querySubastas, queryParams, (error, subastas) => {
    if (error) {
      console.error("Error al obtener datos de subasta", error);
      return res.status(500).send("Error al obtener datos de subasta");
    }

    conexion.query(queryImagenes, (error, imagenes) => {
      if (error) {
        console.error("Error al obtener imágenes de subasta", error);
        return res.status(500).send("Error al obtener imágenes de subasta");
      }

      const subastasConImagenes = subastas.map((subasta) => {
        const imagenesSubasta = imagenes.filter(
          (imagen) => imagen.id_subasta === subasta.id
        );
        return {
          ...subasta,
          imagenes: imagenesSubasta.map((img) => img.imagen.toString("base64")),
        };
      });

      if (usuario_id) {
        // Consulta adicional para verificar los likes del usuario
        const queryLikes = "SELECT subasta_id FROM subastaonline.likes WHERE user_id = ?";
        conexion.query(queryLikes, [usuario_id], (error, likes) => {
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
            categoria
          });
        });
      } else {
        res.render("catalogo", { 
          usuario: req.session.usuario,
          subastas: subastasConImagenes,
          categoria
        });
      }
    });
  });
});

// Subastas
router.get("/subasta/:id", isAuthenticated, (req, res) => {
  const subastaId = req.params.id;

  const querySubasta = `
    SELECT *, DATE_FORMAT(fecha_subasta, '%d/%m/%Y') AS fecha_formateada 
    FROM subastaonline.subastas 
    WHERE id = ?`;
  const queryImagenes = 'SELECT imagen FROM subastaonline.imagenes_propiedad WHERE id_subasta = ?';
  const queryAnexos = 'SELECT id FROM subastaonline.anexos_propiedad WHERE id_subasta = ?'; // Elimina nombre_anexo

  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  conexion.query(querySubasta, [subastaId], (error, resultadoSubasta) => {
    if (error) {
      console.error("Error al obtener datos de subasta", error);
      return res.status(500).send("Error al obtener datos de subasta");
    }

    if (resultadoSubasta.length === 0) {
      return res.status(404).send("Subasta no encontrada");
    }

    conexion.query(queryImagenes, [subastaId], (error, resultadoImagenes) => {
      if (error) {
        console.error("Error al obtener imágenes de subasta", error);
        return res.status(500).send("Error al obtener imágenes de subasta");
      }

      conexion.query(queryAnexos, [subastaId], (error, resultadoAnexos) => {
        if (error) {
          console.error("Error al obtener anexos de subasta", error);
          return res.status(500).send("Error al obtener anexos de subasta");
        }

        const subasta = {
          ...resultadoSubasta[0],
          imagenes: resultadoImagenes.map(img => img.imagen.toString('base64')),
          anexos: resultadoAnexos // Incluimos los anexos en los datos de la subasta
        };

        res.render("subasta", {
          subasta,
          usuario: req.session.usuario,
          formatNumber
        });
      });
    });
  });
});


//descargar el anexo
router.get('/descargar-anexo/:id', (req, res) => {
  const anexoId = req.params.id;

  const query = 'SELECT anexo FROM subastaonline.anexos_propiedad WHERE id = ?';
  conexion.query(query, [anexoId], (err, results) => {
    if (err) {
      console.error('Error al obtener el anexo:', err);
      return res.status(500).send('Error al obtener el anexo');
    }

    if (results.length > 0) {
      const { anexo } = results[0];

      // Enviar el archivo para descarga con un nombre predeterminado
      res.setHeader('Content-Disposition', 'attachment; filename=archivo.pdf');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(anexo);
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
  conexion.query(
    'UPDATE subastas SET estado = "ganada", id_ganador = ? WHERE id = ?',
    [usuarioId, subastaId],
    (error, results) => {
      if (error) {
        console.error('Error al marcar la subasta como ganada:', error);
        return res.status(500).json({ success: false, message: 'Error al marcar la subasta como ganada' });
      }

      // Luego, resta una oportunidad al usuario que ganó
      conexion.query(
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
  conexion.query(
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



// Like
router.post("/like", (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ success: false, message: "Usuario no autenticado", redirect: "/login" });
  }

  const { subasta_id } = req.body;
  const usuario_id = req.session.usuario.id;

  conexion.beginTransaction((err) => {
    if (err) {
      console.error("Error al iniciar la transacción:", err);
      return res.status(500).json({ success: false });
    }

    // Verificar si el usuario ya ha dado like a la subasta
    const checkLikeQuery = "SELECT * FROM subastaonline.likes WHERE user_id = ? AND subasta_id = ?";
    conexion.query(checkLikeQuery, [usuario_id, subasta_id], (error, results) => {
      if (error) {
        return conexion.rollback(() => {
          console.error("Error al verificar el like:", error);
          return res.status(500).json({ success: false });
        });
      }

      if (results.length > 0) {
        // El usuario ya ha dado like, eliminar el like y decrementar el like_count
        const deleteLikeQuery = "DELETE FROM subastaonline.likes WHERE user_id = ? AND subasta_id = ?";
        conexion.query(deleteLikeQuery, [usuario_id, subasta_id], (error) => {
          if (error) {
            return conexion.rollback(() => {
              console.error("Error al eliminar el like:", error);
              return res.status(500).json({ success: false });
            });
          }

          const decrementLikeCountQuery = "UPDATE subastaonline.subastas SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?";
          conexion.query(decrementLikeCountQuery, [subasta_id], (error) => {
            if (error) {
              return conexion.rollback(() => {
                console.error("Error al decrementar el like_count:", error);
                return res.status(500).json({ success: false });
              });
            }

            conexion.commit((err) => {
              if (err) {
                return conexion.rollback(() => {
                  console.error("Error al hacer commit:", err);
                  return res.status(500).json({ success: false });
                });
              }
              res.json({ success: true });
            });
          });
        });
      } else {
        // El usuario no ha dado like, agregar el like y incrementar el like_count
        const addLikeQuery = "INSERT INTO subastaonline.likes (user_id, subasta_id) VALUES (?, ?)";
        conexion.query(addLikeQuery, [usuario_id, subasta_id], (error) => {
          if (error) {
            return conexion.rollback(() => {
              console.error("Error al agregar el like:", error);
              return res.status(500).json({ success: false });
            });
          }

          const incrementLikeCountQuery = "UPDATE subastaonline.subastas SET like_count = like_count + 1 WHERE id = ?";
          conexion.query(incrementLikeCountQuery, [subasta_id], (error) => {
            if (error) {
              return conexion.rollback(() => {
                console.error("Error al incrementar el like_count:", error);
                return res.status(500).json({ success: false });
              });
            }

            conexion.commit((err) => {
              if (err) {
                return conexion.rollback(() => {
                  console.error("Error al hacer commit:", err);
                  return res.status(500).json({ success: false });
                });
              }
              res.json({ success: true });
            });
          });
        });
      }
    });
  });
});



module.exports = router;