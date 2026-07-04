CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  register_number VARCHAR(40) NOT NULL,
  enrollment_number VARCHAR(40) NOT NULL,
  section VARCHAR(40) NOT NULL DEFAULT 'A',
  department VARCHAR(120) NOT NULL,
  batch VARCHAR(40) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  parent_phone VARCHAR(15) NOT NULL,
  address VARCHAR(255) NOT NULL,
  college_email VARCHAR(120) NULL,
  personal_email VARCHAR(120) NULL,
  photo_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_register_number (register_number),
  KEY idx_students_name (name),
  KEY idx_students_register_number (register_number)
);

CREATE TABLE IF NOT EXISTS photo_import_history (
  id VARCHAR(50) NOT NULL,
  folder_url VARCHAR(500) NULL,
  successes JSON NULL,
  errors JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  action VARCHAR(64) NOT NULL,
  entity VARCHAR(64) NULL,
  entity_id VARCHAR(64) NULL,
  actor VARCHAR(120) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'success',
  details VARCHAR(500) NULL,
  ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created_at (created_at),
  KEY idx_audit_action (action)
);
