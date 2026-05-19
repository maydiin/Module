import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { 
    Controls, 
    Background, 
    Handle, 
    Position, 
    useNodesState, 
    useEdgesState, 
    addEdge 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

// Custom Trigger Node
const TriggerNode = ({ data }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-success border-opacity-30 text-center" style={{ minWidth: '180px' }}>
            <div className="badge bg-success bg-opacity-20 text-success px-3 py-1 rounded-pill mb-2 fw-extrabold text-uppercase small">
                {t('node_trigger') || 'TETİKLEYİCİ'}
            </div>
            <div className="fw-bold text-foreground opacity-90">{data.triggerType}</div>
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--primary))', width: '10px', height: '10px' }} />
        </div>
    );
};

// Custom Log Node
const LogNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-info border-opacity-30" style={{ minWidth: '220px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-info bg-opacity-20 text-info px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_log') || 'LOG YAZ'}
                </div>
                <Icon name="terminal" size={14} className="text-info" />
            </div>
            <input 
                type="text" 
                className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1 mt-1" 
                value={data.message || ''} 
                onChange={(e) => data.onChange(id, 'message', e.target.value)}
                placeholder={t('node_log_placeholder') || "Log mesajı (örn: {{Data.Name}})"}
                style={{ fontSize: '0.8rem', borderRadius: '8px' }}
            />
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--primary))' }} />
        </div>
    );
};

// Custom Fail Node
const FailNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-danger border-opacity-30" style={{ minWidth: '220px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-danger bg-opacity-20 text-danger px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_validation_fail') || 'HATA FIRLAT'}
                </div>
                <Icon name="x" size={14} className="text-danger" />
            </div>
            <input 
                type="text" 
                className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1 mt-1" 
                value={data.message || ''} 
                onChange={(e) => data.onChange(id, 'message', e.target.value)}
                placeholder={t('node_fail_placeholder') || "Hata mesajı (örn: Fiyat geçersiz)"}
                style={{ fontSize: '0.8rem', borderRadius: '8px' }}
            />
            {/* Fail halts script, no source handle needed */}
        </div>
    );
};

// Custom Condition Node
const ConditionNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-warning border-opacity-30" style={{ minWidth: '240px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-warning bg-opacity-20 text-warning px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_condition') || 'KOŞUL (IF)'}
                </div>
                <Icon name="settings" size={14} className="text-warning" />
            </div>
            <input 
                type="text" 
                className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1 mt-1" 
                value={data.expression || ''} 
                onChange={(e) => data.onChange(id, 'expression', e.target.value)}
                placeholder={t('node_condition_placeholder') || "Koşul ifadesi (örn: Data.Fiyat < 0)"}
                style={{ fontSize: '0.8rem', borderRadius: '8px' }}
            />
            <div className="d-flex justify-content-between mt-3 text-muted small px-1">
                <span>{t('true_label') || 'DOĞRU (True)'}</span>
                <span>{t('false_label') || 'YANLIŞ (False)'}</span>
            </div>
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="true" 
                style={{ left: '25%', background: '#198754', width: '10px', height: '10px' }} 
            />
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="false" 
                style={{ left: '75%', background: '#dc3545', width: '10px', height: '10px' }} 
            />
        </div>
    );
};

// Custom DB Find Node
const DbFindNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-primary border-opacity-30" style={{ minWidth: '260px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-primary bg-opacity-20 text-primary px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_db_find') || 'KAYIT BUL (DB)'}
                </div>
                <Icon name="edit" size={14} className="text-primary" />
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1" 
                    value={data.moduleName || ''} 
                    onChange={(e) => data.onChange(id, 'moduleName', e.target.value)}
                    placeholder={t('node_db_module_placeholder') || "Modül Adı (örn: Personel)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                    value={data.recordIdExpression || ''} 
                    onChange={(e) => data.onChange(id, 'recordIdExpression', e.target.value)}
                    placeholder={t('node_db_id_placeholder') || "Kayıt ID ifadesi (örn: Data.Id)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                    value={data.outputVar || ''} 
                    onChange={(e) => data.onChange(id, 'outputVar', e.target.value)}
                    placeholder={t('node_db_var_placeholder') || "Değişken Adı (örn: kayit)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--primary))' }} />
        </div>
    );
};

// Custom DB Update Node
const DbUpdateNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-primary border-opacity-30" style={{ minWidth: '260px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-primary bg-opacity-20 text-primary px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_db_update') || 'KAYIT GÜNCELLE'}
                </div>
                <Icon name="check" size={14} className="text-primary" />
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1" 
                    value={data.moduleName || ''} 
                    onChange={(e) => data.onChange(id, 'moduleName', e.target.value)}
                    placeholder={t('node_db_module_placeholder') || "Modül Adı (örn: Personel)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                    value={data.recordIdExpression || ''} 
                    onChange={(e) => data.onChange(id, 'recordIdExpression', e.target.value)}
                    placeholder={t('node_db_id_placeholder') || "Kayıt ID ifadesi (örn: Data.Id)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
                <textarea 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                    value={data.updateDataExpression || ''} 
                    onChange={(e) => data.onChange(id, 'updateDataExpression', e.target.value)}
                    placeholder={t('node_db_update_placeholder') || "Güncellenecek JSON (örn: { Aktif: false })"}
                    rows={2}
                    style={{ fontSize: '0.8rem', borderRadius: '8px', resize: 'none' }}
                />
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--primary))' }} />
        </div>
    );
};

// Custom API Node
const ApiNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-secondary border-opacity-30" style={{ minWidth: '260px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-secondary bg-opacity-20 text-secondary px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_api_action') || 'API ÇAĞRISI'}
                </div>
                <Icon name="arrowLeft" size={14} className="text-secondary" style={{ transform: 'rotate(180deg)' }} />
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1" 
                    value={data.apiConfigName || ''} 
                    onChange={(e) => data.onChange(id, 'apiConfigName', e.target.value)}
                    placeholder={t('node_api_config_placeholder') || "API Config Adı (örn: SmsGonder)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
                <textarea 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                    value={data.parametersExpression || ''} 
                    onChange={(e) => data.onChange(id, 'parametersExpression', e.target.value)}
                    placeholder={t('node_api_param_placeholder') || "Parametre JSON (örn: { Telefon: Data.Tel })"}
                    rows={2}
                    style={{ fontSize: '0.8rem', borderRadius: '8px', resize: 'none' }}
                />
                <input 
                    type="text" 
                    className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                    value={data.outputVar || ''} 
                    onChange={(e) => data.onChange(id, 'outputVar', e.target.value)}
                    placeholder={t('node_api_out_placeholder') || "Çıktı Değişkeni (örn: apiResult)"}
                    style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                />
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--primary))' }} />
        </div>
    );
};

// Custom Code Block Node
const CodeBlockNode = ({ data, id }) => {
    const { t } = useTranslation();
    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-info border-opacity-30" style={{ minWidth: '300px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--primary))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-info bg-opacity-20 text-info px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_code_block') || 'ÖZEL JS KODU'}
                </div>
                <Icon name="terminal" size={14} className="text-info" />
            </div>
            <textarea 
                className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small p-2 mt-1" 
                value={data.code || ''} 
                onChange={(e) => data.onChange(id, 'code', e.target.value)}
                placeholder={t('js_code_placeholder') || "// JavaScript kodunuz..."}
                rows={4}
                style={{ fontSize: '0.75rem', borderRadius: '8px', resize: 'vertical' }}
            />
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--primary))' }} />
        </div>
    );
};

// Custom Approval Node
const ApprovalNode = ({ data, id }) => {
    const { t } = useTranslation();
    const showEscalateRole = data.escalationAction === 'Escalate';

    return (
        <div className="glass shadow-premium p-3 rounded-4 border border-warning border-opacity-50" style={{ minWidth: '280px' }}>
            <Handle type="target" position={Position.Top} style={{ background: 'hsl(var(--warning))' }} />
            <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="badge bg-warning bg-opacity-20 text-warning px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.65rem' }}>
                    {t('node_approval') || 'ONAY İSTASYONU'}
                </div>
                <Icon name="check" size={14} className="text-warning" />
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
                <div className="d-flex flex-column">
                    <label className="text-muted small mb-1" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{t('approval_role') || 'Onaylayacak Rol'}</label>
                    <input 
                        type="text" 
                        className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1" 
                        value={data.roleName || ''} 
                        onChange={(e) => data.onChange(id, 'roleName', e.target.value)}
                        placeholder={t('node_approval_role_placeholder') || "Onaylayacak Rol (örn: Admin)"}
                        style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                    />
                </div>
                
                <div className="d-flex flex-column">
                    <label className="text-muted small mb-1" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{t('approval_message') || 'Onay Mesajı'}</label>
                    <textarea 
                        className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light font-monospace small px-2 py-1" 
                        value={data.message || ''} 
                        onChange={(e) => data.onChange(id, 'message', e.target.value)}
                        placeholder={t('node_approval_msg_placeholder') || "Onay Mesajı (örn: İzin talebi)"}
                        rows={2}
                        style={{ fontSize: '0.8rem', borderRadius: '8px', resize: 'none' }}
                    />
                </div>

                <div className="d-flex gap-2">
                    <div className="d-flex flex-column flex-fill">
                        <label className="text-muted small mb-1" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{t('timeout_hours') || 'Süre (Saat)'}</label>
                        <input 
                            type="number" 
                            className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1" 
                            value={data.timeoutHours || ''} 
                            onChange={(e) => data.onChange(id, 'timeoutHours', e.target.value)}
                            placeholder={t('none') || "Yok"}
                            style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                            min={0}
                        />
                    </div>

                    <div className="d-flex flex-column flex-fill">
                        <label className="text-muted small mb-1" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{t('escalation') || 'Eskalasyon'}</label>
                        <select 
                            className="form-select form-select-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1"
                            value={data.escalationAction || ''}
                            onChange={(e) => data.onChange(id, 'escalationAction', e.target.value)}
                            style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                            <option value="">{t('none') || 'Yok'}</option>
                            <option value="Escalate">{t('escalate_role') || 'Üst Role Ata'}</option>
                            <option value="AutoReject">{t('auto_reject') || 'Otomatik Reddet'}</option>
                            <option value="AutoApprove">{t('auto_approve') || 'Otomatik Onayla'}</option>
                        </select>
                    </div>
                </div>

                {showEscalateRole && (
                    <div className="d-flex flex-column mt-1">
                        <label className="text-muted small mb-1" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{t('escalate_to_role') || 'Eskale Edilecek Rol'}</label>
                        <input 
                            type="text" 
                            className="form-control form-control-sm border-secondary border-opacity-20 bg-dark text-light small px-2 py-1" 
                            value={data.escalateToRole || ''} 
                            onChange={(e) => data.onChange(id, 'escalateToRole', e.target.value)}
                            placeholder="örn: CFO"
                            style={{ fontSize: '0.8rem', borderRadius: '8px' }}
                        />
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: 'hsl(var(--warning))' }} />
        </div>
    );
};

const nodeTypes = {
    trigger: TriggerNode,
    log: LogNode,
    fail: FailNode,
    condition: ConditionNode,
    dbFind: DbFindNode,
    dbUpdate: DbUpdateNode,
    api: ApiNode,
    codeBlock: CodeBlockNode,
    approval: ApprovalNode
};

const VisualWorkflowBuilder = ({ triggerType, value, onChange }) => {
    const { t } = useTranslation();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Populate flow from saved value or initialize with Trigger Node
    useEffect(() => {
        if (value) {
            try {
                const parsed = JSON.parse(value);
                if (parsed.nodes && parsed.edges) {
                    // Inject onChange callback into node data and sync triggerType
                    const nodesWithCallback = parsed.nodes.map(node => {
                        if (node.type === 'trigger') {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    triggerType: triggerType,
                                    onChange: handleNodeDataChange
                                }
                            };
                        }
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                onChange: handleNodeDataChange
                            }
                        };
                    });
                    setNodes(nodesWithCallback);
                    setEdges(parsed.edges);
                    return;
                }
            } catch (e) {
                console.error("Failed to parse visual flow layout, resetting", e);
            }
        }

        // Initialize with default trigger node
        const defaultNodes = [
            {
                id: 'trigger-1',
                type: 'trigger',
                position: { x: 250, y: 50 },
                data: { 
                    triggerType: triggerType,
                    onChange: handleNodeDataChange
                }
            }
        ];
        setNodes(defaultNodes);
        setEdges([]);
    }, [triggerType, value]);

    // Handle node field inputs
    const handleNodeDataChange = useCallback((nodeId, field, val) => {
        setNodes((nds) => 
            nds.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            [field]: val
                        }
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Save to outer form state on nodes/edges change
    useEffect(() => {
        if (nodes.length > 0) {
            // Strip onChange function before stringifying to avoid circular or serialization error
            const cleanNodes = nodes.map(({ data, ...node }) => {
                const { onChange, ...cleanData } = data;
                return {
                    ...node,
                    data: cleanData
                };
            });
            const flowState = JSON.stringify({ nodes: cleanNodes, edges });
            onChange(flowState, nodes, edges);
        }
    }, [nodes, edges]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } }, eds)),
        [setEdges]
    );

    // Add new node helper
    const addNode = (type) => {
        const id = `${type}-${Date.now()}`;
        const newNode = {
            id,
            type,
            position: { x: 250, y: nodes[nodes.length - 1]?.position?.y + 150 || 200 },
            data: { 
                onChange: handleNodeDataChange 
            }
        };

        if (type === 'trigger') {
            newNode.data.triggerType = triggerType;
        }

        setNodes((nds) => nds.concat(newNode));
    };

    // Remove node
    const removeNode = (nodeId) => {
        if (nodeId === 'trigger-1') return; // Cannot delete initial trigger
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    };

    return (
        <div className="row g-0 rounded-4 overflow-hidden border border-secondary border-opacity-10 shadow-lg" style={{ height: '550px' }}>
            {/* Sidebar Toolbox */}
            <div className="col-md-3 bg-dark bg-opacity-40 p-4 border-end border-secondary border-opacity-10 d-flex flex-column gap-3 overflow-y-auto" style={{ backdropFilter: 'blur(10px)' }}>
                <h6 className="small fw-bold text-uppercase tracking-wider text-muted mb-2">
                    {t('workflow_nodes') || 'AKIŞ DÜĞÜMLERİ'}
                </h6>
                
                <button 
                    type="button"
                    onClick={() => addNode('log')} 
                    className="btn btn-blur bg-info bg-opacity-10 text-info border-info border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="terminal" size={16} />
                    <span className="small">{t('node_log') || 'Log Yaz'}</span>
                </button>

                <button 
                    type="button"
                    onClick={() => addNode('fail')} 
                    className="btn btn-blur bg-danger bg-opacity-10 text-danger border-danger border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="x" size={16} />
                    <span className="small">{t('node_validation_fail') || 'Hata Fırlat'}</span>
                </button>

                <button 
                    type="button"
                    onClick={() => addNode('condition')} 
                    className="btn btn-blur bg-warning bg-opacity-10 text-warning border-warning border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="settings" size={16} />
                    <span className="small">{t('node_condition') || 'Koşul (IF)'}</span>
                </button>

                <div className="border-top border-secondary border-opacity-10 my-1"></div>

                <button 
                    type="button"
                    onClick={() => addNode('dbFind')} 
                    className="btn btn-blur bg-primary bg-opacity-10 text-primary border-primary border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="edit" size={16} />
                    <span className="small">{t('node_db_find') || 'Kayıt Bul (DB)'}</span>
                </button>

                <button 
                    type="button"
                    onClick={() => addNode('dbUpdate')} 
                    className="btn btn-blur bg-primary bg-opacity-10 text-primary border-primary border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="check" size={16} />
                    <span className="small">{t('node_db_update') || 'Kayıt Güncelle'}</span>
                </button>

                <div className="border-top border-secondary border-opacity-10 my-1"></div>

                <button 
                    type="button"
                    onClick={() => addNode('approval')} 
                    className="btn btn-blur bg-warning bg-opacity-10 text-warning border-warning border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="check" size={16} />
                    <span className="small">{t('node_approval') || 'Onay İstasyonu'}</span>
                </button>

                <div className="border-top border-secondary border-opacity-10 my-1"></div>

                <button 
                    type="button"
                    onClick={() => addNode('api')} 
                    className="btn btn-blur bg-secondary bg-opacity-10 text-secondary border-secondary border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="arrowLeft" size={16} style={{ transform: 'rotate(180deg)' }} />
                    <span className="small">{t('node_api_action') || 'API Çağrısı'}</span>
                </button>

                <button 
                    type="button"
                    onClick={() => addNode('codeBlock')} 
                    className="btn btn-blur bg-info bg-opacity-10 text-info border-info border-opacity-20 d-flex align-items-center gap-2 justify-content-start w-100 py-2.5 rounded-3 hover-lift shadow-sm"
                >
                    <Icon name="terminal" size={16} />
                    <span className="small">{t('node_code_block') || 'Özel JS Kodu'}</span>
                </button>

                <div className="mt-auto border-top border-secondary border-opacity-10 pt-3 text-center">
                    <span className="text-muted small opacity-50 d-block mb-1">{t('node_delete_hint') || "Düğüm Silmek İçin:"}</span>
                    <div className="d-flex flex-wrap gap-1 justify-content-center">
                        {nodes.filter(n => n.id !== 'trigger-1').map(n => (
                            <button 
                                type="button"
                                key={n.id} 
                                onClick={() => removeNode(n.id)} 
                                className="btn btn-sm btn-outline-danger px-2 py-0.5 border-danger border-opacity-30 rounded-3 text-uppercase" 
                                style={{ fontSize: '0.65rem' }}
                            >
                                {n.type} ✖
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div className="col-md-9 bg-dark bg-opacity-20 position-relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    style={{ background: 'transparent' }}
                >
                    <Controls className="bg-dark bg-opacity-50 text-white rounded shadow border border-secondary border-opacity-20" />
                    <Background color="hsla(var(--primary), 0.15)" gap={16} size={1} />
                </ReactFlow>
            </div>
        </div>
    );
};

export default VisualWorkflowBuilder;
