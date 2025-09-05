import Patient from '../models/Patient.js';
import { emitToAllUsers } from '../socket/socketHandlers.js';

// Helper function to check user permissions
function canManagePatientDetails(userRole) {
  return ['clerk', 'doctor', 'nurse'].includes(userRole);
}

function canCreatePatients(userRole) {
  return ['clerk'].includes(userRole);
}

function canManageMedicalRecords(userRole) {
  return ['doctor'].includes(userRole);
}

function canManageVitalSigns(userRole) {
  return ['admin', 'doctor', 'nurse'].includes(userRole);
}

function canManagePatientStatus(userRole) {
  return ['admin', 'doctor'].includes(userRole);
}

function canViewMedicalRecords(userRole) {
  return ['admin', 'doctor', 'nurse'].includes(userRole);
}

function canDeletePatients(userRole) {
  return ['admin'].includes(userRole);
}

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
    // Only clerks can create new patients
    if (!canCreatePatients(req.user.role)) {
      return res.status(403).json({ error: 'Only clerks can create patient records' });
    }

    // Ensure admission status defaults to "Admitted" for new patients
    const patientData = {
      ...req.body,
      medicalRecords: {
        ...req.body.medicalRecords,
        admissionStatus: req.body.admissionStatus || req.body.medicalRecords?.admissionStatus || 'Admitted'
      }
    };

    const patient = await Patient.create(patientData);

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
    const existingPatient = await Patient.findById(req.params.id);
    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check permissions based on what's being updated
    const updateData = { ...req.body };
    const isUpdatingPatientDetails = updateData.patientDetails ||
      ['firstName', 'lastName', 'dob', 'sex', 'phone', 'email', 'address', 'emergencyContact', 'insurance', 'recordStatus', 'status', 'folderNumber'].some(field => field in updateData);

    // For clerks, allow updating patient details even if medical record fields are present
    // (they might be default values or unchanged fields)
    if (req.user.role === 'clerk') {
      if (!canManagePatientDetails(req.user.role)) {
        return res.status(403).json({ error: 'You do not have permission to update patient records' });
      }
    } else {
      // For non-clerks, check both patient details and medical records permissions
      const isUpdatingMedicalRecords = updateData.medicalRecords ||
        ['medicalHistory', 'allergies', 'medications', 'vitals', 'diagnoses', 'treatments', 'labResults', 'prescriptions', 'patientStatus', 'admissionStatus'].some(field => field in updateData);

      if (isUpdatingPatientDetails && !canManagePatientDetails(req.user.role)) {
        return res.status(403).json({ error: 'You do not have permission to update patient details' });
      }

      if (isUpdatingMedicalRecords && !canManageMedicalRecords(req.user.role)) {
        return res.status(403).json({ error: 'Only doctors can update medical records' });
      }
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      updateData
    );

    // Emit real-time update
    emitToAllUsers('patient:updated', patient);

    res.json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Update only patient details (clerk only)
export async function updatePatientDetails(req, res) {
  try {
    if (!canManagePatientDetails(req.user.role)) {
      return res.status(403).json({ error: 'Only clerks can update patient details' });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { patientDetails: req.body }
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

// Update only medical records (doctor only - nurses have limited access)
export async function updateMedicalRecords(req, res) {
  try {
    if (!canManageMedicalRecords(req.user.role) && !canManageVitalSigns(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to update medical records' });
    }

    // If user is a nurse, only allow vitals and admission status updates
    if (req.user.role === 'nurse') {
      const allowedFields = ['vitals', 'admissionStatus'];
      const requestedFields = Object.keys(req.body);
      const unauthorizedFields = requestedFields.filter(field => !allowedFields.includes(field));

      if (unauthorizedFields.length > 0) {
        return res.status(403).json({
          error: `Nurses can only update vital signs and admission status. Unauthorized fields: ${unauthorizedFields.join(', ')}`
        });
      }
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update the medicalRecords object with the new data
    const updatedMedicalRecords = {
      ...patient.medicalRecords,
      ...req.body
    };

    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { medicalRecords: updatedMedicalRecords },
      { new: true }
    );

    // Emit real-time update
    emitToAllUsers('patient:medical-updated', updatedPatient);

    res.json(updatedPatient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Update only vital signs (nurse/doctor/admin)
export async function updateVitalSigns(req, res) {
  try {
    if (!canManageVitalSigns(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to update vital signs' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update only the vitals field
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { 'medicalRecords.vitals': req.body.vitals }
    );

    // Emit real-time update
    emitToAllUsers('patient:vitals-updated', updatedPatient);

    res.json(updatedPatient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Update patient status (nurse/doctor/admin)
export async function updatePatientStatus(req, res) {
  try {
    if (!canManagePatientStatus(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to update patient status' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update only the patient status field
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { 'medicalRecords.patientStatus': req.body.patientStatus }
    );

    // Emit real-time update
    emitToAllUsers('patient:status-updated', updatedPatient);

    res.json(updatedPatient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function deletePatient(req, res) {
  try {
    // Only admins can delete patients
    if (!canDeletePatients(req.user.role)) {
      return res.status(403).json({ error: 'Only admins can delete patient records' });
    }

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
