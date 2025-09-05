import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, '../../data/users.json');

class User {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.name = data.name;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.role = data.role || 'clerk';
    this.phone = data.phone || '';
    this.department = data.department || '';
    this.isTemporaryPassword = data.isTemporaryPassword || false;
    this.forcePasswordChange = data.forcePasswordChange || false;
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

  // Static methods to mimic Mongoose
  static async find(query = {}) {
    try {
      const users = await this.getUsers();

      if (query.email) {
        return users.filter(user => user.email === query.email);
      }

      return users;
    } catch (error) {
      throw new Error(`Error finding users: ${error.message}`);
    }
  }

  static async findOne(query = {}) {
    try {
      const users = await this.getUsers();

      if (query.email) {
        return users.find(user => user.email === query.email) || null;
      }

      return null;
    } catch (error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const users = await this.getUsers();
      const userData = users.find(user => user.id === id);
      return userData ? new User(userData) : null;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static async create(userData) {
    try {
      const users = await this.getUsers();

      // Check if user already exists
      const existingUser = users.find(user => user.email === userData.email);
      if (existingUser) {
        throw new Error('Email already in use');
      }

      const newUser = new User(userData);
      users.push(newUser);
      await this.saveUsers(users);

      return newUser;
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  static async findByIdAndUpdate(id, updateData, options = {}) {
    try {
      const users = await this.getUsers();
      const userIndex = users.findIndex(user => user.id === id);

      if (userIndex === -1) {
        return null;
      }

      // Update user data
      const updatedUserData = { ...users[userIndex], ...updateData, updatedAt: new Date().toISOString() };
      users[userIndex] = updatedUserData;

      await this.saveUsers(users);

      return options.new !== false ? new User(updatedUserData) : new User(users[userIndex]);
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  static async countDocuments(query = {}) {
    try {
      const users = await this.getUsers();
      return users.length;
    } catch (error) {
      throw new Error(`Error counting users: ${error.message}`);
    }
  }

  // File operations
  static async getUsers() {
    try {
      if (!fs.existsSync(USERS_FILE)) {
        // Create file with default admin user if it doesn't exist
        const defaultUsers = [{
          id: 'admin_default',
          name: 'System Administrator',
          email: 'admin@hospital.com',
          passwordHash: '$2a$10$EU1J7R0X5tN9VfACxuMUl./CpM7RG3VOVPc8RFtCMX0ga9gVceHHG',
          role: 'admin',
          phone: '1234567890',
          department: 'IT Administration',
          isTemporaryPassword: false,
          forcePasswordChange: false,
          settings: {
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
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }];
        await this.saveUsers(defaultUsers);
        return defaultUsers;
      }

      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading users file:', error);
      return [];
    }
  }

  static async saveUsers(users) {
    try {
      // Ensure directory exists
      const dir = path.dirname(USERS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
      throw new Error(`Error saving users: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      console.log('User.save() called for user:', this.id);
      console.log('Password hash before save:', this.passwordHash);

      const users = await User.getUsers();
      const existingIndex = users.findIndex(u => u.id === this.id);

      console.log('Existing user index:', existingIndex);

      // Create clean data object without methods
      const userData = {
        id: this.id,
        name: this.name,
        email: this.email,
        passwordHash: this.passwordHash,
        role: this.role,
        phone: this.phone,
        department: this.department,
        isTemporaryPassword: this.isTemporaryPassword,
        forcePasswordChange: this.forcePasswordChange,
        settings: this.settings,
        createdAt: this.createdAt,
        updatedAt: new Date().toISOString()
      };

      console.log('User data to save:', JSON.stringify(userData, null, 2));

      if (existingIndex >= 0) {
        users[existingIndex] = userData;
        console.log('Updated existing user at index:', existingIndex);
      } else {
        users.push(userData);
        console.log('Added new user');
      }

      await User.saveUsers(users);
      console.log('Users saved to file successfully');
      return this;
    } catch (error) {
      console.error('Error in User.save():', error);
      throw new Error(`Error saving user: ${error.message}`);
    }
  }
}

// Initialize default admin user if file is empty
const initializeDefaultUser = async () => {
  try {
    const users = await User.getUsers();
    if (users.length === 0) {
      const defaultUser = {
        id: 'admin_default',
        name: 'System Administrator',
        email: 'admin@hospital.com',
        passwordHash: '$2a$10$EU1J7R0X5tN9VfACxuMUl./CpM7RG3VOVPc8RFtCMX0ga9gVceHHG',
        role: 'admin',
        phone: '1234567890',
        department: 'IT Administration',
        isTemporaryPassword: false,
        forcePasswordChange: false
      };
      await User.create(defaultUser);
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Error initializing default user:', error);
  }
};

// Initialize default user when the model is loaded
initializeDefaultUser();

export default User;
