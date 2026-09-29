import { useState } from 'react';

const STORAGE_KEY = 'queryFavorites';
const MAX_FAVORITES = 100;

function loadFavorites() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to load query favorites:', error);
        return [];
    }
}

/**
 * Named, saved DQL queries — the "Favorites" panel beside History. Same
 * localStorage shape and best-effort error handling as {@link useQueryHistory},
 * but keyed by a user-given name and never deduped by query text.
 */
const useQueryFavorites = () => {
    const [favorites, setFavorites] = useState(loadFavorites);

    const saveToStorage = (next) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
            console.error('Failed to save query favorites:', error);
        }
    };

    // Save the current query under a name (new entry every time)
    const addFavorite = (name, query) => {
        const trimmedName = (name || '').trim();
        const trimmedQuery = (query || '').trim();
        if (!trimmedName || !trimmedQuery) return;

        setFavorites((prev) => {
            const entry = {
                id: Date.now(),
                name: trimmedName,
                query: trimmedQuery,
                savedAt: Date.now(),
            };
            const next = [entry, ...prev].slice(0, MAX_FAVORITES);
            saveToStorage(next);
            return next;
        });
    };

    const removeFavorite = (id) => {
        setFavorites((prev) => {
            const next = prev.filter((item) => item.id !== id);
            saveToStorage(next);
            return next;
        });
    };

    const renameFavorite = (id, name) => {
        const trimmedName = (name || '').trim();
        if (!trimmedName) return;
        setFavorites((prev) => {
            const next = prev.map((item) =>
                item.id === id ? { ...item, name: trimmedName } : item,
            );
            saveToStorage(next);
            return next;
        });
    };

    return { favorites, addFavorite, removeFavorite, renameFavorite };
};

export default useQueryFavorites;
