import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { candidateApi } from '@/lib/api';

interface DataContextType {
    candidates: any[];
    isPending: boolean;
    isFetching: boolean;
    refetch: () => void;
    updateLocalCache: (data: any[]) => void;
    realTimeEnabled: boolean;
    toggleRealTime: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const GlobalDataProvider = ({ children }: { children: React.ReactNode }) => {
    const [cachedData, setCachedData] = useState<any[]>(() => {
        try {
            const saved = localStorage.getItem("codekarx_candidates_cache");
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [realTimeEnabled, setRealTimeEnabled] = useState(() => {
        try {
            return localStorage.getItem("codekarx_real_time") === "true";
        } catch (e) {
            return false;
        }
    });

    const toggleRealTime = () => {
        const newValue = !realTimeEnabled;
        setRealTimeEnabled(newValue);
        localStorage.setItem("codekarx_real_time", String(newValue));
    };

    const { data: candidates, isPending, isFetching, refetch } = useQuery({
        queryKey: ["applications"],
        queryFn: async () => {
            const data = await candidateApi.getAllApplications();
            localStorage.setItem("codekarx_candidates_cache", JSON.stringify(data));
            setCachedData(data);
            return data;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        initialData: cachedData.length > 0 ? cachedData : undefined,
        refetchInterval: realTimeEnabled ? 10000 : 0, // Poll every 10 seconds if enabled
        refetchIntervalInBackground: true,
    });

    // Derived state to ensure we always have SOMETHING to show if it ever existed
    const displayCandidates = useMemo(() => {
        return candidates || cachedData;
    }, [candidates, cachedData]);

    const updateLocalCache = (newData: any[]) => {
        setCachedData(newData);
        localStorage.setItem("codekarx_candidates_cache", JSON.stringify(newData));
    };

    const value = useMemo(() => ({
        candidates: displayCandidates,
        isPending: isPending && displayCandidates.length === 0, // Only pending if NO data at all
        isFetching,
        refetch,
        updateLocalCache,
        realTimeEnabled,
        toggleRealTime
    }), [displayCandidates, isPending, isFetching, refetch, realTimeEnabled]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useGlobalData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useGlobalData must be used within a GlobalDataProvider');
    }
    return context;
};
