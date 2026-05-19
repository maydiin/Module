import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getModules, getFields } from '../services/api';
import Icon from './Icon';

const RelationsSubGrid = ({
  fieldName,
  label,
  targetModule,
  value = [],
  onChange,
  required,
  error
}) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState(null);

  // 1. Fetch targeted sub-grid module schema dynamically
  useEffect(() => {
    const fetchSchema = async () => {
      setLoading(true);
      setSchemaError(null);
      try {
        const modules = await getModules();
        const matched = modules.find(
          (m) => m.name.toLowerCase() === targetModule.toLowerCase()
        );
        if (matched) {
          // Fetch target fields list directly
          const fieldsData = await getFields(matched.id);
          if (fieldsData && Array.isArray(fieldsData)) {
            // Exclude relations of the child to prevent infinitely deep recursion loops
            const renderableFields = fieldsData
              .filter((f) => f.type !== 'relations')
              .sort((a, b) => a.orderNo - b.orderNo);
            setFields(renderableFields);
          } else {
            setSchemaError(`Failed to load fields for module "${targetModule}".`);
          }
        } else {
          setSchemaError(`Target module "${targetModule}" not found.`);
        }
      } catch (err) {
        console.error('Failed to load sub-grid schema for: ' + targetModule, err);
        setSchemaError(t('error_occurred') || 'Failed to load module schema.');
      } finally {
        setLoading(false);
      }
    };

    if (targetModule) {
      fetchSchema();
    }
  }, [targetModule, t]);

  // 2. Add new empty row with default values mapped by field schemas
  const handleAddRow = () => {
    const newRow = { id: 0 };
    fields.forEach((f) => {
      if (f.type === 'boolean') {
        newRow[f.name] = false;
      } else {
        newRow[f.name] = '';
      }
    });
    onChange([...value, newRow]);
  };

  // 3. Delete row
  const handleDeleteRow = (indexToDelete) => {
    const updated = value.filter((_, idx) => idx !== indexToDelete);
    onChange(updated);
  };

  // 4. Update cell
  const handleCellChange = (rowIndex, fieldName, cellValue) => {
    const updated = value.map((row, idx) => {
      if (idx === rowIndex) {
        return { ...row, [fieldName]: cellValue };
      }
      return row;
    });
    onChange(updated);
  };

  // 5. Render individual input cell based on type
  const renderCellInput = (rowIndex, field, rowData) => {
    const cellVal = rowData[field.name] !== undefined ? rowData[field.name] : '';

    switch (field.type) {
      case 'boolean':
        return (
          <div className="form-check form-switch d-flex justify-content-center m-0">
            <input
              type="checkbox"
              className="form-check-input"
              checked={!!cellVal}
              onChange={(e) => handleCellChange(rowIndex, field.name, e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
          </div>
        );

      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <input
            type="number"
            className="form-control form-control-sm px-2 py-1"
            value={cellVal}
            onChange={(e) => {
              const val = e.target.value;
              handleCellChange(rowIndex, field.name, val === '' ? '' : Number(val));
            }}
            placeholder="0"
            style={{ minWidth: '80px' }}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            className="form-control form-control-sm px-2 py-1"
            value={cellVal ? cellVal.split('T')[0] : ''}
            onChange={(e) => handleCellChange(rowIndex, field.name, e.target.value)}
            style={{ minWidth: '120px' }}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            className="form-control form-control-sm px-2 py-1"
            value={cellVal ? cellVal.replace('Z', '') : ''}
            onChange={(e) => handleCellChange(rowIndex, field.name, e.target.value)}
            style={{ minWidth: '160px' }}
          />
        );

      case 'select':
      case 'status':
        const selectOptions = field.options
          ? field.options.split(',').map((o) => o.trim().replace(/['"]+/g, ''))
          : [];
        return (
          <select
            className="form-select form-select-sm px-2 py-1"
            value={cellVal}
            onChange={(e) => handleCellChange(rowIndex, field.name, e.target.value)}
            style={{ minWidth: '100px', cursor: 'pointer' }}
          >
            <option value="">--</option>
            {selectOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            className="form-control form-control-sm px-2 py-1"
            value={cellVal}
            onChange={(e) => handleCellChange(rowIndex, field.name, e.target.value)}
            placeholder="..."
            style={{ minWidth: '120px' }}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="card border-secondary bg-dark-deep mb-4 p-4 text-center">
        <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
        <span className="text-muted">{t('loading') || 'Loading schema...'}</span>
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="alert alert-danger border-0 shadow-sm d-flex align-items-center mb-4">
        <Icon name="alert" size={20} className="me-2" />
        <span>{schemaError}</span>
      </div>
    );
  }

  return (
    <div className="card border-0 bg-dark-deep mb-4 shadow-lg overflow-hidden relations-sub-grid">
      {/* Subgrid Header */}
      <div className="card-header bg-dark-gradient border-0 px-4 py-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <Icon name="list" className="text-primary me-2" size={20} />
          <h5 className="m-0 font-weight-bold text-white-85">
            {label}
            {required && <span className="text-danger ms-1">*</span>}
          </h5>
          <span className="badge bg-primary-transparent text-primary ms-3 px-2 py-1" style={{ fontSize: '0.75rem' }}>
            {value.length} {t('records') || 'Kayıt'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary-gradient px-3 py-1-5 d-flex align-items-center gap-1 shadow-sm transition-all hover-scale"
          onClick={handleAddRow}
        >
          <Icon name="plus" size={16} />
          <span>{t('add') || 'Ekle'}</span>
        </button>
      </div>

      {/* Subgrid Table Area */}
      <div className="card-body p-0 overflow-auto" style={{ maxHeight: '400px' }}>
        {value.length === 0 ? (
          <div className="text-center text-muted py-5">
            <Icon name="folderOpen" size={40} className="mb-2 text-muted-30" />
            <p className="m-0 small">{t('no_records_found') || 'Henüz hiç satır eklenmedi.'}</p>
          </div>
        ) : (
          <table className="table table-dark table-hover m-0 align-middle subgrid-table">
            <thead>
              <tr className="bg-dark-gradient text-muted-85 border-bottom border-secondary-transparent" style={{ fontSize: '0.85rem' }}>
                <th className="px-3 py-2 text-center" style={{ width: '50px' }}>#</th>
                {fields.map((field) => (
                  <th key={field.name} className="px-3 py-2">
                    {field.label}
                    {field.required && <span className="text-danger ms-1">*</span>}
                  </th>
                ))}
                <th className="px-3 py-2 text-center" style={{ width: '70px' }}>{t('actions') || 'İşlemler'}</th>
              </tr>
            </thead>
            <tbody>
              {value.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-bottom border-secondary-transparent hover-highlight">
                  <td className="px-3 py-2 text-center text-muted font-weight-bold" style={{ fontSize: '0.85rem' }}>
                    {rowIndex + 1}
                  </td>
                  {fields.map((field) => (
                    <td key={field.name} className="p-1 cell-editable">
                      <div className="cell-input-wrapper">
                        {renderCellInput(rowIndex, field, row)}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      className="btn btn-link text-danger p-1 hover-scale transition-all"
                      onClick={() => handleDeleteRow(rowIndex)}
                      title={t('delete') || 'Sil'}
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {error && (
        <div className="card-footer bg-danger-transparent border-0 px-4 py-2 d-flex align-items-center text-danger small">
          <Icon name="alert" size={16} className="me-1" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default RelationsSubGrid;
