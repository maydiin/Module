import { createContext, useContext, useState, useEffect } from 'react';

const TenantContext = createContext();

export function TenantProvider({ children }) {
    const [selectedTenantId, setSelectedTenantId] = useState(() => {
        return localStorage.getItem('selectedTenantId') || null;
    });

    const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';

    useEffect(() => {
        if (selectedTenantId) {
            localStorage.setItem('selectedTenantId', selectedTenantId);
        } else {
            localStorage.removeItem('selectedTenantId');
        }
    }, [selectedTenantId]);

    return (
        <TenantContext.Provider value={{ selectedTenantId, setSelectedTenantId, isSuperAdmin }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
}

export default TenantContext;
