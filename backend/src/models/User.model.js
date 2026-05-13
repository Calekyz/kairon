class UserModel {
  constructor(db) {
    this.db = db;
  }

  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        subscription_status VARCHAR(50) DEFAULT 'inactive',
        subscription_end_date TIMESTAMP,
        active_session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        UNIQUE(email)
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_session ON users(active_session_id);
    `;
    await this.db.query(query);
  }

  async createUser(email, passwordHash, fullName = null) {
    const query = `
      INSERT INTO users (email, password_hash, full_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, full_name, subscription_status, subscription_end_date
    `;
    const values = [email, passwordHash, fullName];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async findByEmail(email) {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await this.db.query(query, [email]);
    return result.rows[0];
  }

  async updateSession(userId, sessionId) {
    const query = `UPDATE users SET active_session_id = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2`;
    await this.db.query(query, [sessionId, userId]);
  }

  async validateSession(userId, sessionId) {
    const query = `SELECT active_session_id FROM users WHERE id = $1`;
    const result = await this.db.query(query, [userId]);
    return result.rows[0]?.active_session_id === sessionId;
  }

  async checkSubscription(userId) {
    const query = `
      SELECT subscription_status, subscription_end_date 
      FROM users 
      WHERE id = $1 AND subscription_status = 'active' 
      AND subscription_end_date > CURRENT_TIMESTAMP
    `;
    const result = await this.db.query(query, [userId]);
    return result.rows.length > 0;
  }

  async updateSubscription(userId, status, endDate) {
    const query = `
      UPDATE users 
      SET subscription_status = $1, subscription_end_date = $2 
      WHERE id = $3
    `;
    await this.db.query(query, [status, endDate, userId]);
  }
}

module.exports = UserModel;
