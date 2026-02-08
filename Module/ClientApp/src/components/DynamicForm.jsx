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
    // Determine if we need to handle multi-select (array) or single value
    const field = fields.find(f => f.name === fieldName);
    const isMultiSelect = field && (field.type.toLowerCase() === 'relation' || field.type.toLowerCase() === 'multiselect');

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
        } else if (field.type.toLowerCase() === 'relation' || field.type.toLowerCase() === 'multiselect') {
          if (!value || (Array.isArray(value) && value.length === 0)) {
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
      // Create a copy of the data and convert empty strings to null
      const sanitizedData = { ...formData };
      Object.keys(sanitizedData).forEach(key => {
        if (sanitizedData[key] === '') {
          sanitizedData[key] = null;
        }
      });
      onSubmit(sanitizedData);
    }
  };

  const renderField = (field) => {
    const value = formData[field.name] || (['relation', 'multiselect'].includes(field.type.toLowerCase()) ? [] : '');
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

      case 'datetime':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="datetime-local"
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
        // Handle multi-select value extraction
        const handleRelationChange = (e) => {
          const selectedOptions = Array.from(e.target.selectedOptions).map(opt => Number(opt.value));
          handleChange(field.name, selectedOptions);
        };

        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <select
              multiple
              className={`form-select ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={Array.isArray(value) ? value : (value ? [value] : [])}
              onChange={handleRelationChange}
              style={{ minHeight: '120px' }}
            >
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
            <div className="form-text small">Hold Ctrl (Cmd on Mac) to select multiple.</div>
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'textarea':
      case 'richtext':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <textarea
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              rows="4"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'email':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="email"
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'phone':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="tel"
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'currency':
      case 'percentage':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <input
              type="number"
              step={field.type.toLowerCase() === 'currency' ? '0.01' : '0.1'}
              className={`form-control ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value ? Number(e.target.value) : '')}
            />
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'file':
      case 'image':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <div className="input-group">
              <input
                type="file"
                className={`form-control ${hasError ? 'is-invalid' : ''}`}
                id={field.name}
                onChange={(e) => {
                  const fileName = e.target.files[0]?.name || '';
                  handleChange(field.name, fileName);
                }}
              />
            </div>
            {value && <div className="form-text mt-1 text-success small">Selected file: {value}</div>}
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'json':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <textarea
              className={`form-control ${hasError ? 'is-invalid' : ''} font-monospace`}
              id={field.name}
              rows="5"
              placeholder='{ "key": "value" }'
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
            <div className="form-text small">Enter valid JSON content.</div>
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

