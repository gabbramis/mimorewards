"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export function isPlanFree(plan?: string | null): boolean {
    if (!plan) return true;
    const p = String(plan).trim().toUpperCase();
    return p === "FREE" || p === "INICIAL" || p === "GRATIS";
}

export interface BusinessContextType {
    businessName: string;
    setBusinessName: (name: string) => void;
    logoUrl: string | null;
    setLogoUrl: (url: string | null) => void;
    primaryColor: string | null;
    setPrimaryColor: (color: string | null) => void;
    plan: string;
    planType: string;
    setPlanType: (plan: string) => void;
    isFreePlan: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

interface BusinessProviderProps {
    children: ReactNode;
    initialName?: string;
    initialLogo?: string | null;
    initialPrimaryColor?: string | null;
    initialPlanType?: string | null;
}

export function BusinessProvider({
    children,
    initialName = "",
    initialLogo = null,
    initialPrimaryColor = null,
    initialPlanType = "inicial"
}: BusinessProviderProps) {
    const [businessName, setBusinessName] = useState(initialName);
    const [logoUrl, setLogoUrl] = useState(initialLogo);
    const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
    const [planType, setPlanType] = useState(initialPlanType || "inicial");

    const isFreePlan = isPlanFree(planType);

    return (
        <BusinessContext.Provider
            value={{
                businessName,
                setBusinessName,
                logoUrl,
                setLogoUrl,
                primaryColor,
                setPrimaryColor,
                plan: planType,
                planType,
                setPlanType,
                isFreePlan,
            }}
        >
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
            setPrimaryColor: () => { },
            plan: "inicial",
            planType: "inicial",
            setPlanType: () => { },
            isFreePlan: true,
        };
    }
    return context;
}

