import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, '../../data/users.json');

// Ensure data directory exists
const dataDir = path.dirname(usersFilePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize users file if it doesn't exist
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify([], null, 2));
}

class User {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.name = data.name;
    this.email = data.email?.toLowerCase();
    this.passwordHash = data.passwordHash;
    this.role = data.role || 'clerk';
    this.phone = data.phone || '';
    this.department = data.department || '';
    this.settings = data.settings || {
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        patientUpdates: true,
        systemAlerts: false
      },
      security: {
        twoFactorAuth: false,
        sessionTimeout: '30',
        passwordExpiry: '90'
      },
      system: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/dd/yyyy'
      }
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static getUsers() {
    try {
      const data = fs.readFileSync(usersFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  static saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  }

  static async findOne(query) {
    const users = this.getUsers();
    return users.find(user => {
      if (query.email) return user.email === query.email.toLowerCase();
      if (query.id) return user.id === query.id;
      return false;
    });
  }

  static async findById(id) {
    return this.findOne({ id });
  }

  async save() {
    const users = User.getUsers();
    const existingIndex = users.findIndex(u => u.id === this.id);

    this.updatedAt = new Date().toISOString();

    if (existingIndex >= 0) {
      users[existingIndex] = this;
    } else {
      users.push(this);
    }

    User.saveUsers(users);
    return this;
  }

  static async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  static async countDocuments() {
    return this.getUsers().length;
  }

  static async aggregate(pipeline) {
    const users = this.getUsers();

    // Role distribution aggregation
    if (pipeline.some(stage => stage.$group && stage.$group._id === '$role')) {
      const roleCounts = {};
      users.forEach(u => {
        roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
      });
      return Object.entries(roleCounts).map(([role, count]) => ({ _id: role, count }));
    }

    return [];
  }

  static async find(query = {}) {
    const users = this.getUsers();
    return users.map(u => new User(u));
  }
}

export default User;
