const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();
const conexion = require("../database/db"); // Asegúrate de que el nombre del archivo y la ruta sean correctos

router.use(bodyParser.urlencoded({ extended: true }));

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.usuario) {
    return next();
  } else {
    res.redirect('/user/login');
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
    res.redirect("/user/");
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
      res.json({ success: true, redirect: "/user/" });
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
      res.redirect("/user/");
    }
  });
});

/* REGISTRO GET POST */
router.get("/registro", (req, res) => {
  res.render("registro");
});

router.post("/registro", (req, res) => {
  const consulta =
    "INSERT INTO subastaonline.usuarios (nombre, apellidos, dni, celular, correo_electronico, contraseña, boleta, factura, numero_factura, terminos_y_condiciones, uso_datos_personales) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";

  let {
    nombre,
    apellidos,
    dni,
    celular,
    correo_electronico,
    contraseña,
    boleta,
    factura,
    numero_factura,
    terminos_y_condiciones,
    uso_datos_personales,
  } = req.body;

  // Eliminar espacios en blanco alrededor de cada campo
  nombre = nombre.trim();
  apellidos = apellidos.trim();
  dni = dni.trim();
  celular = celular.trim();
  correo_electronico = correo_electronico.trim();
  contraseña = contraseña.trim();
  numero_factura = numero_factura ? numero_factura.trim() : null;

  // Convertir valores de boleta y factura a 0 o 1
  boleta = boleta ? 1 : 0;
  factura = factura ? 1 : 0;

  // Convertir valores de terminos_y_condiciones y uso_datos_personales a 0 o 1
  terminos_y_condiciones = terminos_y_condiciones ? 1 : 0;
  uso_datos_personales = uso_datos_personales ? 1 : 0;

  const valores = [
    nombre,
    apellidos,
    dni,
    celular,
    correo_electronico,
    contraseña,
    boleta,
    factura,
    numero_factura,
    terminos_y_condiciones,
    uso_datos_personales,
  ];

  conexion.query(consulta, valores, function (err, result, fields) {
    if (err) {
      console.error("Error al realizar la inserción: ", err);
      res.status(500).send("Error interno del servidor");
      return;
    }

    console.log("Registro insertado correctamente:", result);
    res.render("login");
  });
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