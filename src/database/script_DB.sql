-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `mydb` DEFAULT CHARACTER SET utf8 ;
-- -----------------------------------------------------
-- Schema subastaonline
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema subastaonline
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `subastaonline` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ;
USE `subastaonline`;

-- -----------------------------------------------------
-- Table `mydb`.`usuarios`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mydb`.`usuarios` (
  `id_usuarios` INT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id_usuarios`))
ENGINE = InnoDB;

USE `subastaonline` ;

-- -----------------------------------------------------
-- Table `subastaonline`.`admingeneral`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`admingeneral` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre_usuario` VARCHAR(50) NOT NULL,
  `contraseña` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`adminvendedor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`adminvendedor` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_admin_general` INT NOT NULL,
  `nombre_usuario` VARCHAR(50) NOT NULL,
  `contraseña` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `id_admin_general` (`id_admin_general` ASC) VISIBLE,
  CONSTRAINT `adminvendedor_ibfk_1`
    FOREIGN KEY (`id_admin_general`)
    REFERENCES `subastaonline`.`admingeneral` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`usuarios`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `apellidos` VARCHAR(50) NOT NULL,
  `dni` VARCHAR(20) NOT NULL,
  `celular` VARCHAR(15) NOT NULL,
  `correo_electronico` VARCHAR(100) NOT NULL,
  `contraseña` VARCHAR(100) NOT NULL,
  `boleta` TINYINT(1) NOT NULL DEFAULT '0',
  `factura` TINYINT(1) NOT NULL DEFAULT '0',
  `numero_factura` VARCHAR(50) NULL DEFAULT NULL,
  `terminos_y_condiciones` TINYINT(1) NOT NULL DEFAULT '0',
  `uso_datos_personales` TINYINT(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`subastas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`subastas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre_propiedad` VARCHAR(100) NOT NULL,
  `categoria` ENUM('departamento', 'casa_campo', 'casa') NOT NULL,
  `direccion` VARCHAR(255) NOT NULL,
  `precio_base` DECIMAL(10,2) NOT NULL,
  `N_baños` INT NOT NULL,
  `N_cuartos` INT NOT NULL,
  `N_cocina` INT NOT NULL,
  `N_cocheras` INT NOT NULL,
  `patio` ENUM('si', 'no') NOT NULL,
  `id_admin_vendedor` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `id_admin_vendedor` (`id_admin_vendedor` ASC) VISIBLE,
  CONSTRAINT `subastas_ibfk_1`
    FOREIGN KEY (`id_admin_vendedor`)
    REFERENCES `subastaonline`.`adminvendedor` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`imagenes_propiedad` directo
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`imagenes_propiedad` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_subasta` INT NOT NULL,
  `imagen` LONGBLOB NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `id_subasta` (`id_subasta` ASC) VISIBLE,
  CONSTRAINT `imagenes_propiedad_ibfk_1`
    FOREIGN KEY (`id_subasta`)
    REFERENCES `subastaonline`.`subastas` (`id`)
    ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`imagenes_propiedad`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`imagenes_propiedad` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_subasta` INT NOT NULL,
  `url_imagen` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `id_subasta` (`id_subasta` ASC) VISIBLE,
  CONSTRAINT `imagenes_propiedad_ibfk_1`
    FOREIGN KEY (`id_subasta`)
    REFERENCES `subastaonline`.`subastas` (`id`)
    ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`ofertas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`ofertas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `id_subasta` INT NOT NULL,
  `monto_oferta` DECIMAL(10,2) NOT NULL,
  `fecha_oferta` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `id_usuario` (`id_usuario` ASC) VISIBLE,
  INDEX `id_subasta` (`id_subasta` ASC) VISIBLE,
  CONSTRAINT `ofertas_ibfk_1`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `subastaonline`.`usuarios` (`id`),
  CONSTRAINT `ofertas_ibfk_2`
    FOREIGN KEY (`id_subasta`)
    REFERENCES `subastaonline`.`subastas` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table `subastaonline`.`comentarios`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subastaonline`.`comentarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `comentario` TEXT NOT NULL,
  `rating` INT NOT NULL,
  PRIMARY KEY (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

