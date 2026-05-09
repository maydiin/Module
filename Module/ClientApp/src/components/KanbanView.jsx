import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

function KanbanView({ fields, records, onRecordUpdate, onRecordClick, groupByField }) {
  const { t } = useTranslation();
  const [columns, setColumns] = useState([]);
  const [draggedRecord, setDraggedRecord] = useState(null);

  const groupFieldMeta = fields.find(f => f.name === groupByField);
  
  useEffect(() => {
    if (!groupFieldMeta) {
      setColumns([]);
      return;
    }

    let options = [];
    if (groupFieldMeta.type === 'select') {
      try {
        options = JSON.parse(groupFieldMeta.options || '[]');
      } catch (e) {
        options = [];
      }
    } else if (groupFieldMeta.type === 'checkbox') {
      options = ['true', 'false'];
    }

    const cols = options.map(opt => ({
      id: opt,
      title: opt === 'true' ? t('yes') : opt === 'false' ? t('no') : opt,
      records: records.filter(r => String(r.data[groupByField]) === String(opt))
    }));

    // Add an "Other" column for records with missing or different values
    const otherRecords = records.filter(r => !options.map(String).includes(String(r.data[groupByField] || '')));
    if (otherRecords.length > 0) {
      cols.push({
        id: '__other',
        title: t('other') || 'Other',
        records: otherRecords
      });
    }

    setColumns(cols);
  }, [groupFieldMeta, records, groupByField, t]);

  const onDragStart = (record) => {
    setDraggedRecord(record);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = async (columnId) => {
    if (!draggedRecord || columnId === '__other') return;

    const newValue = groupFieldMeta.type === 'checkbox' ? (columnId === 'true') : columnId;
    
    if (String(draggedRecord.data[groupByField]) === String(newValue)) return;

    const updatedData = { ...draggedRecord.data, [groupByField]: newValue };
    
    // Optimistic UI update
    const updatedRecords = records.map(r => 
      r.id === draggedRecord.id ? { ...r, data: updatedData } : r
    );
    
    onRecordUpdate(draggedRecord.id, updatedData);
    setDraggedRecord(null);
  };

  if (!groupFieldMeta) {
    return (
      <div className="alert alert-info shadow-sm">
        <Icon name="info" size={20} className="me-2" />
        {t('kanban_select_field_hint') || 'Please select a grouping field to view the Kanban board.'}
      </div>
    );
  }

  return (
    <div className="kanban-container d-flex gap-3 overflow-auto pb-3" style={{ minHeight: '600px' }}>
      {columns.map(column => (
        <div 
          key={column.id} 
          className="kanban-column bg-surface bg-opacity-40 rounded-4 p-3 d-flex flex-column" 
          style={{ minWidth: '300px', maxWidth: '300px', border: '1px solid rgba(255,255,255,0.05)' }}
          onDragOver={onDragOver}
          onDrop={() => onDrop(column.id)}
        >
          <div className="d-flex justify-content-between align-items-center mb-3 px-1">
            <h6 className="mb-0 fw-800 text-uppercase tracking-wider opacity-60" style={{ fontSize: '0.75rem' }}>
              {column.title}
              <span className="badge badge-soft-primary ms-2 rounded-pill">{column.records.length}</span>
            </h6>
          </div>
          
          <div className="kanban-cards d-flex flex-column gap-3 flex-grow-1">
            {column.records.map(record => (
              <div
                key={record.id}
                draggable
                onDragStart={() => onDragStart(record)}
                className="kanban-card glass-card p-3 shadow-sm hover-lift cursor-pointer transition-all border-theme-accent"
                onClick={() => onRecordClick(record)}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="badge bg-secondary-soft text-muted x-small">#{record.id}</span>
                  <small className="text-muted opacity-50" style={{ fontSize: '0.65rem' }}>
                    {new Date(record.createdAt).toLocaleDateString()}
                  </small>
                </div>
                
                {/* Render display fields */}
                <div className="kanban-card-content">
                  {fields.filter(f => f.isDisplayField).map(f => (
                    <div key={f.id} className="mb-1">
                      <div className="text-muted x-small fw-bold text-uppercase opacity-40">{f.label}</div>
                      <div className="fw-medium text-truncate" style={{ fontSize: '0.85rem' }}>
                        {record.data[`__display_${f.name}`] || String(record.data[f.name] || '-')}
                      </div>
                    </div>
                  ))}
                  
                  {/* If no display fields, show first 2 fields */}
                  {fields.filter(f => f.isDisplayField).length === 0 && fields.slice(0, 2).map(f => (
                    <div key={f.id} className="mb-1">
                      <div className="text-muted x-small fw-bold text-uppercase opacity-40">{f.label}</div>
                      <div className="fw-medium text-truncate" style={{ fontSize: '0.85rem' }}>
                        {record.data[`__display_${f.name}`] || String(record.data[f.name] || '-')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {column.records.length === 0 && (
              <div className="text-center py-4 opacity-20 dashed-border rounded-3">
                <Icon name="plus" size={20} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default KanbanView;
