import Patient from '../models/Patient.js';
import { emitToAllUsers } from '../socket/socketHandlers.js';

export async function list(req, res) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all patients first
    let patients = await Patient.find(query);

    // Sort by createdAt (newest first)
    patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate pagination
    const total = patients.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);

    // Apply pagination
    const paginatedPatients = patients.slice(startIndex, endIndex);

    res.json({
      patients: paginatedPatients,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req, res) {
  try {
    const patient = await Patient.create(req.body);

    // Emit real-time update
    emitToAllUsers('patient:created', patient);

    res.status(201).json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req, res) {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Emit real-time update
    emitToAllUsers('patient:updated', patient);

    res.json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function deletePatient(req, res) {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Emit real-time update
    emitToAllUsers('patient:deleted', { id: req.params.id });

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
