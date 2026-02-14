import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecordsByName } from '../services/api';
import AsyncRelationSelect from './AsyncRelationSelect';

function DynamicForm({ fields, initialData = {}, onSubmit, submitLabel }) {
  const { t } = useTranslation();
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

    // Old fetchRelations logic removed for performance
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
            newErrors[field.name] = `${field.label} ${t('field_required')}`;
          }
        } else if (field.type.toLowerCase() === 'relation' || field.type.toLowerCase() === 'multiselect') {
          if (!value || (Array.isArray(value) && value.length === 0)) {
            newErrors[field.name] = `${field.label} ${t('field_required')}`;
          }
        } else {
          if (value === undefined || value === null || value === '' ||
            (typeof value === 'string' && value.trim() === '')) {
            newErrors[field.name] = `${field.label} ${t('field_required')}`;
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
              <option value="">{t('select_option')}</option>
              {selectOptions.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'relation':
        // Normalize module name
        const targetModule = field.options ? field.options.replace(/['"]+/g, '') : '';

        return (
          <AsyncRelationSelect
            key={field.id}
            moduleName={targetModule}
            label={field.label}
            required={field.required}
            multiple={true} // Relations are usually multi-select in this system based on usage
            value={value}
            onChange={(val) => handleChange(field.name, val)}
            error={errors[field.name]}
          />
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
            {value && <div className="form-text mt-1 text-success small">{t('selected_file')}: {value}</div>}
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
            <div className="form-text small">{t('valid_json_hint')}</div>
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'formula':
        const rawValue = formData[field.name];
        const displayValue = (rawValue !== undefined && rawValue !== null && rawValue !== '')
          ? rawValue
          : t('calculated_automatically');

        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label">
              {field.label}
            </label>
            <input
              type="text"
              className="form-control bg-light"
              id={field.name}
              value={displayValue}
              disabled
              readOnly
            />
            <div className="form-text text-muted">{t('formula_field_hint')}</div>
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
          <span>✓</span> {submitLabel || t('submit')}
        </button>
      </div>
    </form>
  );
}

export default DynamicForm;

