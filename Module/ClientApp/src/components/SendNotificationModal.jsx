import React, { useState, useEffect } from 'react';
import { getUsers, getRoles } from '../services/api';
import notificationService from '../services/notificationService';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

const SendNotificationModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('0'); // 0: Info, 1: Success, 2: Warning, 3: Error
  const [actionUrl, setActionUrl] = useState('');
  const [targetType, setTargetType] = useState('All'); // All, Users, Roles
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  
  const showToast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const usersData = await getUsers();
      setUsers(usersData.data || usersData);
      
      const rolesData = await getRoles();
      setRoles(rolesData.data || rolesData);
    } catch (error) {
      console.error('Failed to fetch users/roles:', error);
      showToast(t('failed_to_fetch_data'), 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !message) {
      showToast(t('title_and_message_required'), 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        message,
        type: parseInt(type),
        actionUrl: actionUrl || null,
        targetType,
        userIds: targetType === 'Users' ? selectedUserIds : null,
        roleIds: targetType === 'Roles' ? selectedRoleIds : null
      };

      await notificationService.sendNotification(payload);
      showToast(t('notification_sent_success'), 'success');
      onClose();
      // Reset form
      setTitle('');
      setMessage('');
      setTargetType('All');
      setSelectedUserIds([]);
      setSelectedRoleIds([]);
    } catch (error) {
      console.error('Failed to send notification:', error);
      showToast(t('notification_send_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-content notification-send-modal glass-panel">
        <div className="custom-modal-header">
          <div className="d-flex align-items-center gap-2">
            <Icon name="bell" size={20} color="#3b82f6" />
            <h5 className="m-0">{t('send_notification')}</h5>
          </div>
          <button className="close-btn" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="custom-modal-body">
          <div className="form-group mb-3">
            <label className="form-label">{t('title')}</label>
            <input
              type="text"
              className="form-control custom-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('notification_title_placeholder')}
              required
            />
          </div>

          <div className="form-group mb-3">
            <label className="form-label">{t('message')}</label>
            <textarea
              className="form-control custom-input"
              rows="3"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('notification_message_placeholder')}
              required
            ></textarea>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">{t('type')}</label>
              <select 
                className="form-select custom-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="0">{t('info')}</option>
                <option value="1">{t('success')}</option>
                <option value="2">{t('warning')}</option>
                <option value="3">{t('error')}</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">{t('action_url')}</label>
              <input
                type="text"
                className="form-control custom-input"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/records/123"
              />
            </div>
          </div>

          <div className="target-selection mb-3">
            <label className="form-label d-block mb-2">{t('target')}</label>
            <div className="target-type-chips">
              <button
                type="button"
                className={`target-chip ${targetType === 'All' ? 'active' : ''}`}
                onClick={() => setTargetType('All')}
              >
                <Icon name="globe" size={16} />
                <span>{t('all_users')}</span>
              </button>
              <button
                type="button"
                className={`target-chip ${targetType === 'Users' ? 'active' : ''}`}
                onClick={() => setTargetType('Users')}
              >
                <Icon name="users" size={16} />
                <span>{t('users')}</span>
              </button>
              <button
                type="button"
                className={`target-chip ${targetType === 'Roles' ? 'active' : ''}`}
                onClick={() => setTargetType('Roles')}
              >
                <Icon name="fields" size={16} />
                <span>{t('roles')}</span>
              </button>
            </div>
          </div>

          {targetType === 'Users' && (
            <div className="selection-list-wrapper mb-3 animate-fade-in">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label small text-muted m-0">{t('select_users')}</label>
                <span className="small text-primary fw-bold">{selectedUserIds.length} {t('selected')}</span>
              </div>
              
              <div className="selection-search-container mb-2">
                <Icon name="search" size={14} className="search-icon" />
                <input 
                  type="text" 
                  className="selection-search-input" 
                  placeholder={t('search_users')}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                {userSearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setUserSearch('')}>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>

              <div className="selection-list custom-scrollbar">
                {users.filter(u => 
                  u.username?.toLowerCase().includes(userSearch.toLowerCase()) || 
                  u.email?.toLowerCase().includes(userSearch.toLowerCase())
                ).map(u => (
                  <label key={u.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                        else setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                      }}
                    />
                    <div className="ms-2 d-flex flex-column">
                      <span className="username">{u.username}</span>
                      {u.email && <span className="email small text-muted">{u.email}</span>}
                    </div>
                  </label>
                ))}
                {users.length > 0 && users.filter(u => 
                  u.username?.toLowerCase().includes(userSearch.toLowerCase()) || 
                  u.email?.toLowerCase().includes(userSearch.toLowerCase())
                ).length === 0 && (
                  <div className="text-center py-3 text-muted small">
                    {t('no_results_found')}
                  </div>
                )}
              </div>
            </div>
          )}

          {targetType === 'Roles' && (
            <div className="selection-list-wrapper mb-3 animate-fade-in">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label small text-muted m-0">{t('select_roles')}</label>
                <span className="small text-primary fw-bold">{selectedRoleIds.length} {t('selected')}</span>
              </div>

              <div className="selection-search-container mb-2">
                <Icon name="search" size={14} className="search-icon" />
                <input 
                  type="text" 
                  className="selection-search-input" 
                  placeholder={t('search_roles')}
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                />
                {roleSearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setRoleSearch('')}>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>

              <div className="selection-list custom-scrollbar">
                {roles.filter(r => 
                  r.name?.toLowerCase().includes(roleSearch.toLowerCase())
                ).map(r => (
                  <label key={r.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRoleIds([...selectedRoleIds, r.id]);
                        else setSelectedRoleIds(selectedRoleIds.filter(id => id !== r.id));
                      }}
                    />
                    <span className="ms-2">{r.name}</span>
                  </label>
                ))}
                {roles.length > 0 && roles.filter(r => 
                  r.name?.toLowerCase().includes(roleSearch.toLowerCase())
                ).length === 0 && (
                  <div className="text-center py-3 text-muted small">
                    {t('no_results_found')}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        <div className="custom-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </button>
          <button 
            className="btn btn-primary d-flex align-items-center gap-2" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : (
              <Icon name="check" size={16} />
            )}
            {t('send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendNotificationModal;
