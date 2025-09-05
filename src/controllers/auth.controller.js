import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function register(req, res) {
  const { name, email, password, role } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: 'Email already used' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });

  // Automatically log in the user after successful registration
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, role: user.role },
    message: 'Registration successful'
  });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  // Check if password change is required
  if (user.forcePasswordChange) {
    const tempToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' });
    return res.json({
      token: tempToken,
      user: { id: user.id, name: user.name, role: user.role },
      requiresPasswordChange: true,
      message: 'Password change required'
    });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.sub;

  console.log('Change password request for user:', userId);

  const user = await User.findById(userId);
  if (!user) {
    console.log('User not found:', userId);
    return res.status(404).json({ error: 'User not found' });
  }

  console.log('Current password hash:', user.passwordHash);

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  console.log('Current password valid:', isCurrentPasswordValid);

  if (!isCurrentPasswordValid) {
    console.log('Current password is incorrect for user:', userId);
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  console.log('New password hash generated:', newPasswordHash);

  // Update user
  user.passwordHash = newPasswordHash;
  user.isTemporaryPassword = false;
  user.forcePasswordChange = false;

  console.log('Saving user with new password...');
  await user.save();
  console.log('User saved successfully');

  res.json({ message: 'Password changed successfully' });
}

export async function forcePasswordChange(req, res) {
  const { newPassword } = req.body;
  const userId = req.user.sub;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update user
  user.passwordHash = newPasswordHash;
  user.isTemporaryPassword = false;
  user.forcePasswordChange = false;
  await user.save();

  // Generate token for login
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role },
    message: 'Password changed successfully'
  });
}
