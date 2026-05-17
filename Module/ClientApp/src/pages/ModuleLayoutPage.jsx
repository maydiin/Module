import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getFields, updateModule } from '../services/api';
import { useToast } from '../components/ToastContext';
import Icon from '../components/Icon';

function ModuleLayoutPage() {
  const { t } = useTranslation();
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [module, setModule] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState('layout'); // 'layout' or 'rules'

  // Form Layout State
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [visibilityRules, setVisibilityRules] = useState([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [moduleData, fieldsData] = await Promise.all([
        getModule(moduleId),
        getFields(moduleId)
      ]);
      setModule(moduleData);
      setFields(fieldsData || []);

      // Initialize layout from config
      if (moduleData.layoutConfig) {
        try {
          const config = typeof moduleData.layoutConfig === 'string' 
            ? JSON.parse(moduleData.layoutConfig) 
            : moduleData.layoutConfig;
          
          setTabs(config.tabs || []);
          setVisibilityRules(config.visibilityRules || []);
          if (config.tabs && config.tabs.length > 0) {
            setActiveTabId(config.tabs[0].id);
          }
        } catch (e) {
          console.error("Failed to parse layout config", e);
          initializeDefaultLayout(fieldsData);
        }
      } else {
        initializeDefaultLayout(fieldsData);
      }
    } catch (err) {
      console.error(err);
      showToast(t('error_loading_layout') || 'Error loading layout settings.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultLayout = (fieldsList) => {
    const defaultTabId = 'tab-' + Math.random().toString(36).substr(2, 9);
    const defaultSectionId = 'sec-' + Math.random().toString(36).substr(2, 9);
    
    // Sort fields by orderNo
    const sortedFields = [...fieldsList].sort((a, b) => a.orderNo - b.orderNo);
    const fieldNames = sortedFields.map(f => f.name);

    setTabs([
      {
        id: defaultTabId,
        title: t('general') || 'General',
        sections: [
          {
            id: defaultSectionId,
            title: t('primary_details') || 'Primary Details',
            gridCols: 1,
            fields: fieldNames
          }
        ]
      }
    ]);
    setActiveTabId(defaultTabId);
    setVisibilityRules([]);
  };

  // Helper to calculate unplaced fields
  const getPlacedFieldNames = () => {
    const names = new Set();
    tabs.forEach(tab => {
      if (tab.sections) {
        tab.sections.forEach(sec => {
          if (sec.fields) {
            sec.fields.forEach(f => names.add(f));
          }
        });
      }
    });
    return names;
  };

  const placedFieldNames = getPlacedFieldNames();
  const unplacedFields = fields.filter(f => !placedFieldNames.has(f.name));

  // Tabs Management
  const addTab = () => {
    const newId = 'tab-' + Math.random().toString(36).substr(2, 9);
    const newTab = {
      id: newId,
      title: `${t('tab') || 'Tab'} ${tabs.length + 1}`,
      sections: []
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const renameTab = (tabId, newTitle) => {
    if (!newTitle.trim()) return;
    setTabs(tabs.map(t => t.id === tabId ? { ...t, title: newTitle } : t));
  };

  const deleteTab = (tabId) => {
    if (tabs.length <= 1) {
      showToast(t('cannot_delete_last_tab') || 'You must have at least one tab.', 'warning');
      return;
    }
    const index = tabs.findIndex(t => t.id === tabId);
    const updatedTabs = tabs.filter(t => t.id !== tabId);
    setTabs(updatedTabs);
    
    // Set active tab to another tab
    if (activeTabId === tabId) {
      setActiveTabId(updatedTabs[Math.max(0, index - 1)].id);
    }
  };

  // Sections Management
  const addSection = (tabId) => {
    const newId = 'sec-' + Math.random().toString(36).substr(2, 9);
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: [
          ...(tab.sections || []),
          {
            id: newId,
            title: `${t('section') || 'Section'} ${(tab.sections || []).length + 1}`,
            gridCols: 1,
            fields: []
          }
        ]
      };
    }));
  };

  const renameSection = (tabId, secId, newTitle) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: tab.sections.map(s => s.id === secId ? { ...s, title: newTitle } : s)
      };
    }));
  };

  const changeSectionGrid = (tabId, secId, cols) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: tab.sections.map(s => s.id === secId ? { ...s, gridCols: parseInt(cols) } : s)
      };
    }));
  };

  const deleteSection = (tabId, secId) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: tab.sections.filter(s => s.id !== secId)
      };
    }));
  };

  const moveSection = (tabId, secId, direction) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      const secs = [...tab.sections];
      const index = secs.findIndex(s => s.id === secId);
      if (index === -1) return tab;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= secs.length) return tab;

      // Swap
      const temp = secs[index];
      secs[index] = secs[newIndex];
      secs[newIndex] = temp;

      return { ...tab, sections: secs };
    }));
  };

  // Field Placement Management
  const addFieldToSection = (tabId, secId, fieldName) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: tab.sections.map(s => {
          if (s.id !== secId) return s;
          if (s.fields.includes(fieldName)) return s;
          return {
            ...s,
            fields: [...s.fields, fieldName]
          };
        })
      };
    }));
  };

  const removeFieldFromSection = (tabId, secId, fieldName) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: tab.sections.map(s => {
          if (s.id !== secId) return s;
          return {
            ...s,
            fields: s.fields.filter(f => f !== fieldName)
          };
        })
      };
    }));
  };

  const moveFieldInSection = (tabId, secId, fieldName, direction) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        sections: tab.sections.map(s => {
          if (s.id !== secId) return s;
          const fieldsList = [...s.fields];
          const index = fieldsList.indexOf(fieldName);
          if (index === -1) return s;

          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= fieldsList.length) return s;

          // Swap
          const temp = fieldsList[index];
          fieldsList[index] = fieldsList[newIndex];
          fieldsList[newIndex] = temp;

          return { ...s, fields: fieldsList };
        })
      };
    }));
  };

  // Visibility Rules Management
  const addVisibilityRule = () => {
    const newRule = {
      id: 'rule-' + Math.random().toString(36).substr(2, 9),
      sourceField: '',
      operator: 'eq',
      value: '',
      targetField: '',
      action: 'show'
    };
    setVisibilityRules([...visibilityRules, newRule]);
  };

  const updateRule = (ruleId, key, value) => {
    setVisibilityRules(visibilityRules.map(r => r.id === ruleId ? { ...r, [key]: value } : r));
  };

  const deleteRule = (ruleId) => {
    setVisibilityRules(visibilityRules.filter(r => r.id !== ruleId));
  };

  // Save Config
  const handleSave = async () => {
    if (!module) return;

    try {
      setSaving(true);
      const newLayoutConfig = {
        tabs,
        visibilityRules
      };

      const updatedModule = {
        name: module.name,
        auditCreate: module.auditCreate,
        auditUpdate: module.auditUpdate,
        auditDelete: module.auditDelete,
        kanbanField: module.kanbanField,
        layoutConfig: JSON.stringify(newLayoutConfig)
      };

      await updateModule(moduleId, updatedModule);
      showToast(t('layout_saved_success') || 'Form layout settings saved successfully.', 'success');
      navigate(`/modules/${moduleId}/fields`);
    } catch (err) {
      console.error(err);
      showToast(t('error_saving_layout') || 'Failed to save form layout settings.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Reset Config
  const handleReset = () => {
    if (window.confirm(t('confirm_reset_layout') || 'Are you sure you want to reset layout config back to sequential default?')) {
      initializeDefaultLayout(fields);
      showToast(t('layout_reset_success') || 'Reset layout to default state. Hit Save to apply changes.', 'info');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-2 text-muted">{t('loading')}</p>
      </div>
    );
  }

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="fade-in pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <button
            className="btn btn-link mb-2 p-0 text-decoration-none text-primary d-flex align-items-center gap-2"
            onClick={() => navigate(`/modules/${moduleId}/fields`)}
          >
            <Icon name="arrowLeft" size={20} /> {t('back_to_fields') || 'Back to Fields'}
          </button>
          <h1 className="display-6 mb-1 d-flex align-items-center gap-3">
            <div className="text-primary me-2 d-flex align-items-center justify-content-center">
              <Icon name="dashboard" size={32} className="icon-theme" />
            </div>
            {t('form_layout_designer') || 'Form Layout Designer'}
          </h1>
          <p className="text-muted mb-0">{module?.name} {t('module')}</p>
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-blur bg-surface bg-opacity-40 border-theme-accent shadow-sm hover-lift fw-bold text-muted"
            onClick={handleReset}
          >
            <Icon name="trash" size={20} className="me-2" /> {t('reset_to_default') || 'Reset Layout'}
          </button>
          <button
            type="button"
            className="btn btn-primary px-4 shadow-premium hover-lift fw-bold d-flex align-items-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <span className="spinner-border spinner-border-sm" role="status" />
            ) : (
              <><Icon name="check" size={20} /> {t('save_layout') || 'Save Layout'}</>
            )}
          </button>
        </div>
      </div>

      {/* Main Mode Tabs Selector */}
      <div className="mb-4">
        <ul className="nav nav-tabs gap-2 border-bottom border-theme-accent stagger-in">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link border-0 fw-800 text-uppercase tracking-wider pb-3 transition-all ${activeViewTab === 'layout' ? 'active border-bottom border-3 border-primary text-primary' : 'text-muted'}`}
              onClick={() => setActiveViewTab('layout')}
            >
              <Icon name="dashboard" size={18} className="me-2" />
              {t('grid_and_tabs_designer') || 'Grid & Tabs Designer'}
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link border-0 fw-800 text-uppercase tracking-wider pb-3 transition-all ${activeViewTab === 'rules' ? 'active border-bottom border-3 border-primary text-primary' : 'text-muted'}`}
              onClick={() => setActiveViewTab('rules')}
            >
              <Icon name="settings" size={18} className="me-2" />
              {t('ui_visibility_rules') || 'UI Visibility Rules'}
            </button>
          </li>
        </ul>
      </div>

      {activeViewTab === 'layout' ? (
        <div className="row g-4">
          {/* Main Visual Layout Builder (Left & Center Columns Combined) */}
          <div className="col-lg-8">
            {/* Tabs Controller */}
            <div className="glass-card p-4 border-0 mb-4 shadow-premium" style={{ borderRadius: '20px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-800 text-uppercase text-muted small tracking-wider mb-0">
                  {t('tabs') || 'Tabs'}
                </h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary px-3 rounded-pill hover-lift fw-bold"
                  onClick={addTab}
                >
                  + {t('add_tab') || 'Add Tab'}
                </button>
              </div>

              {/* Tab Navigation list */}
              <div className="d-flex flex-wrap gap-2 p-2 bg-surface bg-opacity-30 border border-theme-accent rounded-premium">
                {tabs.map((tab, idx) => (
                  <div
                    key={tab.id}
                    className={`d-flex align-items-center gap-2 px-3 py-2 rounded-premium transition-all ${activeTabId === tab.id ? 'bg-primary text-white shadow-premium' : 'bg-transparent text-foreground hover-bg-surface'}`}
                    style={{ cursor: 'pointer', borderRadius: '12px' }}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <input
                      type="text"
                      className={`border-0 bg-transparent fw-bold text-center ${activeTabId === tab.id ? 'text-white' : 'text-foreground'}`}
                      value={tab.title}
                      style={{ outline: 'none', width: '90px', fontSize: '0.9rem' }}
                      onChange={(e) => renameTab(tab.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className={`btn btn-sm p-0 border-0 ${activeTabId === tab.id ? 'text-white' : 'text-muted'} hover-text-danger`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTab(tab.id);
                      }}
                      title={t('delete') || 'Delete'}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections of Active Tab */}
            {activeTab ? (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fw-bold text-foreground mb-0">
                    {activeTab.title} — {t('sections') || 'Sections'}
                  </h4>
                  <button
                    type="button"
                    className="btn btn-primary px-3 shadow-premium hover-lift fw-bold"
                    onClick={() => addSection(activeTab.id)}
                  >
                    + {t('add_section') || 'Add Section'}
                  </button>
                </div>

                {(!activeTab.sections || activeTab.sections.length === 0) ? (
                  <div className="glass-card p-5 text-center text-muted" style={{ borderRadius: '20px' }}>
                    <Icon name="plus" size={32} className="mb-2 text-primary opacity-50" />
                    <p className="mb-0">{t('no_sections_tab_desc') || 'No sections added in this tab. Click "Add Section" to create one.'}</p>
                  </div>
                ) : (
                  activeTab.sections.map((section, secIdx) => (
                    <div
                      key={section.id}
                      className="glass-card p-4 border-0 mb-4 shadow-sm fade-in hover-shadow-premium transition-all"
                      style={{ borderRadius: '20px' }}
                    >
                      {/* Section Header Controls */}
                      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-bottom border-theme-accent pb-3 mb-4">
                        <div className="d-flex align-items-center gap-2">
                          <Icon name="records" size={18} className="text-primary opacity-70" />
                          <input
                            type="text"
                            className="form-control border-0 bg-transparent fw-800 text-foreground text-uppercase"
                            value={section.title}
                            style={{ fontSize: '1rem', width: '200px', padding: '0 4px', fontWeight: 'bold' }}
                            onChange={(e) => renameSection(activeTab.id, section.id, e.target.value)}
                          />
                        </div>

                        <div className="d-flex align-items-center gap-3 flex-wrap">
                          {/* Grid Selection */}
                          <div className="d-flex align-items-center gap-2">
                            <span className="small text-muted fw-bold">{t('columns') || 'Columns'}:</span>
                            <select
                              className="form-select form-select-sm border-theme-accent"
                              style={{ width: '80px', borderRadius: '8px' }}
                              value={section.gridCols || 1}
                              onChange={(e) => changeSectionGrid(activeTab.id, section.id, e.target.value)}
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                            </select>
                          </div>

                          {/* Quick Actions (Move Up / Down, Delete) */}
                          <div className="btn-group shadow-sm" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-blur bg-surface border-theme-accent text-foreground hover-bg-surface"
                              disabled={secIdx === 0}
                              onClick={() => moveSection(activeTab.id, section.id, 'up')}
                              title={t('move_up') || 'Move Up'}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-blur bg-surface border-theme-accent text-foreground hover-bg-surface"
                              disabled={secIdx === activeTab.sections.length - 1}
                              onClick={() => moveSection(activeTab.id, section.id, 'down')}
                              title={t('move_down') || 'Move Down'}
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger border-theme-accent"
                              onClick={() => deleteSection(activeTab.id, section.id)}
                              title={t('delete') || 'Delete'}
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Section Content Fields */}
                      <div className="row g-2">
                        {(!section.fields || section.fields.length === 0) ? (
                          <div className="col-12 py-3 text-center text-muted small bg-surface bg-opacity-20 rounded border border-dashed">
                            {t('no_fields_placed_desc') || 'No fields inside this section. Click unplaced fields to add them.'}
                          </div>
                        ) : (
                          section.fields.map((fName, fieldIdx) => {
                            const field = fields.find(f => f.name === fName);
                            if (!field) return null;
                            return (
                              <div key={fName} className="col-md-6 col-12">
                                <div className="d-flex justify-content-between align-items-center p-3 rounded bg-surface bg-opacity-40 border shadow-sm hover-lift">
                                  <div>
                                    <div className="fw-bold text-foreground small">{field.label}</div>
                                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                      {field.name} • <span className="text-primary">{field.type}</span>
                                    </div>
                                  </div>
                                  <div className="d-flex align-items-center gap-2">
                                    <div className="btn-group btn-group-sm">
                                      <button
                                        type="button"
                                        className="btn btn-light"
                                        disabled={fieldIdx === 0}
                                        onClick={() => moveFieldInSection(activeTab.id, section.id, fName, 'up')}
                                      >
                                        ◀
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-light"
                                        disabled={fieldIdx === section.fields.length - 1}
                                        onClick={() => moveFieldInSection(activeTab.id, section.id, fName, 'down')}
                                      >
                                        ▶
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger border-0 p-1"
                                      onClick={() => removeFieldFromSection(activeTab.id, section.id, fName)}
                                      title={t('remove') || 'Remove'}
                                    >
                                      <Icon name="x" size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Dropdown helper to quickly insert field */}
                      {unplacedFields.length > 0 && (
                        <div className="mt-3 text-end">
                          <div className="dropdown d-inline-block">
                            <button
                              className="btn btn-sm btn-outline-primary dropdown-toggle rounded-pill"
                              type="button"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              + {t('add_field_here') || 'Add Field'}
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end shadow-premium border-theme-accent bg-surface glass p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {unplacedFields.map(f => (
                                <li key={f.id}>
                                  <button
                                    type="button"
                                    className="dropdown-item fw-medium py-2 rounded text-foreground hover-bg-surface hover-text-primary"
                                    onClick={() => addFieldToSection(activeTab.id, section.id, f.name)}
                                  >
                                    {f.label} ({f.name})
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="glass-card p-5 text-center text-muted" style={{ borderRadius: '20px' }}>
                <p className="mb-0">{t('create_first_tab_desc') || 'Create a tab at the top to start building form layout grid!'}</p>
              </div>
            )}
          </div>

          {/* Unplaced Fields Sidebar Panel */}
          <div className="col-lg-4">
            <div className="glass-card p-4 border-0 mb-4 sticky-top shadow-premium" style={{ top: '80px', borderRadius: '20px' }}>
              <h5 className="fw-800 text-uppercase tracking-wider text-muted small border-bottom pb-2 mb-3 d-flex justify-content-between align-items-center">
                <span>{t('unplaced_fields') || 'Unplaced Fields'}</span>
                <span className="badge bg-primary rounded-pill">{unplacedFields.length}</span>
              </h5>
              
              {unplacedFields.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  <Icon name="check" size={24} className="text-success mb-2" />
                  <p className="mb-0">{t('all_fields_placed') || 'All fields are placed in the layout!'}</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: '4px' }}>
                  {unplacedFields.map(f => (
                    <div
                      key={f.id}
                      className="p-3 rounded bg-surface bg-opacity-30 border shadow-sm hover-lift d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <div className="fw-bold text-foreground small">{f.label}</div>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                          {f.name} • <span className="text-primary">{f.type}</span>
                        </div>
                      </div>

                      {/* Placement Quick Action buttons */}
                      {activeTab && activeTab.sections && activeTab.sections.length > 0 && (
                        <div className="dropdown">
                          <button
                            type="button"
                            className="btn btn-sm btn-blur bg-surface border-0 shadow-sm p-1 rounded-circle"
                            data-bs-toggle="dropdown"
                            title={t('place_field') || 'Place Field'}
                          >
                            <Icon name="plus" size={16} className="text-primary" />
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end shadow-premium border-theme-accent bg-surface glass p-2">
                            <li className="dropdown-header small text-muted text-uppercase tracking-wider fw-bold">
                              {t('select_section') || 'Select Section'}
                            </li>
                            {activeTab.sections.map(sec => (
                              <li key={sec.id}>
                                <button
                                  type="button"
                                  className="dropdown-item py-2 rounded text-foreground hover-bg-surface hover-text-primary"
                                  onClick={() => addFieldToSection(activeTab.id, sec.id, f.name)}
                                >
                                  {sec.title}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Visibility Rules Panel */
        <div className="glass-card p-4 border-0 mb-4 shadow-premium fade-in" style={{ borderRadius: '20px' }}>
          <div className="d-flex justify-content-between align-items-center border-bottom border-theme-accent pb-3 mb-4">
            <div>
              <h5 className="fw-bold text-foreground mb-1">
                {t('ui_visibility_rules') || 'UI Visibility Rules'}
              </h5>
              <p className="text-muted small mb-0">
                {t('visibility_rules_desc') || 'Define client-side logical rules to dynamically show/hide fields based on other field inputs.'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary px-3 shadow-premium hover-lift fw-bold"
              onClick={addVisibilityRule}
            >
              + {t('add_new_rule') || 'Add Rule'}
            </button>
          </div>

          {visibilityRules.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Icon name="settings" size={32} className="text-primary opacity-50 mb-2" />
              <p className="mb-0">{t('no_rules_defined') || 'No visibility rules established yet. Click "Add Rule" to configure.'}</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {visibilityRules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="p-3 rounded bg-surface bg-opacity-20 border border-theme-accent d-flex flex-column gap-3 shadow-sm hover-shadow-premium transition-all"
                >
                  <div className="d-flex justify-content-between align-items-center border-bottom border-theme-accent border-opacity-50 pb-2">
                    <span className="badge bg-surface bg-opacity-50 text-primary fw-bold">
                      {t('rule') || 'Rule'} #{idx + 1}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger border-0 p-1"
                      onClick={() => deleteRule(rule.id)}
                      title={t('delete') || 'Delete'}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>

                  <div className="row g-3 align-items-center">
                    {/* Source Field */}
                    <div className="col-md-3 col-12">
                      <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">{t('if') || 'IF'}</label>
                      <select
                        className="form-select border-theme-accent"
                        value={rule.sourceField}
                        onChange={(e) => updateRule(rule.id, 'sourceField', e.target.value)}
                      >
                        <option value="">{t('select_field') || 'Select Field'}</option>
                        {fields.map(f => (
                          <option key={f.id} value={f.name}>{f.label} ({f.name})</option>
                        ))}
                      </select>
                    </div>

                    {/* Operator */}
                    <div className="col-md-2 col-12">
                      <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">{t('operator') || 'Operator'}</label>
                      <select
                        className="form-select border-theme-accent"
                        value={rule.operator}
                        onChange={(e) => updateRule(rule.id, 'operator', e.target.value)}
                      >
                        <option value="eq">{t('equals') || 'Equals'}</option>
                        <option value="neq">{t('not_equals') || 'Not Equals'}</option>
                        <option value="contains">{t('contains') || 'Contains'}</option>
                        <option value="gt">{t('greater_than') || 'Greater Than'}</option>
                        <option value="lt">{t('less_than') || 'Less Than'}</option>
                      </select>
                    </div>

                    {/* Comparison Value */}
                    <div className="col-md-2 col-12">
                      <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">{t('value') || 'Value'}</label>
                      <input
                        type="text"
                        className="form-control border-theme-accent"
                        placeholder="Passive, 100, etc."
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                      />
                    </div>

                    {/* Action */}
                    <div className="col-md-2 col-12">
                      <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">{t('then') || 'THEN'}</label>
                      <select
                        className="form-select border-theme-accent"
                        value={rule.action}
                        onChange={(e) => updateRule(rule.id, 'action', e.target.value)}
                      >
                        <option value="show">{t('show_field') || 'Show'}</option>
                        <option value="hide">{t('hide_field') || 'Hide'}</option>
                      </select>
                    </div>

                    {/* Target Field */}
                    <div className="col-md-3 col-12">
                      <label className="form-label small fw-bold text-muted text-uppercase tracking-wider">{t('target_field') || 'Target Field'}</label>
                      <select
                        className="form-select border-theme-accent"
                        value={rule.targetField}
                        onChange={(e) => updateRule(rule.id, 'targetField', e.target.value)}
                      >
                        <option value="">{t('select_field') || 'Select Field'}</option>
                        {fields.filter(f => f.name !== rule.sourceField).map(f => (
                          <option key={f.id} value={f.name}>{f.label} ({f.name})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ModuleLayoutPage;
