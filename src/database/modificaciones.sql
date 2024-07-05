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