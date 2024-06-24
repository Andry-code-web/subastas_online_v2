const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
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
  res.render("adminGeneral", { nombreUsuario });
});

router.get('/loginAdminV', (req, res) => {
  res.render('login_adminV')
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
      return res.status(401).send("Correo electrónico no registrado");
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
  req.session.destroy((err) => {
    if (err) {
      console.log("Error al cerrar sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }
    res.redirect("/admin/loginAdminV"); // Redirige al formulario de inicio de sesión del admin vendedor
  });
});

router.get("/adminV", (req, res) => {
  res.render("adminVendedor");
});

router.post("/adminV", (req, res) => {
  const { nombre_usuario, contraseña } = req.body;
  const query = "SELECT * FROM adminVendedor WHERE nombre_usuario = ?";

  connection.query(query, [nombre_usuario], async (error, results) => {
    if (error) {
      console.error("Error al buscar el admin vendedor:", error);
      return res.status(500).send("Error al iniciar sesión");
    }

    if (results.length === 0) {
      return res.status(401).send("Usuario no encontrado");
    }

    const adminVendedor = results[0];

    const isPasswordValid = await bcrypt.compare(
      contraseña,
      adminVendedor.contraseña
    );
    if (!isPasswordValid) {
      return res.status(401).send("Contraseña incorrecta");
    }

    req.session.adminVendedorId = adminVendedor.id;
    res.redirect("/adminV");
  });
});

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

router.get("/test-session", (req, res) => {
  const adminGeneralId = req.session.adminGeneralId;
  const adminVendedorId = req.session.adminVendedorId;

  res.send(
    `ID del admin general: ${adminGeneralId}, ID del admin vendedor: ${adminVendedorId}`
  );
});

/* FUNCIONE PARA GENERAR CODIGO DE VERIFICACION */
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
