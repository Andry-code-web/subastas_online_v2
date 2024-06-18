const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const formidable = require("formidable");
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

router.get("/recuperar", (req, res) => {
  res.render("recup_contra");
});

module.exports = router;
