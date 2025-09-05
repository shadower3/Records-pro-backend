import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATIENTS_FILE = path.join(__dirname, '../../data/patients.json');

class Patient {
  constructor(data) {
    this._id = data._id || Date.now().toString();
    this.patientDetails = data.patientDetails || {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      dob: data.dob || new Date().toISOString(),
      sex: data.sex || 'M',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      emergencyContact: data.emergencyContact || { name: '', phone: '', relationship: '' },
      insurance: data.insurance || { provider: '', policyNumber: '', groupNumber: '' },
      recordStatus: data.recordStatus || data.status || 'Active',
      folderNumber: data.folderNumber || ''
    };

    this.medicalRecords = data.medicalRecords || {
      medicalHistory: data.medicalHistory || [],
      allergies: data.allergies || [],
      medications: data.medications || [],
      vitals: data.vitals || [],
      diagnoses: data.diagnoses || [],
      treatments: data.treatments || [],
      labResults: data.labResults || [],
      prescriptions: data.prescriptions || [],
      patientStatus: data.patientStatus || 'Admitted',
      admissionStatus: data.admissionStatus || 'Admitted'
    };

    // Legacy fields for backward compatibility
    this.firstName = this.patientDetails.firstName;
    this.lastName = this.patientDetails.lastName;
    this.dob = this.patientDetails.dob;
    this.sex = this.patientDetails.sex;
    this.phone = this.patientDetails.phone;
    this.email = this.patientDetails.email;
    this.address = this.patientDetails.address;
    this.emergencyContact = this.patientDetails.emergencyContact;
    this.insurance = this.patientDetails.insurance;
    this.status = this.patientDetails.recordStatus;
    this.folderNumber = this.patientDetails.folderNumber;

    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Virtual for full name
  get fullName() {
    return `${this.patientDetails.firstName} ${this.patientDetails.lastName}`;
  }

  // Static methods to mimic Mongoose
  static async find(query = {}) {
    try {
      const patients = await this.getPatients();

      if (query.$or) {
        // Handle search queries
        return patients.filter(patient => {
          return query.$or.some(condition => {
            const field = Object.keys(condition)[0];
            const searchValue = condition[field].$regex;
            const regex = new RegExp(searchValue, 'i');

            if (field === 'firstName') return regex.test(patient.patientDetails.firstName);
            if (field === 'lastName') return regex.test(patient.patientDetails.lastName);
            if (field === 'phone') return regex.test(patient.patientDetails.phone);

            return false;
          });
        });
      }

      return patients;
    } catch (error) {
      throw new Error(`Error finding patients: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const patients = await this.getPatients();
      const patientData = patients.find(patient => patient._id === id);
      return patientData ? new Patient(patientData) : null;
    } catch (error) {
      throw new Error(`Error finding patient by ID: ${error.message}`);
    }
  }

  static async create(patientData) {
    try {
      const patients = await this.getPatients();
      const newPatient = new Patient(patientData);
      patients.push(newPatient);
      await this.savePatients(patients);
      return newPatient;
    } catch (error) {
      throw new Error(`Error creating patient: ${error.message}`);
    }
  }

  static async findByIdAndUpdate(id, updateData, options = {}) {
    try {
      const patients = await this.getPatients();
      const patientIndex = patients.findIndex(patient => patient._id === id);

      if (patientIndex === -1) {
        return null;
      }

      const processedUpdateData = { ...updateData };
      const existingPatient = patients[patientIndex];

      // Handle patient details field mapping for clerks
      const patientDetailFields = ['firstName', 'lastName', 'dob', 'sex', 'phone', 'email', 'address', 'emergencyContact', 'insurance', 'folderNumber'];
      const hasPatientDetailFields = patientDetailFields.some(field => field in processedUpdateData);
      const hasStatusField = 'status' in processedUpdateData;

      if ((hasPatientDetailFields || hasStatusField) && !processedUpdateData.patientDetails) {
        // Map individual patient detail fields to patientDetails object
        processedUpdateData.patientDetails = {
          ...existingPatient.patientDetails
        };

        // Map patient detail fields
        patientDetailFields.forEach(field => {
          if (field in processedUpdateData) {
            if (field === 'emergencyContact' || field === 'insurance') {
              // Handle nested objects
              processedUpdateData.patientDetails[field] = {
                ...existingPatient.patientDetails[field],
                ...processedUpdateData[field]
              };
            } else {
              processedUpdateData.patientDetails[field] = processedUpdateData[field];
            }
            delete processedUpdateData[field];
          }
        });

        // Handle status field mapping
        if (hasStatusField) {
          processedUpdateData.patientDetails.recordStatus = processedUpdateData.status;
          delete processedUpdateData.status;
        }
      }

      // Update patient data
      const updatedPatientData = {
        ...existingPatient,
        ...processedUpdateData,
        updatedAt: new Date().toISOString()
      };
      const updatedPatient = new Patient(updatedPatientData);

      patients[patientIndex] = updatedPatient;
      await this.savePatients(patients);

      return options.new !== false ? updatedPatient : new Patient(patients[patientIndex]);
    } catch (error) {
      throw new Error(`Error updating patient: ${error.message}`);
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const patients = await this.getPatients();
      const patientIndex = patients.findIndex(patient => patient._id === id);

      if (patientIndex === -1) {
        return null;
      }

      const deletedPatient = patients[patientIndex];
      patients.splice(patientIndex, 1);
      await this.savePatients(patients);

      return deletedPatient;
    } catch (error) {
      throw new Error(`Error deleting patient: ${error.message}`);
    }
  }

  static async countDocuments(query = {}) {
    try {
      const patients = await this.getPatients();

      if (query.createdAt && query.createdAt.$gte) {
        const cutoffDate = new Date(query.createdAt.$gte);
        return patients.filter(patient => new Date(patient.createdAt) >= cutoffDate).length;
      }

      return patients.length;
    } catch (error) {
      throw new Error(`Error counting patients: ${error.message}`);
    }
  }

  static async aggregate(pipeline) {
    try {
      const patients = await this.getPatients();

      // Handle gender distribution aggregation
      if (pipeline.some(stage => stage.$group && stage.$group._id === '$patientDetails.sex')) {
        const genderCount = {};
        patients.forEach(patient => {
          const sex = patient.patientDetails.sex;
          genderCount[sex] = (genderCount[sex] || 0) + 1;
        });

        return Object.entries(genderCount).map(([sex, count]) => ({ _id: sex, count }));
      }

      // Handle age distribution aggregation
      if (pipeline.some(stage => stage.$addFields && stage.$addFields.age)) {
        const ageGroups = { '0-17': 0, '18-29': 0, '30-49': 0, '50-69': 0, '70+': 0 };

        patients.forEach(patient => {
          const dob = new Date(patient.patientDetails.dob);
          const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));

          if (age < 18) ageGroups['0-17']++;
          else if (age < 30) ageGroups['18-29']++;
          else if (age < 50) ageGroups['30-49']++;
          else if (age < 70) ageGroups['50-69']++;
          else ageGroups['70+']++;
        });

        return Object.entries(ageGroups)
          .map(([group, count]) => ({ _id: group, count }))
          .sort((a, b) => a._id.localeCompare(b._id));
      }

      // Handle monthly trends aggregation
      if (pipeline.some(stage => stage.$group && stage.$group._id && stage.$group._id.year)) {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyCount = {};
        patients
          .filter(patient => new Date(patient.createdAt) >= twelveMonthsAgo)
          .forEach(patient => {
            const date = new Date(patient.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyCount[key] = (monthlyCount[key] || 0) + 1;
          });

        return Object.entries(monthlyCount)
          .map(([key, count]) => {
            const [year, month] = key.split('-');
            return { _id: { year: parseInt(year), month: parseInt(month) }, count };
          })
          .sort((a, b) => {
            if (a._id.year !== b._id.year) return a._id.year - b._id.year;
            return a._id.month - b._id.month;
          });
      }

      return patients;
    } catch (error) {
      throw new Error(`Error aggregating patients: ${error.message}`);
    }
  }

  // File operations
  static async getPatients() {
    try {
      if (!fs.existsSync(PATIENTS_FILE)) {
        await this.savePatients([]);
        return [];
      }

      const data = fs.readFileSync(PATIENTS_FILE, 'utf8');
      const patients = JSON.parse(data);

      // Ensure all patients have the correct structure
      return patients.map(patient => new Patient(patient));
    } catch (error) {
      console.error('Error reading patients file:', error);
      return [];
    }
  }

  static async savePatients(patients) {
    try {
      // Ensure directory exists
      const dir = path.dirname(PATIENTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(PATIENTS_FILE, JSON.stringify(patients, null, 2));
    } catch (error) {
      throw new Error(`Error saving patients: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      const patients = await Patient.getPatients();
      const existingIndex = patients.findIndex(p => p._id === this._id);

      if (existingIndex >= 0) {
        patients[existingIndex] = { ...this, updatedAt: new Date().toISOString() };
      } else {
        patients.push(this);
      }

      await Patient.savePatients(patients);
      return this;
    } catch (error) {
      throw new Error(`Error saving patient: ${error.message}`);
    }
  }
}

export default Patient;
