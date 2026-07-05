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

CREATE TABLE IF NOT EXISTS late_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  period VARCHAR(24) NOT NULL,
  scheduled_time VARCHAR(8) NULL,
  late_time VARCHAR(8) NULL,
  minutes_late INT NULL,
  late_date DATE NOT NULL,
  marked_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_late_student_period_day (student_id, period, late_date),
  KEY idx_late_student (student_id),
  KEY idx_late_date (late_date)
);

CREATE TABLE IF NOT EXISTS achievements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(40) NULL,
  title VARCHAR(200) NOT NULL,
  venue VARCHAR(200) NULL,
  duration VARCHAR(120) NULL,
  result VARCHAR(20) NOT NULL DEFAULT 'participated',
  position VARCHAR(60) NULL,
  prize VARCHAR(200) NULL,
  event_date DATE NULL,
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ach_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS achievement_members (
  achievement_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (achievement_id, student_id),
  KEY idx_am_student (student_id)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(120) NOT NULL,
  name VARCHAR(120) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
);
