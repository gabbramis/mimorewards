"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface BusinessContextType {
    businessName: string;
    setBusinessName: (name: string) => void;
    logoUrl: string | null;
    setLogoUrl: (url: string | null) => void;
    primaryColor: string | null;
    setPrimaryColor: (color: string | null) => void;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

interface BusinessProviderProps {
    children: ReactNode;
    initialName?: string;
    initialLogo?: string | null;
    initialPrimaryColor?: string | null;
}

export function BusinessProvider({ children, initialName = "", initialLogo = null, initialPrimaryColor = null }: BusinessProviderProps) {
    const [businessName, setBusinessName] = useState(initialName);
    const [logoUrl, setLogoUrl] = useState(initialLogo);
    const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);

    return (
        <BusinessContext.Provider value={{ businessName, setBusinessName, logoUrl, setLogoUrl, primaryColor, setPrimaryColor }}>
            {children}
        </BusinessContext.Provider>
    );
}

export function useBusiness() {
    const context = useContext(BusinessContext);
    if (context === undefined) {
        // En entornos donde no hay provider (ej. el admin interno), podemos devolver valores por defecto
        return {
            businessName: "",
            setBusinessName: () => { },
            logoUrl: null,
            setLogoUrl: () => { },
            primaryColor: null,
            setPrimaryColor: () => { }
        };
    }
    return context;
}
