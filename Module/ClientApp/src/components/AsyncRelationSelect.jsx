import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecordsByName } from '../services/api';

function AsyncRelationSelect({
    moduleName,
    value,
    onChange,
    label,
    required,
    multiple,
    error
}) {
    const { t } = useTranslation();
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Initial load & search handlers
    useEffect(() => {
        const fetchOptions = async () => {
            setLoading(true);
            try {
                const data = await getRecordsByName(moduleName, {
                    search: searchTerm,
                    page: 1,
                    pageSize: 20
                });
                setOptions(data.items || []);
            } catch (err) {
                console.error('Failed to fetch relation options', err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchOptions();
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [moduleName, searchTerm]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (recordId) => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            const newValue = currentValues.includes(recordId)
                ? currentValues.filter(id => id !== recordId)
                : [...currentValues, recordId];
            onChange(newValue);
        } else {
            onChange(recordId);
            setIsOpen(false);
        }
    };

    const getDisplayValue = (record) => {
        if (record.data && record.data.__displayValue) {
            return record.data.__displayValue;
        }
        return record.data.name || record.data.title || record.data.label ||
            Object.values(record.data).find(v => typeof v === 'string') ||
            `Record #${record.id}`;
    };

    const selectedCount = multiple ? (Array.isArray(value) ? value.length : 0) : (value ? 1 : 0);

    return (
        <div className="mb-3" ref={wrapperRef}>
            <label className="form-label">
                {label}
                {required && <span className="text-danger"> *</span>}
            </label>

            <div className="dropdown w-100">
                <button
                    className={`form-select text-start ${error ? 'is-invalid' : ''}`}
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {selectedCount > 0
                        ? `${selectedCount} ${t('selected')}`
                        : t('select_option')}
                </button>

                <div className={`dropdown-menu w-100 p-2 ${isOpen ? 'show' : ''}`} style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <input
                        type="text"
                        className="form-control mb-2"
                        placeholder={t('search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />

                    {loading && <div className="text-center text-muted small py-2">{t('loading')}...</div>}

                    {!loading && options.length === 0 && (
                        <div className="text-center text-muted small py-2">{t('no_results')}</div>
                    )}

                    {!loading && options.map(option => {
                        const isSelected = multiple
                            ? (Array.isArray(value) && value.includes(option.id))
                            : value == option.id; // loose equality for string/number match

                        return (
                            <button
                                key={option.id}
                                className={`dropdown-item ${isSelected ? 'active' : ''}`}
                                type="button"
                                onClick={() => handleSelect(option.id)}
                            >
                                <div className="d-flex justify-content-between">
                                    <span>{getDisplayValue(option)}</span>
                                    <small className="text-muted ms-2">#{option.id}</small>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selected Items Tags (for visibility) */}
            {multiple && Array.isArray(value) && value.length > 0 && (
                <div className="mt-2 d-flex flex-wrap gap-1">
                    {value.map(v => (
                        <span key={v} className="badge bg-secondary">
                            ID: {v}
                            {/* Note: We might not have the display name if it wasn't in the loaded options. 
                          Ideally we'd fetch selected items specifically, but for Phase 1 this is acceptable. */}
                        </span>
                    ))}
                </div>
            )}

            {error && <div className="invalid-feedback d-block">{error}</div>}
            <div className="form-text small">{multiple ? t('multi_select_hint') : ''}</div>
        </div>
    );
}

export default AsyncRelationSelect;
