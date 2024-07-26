-- SUBASTAS
SELECT * FROM subastaonline.subastas;

DELETE FROM subastaonline.subastas WHERE id > 0;


ALTER TABLE subastas
ADD COLUMN descripcion TEXT;

ALTER TABLE `subastaonline`.`subastas`
MODIFY COLUMN `precio_base` DECIMAL(20,2) NOT NULL;

-- Desactivar restricción de clave externa
SET FOREIGN_KEY_CHECKS = 0;
-- Truncar la tabla subastas
TRUNCATE TABLE subastas;
-- Volver a activar restricción de clave externa
SET FOREIGN_KEY_CHECKS = 1;
ALTER TABLE subastas AUTO_INCREMENT = 1;

ALTER TABLE subastas ADD COLUMN auctionEnded BOOLEAN DEFAULT false;
ALTER TABLE subastas ADD COLUMN currentWinner VARCHAR(255) DEFAULT NULL;
ALTER TABLE subastas ADD COLUMN hora_subasta TIME AFTER fecha_subasta;

ALTER TABLE subastas MODIFY COLUMN fecha_subasta DATE AFTER patio;

--IMAGENES_PROPIEDAD

SELECT * FROM subastaonline.imagenes_propiedad;

ALTER TABLE `subastaonline`.`imagenes_propiedad`
ADD COLUMN `imagen` LONGBLOB AFTER `url_imagen`;
ALTER TABLE imagenes_propiedad MODIFY url_imagen VARCHAR(255) DEFAULT 'sin-imagen.jpg';


DELETE FROM subastaonline.imagenes_propiedad WHERE id > 0;
TRUNCATE TABLE imagenes_propiedad;
ALTER TABLE imagenes_propiedad AUTO_INCREMENT = 1;


ALTER TABLE `subastaonline`.`imagenes_propiedad`
DROP COLUMN `imagen`;

ALTER TABLE `subastaonline`.`imagenes_propiedad`
MODIFY COLUMN `url_imagen` VARCHAR(255) DEFAULT 'sin-imagen.jpg';



-- -----------------------------------------------------
-- Table `subastaonline`.`usuarios`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tipo_persona` ENUM('natural', 'juridica') NOT NULL,
  
  -- Campos comunes
  `email` VARCHAR(100) NOT NULL,
  `confirmacion_email` VARCHAR(100) NOT NULL,
  `celular` VARCHAR(15) NOT NULL,
  `telefono` VARCHAR(15) NULL,
  
  -- Campos para persona natural
  `nombre_apellidos` VARCHAR(100) NULL,
  `dni_ce` VARCHAR(20) NULL,
  `fecha_nacimiento` DATE NULL,
  `sexo` ENUM('M', 'F') NULL,
  `estado_civil` ENUM('Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)') NULL,
  
  -- Campos para persona jurídica
  `ruc` VARCHAR(20) NULL,
  `nombre_comercial` VARCHAR(100) NULL,
  `actividad_comercial` VARCHAR(100) NULL,
  
  -- Campos de dirección
  `departamento` VARCHAR(50) NULL,
  `provincia` VARCHAR(50) NULL,
  `distrito` VARCHAR(50) NULL,
  `direccion` VARCHAR(100) NULL,
  `numero` VARCHAR(10) NULL,
  `complemento` VARCHAR(100) NULL,
  
  -- Datos de acceso
  `usuario` VARCHAR(50) NOT NULL,
  `contraseña` VARCHAR(100) NOT NULL,
  
  -- Términos y condiciones
  `terminos_y_condiciones` TINYINT(1) NOT NULL DEFAULT '0',
  
  PRIMARY KEY (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
