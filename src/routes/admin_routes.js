const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const formidable = require("formidable");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const connection = require("../database/db");

const router = express.Router();

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

router.post('/adminV', (req, res) => {

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

router.post("/subir-inmueble", (req, res) => {
  const form = new formidable.IncomingForm();

  // Especificar el directorio de carga de archivos
  form.uploadDir = path.join(__dirname, "../uploads");
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).send("Error al procesar la subida de archivos");
    }

    // Procesar campos y archivos recibidos
    const {
      nombre_propiedad,
      categoria,
      direccion,
      precio_base,
      N_baños,
      N_cuartos,
      N_cocina,
      N_cocheras,
      patio,
    } = fields;

    // Guardar información de la propiedad en la base de datos
    const subastaQuery = `
          INSERT INTO subastaonline.subastas (nombre_propiedad, categoria, direccion, precio_base, N_baños, N_cuartos, N_cocina, N_cocheras, patio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const subastaValues = [
      nombre_propiedad,
      categoria,
      direccion,
      precio_base,
      N_baños,
      N_cuartos,
      N_cocina,
      N_cocheras,
      patio,
    ];

    connection.query(subastaQuery, subastaValues, (err, result) => {
      if (err) {
        // Si hay un error al insertar en la base de datos, eliminar los archivos subidos (opcional)
        if (files.imagenes) {
          fs.unlinkSync(files.imagenes.path); // Elimina el archivo
        }
        return res.status(500).send(err);
      }

      const subastaId = result.insertId;

      // Procesar archivos de imágenes subidos
      if (files.imagenes) {
        const imagenQuery = `
                  INSERT INTO subastaonline.imagenes_propiedad (id_subasta, url_imagen)
                  VALUES (?, ?)
              `;
        const imagenValues = [subastaId, files.imagenes.path];

        connection.query(imagenQuery, imagenValues, (err, result) => {
          if (err) {
            // Si hay un error al insertar la imagen en la base de datos, eliminar el archivo subido
            fs.unlinkSync(files.imagenes.path); // Elimina el archivo
            return res.status(500).send(err);
          }
          res.send("Inmueble y su imagen subidos con éxito");
        });
      } else {
        res.status(400).send("No se han subido archivos");
      }
    });
  });
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
