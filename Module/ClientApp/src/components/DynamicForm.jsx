import { useState, useEffect } from 'react';
import { getRecordsByName } from '../services/api';

function DynamicForm({ fields, initialData = {}, onSubmit, submitLabel = 'Submit' }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [relationsData, setRelationsData] = useState({});

  useEffect(() => {
    // Initialize form data with initial values or empty values
    const initialFormData = {};
    fields.forEach(field => {
      if (field.type.toLowerCase() === 'checkbox') {
        initialFormData[field.name] = initialData[field.name] === true || initialData[field.name] === 'true' || false;
      } else {
        initialFormData[field.name] = initialData[field.name] !== undefined && initialData[field.name] !== null
          ? initialData[field.name]
          : '';
      }
    });
    setFormData(initialFormData);

    // Fetch relation options
    const fetchRelations = async () => {
      const relationFields = fields.filter(f => f.type.toLowerCase() === 'relation' && f.options);
      if (relationFields.length === 0) return;

      const relationsMap = {};
      await Promise.all(relationFields.map(async (field) => {
        try {
          // Normalize module name (remove quotes if any)
          const targetModule = field.options.replace(/['"]+/g, '');
          const records = await getRecordsByName(targetModule);
          relationsMap[field.name] = records;
        } catch (err) {
          console.error(`Failed to fetch records for relation field ${field.name}`, err);
        }
      }));
      setRelationsData(relationsMap);
    };

    fetchRelations();
  }, [fields, initialData]);

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach(field => {
      if (field.required) {
        const value = formData[field.name];
        if (field.type.toLowerCase() === 'checkbox') {
          if (value !== true && value !== 'true') {
            newErrors[field.name] = `${field.label} is required`;
          }
        } else {
          if (value === undefined || value === null || value === '' ||
            (typeof value === 'string' && value.trim() === '')) {
            newErrors[field.name] = `${field.label} is required`;
          }
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const renderField = (field) => {
    const value = formData[field.name] || '';
    const hasError = errors[field.name];

    switch (field.type.toLowerCase()) {
      case 'text':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="text"
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="number"
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value ? Number(e.target.value) : '')}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="date"
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="mb-3 form-check">
            <input
              type="checkbox"
              className={`form-check-input ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              checked={value === true || value === 'true'}
              onChange={(e) => handleChange(field.name, e.target.checked)}
            />
            <label htmlFor={field.name} className="form-check-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'select':
        let selectOptions = [];
        try {
          if (field.options) {
            selectOptions = JSON.parse(field.options);
          }
        } catch (e) {
          console.error("Failed to parse options for field", field.name, e);
        }

        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <select
              className={`form-select ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            >
              <option value="">-- Select an option --</option>
              {selectOptions.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'relation':
        const relationRecords = relationsData[field.name] || [];
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <select
              className={`form-select ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- Select {field.label} --</option>
              {relationRecords.map((rec) => {
                const displayName = rec.data.name || rec.data.title || rec.data.label ||
                  Object.values(rec.data).find(v => typeof v === 'string') ||
                  `Record #${rec.id}`;
                return (
                  <option key={rec.id} value={rec.id}>
                    {displayName} (ID: {rec.id})
                  </option>
                );
              })}
            </select>
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      default:
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="text"
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );
    }
  };

  // Sort fields by OrderNo
  const sortedFields = [...fields].sort((a, b) => a.orderNo - b.orderNo);

  return (
    <form onSubmit={handleSubmit}>
      {sortedFields.map(field => renderField(field))}
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary">
          <span>✓</span> {submitLabel}
        </button>
      </div>
    </form>
  );
}

export default DynamicForm;

