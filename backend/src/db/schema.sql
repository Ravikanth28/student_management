CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  register_number VARCHAR(40) NOT NULL,
  enrollment_number VARCHAR(40) NOT NULL,
  section VARCHAR(40) NOT NULL DEFAULT 'A',
  year VARCHAR(16) NULL,
  department VARCHAR(120) NOT NULL,
  batch VARCHAR(40) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  parent_phone VARCHAR(15) NOT NULL,
  address VARCHAR(255) NOT NULL,
  college_email VARCHAR(120) NULL,
  personal_email VARCHAR(120) NULL,
  photo_url VARCHAR(255) NULL,
  blood_group VARCHAR(8) NULL,
  dob DATE NULL,
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

CREATE TABLE IF NOT EXISTS discipline_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT NULL,
  record_date DATE NOT NULL,
  record_time VARCHAR(8) NULL,
  marked_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_disc_student (student_id),
  KEY idx_disc_date (record_date)
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

CREATE TABLE IF NOT EXISTS placements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  company VARCHAR(200) NOT NULL,
  position VARCHAR(200) NULL,
  package VARCHAR(60) NULL,
  placement_type VARCHAR(20) NOT NULL DEFAULT 'on_campus',
  offer_type VARCHAR(30) NULL,
  location VARCHAR(200) NULL,
  placed_date DATE NULL,
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_placement_student (student_id),
  KEY idx_placement_created (created_at)
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  att_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'present',
  year VARCHAR(16) NULL,
  section VARCHAR(40) NULL,
  marked_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_att_student_day (student_id, att_date),
  KEY idx_att_date (att_date),
  KEY idx_att_student (student_id)
);

CREATE TABLE IF NOT EXISTS promotion_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_by VARCHAR(120) NULL,
  promoted_count INT NOT NULL DEFAULT 0,
  reverted TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reverted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_promo_created (created_at)
);

CREATE TABLE IF NOT EXISTS promotion_changes (
  batch_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  from_year VARCHAR(16) NULL,
  PRIMARY KEY (batch_id, student_id),
  KEY idx_promo_changes_batch (batch_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  name VARCHAR(64) NOT NULL,
  value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
);

CREATE TABLE IF NOT EXISTS device_tokens (
  token VARCHAR(255) NOT NULL,
  username VARCHAR(120) NULL,
  role VARCHAR(20) NULL,
  platform VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (token)
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
