const express = require("express");
const bcrypt = require("bcrypt");
/* const crypto = require('crypto'); */
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const connection = require("../database/db");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });


/* ADMIN GENERAL */
router.get("/loginAdminG", (req, res) => {
  res.render("login_adminG");
});

router.post("/loginAdminG", (req, res) => {
  const { correo, contraseña } = req.body;

  const query = "SELECT * FROM adminGeneral WHERE correo_electronico = ?";
  connection.query(query, [correo], (error, results) => {
    if (error) {
      console.error("Error al buscar el administrador general:", error);
      return res.status(500).send("Error al iniciar sesión");
    }

    if (results.length === 0) {
      return res.status(401).send("Correo electrónico no registrado");
    }

    const adminGeneral = results[0];

    if (contraseña.trim() !== adminGeneral.contraseña.trim()) {
      return res.status(401).send("Contraseña incorrecta");
    }

    req.session.adminGeneralId = adminGeneral.id;
    req.session.adminGeneralNombreUsuario = adminGeneral.nombre_usuario;

    // Redirige al usuario después de que la sesión se haya actualizado
    req.session.save((err) => {
      if (err) {
        console.error("Error al guardar la sesión:", err);
        return res.status(500).send("Error al iniciar sesión");
      }
      res.redirect("/admin/adminG");
    });
  });
});

router.get("/logout", function (req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.log("Error al cerrar sesion ", err);
    }
    res.redirect("/admin/loginAdminG");
  });
});

router.get("/adminG", (req, res) => {
  // Middleware para asegurarse de que la sesión se haya actualizado
  if (!req.session.adminGeneralNombreUsuario) {
    return res.redirect("/admin/loginAdminG");
  }

  const nombreUsuario = req.session.adminGeneralNombreUsuario;

  const queryUsuarios = 'SELECT * FROM subastaonline.usuarios';
  const queryAdminVendedores = 'SELECT * FROM subastaonline.adminvendedor';
  const querySubastas = 'SELECT * FROM subastaonline.subastas';

  Promise.all([
    new Promise((resolve, reject) => {
      connection.query(queryUsuarios, (error, resultadosUsuarios) => {
        if (error) {
          console.error("Error al obtener los usuarios: ", error);
          reject(error);
        } else {
          resolve(resultadosUsuarios);
        }
      });
    }),
    new Promise((resolve, reject) => {
      connection.query(queryAdminVendedores, (error, resultadosAdminVendedores) => {
        if (error) {
          console.error("Error al obtener los admin vendedores: ", error);
          reject(error);
        } else {
          // Añadir estado "activo" basado en la sesión
          const adminVendedoresConEstado = resultadosAdminVendedores.map(adminVendedor => {
            return {
              ...adminVendedor,
              activo: adminVendedor.id === req.session.adminVendedorId && req.session.adminVendedorActivo
            };
          });
          resolve(adminVendedoresConEstado);
        }
      });
    }),
    new Promise((resolve, reject) =>{
      connection.query(querySubastas, (error, resultadoSubastas) => {
        if (error) {
          console.error("Error al obtener los datos de subasta", error);
          reject(error);
        } else {
          resolve(resultadoSubastas);
        }
      });
    })
  ])
  .then(([usuarios, adminVendedores, subastas]) => {
    const numUsuarios = usuarios.length;
    const numAdminVendedores = adminVendedores.length;
    const numSubastas = subastas.length;

    res.render("adminGeneral", {
      nombreUsuario,
      usuarios,
      numUsuarios,
      adminVendedores,
      numAdminVendedores,
      subastas,
      numSubastas
    });
  })
  .catch((error) => {
    console.error("Error al obtener datos para la vista adminGeneral: ", error);
    res.status(500).send("Error al obtener datos para la vista adminGeneral");
  });
});

// Método POST para crear un nuevo admin vendedor
router.post("/crear-admin-vendedor", async (req, res) => {
  const { nombre_usuario, contraseña } = req.body;
  const id_admin_general = req.session.adminGeneralId;

  if (!id_admin_general) {
    return res.status(401).send("Debe iniciar sesión como administrador general para crear un administrador vendedor.");
  }

  try {
    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    const query = "INSERT INTO adminvendedor (id_admin_general, nombre_usuario, contraseña) VALUES (?, ?, ?)";

    connection.query(query, [id_admin_general, nombre_usuario, hashedPassword], (error, results) => {
      if (error) {
        console.error("Error al crear el admin vendedor:", error);
        return res.status(500).send("Error al crear el admin vendedor");
      }
      res.redirect("/admin/loginAdminV");
    });
  } catch (error) {
    console.error("Error al encriptar la contraseña:", error);
    res.status(500).send("Error al crear el admin vendedor");
  }
});

//EDITAR EL USUARIO
router.get('/editarUsuario/:id', (req, res) =>{
  const userId = req.params.id;

  const query = 'SELECT * FROM subastaonline.usuarios WHERE id = ?';
  connection.query(query, [userId], (error, result) => {
    if (error) {
      console.error("Error al obtener el usuario para editar: ", error);
      return res.status(500).send("Error el usuario para editar");
    }

    if (result.length === 0) {
      return res.status(404).send("Usuario no encontrado");
    }

    const usuario = result[0];
    res.render('editarUsuario', { usuario });
  });
});
//prosesar la actualizacion de usuario
router.post('/editarUsuario/:id', (req, res) => {
  const userId = req.params.id;
  const { nombre, apellidos, dni, correo_electronico } = req.body;

  const query = 'UPDATE usuarios SET nombre = ?, apellidos = ?, dni = ?, correo_electronico = ? WHERE id = ?';
  connection.query(query, [nombre, apellidos, dni, correo_electronico, userId], (error, result) => {
    if (error) {
      console.error('Error al actualizar el usuario', error);
      return res.status(500).send('Error al actualizar el usuario');
    }
    res.redirect('/admin/adminG');
  })
});

// Ruta para eliminar usuario
router.delete('/eliminarUsuario/:id', (req, res) => {
  const userId = req.params.id;

  // Lógica para eliminar usuario en la base de datos
  const query = 'DELETE FROM usuarios WHERE id = ?';
  connection.query(query, [userId], (error, result) => {
      if (error) {
          console.error('Error al eliminar el usuario', error);
          return res.status(500).send('Error al eliminar el usuario');
      }
      res.sendStatus(200); // Enviar una respuesta de éxito
  });
});


/* ADMIN VENDEDOR */
// Middleware para verificar si el admin vendedor ha iniciado sesión
function isAuthenticatedAdminV(req, res, next) {
  if (req.session.adminVendedorId) {
    return next();
  }
  res.redirect('/admin/loginAdminV');
}

router.get('/loginAdminV', (req, res) => {
  res.render('login_adminV');
});

router.post('/loginAdminV', (req, res) => {
  const { usuario, contraseña } = req.body;

  if (!contraseña) {
    return res.status(400).send("Contraseña no proporcionada");
  }

  const query = "SELECT * FROM adminvendedor WHERE nombre_usuario = ?";
  connection.query(query, [usuario], async (error, results) => {
    if (error) {
      console.error("Error al buscar el admin vendedor:", error);
      return res.status(500).send("Error al iniciar sesión");
    }

    if (results.length === 0) {
      return res.status(401).send("Usuario no registrado");
    }

    const adminVendedor = results[0];

    if (!adminVendedor.contraseña) {
      console.error("Contraseña no encontrada en la base de datos para el usuario:", usuario);
      return res.status(500).send("Error al iniciar sesión");
    }

    try {
      const isPasswordValid = await bcrypt.compare(contraseña, adminVendedor.contraseña);
      if (!isPasswordValid) {
        return res.status(401).send("Contraseña incorrecta");
      }

      req.session.adminVendedorId = adminVendedor.id;
      req.session.adminVendedorNombreUsuario = adminVendedor.nombre_usuario;
      req.session.adminVendedorActivo = true; // Establecer como activo

      req.session.save((err) => {
        if (err) {
          console.error("Error al guardar la sesión:", err);
          return res.status(500).send("Error al iniciar sesión");
        }
        res.redirect("/admin/adminV");
      });
    } catch (compareError) {
      console.error("Error al comparar la contraseña:", compareError);
      return res.status(500).send("Error al iniciar sesión");
    }
  });
});

router.get("/logoutAdminV", (req, res) => {
  req.session.adminVendedorActivo = false; // Establecer como inactivo
  // Elimina solo las propiedades relacionadas con adminVendedor
  delete req.session.adminVendedorId;
  delete req.session.adminVendedorNombreUsuario;

  // Si también tienes que eliminar otras propiedades relacionadas con adminVendedor, hazlo aquí
  req.session.save((err) => {
    if (err) {
      console.log("Error al guardar la sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }
    res.redirect("/admin/loginAdminV"); // Redirige al formulario de inicio de sesión del admin vendedor
  });
});


// Ruta protegida que requiere autenticación de admin vendedor
router.get("/adminV", isAuthenticatedAdminV, (req, res) => {
  if (!req.session.adminVendedorNombreUsuario) {
    return res.redirect("/admin/loginAdminV");
  }

  const nombreUsuario = req.session.adminVendedorNombreUsuario;
  res.render("adminVendedor", { nombreUsuario });
});

//Subir una subasta
router.post("/subir-inmueble", upload.array('images', 4), (req, res) => {
  const { nombre_propiedad, descripcion, categoria, direccion, precio_base, N_banos, N_cuartos, N_cocina, N_cocheras, patio } = req.body;
  const imagenes = req.files;

  // Obtener el ID del administrador vendedor desde la sesión
  const id_admin_vendedor = req.session.adminVendedorId;

  if (!id_admin_vendedor) {
    return res.status(401).send("Debe iniciar sesión como administrador vendedor para subir un inmueble.");
  }

  console.log(req.body);

  const insertQuery = `INSERT INTO subastas (nombre_propiedad, descripcion, categoria, direccion, precio_base, N_baños, N_cuartos, N_cocina, N_cocheras, patio, id_admin_vendedor) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [nombre_propiedad, descripcion, categoria, direccion, precio_base, N_banos, N_cuartos, N_cocina, N_cocheras, patio, id_admin_vendedor];

  connection.query(insertQuery, values, (err, result) => {
    if (err) {
      console.error("Error al insertar inmueble:", err);
      res.status(500).send("Error al insertar inmueble");
    } else {
      const id_subasta = result.insertId;

      if (imagenes && imagenes.length > 0) {
        let insertImagenesQuery = 'INSERT INTO imagenes_propiedad (id_subasta, url_imagen) VALUES ?';
        let imagenesData = imagenes.map(img => [id_subasta, img.filename]); // Usamos img.filename para obtener el nombre del archivo

        connection.query(insertImagenesQuery, [imagenesData], (err, results) => {
          if (err) {
            console.error("Error al insertar imágenes:", err);
            res.status(500).send("Error al insertar imágenes");
          } else {
            res.status(200).send("Inmueble y imágenes subidos correctamente");
          }
        });
      } else {
        res.status(200).send("Inmueble subido correctamente (sin imágenes)");
      }
    }
  });
});


/* TEST-SESIONS */
router.get("/test-session", (req, res) => {
  const adminGeneralId = req.session.adminGeneralId || "no hay admin general";
  const adminVendedorId = req.session.adminVendedorId || "no hay admin vendedor";

  res.json({
    adminGeneralId,
    adminVendedorId,
  });
  /* res.send(
    `ID del admin general: ${adminGeneralId}, ID del admin vendedor: ${adminVendedorId}`
  ); */
});


/* VALIDAR CODIGO DE SEGURIDAD */
//funcion par generar codigo de verificacion
function generateVerificationCode() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString(); // Genera un número aleatorio de 10 dígitos
}

router.get("/recuperar", (req, res) => {
  res.render("recup_contra");
});

router.post('/recuperar', (req, res) => {
  const { email } = req.body;

  const query = "SELECT * FROM admingeneral WHERE correo_electronico = ?";
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error("Error al buscar el administrador general:", error);
      return res.status(500).send("Error al buscar el administrador general");
    }
    if (results.length === 0) {
      return res.status(404).send("Correo electrónico no encontrado");
    }

    const verificationCode = generateVerificationCode();
    const updateQuery = "UPDATE admingeneral SET verification_code = ? WHERE correo_electronico = ?";
    connection.query(updateQuery, [verificationCode, email], (error) => {
      if (error) {
        console.error("Error al actualizar el código de verificación:", error);
        return res.status(500).send("Error al actualizar el código de verificación");
      }

      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: 'sebastianandryescalantemendoza@gmail.com',
          pass: 'aqoc cmjx cumo cclf'
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const mailOptions = {
        from: '73274663@certus.edu.pe',
        to: email,
        subject: 'Código de verificación',
        text: `Tu código de verificación es: ${verificationCode}`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error al enviar el correo:", error);
          return res.status(500).send("Error al enviar el correo");
        }
        res.status(200).send("Correo enviado");
        console.log("Correo enviado");
      });
    });
  });
});

router.post('/validarCodigo', (req, res) => {
  const { email, code } = req.body;

  const query = "SELECT * FROM admingeneral WHERE correo_electronico = ? AND verification_code = ?";
  connection.query(query, [email, code], (error, results) => {
    if (error) {
      console.error("Error al validar el código:", error);
      return res.status(500).send("Error al validar el código");
    }
    if (results.length === 0) {
      return res.status(404).send("Código de verificación incorrecto");
    }

    res.status(200).send("Código de verificación correcto");
  });
});

router.post('/cambiarContra', (req, res) => {
  const { email, newPassword } = req.body;

  const updateQuery = "UPDATE admingeneral SET contraseña = ? WHERE correo_electronico = ?";
  connection.query(updateQuery, [newPassword, email], (error) => {
    if (error) {
      console.error("Error al actualizar la contraseña:", error);
      return res.status(500).send("Error al actualizar la contraseña");
    }
    res.status(200).send("Contraseña actualizada");
  });
});

module.exports = router;
