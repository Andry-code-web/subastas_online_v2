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
  const usuario = req.session.usuario;

  const querySubastas = `
    SELECT s.*, 
           (SELECT imagen 
            FROM subastaonline.imagenes_propiedad ip 
            WHERE s.id = ip.id_subasta 
            LIMIT 1) AS imagen_blob
    FROM subastaonline.subastas s
`;

  const queryComentario = "SELECT * FROM subastaonline.comentarios";

  Promise.all([
    new Promise((resolve, reject) => {
      conexion.query(querySubastas, (error, resultadoSubasta) => {
        if (error) {
          console.error("Error al obtener las subastas: ", error);
          reject(error);
        } else {
          resolve(resultadoSubasta);
        }
      });
    }),
    new Promise((resolve, reject) => {
      conexion.query(queryComentario, (error, resultadoComentario) => {
        if (error) {
          console.error("Error al obtener los comentarios", error);
          reject(error);
        } else {
          resolve(resultadoComentario);
        }
      });
    }),
  ])
    .then(([subastas, comentarios]) => {
      res.render("home", {
        usuario,
        subastas,
        comentarios,
      });
    })
    .catch((error) => {
      console.error(
        "Error al obtener los datos para la vista principal: ",
        error
      );
      res.status(500).send("Error al obtener datos para la vista principal");
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

router.post("/login", (req, res) => {
  const consulta = "SELECT id, nombre, contraseña FROM usuarios;";
  const { usuario, contra } = req.body;

  console.log(usuario, contra);

  conexion.query(consulta, function (err, result, fields) {
    if (err) {
      console.error("Error al realizar la consulta: ", err);
      res.status(500).json({ message: "Error interno del servidor" });
      return;
    }

    // Comprobar si se encontró un usuario con la contraseña correcta
    const usuarioEncontrado = result.find(
      (user) => user.nombre === usuario && user.contraseña === contra
    );
    if (usuarioEncontrado) {
      // Guardar información del usuario en la sesión
      req.session.usuario = {
        id: usuarioEncontrado.id,
        nombre: usuarioEncontrado.nombre,
      };
      res.json({ success: true, redirect: "/" });
    } else {
      console.log("Usuario o contraseña incorrectos");
      res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }
  });
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
          terminos_y_condiciones: datos.terminos_y_condiciones ? 1 : 0
      };

      const sql = `
          INSERT INTO subastaonline.usuarios (
              tipo_persona, email, confirmacion_email, celular, telefono,
              nombre_apellidos, dni_ce, fecha_nacimiento, sexo, estado_civil,
              ruc, nombre_comercial, actividad_comercial,
              departamento, provincia, distrito, direccion, numero, complemento,
              usuario, contraseña, terminos_y_condiciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          res.redirect('/success');
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
          terminos_y_condiciones: datos.terminos_y_condiciones ? 1 : 0
      };

      const sql = `
          INSERT INTO subastaonline.usuarios (
              tipo_persona, email, confirmacion_email, celular, telefono,
              nombre_apellidos, dni_ce, fecha_nacimiento, sexo, estado_civil,
              ruc, nombre_comercial, actividad_comercial,
              departamento, provincia, distrito, direccion, numero, complemento,
              usuario, contraseña, terminos_y_condiciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          res.redirect('/success');
      });
  } else {
      res.status(400).send('Tipo de persona no válido');
  }
});




// Catalogo
router.get("/catalogo", (req, res) => {
  const { categoria } = req.query;
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

      res.render("catalogo", { 
        usuario: req.session.usuario,
        subastas: subastasConImagenes,
        categoria // Pasar la categoría seleccionada a la plantilla
      });
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

      const subasta = {
        ...resultadoSubasta[0],
        imagenes: resultadoImagenes.map(img => img.imagen.toString('base64'))
      };

      res.render("subasta", {
        subasta,
        usuario: req.session.usuario,
        formatNumber
      });
    });
  });
});


module.exports = router;