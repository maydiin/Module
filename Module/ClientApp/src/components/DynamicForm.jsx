import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadFile } from '../services/api';
import AsyncRelationSelect from './AsyncRelationSelect';
import { useToast } from './ToastContext';
import Icon from './Icon';

function DynamicForm({ fields, layoutConfig, initialData = {}, onSubmit, submitLabel }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState({});
  const [activeTabId, setActiveTabId] = useState('');
  const [visibleFields, setVisibleFields] = useState({});

  // Parse layout config safely
  let config = null;
  if (layoutConfig) {
    try {
      config = typeof layoutConfig === 'string' ? JSON.parse(layoutConfig) : layoutConfig;
    } catch (e) {
      console.error("Failed to parse layoutConfig", e);
    }
  }

  // Set active tab initially
  useEffect(() => {
    if (config && config.tabs && config.tabs.length > 0) {
      setActiveTabId(config.tabs[0].id);
    } else {
      setActiveTabId('');
    }
  }, [layoutConfig]);

  // Initialize form data with initial values or empty values
  useEffect(() => {
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
  }, [fields, initialData]);

  // Reactive evaluation of client-side visibility rules
  useEffect(() => {
    const map = {};
    fields.forEach(f => {
      map[f.name] = true;
    });

    if (config && config.visibilityRules && config.visibilityRules.length > 0) {
      config.visibilityRules.forEach(rule => {
        const { sourceField, operator, value: triggerValue, targetField, action } = rule;
        if (!sourceField || !targetField) return;

        const sourceVal = formData[sourceField];
        let conditionMet = false;

        switch (operator) {
          case 'eq':
            conditionMet = String(sourceVal ?? '') === String(triggerValue ?? '');
            break;
          case 'neq':
            conditionMet = String(sourceVal ?? '') !== String(triggerValue ?? '');
            break;
          case 'contains':
            conditionMet = String(sourceVal ?? '').toLowerCase().includes(String(triggerValue ?? '').toLowerCase());
            break;
          case 'gt':
            conditionMet = Number(sourceVal) > Number(triggerValue);
            break;
          case 'lt':
            conditionMet = Number(sourceVal) < Number(triggerValue);
            break;
          default:
            conditionMet = false;
        }

        if (action === 'show') {
          map[targetField] = conditionMet;
        } else if (action === 'hide') {
          map[targetField] = !conditionMet;
        }
      });
    }
    setVisibleFields(map);
  }, [formData, fields, layoutConfig]);

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
      // Skip validation if the field is not currently visible
      if (visibleFields[field.name] === false) {
        return;
      }

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
    if (Object.values(uploading).some(isUp => isUp)) {
      showToast(t('please_wait_upload_finishes') || 'Please wait for file upload to finish.', 'warning');
      return;
    }
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
          <div key={field.id} className="mb-3 form-check form-switch p-3 ps-5 rounded bg-surface bg-opacity-30 border border-theme-accent shadow-sm">
            <input
              type="checkbox"
              className={`form-check-input ms-0 ${hasError ? 'is-invalid' : ''}`}
              id={field.name}
              checked={value === true || value === 'true'}
              onChange={(e) => handleChange(field.name, e.target.checked)}
              style={{ float: 'none', marginRight: '15px' }}
            />
            <label htmlFor={field.name} className="form-check-label small fw-bold text-foreground text-uppercase tracking-wide">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            {hasError && <div className="invalid-feedback d-block">{errors[field.name]}</div>}
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
        const targetModule = field.options ? field.options.replace(/['"]+/g, '') : '';

        return (
          <AsyncRelationSelect
            key={field.id}
            moduleName={targetModule}
            label={field.label}
            required={field.required}
            multiple={true}
            value={value}
            onChange={(val) => handleChange(field.name, val)}
            error={errors[field.name]}
          />
        );

      case 'textarea':
      case 'richtext':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            <div className="input-group">
              <input
                type="file"
                className={`form-control ${hasError ? 'is-invalid' : ''}`}
                id={field.name}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) {
                    handleChange(field.name, '');
                    return;
                  }
                  
                  try {
                    setUploading(prev => ({ ...prev, [field.name]: true }));
                    const response = await uploadFile(file);
                    handleChange(field.name, response.url);
                  } catch (err) {
                    console.error('File upload failed', err);
                    setErrors(prev => ({ ...prev, [field.name]: t('upload_failed') || 'Upload failed' }));
                  } finally {
                    setUploading(prev => ({ ...prev, [field.name]: false }));
                  }
                }}
                disabled={uploading[field.name]}
              />
              {uploading[field.name] && (
                <span className="input-group-text bg-white">
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                </span>
              )}
            </div>
            {value && <div className="form-text mt-1 text-success small text-truncate">{t('selected_file')}: {value}</div>}
            {hasError && <div className="invalid-feedback">{errors[field.name]}</div>}
          </div>
        );

      case 'json':
        return (
          <div key={field.id} className="mb-3">
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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
            <label htmlFor={field.name} className="form-label small fw-bold text-muted text-uppercase tracking-wide">
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

  const getGridColsClass = (gridCols) => {
    switch (parseInt(gridCols)) {
      case 2:
        return 'col-md-6 col-12';
      case 3:
        return 'col-md-4 col-12';
      case 4:
        return 'col-md-3 col-12';
      default:
        return 'col-12';
    }
  };

  // Sort fields by OrderNo for sequential fallback
  const sortedFields = [...fields].sort((a, b) => a.orderNo - b.orderNo);

  // Compute placed vs unplaced fields
  const placedFieldNames = new Set();
  if (config && config.tabs) {
    config.tabs.forEach(tab => {
      if (tab.sections) {
        tab.sections.forEach(sec => {
          if (sec.fields) {
            sec.fields.forEach(fName => placedFieldNames.add(fName));
          }
        });
      }
    });
  }

  const unplacedFields = fields.filter(f => !placedFieldNames.has(f.name));

  return (
    <form onSubmit={handleSubmit} className="needs-validation">
      {/* Tabs Menu */}
      {config && config.tabs && config.tabs.length > 0 && (
        <div className="mb-4">
          <ul className="nav nav-pills gap-2 p-2 bg-surface bg-opacity-50 border border-theme-accent rounded-premium stagger-in" style={{ borderRadius: '16px' }}>
            {config.tabs.map(tab => (
              <li className="nav-item" key={tab.id}>
                <button
                  type="button"
                  className={`nav-link px-4 py-2 border-0 fw-bold transition-all hover-lift ${activeTabId === tab.id ? 'active bg-primary text-white shadow-premium' : 'text-foreground opacity-70'}`}
                  onClick={() => setActiveTabId(tab.id)}
                  style={{ borderRadius: '12px' }}
                >
                  {tab.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs Content */}
      {config && config.tabs && config.tabs.length > 0 ? (
        <div className="tab-content stagger-in">
          {config.tabs.map(tab => {
            if (tab.id !== activeTabId) return null;
            return (
              <div key={tab.id} className="fade-in">
                {tab.sections && tab.sections.map(section => (
                  <div key={section.id} className="glass-card p-4 border-0 mb-4 stagger-in" style={{ borderRadius: '18px' }}>
                    {section.title && (
                      <h5 className="fw-800 text-uppercase tracking-wider text-muted small border-bottom pb-2 mb-3">
                        {section.title}
                      </h5>
                    )}
                    <div className="row g-3">
                      {section.fields && section.fields.map(fieldName => {
                        const field = fields.find(f => f.name === fieldName);
                        if (!field || visibleFields[field.name] === false) return null;
                        return (
                          <div className={getGridColsClass(section.gridCols || 1)} key={field.id}>
                            {renderField(field)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Unplaced fields / Default sequential rendering */}
      {(!config || unplacedFields.length > 0) && (
        <div className="glass-card p-4 border-0 mb-4 stagger-in fade-in" style={{ borderRadius: '18px' }}>
          {config && unplacedFields.length > 0 && (
            <h5 className="fw-800 text-uppercase tracking-wider text-muted small border-bottom pb-2 mb-3">
              {t('additional_details') || 'Additional Details'}
            </h5>
          )}
          <div className="row g-3">
            {(config ? unplacedFields : sortedFields).map(field => {
              if (visibleFields[field.name] === false) return null;
              return (
                <div className="col-12" key={field.id}>
                  {renderField(field)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="d-flex gap-2 mt-4 pt-3 border-top border-theme-accent">
        <button type="submit" className="btn btn-primary px-4 py-2 fw-bold shadow-premium hover-lift d-flex align-items-center gap-2">
          <span>✓</span> {submitLabel || t('submit')}
        </button>
      </div>
    </form>
  );
}

export default DynamicForm;
