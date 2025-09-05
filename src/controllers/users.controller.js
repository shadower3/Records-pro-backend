import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { emitToAllUsers } from '../socket/socketHandlers.js';

// Get all users (admin only)
export async function getUsers(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find();
    // Remove password hashes from response
    const safeUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      isTemporaryPassword: user.isTemporaryPassword,
      forcePasswordChange: user.forcePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json(safeUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Create new user (admin only)
export async function createUser(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, email, password, role, phone, department } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with temporary password flag
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      phone,
      department,
      isTemporaryPassword: true,
      forcePasswordChange: true
    });

    // Emit user creation event
    emitToAllUsers('user:created', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'User created successfully. They will be required to change their password on first login.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Update user (admin only)
export async function updateUser(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, email, role, phone, department } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user fields
    user.name = name;
    user.email = email;
    user.role = role;
    user.phone = phone;
    user.department = department;

    await user.save();

    // Emit user update event
    emitToAllUsers('user:updated', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'User updated successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Reset user password (admin only)
export async function resetUserPassword(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user with temporary password
    user.passwordHash = passwordHash;
    user.isTemporaryPassword = true;
    user.forcePasswordChange = true;

    await user.save();

    res.json({
      message: 'Password reset successfully. User will be required to change their password on next login.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Delete user (admin only)
export async function deleteUser(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Prevent deleting the default admin user
    if (id === 'admin_default') {
      return res.status(400).json({ error: 'Cannot delete the default admin user' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove user from users array
    const users = await User.getUsers();
    const filteredUsers = users.filter(u => u.id !== id);
    await User.saveUsers(filteredUsers);

    // Emit user deletion event
    emitToAllUsers('user:deleted', { id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Get current user
export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data without password hash
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      settings: user.settings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Update current user profile
export async function updateProfile(req, res) {
  try {
    const { name, email, phone, department } = req.body;

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update profile fields
    user.name = name || user.name;
    user.email = email ? email.toLowerCase() : user.email;
    user.phone = phone || user.phone;
    user.department = department || user.department;

    await user.save();

    // Emit profile update event
    emitToAllUsers('user:profile:updated', {
      id: user.id,
      name: user.name,
      email: user.email
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Update current user settings
export async function updateSettings(req, res) {
  try {
    const { settings } = req.body;

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update settings
    user.settings = { ...user.settings, ...settings };

    await user.save();

    res.json({
      settings: user.settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
